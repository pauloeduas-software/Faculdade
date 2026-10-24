// =============================================================================
// Etapa 5 – PROCESSAMENTO: grava no NOSSO banco cada entrega válida.
//
// Antes do laço, UMA consulta compara todas as entregas com as já gravadas
// (compararComGravadas). As que não mudaram (ultima_alteracao igual) só são
// contadas, sem abrir transação; as mais antigas são rejeitadas. As novas e as
// alteradas são gravadas, cada uma na SUA PRÓPRIA transação:
//
//   BEGIN
//     a) SELECT ... FOR UPDATE na venda   (ninguém altera a venda até o COMMIT)
//     b) upsert em vendas.entrega pelo id_entrega_origem
//          não existe                     → INSERT     (inseridos)
//          ultima_alteracao mais nova     → UPDATE     (atualizados)
//          ultima_alteracao igual         → nada       (sem_alteracao)
//     c) efeito na venda (contrato §6): CONFIRMADA → EM_ENTREGA → ENTREGUE
//   COMMIT               a entrega e o status da venda juntos: ou os dois ou nenhum
//
// Qualquer problema num registro faz ROLLBACK só dele: o registro vira
// rejeitado, o erro é gravado FORA da transação (log.ts, outra conexão) e o
// processo segue para o próximo (processamento parcial). Como cada COMMIT é
// definitivo, uma queda no meio deixa gravado só o que terminou, e a próxima
// execução continua de onde parou sem duplicar nada (id_entrega_origem UNIQUE
// + comparação de ultima_alteracao).
// =============================================================================
import pg from 'pg'
import { pool } from '../db/pool.js'
import { AppError } from '../http/errors.js'
import type { StatusVenda } from '../modules/vendas/vendas.schema.js'
import { INTERVALO_TOTAIS, type NomeColuna, type TipoErro } from './config.js'
import { registrarErros, type ErroRegistro } from './log.js'
import { formatarDataHora, type EntregaNossa } from './transformacao.js'
import { avaliarEfeitoNaVenda } from './validacao.js'

export interface ItemProcessamento {
  registro_origem: string
  situacao: string // como veio do Grupo 7, para as mensagens
  entrega: EntregaNossa
}

export interface VendaAlterada {
  venda_id: number
  caminho: StatusVenda[] // status anterior seguido dos novos, ex.: CONFIRMADA, EM_ENTREGA, ENTREGUE
}

export interface ResultadoProcessamento {
  inseridos: number
  atualizados: number
  sem_alteracao: number
  rejeitados: number
  vendasAlteradas: VendaAlterada[]
}

type Desfecho = { tipo: 'inserido' | 'atualizado' | 'sem_alteracao'; vendaAlterada: VendaAlterada | null }

// Rejeição decidida dentro da transação: vira ROLLBACK + erro registrado
class Rejeicao extends Error {
  readonly erro: ErroRegistro

  constructor(erro: ErroRegistro) {
    super(erro.descricao)
    this.erro = erro
  }
}

// Só para a demonstração (INTEGRACAO_SIMULAR_QUEDA_APOS): o processo "cai" no
// meio, sem chegar a finalizar o log, e a execução fica EM_ANDAMENTO
export class QuedaSimulada extends AppError {
  constructor(processados: number) {
    super(
      500,
      'QUEDA_SIMULADA',
      `Queda simulada (INTEGRACAO_SIMULAR_QUEDA_APOS=${processados}) depois de ${processados} registro(s) processado(s): ` +
        'a execução ficou EM_ANDAMENTO e será marcada como FALHOU na próxima execução.',
    )
    this.name = 'QuedaSimulada'
  }
}

// Como cada entrega recebida se compara com a que já está no nosso banco
type Comparacao = { situacao: 'NOVA' | 'MAIS_NOVA' | 'IGUAL' | 'MAIS_ANTIGA'; gravada: Date | null }

// Uma consulta só para o lote inteiro, com a comparação de datas feita pelo
// PostgreSQL (microssegundos). Só a integração grava vendas.entrega, e ela roda
// uma por vez (trava de execução única em executar.ts): este retrato não muda
// durante o laço. As entregas novas e alteradas são conferidas de novo, com
// FOR UPDATE, dentro da transação de cada uma (gravarEntrega).
async function compararComGravadas(client: pg.PoolClient, itens: ItemProcessamento[]): Promise<Map<number, Comparacao>> {
  if (itens.length === 0) return new Map()
  const resultado = await client.query<Comparacao & { id: number }>(
    `SELECT x.id,
            CASE WHEN e.id_entrega_origem IS NULL THEN 'NOVA'
                 WHEN x.ultima > e.origem_atualizado_em THEN 'MAIS_NOVA'
                 WHEN x.ultima = e.origem_atualizado_em THEN 'IGUAL'
                 ELSE 'MAIS_ANTIGA'
            END AS situacao,
            e.origem_atualizado_em AS gravada
       FROM unnest($1::int[], $2::timestamptz[]) AS x(id, ultima)
       LEFT JOIN vendas.entrega e ON e.id_entrega_origem = x.id`,
    [itens.map((i) => i.entrega.id_entrega_origem), itens.map((i) => i.entrega.origem_atualizado_em)],
  )
  return new Map(resultado.rows.map(({ id, situacao, gravada }) => [id, { situacao, gravada }]))
}

function rejeicaoVoltaNoTempo(item: ItemProcessamento, gravada: Date): ErroRegistro {
  const recebida = item.entrega.origem_atualizado_em
  return {
    registro_origem: item.registro_origem,
    campo: 'ultima_alteracao',
    tipo_erro: 'REGRA_NEGOCIO',
    descricao:
      `ultima_alteracao (${formatarDataHora(Date.parse(recebida))}) é anterior à já integrada ` +
      `(${formatarDataHora(gravada)}): o registro não pode voltar no tempo.`,
    valor_recebido: recebida,
  }
}

export async function processar(
  integracaoId: number,
  itens: ItemProcessamento[],
  quedaApos: number | null,
  aoProgresso: (parcial: ResultadoProcessamento) => Promise<void>,
): Promise<ResultadoProcessamento> {
  const resultado: ResultadoProcessamento = { inseridos: 0, atualizados: 0, sem_alteracao: 0, rejeitados: 0, vendasAlteradas: [] }

  // Uma conexão para todos os registros, uma transação por registro gravado
  const client = await pool.connect()
  let conexaoQuebrada = false

  try {
    const comparacoes = await compararComGravadas(client, itens)

    for (const [indice, item] of itens.entries()) {
      if (quedaApos !== null && indice >= quedaApos) throw new QuedaSimulada(indice)
      if (indice > 0 && indice % INTERVALO_TOTAIS === 0) await aoProgresso(resultado)

      const comparacao = comparacoes.get(item.entrega.id_entrega_origem)
      if (comparacao?.situacao === 'IGUAL') {
        resultado.sem_alteracao++
        continue
      }
      if (comparacao?.situacao === 'MAIS_ANTIGA' && comparacao.gravada) {
        await registrarErros(integracaoId, [rejeicaoVoltaNoTempo(item, comparacao.gravada)])
        resultado.rejeitados++
        continue
      }

      try {
        await client.query('BEGIN')
        const desfecho = await gravarEntrega(client, item)
        await client.query('COMMIT')

        if (desfecho.tipo === 'inserido') resultado.inseridos++
        else if (desfecho.tipo === 'atualizado') resultado.atualizados++
        else resultado.sem_alteracao++
        if (desfecho.vendaAlterada) resultado.vendasAlteradas.push(desfecho.vendaAlterada)
      } catch (err) {
        try {
          await client.query('ROLLBACK')
        } catch {
          // Nem o ROLLBACK funcionou: a conexão com o NOSSO banco caiu. Não há
          // como seguir; o servidor desfaz a transação aberta sozinho.
          conexaoQuebrada = true
          throw err
        }

        const erro = err instanceof Rejeicao ? err.erro : traduzirErroBanco(err, item)
        if (!erro) throw err // não veio do banco (bug, rede): fatal

        // Fora da transação que acabou de ser desfeita
        await registrarErros(integracaoId, [erro])
        resultado.rejeitados++
      }
    }
    await aoProgresso(resultado)
  } finally {
    client.release(conexaoQuebrada)
  }

  return resultado
}

async function gravarEntrega(client: pg.PoolClient, item: ItemProcessamento): Promise<Desfecho> {
  const e = item.entrega
  const rejeitar = (tipo_erro: TipoErro, campo: NomeColuna, descricao: string, valor: string | number) =>
    new Rejeicao({ registro_origem: item.registro_origem, campo, tipo_erro, descricao, valor_recebido: String(valor) })

  // a) Trava a venda até o COMMIT: nenhuma outra transação (ex.: a API mudando
  //    o status) altera esta venda enquanto aplicamos a entrega
  const venda = await client.query<{ status: StatusVenda }>(
    'SELECT status FROM vendas.venda WHERE venda_id = $1 FOR UPDATE',
    [e.venda_id],
  )
  if (venda.rows.length === 0) {
    throw rejeitar('REGISTRO_INEXISTENTE', 'num_venda', `A venda ${e.venda_id} não existe no Sistema de Vendas.`, e.venda_id)
  }
  const statusVenda = venda.rows[0].status

  // b) A entrega já foi integrada? A comparação das datas é feita pelo
  //    PostgreSQL, na precisão de microssegundos
  const existente = await client.query<{ venda_id: number; origem_atualizado_em: Date; comparacao: 'MAIS_NOVA' | 'IGUAL' | 'MAIS_ANTIGA' }>(
    `SELECT venda_id, origem_atualizado_em,
            CASE WHEN $2::timestamptz > origem_atualizado_em THEN 'MAIS_NOVA'
                 WHEN $2::timestamptz = origem_atualizado_em THEN 'IGUAL'
                 ELSE 'MAIS_ANTIGA'
            END AS comparacao
       FROM vendas.entrega
      WHERE id_entrega_origem = $1
        FOR UPDATE`,
    [e.id_entrega_origem, e.origem_atualizado_em],
  )
  const anterior = existente.rows[0]

  if (anterior?.comparacao === 'IGUAL') return { tipo: 'sem_alteracao', vendaAlterada: null }

  if (anterior?.comparacao === 'MAIS_ANTIGA') throw new Rejeicao(rejeicaoVoltaNoTempo(item, anterior.origem_atualizado_em))
  if (anterior && anterior.venda_id !== e.venda_id) {
    throw rejeitar(
      'REGRA_NEGOCIO',
      'num_venda',
      `A entrega ${e.id_entrega_origem} já foi integrada para a venda ${anterior.venda_id} e não pode passar para a venda ${e.venda_id}.`,
      e.venda_id,
    )
  }

  // c) Efeito na venda, de novo e agora com a venda travada: o status pode ter
  //    mudado desde a validação
  const efeito = avaliarEfeitoNaVenda(e.venda_id, statusVenda, e.status_entrega, item.situacao)
  if (!efeito.ok) {
    throw rejeitar('REGRA_NEGOCIO', efeito.campo, efeito.descricao, efeito.campo === 'situacao' ? item.situacao : e.venda_id)
  }

  if (!anterior) {
    await client.query(
      `INSERT INTO vendas.entrega (venda_id, id_entrega_origem, codigo_rastreio, status_entrega, data_prevista,
                                   data_saida, data_entrega, entregador, cidade, uf, origem_atualizado_em)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [e.venda_id, e.id_entrega_origem, e.codigo_rastreio, e.status_entrega, e.data_prevista,
       e.data_saida, e.data_entrega, e.entregador, e.cidade, e.uf, e.origem_atualizado_em],
    )
  } else {
    await client.query(
      `UPDATE vendas.entrega
          SET codigo_rastreio = $2, status_entrega = $3, data_prevista = $4, data_saida = $5,
              data_entrega = $6, entregador = $7, cidade = $8, uf = $9, origem_atualizado_em = $10
        WHERE id_entrega_origem = $1`,
      [e.id_entrega_origem, e.codigo_rastreio, e.status_entrega, e.data_prevista, e.data_saida,
       e.data_entrega, e.entregador, e.cidade, e.uf, e.origem_atualizado_em],
    )
  }

  // Um UPDATE por transição: CONFIRMADA → EM_ENTREGA e depois EM_ENTREGA → ENTREGUE
  for (const novoStatus of efeito.transicoes) {
    await client.query('UPDATE vendas.venda SET status = $2 WHERE venda_id = $1', [e.venda_id, novoStatus])
  }

  return {
    tipo: anterior ? 'atualizado' : 'inserido',
    vendaAlterada: efeito.transicoes.length > 0 ? { venda_id: e.venda_id, caminho: [statusVenda, ...efeito.transicoes] } : null,
  }
}

// -----------------------------------------------------------------------------
// Erro inesperado do PostgreSQL num registro → rejeição com o erro traduzido.
// Retorna null quando o erro não veio do banco (aí é fatal para a execução).
// -----------------------------------------------------------------------------
const ERROS_POSTGRES: Record<string, { tipo: TipoErro; mensagem: string }> = {
  '23505': { tipo: 'REGISTRO_DUPLICADO', mensagem: 'registro duplicado' },
  '23503': { tipo: 'REGISTRO_INEXISTENTE', mensagem: 'referência a registro inexistente' },
  '23502': { tipo: 'CAMPO_OBRIGATORIO', mensagem: 'campo obrigatório sem valor' },
  '23514': { tipo: 'VALOR_INVALIDO', mensagem: 'valor recusado por uma regra do banco' },
  '22001': { tipo: 'VALOR_INVALIDO', mensagem: 'texto maior que o tamanho da coluna' },
  '22003': { tipo: 'TIPO_INVALIDO', mensagem: 'número fora do intervalo do tipo' },
  '22P02': { tipo: 'TIPO_INVALIDO', mensagem: 'valor com tipo inválido' },
  '22007': { tipo: 'TIPO_INVALIDO', mensagem: 'data em formato inválido' },
  '22008': { tipo: 'TIPO_INVALIDO', mensagem: 'data inexistente' },
}

// Constraints de vendas.entrega (database/07_consumo_entregas.sql)
const ERROS_CONSTRAINT: Record<string, { tipo: TipoErro; campo: string; mensagem: string }> = {
  uq_entrega_id_entrega_origem: { tipo: 'REGISTRO_DUPLICADO', campo: 'id_entrega', mensagem: 'a entrega já foi integrada' },
  fk_entrega_venda: { tipo: 'REGISTRO_INEXISTENTE', campo: 'num_venda', mensagem: 'a venda não existe no Sistema de Vendas' },
  ck_entrega_status: { tipo: 'VALOR_INVALIDO', campo: 'situacao', mensagem: 'status de entrega fora do vocabulário do Grupo 2' },
  ck_entrega_entregue_com_data: { tipo: 'REGRA_NEGOCIO', campo: 'dt_entrega', mensagem: 'entrega ENTREGUE sem data de entrega' },
  ck_entrega_datas: { tipo: 'REGRA_NEGOCIO', campo: 'dt_entrega', mensagem: 'data de entrega anterior à data de saída' },
}

function traduzirErroBanco(err: unknown, item: ItemProcessamento): ErroRegistro | null {
  if (!(err instanceof pg.DatabaseError)) return null

  const porConstraint = err.constraint ? ERROS_CONSTRAINT[err.constraint] : undefined
  const porCodigo = err.code ? ERROS_POSTGRES[err.code] : undefined
  const tipo = porConstraint?.tipo ?? porCodigo?.tipo ?? 'REGRA_NEGOCIO'
  const traducao = porConstraint?.mensagem ?? porCodigo?.mensagem ?? 'erro inesperado do banco'

  return {
    registro_origem: item.registro_origem,
    campo: porConstraint?.campo ?? err.column ?? null,
    tipo_erro: tipo,
    descricao: `Erro do banco ao gravar (SQLSTATE ${err.code}${err.constraint ? `, ${err.constraint}` : ''}): ${traducao}. ${err.message}`,
    valor_recebido: null,
  }
}
