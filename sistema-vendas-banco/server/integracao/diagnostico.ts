// =============================================================================
// Diagnóstico do produtor, para a tela de integração: testa a conexão com o
// banco do Grupo 7 e roda SÓ a verificação estrutural, sem consultar dados e
// sem gravar nada. Também lista as permissões do nosso usuário lá.
//
//   OK     conexão e view de acordo com o contrato
//   ALERTA tipo diferente ou coluna fora do contrato: a integração roda, com aviso
//   ERRO   sem conexão, sem permissão ou coluna do contrato ausente: a integração FALHA
// =============================================================================
import { VIEW } from './config.js'
import { conectarGrupo7, ehErroDeConexao, hostDoGrupo7, traduzirErroConexao } from './conexao.js'
import { compararEstrutura, type ComparacaoColuna } from './estrutura.js'

export interface DiagnosticoProdutor {
  nivel: 'OK' | 'ALERTA' | 'ERRO'
  verificado_em: Date
  conexao: { ok: boolean; mensagem: string; duracao_ms: number; destino: string }
  estrutura: { verificada: boolean; view: string; mensagem: string; colunas: ComparacaoColuna[] }
}

export async function diagnosticarProdutor(): Promise<DiagnosticoProdutor> {
  const inicio = performance.now()
  const destino = hostDoGrupo7()
  const base = { verificado_em: new Date() }

  let client
  try {
    // Uma tentativa só: o diagnóstico precisa responder rápido
    ;({ client } = await conectarGrupo7(() => {}, 1))
  } catch (err) {
    return {
      ...base,
      nivel: 'ERRO',
      conexao: { ok: false, mensagem: err instanceof Error ? err.message : String(err), duracao_ms: Math.round(performance.now() - inicio), destino },
      estrutura: { verificada: false, view: VIEW, mensagem: 'Não verificada: sem conexão com o banco do Grupo 7.', colunas: [] },
    }
  }

  const conexao = { ok: true, mensagem: `Conectado a ${destino}.`, duracao_ms: Math.round(performance.now() - inicio), destino }
  let falhou = false
  try {
    const comparacao = await compararEstrutura(client)
    if (!comparacao.existe) {
      return { ...base, nivel: 'ERRO', conexao, estrutura: { verificada: true, view: VIEW, mensagem: `A view ${VIEW} não existe.`, colunas: [] } }
    }
    if (!comparacao.podeLer) {
      return {
        ...base,
        nivel: 'ERRO',
        conexao,
        estrutura: { verificada: true, view: VIEW, mensagem: `Permissão negada: o nosso usuário não tem SELECT na view ${VIEW}.`, colunas: [] },
      }
    }

    const nomes = (situacao: ComparacaoColuna['situacao']) =>
      comparacao.colunas.filter((c) => c.situacao === situacao).map((c) => c.nome)
    const ausentes = nomes('AUSENTE')
    const tipos = nomes('TIPO_DIFERENTE')
    const extras = nomes('EXTRA')

    let nivel: DiagnosticoProdutor['nivel'] = 'OK'
    const partes: string[] = []
    if (ausentes.length > 0) {
      nivel = 'ERRO'
      partes.push(`Coluna(s) do contrato ausente(s): ${ausentes.join(', ')}. A integração vai FALHAR com ERRO_ESTRUTURAL.`)
    }
    if (tipos.length > 0) {
      if (nivel === 'OK') nivel = 'ALERTA'
      partes.push(`Tipo diferente do contrato em: ${tipos.join(', ')}. A integração roda e converte registro a registro.`)
    }
    if (extras.length > 0) {
      if (nivel === 'OK') nivel = 'ALERTA'
      partes.push(`Colunas fora do contrato (ignoradas): ${extras.join(', ')}.`)
    }
    if (partes.length === 0) partes.push(`As ${comparacao.colunas.length} colunas conferem com o contrato.`)

    return { ...base, nivel, conexao, estrutura: { verificada: true, view: VIEW, mensagem: partes.join(' '), colunas: comparacao.colunas } }
  } catch (err) {
    falhou = true
    const mensagem = ehErroDeConexao(err) ? traduzirErroConexao(err) : err instanceof Error ? err.message : String(err)
    return { ...base, nivel: 'ERRO', conexao, estrutura: { verificada: false, view: VIEW, mensagem, colunas: [] } }
  } finally {
    client.release(falhou)
  }
}

// -----------------------------------------------------------------------------
// Permissões do NOSSO usuário no banco do Grupo 7, consultadas lá
// (has_*_privilege e pg_roles), nunca escritas à mão
// -----------------------------------------------------------------------------
export interface PermissoesNoProdutor {
  usuario: string
  limite_conexoes: number | null
  configuracoes: string[]
  privilegios: { objeto: string; privilegio: string; concedido: boolean }[]
}

export async function permissoesNoProdutor(): Promise<PermissoesNoProdutor> {
  const { client } = await conectarGrupo7(() => {}, 1)
  let falhou = false
  try {
    // Tudo chega como texto neste pool ('t'/'f', números como texto)
    const papel = await client.query<{ usuario: string; limite: string; leitura: string; timeout: string }>(
      `SELECT current_user AS usuario,
              (SELECT rolconnlimit FROM pg_roles WHERE rolname = current_user) AS limite,
              current_setting('default_transaction_read_only') AS leitura,
              current_setting('statement_timeout') AS timeout`,
    )
    const verificacoes = [
      { objeto: 'banco', tipo: 'database', nome: '', privilegio: 'CONNECT' },
      { objeto: 'banco', tipo: 'database', nome: '', privilegio: 'CREATE' },
      { objeto: 'banco', tipo: 'database', nome: '', privilegio: 'TEMPORARY' },
      { objeto: 'schema integracao', tipo: 'schema', nome: 'integracao', privilegio: 'USAGE' },
      { objeto: 'schema integracao', tipo: 'schema', nome: 'integracao', privilegio: 'CREATE' },
      ...['SELECT', 'INSERT', 'UPDATE', 'DELETE'].map((privilegio) => ({ objeto: VIEW, tipo: 'table', nome: VIEW, privilegio })),
    ]
    const resultado = await client.query<{ objeto: string; privilegio: string; concedido: string }>(
      `SELECT CASE WHEN v.tipo = 'database' THEN 'banco ' || current_database() ELSE v.objeto END AS objeto,
              v.privilegio,
              CASE v.tipo
                WHEN 'database' THEN has_database_privilege(current_database(), v.privilegio)
                WHEN 'schema'   THEN has_schema_privilege(v.nome, v.privilegio)
                ELSE has_table_privilege(v.nome, v.privilegio)
              END AS concedido
         FROM unnest($1::text[], $2::text[], $3::text[], $4::text[]) WITH ORDINALITY AS v(objeto, tipo, nome, privilegio, ordem)
        ORDER BY v.ordem`,
      [verificacoes.map((v) => v.objeto), verificacoes.map((v) => v.tipo), verificacoes.map((v) => v.nome), verificacoes.map((v) => v.privilegio)],
    )
    const linha = papel.rows[0]
    const limite = Number(linha.limite)
    return {
      usuario: linha.usuario,
      limite_conexoes: limite >= 0 ? limite : null,
      configuracoes: [`default_transaction_read_only = ${linha.leitura}`, `statement_timeout = ${linha.timeout}`],
      privilegios: resultado.rows.map((r) => ({ objeto: r.objeto, privilegio: r.privilegio, concedido: r.concedido === 't' })),
    }
  } catch (err) {
    falhou = true
    throw err
  } finally {
    client.release(falhou)
  }
}
