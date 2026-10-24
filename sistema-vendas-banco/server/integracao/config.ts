// =============================================================================
// Integração Grupo 7 (Entregas) → Grupo 2 (Vendas): o CONTRATO em código
// Fonte: Docs/contrato_integracao_grupo7_grupo2.md
//
// Tudo o que o consumidor sabe sobre o produtor está aqui: onde fica a view,
// quais colunas ela deve ter (com o tipo de cada uma), o vocabulário de status
// e o efeito de cada entrega na venda. Se o Grupo 7 mudar o contrato, muda-se
// este arquivo; as etapas só leem estas constantes.
// =============================================================================
import type { StatusVenda } from '../modules/vendas/vendas.schema.js'

// Gravados em integracao.integracao (sistema_origem / sistema_destino, varchar(50))
export const SISTEMA_ORIGEM = 'Grupo 7 - Sistema de Entregas'
export const SISTEMA_DESTINO = 'Grupo 2 - Sistema de Vendas'

// Contrato §2: a view que o Grupo 7 disponibiliza
export const SCHEMA_VIEW = 'integracao'
export const NOME_VIEW = 'vw_integracao_entregas'
export const VIEW = `${SCHEMA_VIEW}.${NOME_VIEW}`

// Chave do pg_try_advisory_lock que garante uma execução por vez (7 → 2)
export const CHAVE_TRAVA = 7_002

// Contrato §4.3: valores aceitos pela constraint ck_erro_integracao_tipo
export type TipoErro =
  | 'CAMPO_OBRIGATORIO'
  | 'TIPO_INVALIDO'
  | 'VALOR_INVALIDO'
  | 'REGISTRO_DUPLICADO'
  | 'REGISTRO_INEXISTENTE'
  | 'REGRA_NEGOCIO'
  | 'ERRO_ESTRUTURAL'
  | 'ERRO_CONEXAO'

// -----------------------------------------------------------------------------
// Contrato §3: colunas da view. "tipo" é o data_type do information_schema e
// "tamanho" o character_maximum_length (só varchar/char).
// -----------------------------------------------------------------------------
export interface ColunaContrato {
  nome: string
  tipo: 'integer' | 'character varying' | 'character' | 'date' | 'timestamp with time zone'
  tamanho?: number
  obrigatorio: boolean
}

export const COLUNAS_VIEW = [
  { nome: 'id_entrega', tipo: 'integer', obrigatorio: true },
  { nome: 'num_venda', tipo: 'integer', obrigatorio: true },
  { nome: 'cod_rastreio', tipo: 'character varying', tamanho: 30, obrigatorio: true },
  { nome: 'situacao', tipo: 'character varying', tamanho: 20, obrigatorio: true },
  { nome: 'dt_prevista', tipo: 'date', obrigatorio: false },
  { nome: 'dt_saida', tipo: 'timestamp with time zone', obrigatorio: false },
  { nome: 'dt_entrega', tipo: 'timestamp with time zone', obrigatorio: false },
  { nome: 'nome_entregador', tipo: 'character varying', tamanho: 120, obrigatorio: false },
  { nome: 'cidade_destino', tipo: 'character varying', tamanho: 80, obrigatorio: false },
  { nome: 'uf_destino', tipo: 'character', tamanho: 2, obrigatorio: false },
  { nome: 'ultima_alteracao', tipo: 'timestamp with time zone', obrigatorio: true },
] as const satisfies readonly ColunaContrato[]

export type NomeColuna = (typeof COLUNAS_VIEW)[number]['nome']

// Uma linha da view como chega do banco do Grupo 7: TUDO como texto (ver
// conexao.ts). A conversão para os nossos tipos é feita campo a campo.
export type LinhaView = Record<NomeColuna, string | null>

// -----------------------------------------------------------------------------
// Contrato §5.2: de-para de status. Situação fora desta lista → VALOR_INVALIDO.
// Os valores da direita são os únicos aceitos pela constraint ck_entrega_status.
// -----------------------------------------------------------------------------
export const DE_PARA_STATUS = {
  AGUARDANDO_COLETA: 'AGUARDANDO_COLETA',
  EM_TRANSITO: 'EM_TRANSPORTE',
  ENTREGUE: 'ENTREGUE',
  DEVOLVIDA: 'DEVOLVIDA',
  EXTRAVIADA: 'EXTRAVIADA',
  CANCELADA: 'CANCELADA',
} as const

export type SituacaoGrupo7 = keyof typeof DE_PARA_STATUS
export type StatusEntrega = (typeof DE_PARA_STATUS)[SituacaoGrupo7]

// -----------------------------------------------------------------------------
// Contrato §6: efeito na venda de uma entrega válida.
//   null       → REGRA_NEGOCIO, a entrega é rejeitada
//   []         → grava a entrega e a venda não muda
//   [a, b...]  → grava e a venda passa por esses status, nesta ordem
// CONFIRMADA + ENTREGUE passa por EM_ENTREGA para respeitar a sequência de
// status do Sistema de Vendas (TRANSICOES_STATUS em vendas.schema.ts).
// AGUARDANDO_COLETA com a venda EM_ENTREGA é o reenvio de uma entrega
// DEVOLVIDA: o Grupo 7 garante uma só entrega ativa por venda e nenhuma volta
// de situação. CANCELADA só é gravada: a venda não muda sozinha.
// -----------------------------------------------------------------------------
export const EFEITO_NA_VENDA: Record<StatusEntrega, Record<StatusVenda, readonly StatusVenda[] | null>> = {
  AGUARDANDO_COLETA: { ABERTA: null, CONFIRMADA: [], EM_ENTREGA: [], ENTREGUE: null, CANCELADA: null },
  EM_TRANSPORTE: { ABERTA: null, CONFIRMADA: ['EM_ENTREGA'], EM_ENTREGA: [], ENTREGUE: null, CANCELADA: null },
  ENTREGUE: { ABERTA: null, CONFIRMADA: ['EM_ENTREGA', 'ENTREGUE'], EM_ENTREGA: ['ENTREGUE'], ENTREGUE: [], CANCELADA: null },
  DEVOLVIDA: { ABERTA: null, CONFIRMADA: [], EM_ENTREGA: [], ENTREGUE: [], CANCELADA: null },
  EXTRAVIADA: { ABERTA: null, CONFIRMADA: [], EM_ENTREGA: [], ENTREGUE: [], CANCELADA: null },
  CANCELADA: { ABERTA: null, CONFIRMADA: [], EM_ENTREGA: [], ENTREGUE: [], CANCELADA: [] },
}

// Contrato §4.3: dt_saida e dt_entrega não podem estar mais de 5 minutos no
// futuro (a folga cobre relógios um pouco diferentes entre os dois servidores)
export const TOLERANCIA_FUTURO_MS = 5 * 60 * 1000

// A cada quantos registros processados os totais da execução são gravados em
// integracao.integracao: se o processo cair, a execução mostra o que já gravou
export const INTERVALO_TOTAIS = 100

// UFs aceitas em uf_destino
export const UFS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA',
  'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
] as const

// Só para a demonstração: lança um erro fatal depois de N registros processados
// (INTEGRACAO_SIMULAR_QUEDA_APOS=N). Vazia = desligado.
export function quedaSimuladaApos(): number | null {
  const valor = process.env.INTEGRACAO_SIMULAR_QUEDA_APOS?.trim()
  if (!valor) return null
  const n = Number(valor)
  return Number.isInteger(n) && n >= 0 ? n : null
}
