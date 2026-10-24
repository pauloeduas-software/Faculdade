// =============================================================================
// Etapa 7 – RELATÓRIO: o resultado de uma execução, montado a partir do que
// ficou gravado no log (integracao.integracao + erro_integracao). Por isso o
// relatório devolvido ao fim da execução e o consultado depois pela API são
// sempre o mesmo.
// =============================================================================
import type { ErroGravado, Execucao, StatusExecucao } from './log.js'

export interface Relatorio {
  integracao_id: number
  origem: string
  destino: string
  data_inicio: Date
  data_fim: Date | null
  duracao_ms: number | null
  total_consultado: number
  processados: number
  inseridos: number
  atualizados: number
  sem_alteracao: number
  rejeitados: number
  erros: {
    registro: string | null
    campo: string | null
    tipo_erro: string
    descricao: string
    valor_recebido: string | null
  }[]
  status: StatusExecucao
  mensagem: string | null
}

export function montarRelatorio(execucao: Execucao, erros: ErroGravado[]): Relatorio {
  return {
    integracao_id: execucao.integracao_id,
    origem: execucao.sistema_origem,
    destino: execucao.sistema_destino,
    data_inicio: execucao.data_inicio,
    data_fim: execucao.data_fim,
    duracao_ms: execucao.data_fim ? execucao.data_fim.getTime() - execucao.data_inicio.getTime() : null,
    total_consultado: execucao.total_registros,
    processados: execucao.processados,
    inseridos: execucao.inseridos,
    atualizados: execucao.atualizados,
    sem_alteracao: execucao.sem_alteracao,
    rejeitados: execucao.rejeitados,
    erros: erros.map((e) => ({
      registro: e.registro_origem,
      campo: e.campo,
      tipo_erro: e.tipo_erro,
      descricao: e.descricao,
      valor_recebido: e.valor_recebido,
    })),
    status: execucao.status,
    mensagem: execucao.mensagem,
  }
}

// -----------------------------------------------------------------------------
// Texto, no formato do enunciado ("PROCESSAMENTO DA INTEGRAÇÃO")
// -----------------------------------------------------------------------------
const DUPLA = '='.repeat(36)
const SIMPLES = '-'.repeat(36)

const STATUS_TEXTO: Record<StatusExecucao, string> = {
  EM_ANDAMENTO: 'EM ANDAMENTO',
  CONCLUIDA: 'CONCLUÍDA',
  CONCLUIDA_COM_ERROS: 'CONCLUÍDA COM ERROS',
  FALHOU: 'FALHOU',
}

const DATA_HORA = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  dateStyle: 'short',
  timeStyle: 'medium',
})

// Erros sem registro são da execução: da estrutura da view ou da conexão
function tituloDoGrupo(erro: Relatorio['erros'][number]): string {
  if (erro.registro !== null) return `Registro ${erro.registro}`
  if (erro.tipo_erro === 'ERRO_ESTRUTURAL') return 'Estrutura da view'
  if (erro.tipo_erro === 'ERRO_CONEXAO') return 'Conexão com o banco do Grupo 7'
  return 'Registro sem id_entrega'
}

function linhaDoErro(erro: Relatorio['erros'][number]): string {
  const valor = erro.valor_recebido === null ? '(nulo)' : `"${erro.valor_recebido}"`
  const campo = erro.campo ? ` [${erro.campo} = ${valor}]` : ''
  return `  - ${erro.tipo_erro}${campo}: ${erro.descricao}`
}

export function relatorioEmTexto(r: Relatorio): string {
  const linhas = [
    DUPLA,
    'PROCESSAMENTO DA INTEGRAÇÃO',
    DUPLA,
    `Execução: ${r.integracao_id}`,
    `Origem: ${r.origem}`,
    `Destino: ${r.destino}`,
    `Início: ${DATA_HORA.format(r.data_inicio)}`,
    `Fim: ${r.data_fim ? `${DATA_HORA.format(r.data_fim)} (${((r.duracao_ms ?? 0) / 1000).toFixed(1).replace('.', ',')} s)` : '-'}`,
    `Total consultado: ${r.total_consultado}`,
    `Processados (válidos): ${r.processados}`,
    `  Inseridos: ${r.inseridos}`,
    `  Atualizados: ${r.atualizados}`,
    `  Sem alteração: ${r.sem_alteracao}`,
    `Rejeitados: ${r.rejeitados}`,
    SIMPLES,
    'ERROS ENCONTRADOS',
    SIMPLES,
  ]

  if (r.erros.length === 0) linhas.push('Nenhum erro encontrado.')

  // Agrupa por registro, na ordem em que os erros foram gravados
  const grupos = new Map<string, string[]>()
  for (const erro of r.erros) {
    const titulo = tituloDoGrupo(erro)
    grupos.set(titulo, [...(grupos.get(titulo) ?? []), linhaDoErro(erro)])
  }
  for (const [titulo, erros] of grupos) linhas.push(`${titulo}:`, ...erros)

  linhas.push(SIMPLES, 'STATUS:', STATUS_TEXTO[r.status])
  if (r.mensagem) linhas.push(`${r.status === 'FALHOU' ? 'Motivo' : 'Observações'}: ${r.mensagem}`)

  return linhas.join('\n')
}
