// =============================================================================
// Etapa 6 – REGISTRO: log das execuções (integracao.integracao) e dos erros
// (integracao.erro_integracao) no NOSSO banco.
//
// Nada aqui roda dentro da transação de um registro: tudo usa o pool (outra
// conexão, autocommit). Assim o ROLLBACK de um registro nunca apaga o erro que
// explica por que ele foi rejeitado, e a linha EM_ANDAMENTO já existe no banco
// mesmo que o processo caia no meio.
// =============================================================================
import { pool } from '../db/pool.js'
import { withTransaction } from '../db/transaction.js'
import { SISTEMA_DESTINO, SISTEMA_ORIGEM, type TipoErro } from './config.js'

export type StatusExecucao = 'EM_ANDAMENTO' | 'CONCLUIDA' | 'CONCLUIDA_COM_ERROS' | 'FALHOU'

// Uma linha de integracao.erro_integracao, antes de gravada
export interface ErroRegistro {
  registro_origem: string | null // id_entrega no Grupo 7 (null = erro da execução, não de um registro)
  campo: string | null
  tipo_erro: TipoErro
  descricao: string
  valor_recebido: string | null // valor original, como veio da view
}

export interface ErroGravado extends ErroRegistro {
  erro_id: number
  data_ocorrencia: Date
}

export interface Execucao {
  integracao_id: number
  data_inicio: Date
  data_fim: Date | null
  sistema_origem: string
  sistema_destino: string
  total_registros: number
  processados: number
  inseridos: number
  atualizados: number
  sem_alteracao: number
  rejeitados: number
  status: StatusExecucao
  mensagem: string | null
}

export interface ExecucaoResumo extends Execucao {
  total_erros: number
}

export interface Totais {
  total_registros: number
  processados: number
  inseridos: number
  atualizados: number
  sem_alteracao: number
  rejeitados: number
}

export const MENSAGEM_INTERROMPIDA = 'Execução interrompida'

const COLUNAS_EXECUCAO = `integracao_id, data_inicio, data_fim, sistema_origem, sistema_destino, total_registros,
       processados, inseridos, atualizados, sem_alteracao, rejeitados, status, mensagem`

// Abre a execução numa transação própria, com COMMIT imediato. Antes disso,
// qualquer execução que ficou EM_ANDAMENTO é de um processo que caiu no meio:
// quem chama já tem a trava de execução única (executar.ts), então nenhuma
// outra execução pode estar rodando de verdade.
export async function iniciarExecucao(): Promise<{ integracaoId: number; interrompidas: number[] }> {
  return withTransaction(async (client) => {
    const interrompidas = await client.query<{ integracao_id: number }>(
      `UPDATE integracao.integracao
          SET status = 'FALHOU', data_fim = now(), mensagem = $1
        WHERE status = 'EM_ANDAMENTO'
        RETURNING integracao_id`,
      [MENSAGEM_INTERROMPIDA],
    )

    const nova = await client.query<{ integracao_id: number }>(
      `INSERT INTO integracao.integracao (sistema_origem, sistema_destino, status)
       VALUES ($1, $2, 'EM_ANDAMENTO')
       RETURNING integracao_id`,
      [SISTEMA_ORIGEM, SISTEMA_DESTINO],
    )

    return {
      integracaoId: nova.rows[0].integracao_id,
      interrompidas: interrompidas.rows.map((linha) => linha.integracao_id).sort((a, b) => a - b),
    }
  })
}

// Grava vários erros num único INSERT (uma transação só, autocommit).
// Os textos são cortados no tamanho das colunas: um id enorme vindo do Grupo 7
// não pode impedir o registro do próprio erro.
export async function registrarErros(integracaoId: number, erros: readonly ErroRegistro[]): Promise<void> {
  if (erros.length === 0) return

  await pool.query(
    `INSERT INTO integracao.erro_integracao
            (integracao_id, registro_origem, campo, tipo_erro, descricao, valor_recebido)
     SELECT $1, e.registro_origem, e.campo, e.tipo_erro, e.descricao, e.valor_recebido
       FROM unnest($2::varchar[], $3::varchar[], $4::varchar[], $5::text[], $6::text[])
            AS e(registro_origem, campo, tipo_erro, descricao, valor_recebido)`,
    [
      integracaoId,
      erros.map((e) => e.registro_origem?.slice(0, 50) ?? null),
      erros.map((e) => e.campo?.slice(0, 60) ?? null),
      erros.map((e) => e.tipo_erro),
      erros.map((e) => e.descricao),
      erros.map((e) => e.valor_recebido),
    ],
  )
}

// Totais parciais, gravados durante a execução (depois da validação e a cada
// INTERVALO_TOTAIS registros processados). Se o processo cair, a execução que
// fica EM_ANDAMENTO (e depois vira FALHOU) mostra o que chegou a gravar.
export async function atualizarTotais(integracaoId: number, totais: Totais): Promise<void> {
  await pool.query(
    `UPDATE integracao.integracao
        SET total_registros = $2, processados = $3, inseridos = $4, atualizados = $5, sem_alteracao = $6, rejeitados = $7
      WHERE integracao_id = $1`,
    [integracaoId, totais.total_registros, totais.processados, totais.inseridos, totais.atualizados, totais.sem_alteracao, totais.rejeitados],
  )
}

export async function finalizarExecucao(
  integracaoId: number,
  totais: Totais,
  status: Exclude<StatusExecucao, 'EM_ANDAMENTO'>,
  mensagem: string | null,
): Promise<void> {
  await pool.query(
    `UPDATE integracao.integracao
        SET data_fim = now(), total_registros = $2, processados = $3, inseridos = $4,
            atualizados = $5, sem_alteracao = $6, rejeitados = $7, status = $8, mensagem = $9
      WHERE integracao_id = $1`,
    [
      integracaoId,
      totais.total_registros,
      totais.processados,
      totais.inseridos,
      totais.atualizados,
      totais.sem_alteracao,
      totais.rejeitados,
      status,
      mensagem,
    ],
  )
}

// -----------------------------------------------------------------------------
// Leitura do log (relatório e API)
// -----------------------------------------------------------------------------

export async function buscarExecucao(integracaoId: number): Promise<Execucao | null> {
  const resultado = await pool.query<Execucao>(
    `SELECT ${COLUNAS_EXECUCAO}
       FROM integracao.integracao
      WHERE integracao_id = $1`,
    [integracaoId],
  )
  return resultado.rows[0] ?? null
}

// Na ordem em que foram gravados: os erros de um mesmo registro ficam juntos
export async function listarErros(integracaoId: number): Promise<ErroGravado[]> {
  const resultado = await pool.query<ErroGravado>(
    `SELECT erro_id, registro_origem, campo, tipo_erro, descricao, valor_recebido, data_ocorrencia
       FROM integracao.erro_integracao
      WHERE integracao_id = $1
      ORDER BY erro_id`,
    [integracaoId],
  )
  return resultado.rows
}

export async function listarExecucoes(paginacao: { page: number; limit: number }) {
  const contagem = await pool.query<{ total: number }>('SELECT count(*)::int AS total FROM integracao.integracao')

  const resultado = await pool.query<ExecucaoResumo>(
    `SELECT ${COLUNAS_EXECUCAO},
            (SELECT count(*)::int FROM integracao.erro_integracao e
              WHERE e.integracao_id = i.integracao_id) AS total_erros
       FROM integracao.integracao i
      ORDER BY integracao_id DESC
      LIMIT $1 OFFSET $2`,
    [paginacao.limit, (paginacao.page - 1) * paginacao.limit],
  )

  return { dados: resultado.rows, pagina: paginacao.page, limite: paginacao.limit, total: contagem.rows[0].total }
}

export async function execucaoEmAndamento(): Promise<number | null> {
  const resultado = await pool.query<{ integracao_id: number }>(
    `SELECT integracao_id FROM integracao.integracao
      WHERE status = 'EM_ANDAMENTO'
      ORDER BY integracao_id DESC
      LIMIT 1`,
  )
  return resultado.rows[0]?.integracao_id ?? null
}
