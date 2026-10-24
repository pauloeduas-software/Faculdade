// =============================================================================
// Verificação ESTRUTURAL, antes de consultar: a view do Grupo 7 ainda é a do
// contrato? Compara information_schema.columns com COLUNAS_VIEW (config.ts).
//
//   coluna esperada ausente/renomeada → ERRO_ESTRUTURAL e a execução PARA (FALHOU)
//   tipo diferente do contrato        → ERRO_ESTRUTURAL como alerta; continua e
//                                       converte registro a registro
//   coluna extra                      → só alerta no log (é ignorada)
//
// A mesma comparação alimenta o diagnóstico da tela de integração (diagnostico.ts).
// =============================================================================
import type pg from 'pg'
import { COLUNAS_VIEW, NOME_VIEW, SCHEMA_VIEW, VIEW } from './config.js'
import { ErroFatal, ehErroDeConexao, traduzirErroConexao } from './conexao.js'
import type { ErroRegistro } from './log.js'

export type SituacaoColuna = 'OK' | 'TIPO_DIFERENTE' | 'AUSENTE' | 'EXTRA'

export interface ComparacaoColuna {
  nome: string
  esperado: string | null // tipo do contrato (null = coluna fora do contrato)
  encontrado: string | null // tipo na view (null = coluna ausente)
  situacao: SituacaoColuna
}

export interface ComparacaoEstrutura {
  existe: boolean
  podeLer: boolean
  colunas: ComparacaoColuna[]
}

export interface ResultadoEstrutura {
  colunasConferidas: number
  alertas: ErroRegistro[] // tipos diferentes: gravados em erro_integracao
  colunasExtras: string[] // fora do contrato: só aviso
}

function formatarTipo(tipo: string, tamanho: number | null | undefined): string {
  return tamanho ? `${tipo}(${tamanho})` : tipo
}

// Só compara, sem decidir nada. Neste pool tudo chega como texto (conexao.ts):
// booleanos vêm como 't'/'f'.
export async function compararEstrutura(client: pg.PoolClient): Promise<ComparacaoEstrutura> {
  // 1) A view existe e o nosso usuário pode lê-la? Sem SELECT, o
  //    information_schema simplesmente esconde as colunas, e o problema real
  //    (permissão) pareceria uma mudança de estrutura.
  const acesso = await client.query<{ existe: string; pode_ler: string }>(
    `SELECT to_regclass($1) IS NOT NULL AS existe,
            COALESCE(has_table_privilege(to_regclass($1), 'SELECT'), false) AS pode_ler`,
    [VIEW],
  )
  const existe = acesso.rows[0].existe === 't'
  const podeLer = acesso.rows[0].pode_ler === 't'
  if (!existe || !podeLer) return { existe, podeLer, colunas: [] }

  // 2) Colunas e tipos
  const resultado = await client.query<{ column_name: string; data_type: string; character_maximum_length: string | null }>(
    `SELECT column_name, data_type, character_maximum_length
       FROM information_schema.columns
      WHERE table_schema = $1 AND table_name = $2
      ORDER BY ordinal_position`,
    [SCHEMA_VIEW, NOME_VIEW],
  )
  const encontradas = new Map(
    resultado.rows.map((c) => [
      c.column_name,
      formatarTipo(c.data_type, c.character_maximum_length === null ? null : Number(c.character_maximum_length)),
    ]),
  )

  const colunas: ComparacaoColuna[] = COLUNAS_VIEW.map((coluna) => {
    const esperado = formatarTipo(coluna.tipo, 'tamanho' in coluna ? coluna.tamanho : undefined)
    const encontrado = encontradas.get(coluna.nome) ?? null
    const situacao: SituacaoColuna = encontrado === null ? 'AUSENTE' : encontrado === esperado ? 'OK' : 'TIPO_DIFERENTE'
    return { nome: coluna.nome, esperado, encontrado, situacao }
  })

  const nomesContrato = new Set<string>(COLUNAS_VIEW.map((c) => c.nome))
  for (const [nome, tipo] of encontradas) {
    if (!nomesContrato.has(nome)) colunas.push({ nome, esperado: null, encontrado: tipo, situacao: 'EXTRA' })
  }

  return { existe, podeLer, colunas }
}

export async function verificarEstrutura(client: pg.PoolClient): Promise<ResultadoEstrutura> {
  let comparacao: ComparacaoEstrutura
  try {
    comparacao = await compararEstrutura(client)
  } catch (err) {
    if (ehErroDeConexao(err)) throw new ErroFatal('ERRO_CONEXAO', traduzirErroConexao(err))
    throw err
  }

  if (!comparacao.existe) {
    throw new ErroFatal('ERRO_ESTRUTURAL', `A view ${VIEW} não existe no banco do Grupo 7. Nada foi processado.`)
  }
  if (!comparacao.podeLer) {
    throw new ErroFatal(
      'ERRO_CONEXAO',
      `Permissão negada: o nosso usuário não tem SELECT na view ${VIEW} [42501]. Nada foi processado.`,
    )
  }

  const colunasExtras = comparacao.colunas.filter((c) => c.situacao === 'EXTRA').map((c) => c.nome)
  const dica = colunasExtras.length > 0 ? ` A view tem colunas fora do contrato (${colunasExtras.join(', ')}): possível renomeação.` : ''

  const ausentes: ErroRegistro[] = comparacao.colunas
    .filter((c) => c.situacao === 'AUSENTE')
    .map((c) => ({
      registro_origem: null,
      campo: c.nome,
      tipo_erro: 'ERRO_ESTRUTURAL',
      descricao: `A coluna ${c.nome} (${c.esperado}) do contrato não existe na view.${dica}`,
      valor_recebido: null,
    }))

  if (ausentes.length > 0) {
    const nomes = ausentes.map((e) => e.campo).join(', ')
    const extras = colunasExtras.length > 0 ? ` (colunas fora do contrato: ${colunasExtras.join(', ')})` : ''
    throw new ErroFatal(
      'ERRO_ESTRUTURAL',
      `A estrutura da view mudou: coluna(s) do contrato ausente(s): ${nomes}${extras}. Nada foi processado.`,
      ausentes,
    )
  }

  const alertas: ErroRegistro[] = comparacao.colunas
    .filter((c) => c.situacao === 'TIPO_DIFERENTE')
    .map((c) => ({
      registro_origem: null,
      campo: c.nome,
      tipo_erro: 'ERRO_ESTRUTURAL',
      descricao:
        `Tipo da coluna ${c.nome} diferente do contrato: esperado ${c.esperado}, recebido ${c.encontrado}. ` +
        'A execução continua e converte registro a registro.',
      valor_recebido: c.encontrado,
    }))

  return { colunasConferidas: COLUNAS_VIEW.length, alertas, colunasExtras }
}
