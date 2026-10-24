// Textos da integração que não são componentes (resumo da execução e nomes dos erros)
import type { StatusExecucao, TipoErro } from '../../types'
import type { Totais } from './componentes'

const qtd = (n: number, singular: string, plural: string) => `${n} ${n === 1 ? singular : plural}`

// O resultado de uma execução numa frase
export function resumoExecucao(totais: Totais, status: StatusExecucao): string {
  if (status === 'FALHOU') return 'A integração parou antes de terminar. O motivo está abaixo; o que chegou a ser gravado aparece nos números.'
  if (status === 'EM_ANDAMENTO') return 'Esta execução ainda está rodando, ou o processo caiu antes de terminar.'
  if (totais.total_consultado === 0) return 'O Grupo 7 não tinha nenhuma entrega para enviar.'
  const partes = [
    totais.inseridos > 0 && qtd(totais.inseridos, 'nova gravada', 'novas gravadas'),
    totais.atualizados > 0 && qtd(totais.atualizados, 'atualizada', 'atualizadas'),
    totais.sem_alteracao > 0 && qtd(totais.sem_alteracao, 'já estava igual', 'já estavam iguais'),
    totais.rejeitados > 0 && qtd(totais.rejeitados, 'recusada por problema', 'recusadas por problema'),
  ].filter(Boolean) as string[]
  const lista = partes.length > 1 ? `${partes.slice(0, -1).join(', ')} e ${partes.at(-1)}` : partes[0]
  return `O Grupo 7 enviou ${qtd(totais.total_consultado, 'entrega', 'entregas')}: ${lista}.`
}

// Tipos de erro (códigos do contrato) com nome e cor para a tela
export const TIPO_ERRO: Record<TipoErro, { rotulo: string; cor: string }> = {
  CAMPO_OBRIGATORIO: { rotulo: 'Campo obrigatório vazio', cor: 'amarelo' },
  TIPO_INVALIDO: { rotulo: 'Tipo de dado errado', cor: 'amarelo' },
  VALOR_INVALIDO: { rotulo: 'Valor inválido', cor: 'amarelo' },
  REGISTRO_DUPLICADO: { rotulo: 'Registro duplicado', cor: 'roxo' },
  REGISTRO_INEXISTENTE: { rotulo: 'Registro inexistente', cor: 'roxo' },
  REGRA_NEGOCIO: { rotulo: 'Regra de negócio', cor: 'azul' },
  ERRO_ESTRUTURAL: { rotulo: 'Estrutura da view mudou', cor: 'vermelho' },
  ERRO_CONEXAO: { rotulo: 'Falha de conexão', cor: 'vermelho' },
}
