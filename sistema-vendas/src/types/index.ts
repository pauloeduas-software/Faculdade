// Tipos das respostas da API (server/). Datas chegam como texto ISO 8601.

export interface Pagina<T> {
  dados: T[]
  pagina: number
  limite: number
  total: number
}

// -----------------------------------------------------------------------------
// Cadastros
// -----------------------------------------------------------------------------
export interface Cliente {
  cliente_id: number
  nome: string
  cpf: string
  email: string | null
  telefone: string | null
  cidade: string | null
  uf: string | null
  ativo: boolean
  criado_em: string
  atualizado_em: string
}

export interface Vendedor {
  vendedor_id: number
  nome: string
  email: string
  comissao_percentual: number
  ativo: boolean
  criado_em: string
  atualizado_em: string
}

export interface Produto {
  produto_id: number
  codigo_sku: string
  nome: string
  descricao: string | null
  preco_unitario: number
  ativo: boolean
  criado_em: string
  atualizado_em: string
}

export type ClienteDados = Omit<Cliente, 'cliente_id' | 'criado_em' | 'atualizado_em'>
export type VendedorDados = Omit<Vendedor, 'vendedor_id' | 'criado_em' | 'atualizado_em'>
export type ProdutoDados = Omit<Produto, 'produto_id' | 'criado_em' | 'atualizado_em'>

// -----------------------------------------------------------------------------
// Vendas (mesmos valores de server/modules/vendas/vendas.schema.ts)
// -----------------------------------------------------------------------------
export const STATUS_VENDA = ['ABERTA', 'CONFIRMADA', 'EM_ENTREGA', 'ENTREGUE', 'CANCELADA'] as const
export type StatusVenda = (typeof STATUS_VENDA)[number]

export const FORMAS_PAGAMENTO = ['PIX', 'DINHEIRO', 'CARTAO_CREDITO', 'CARTAO_DEBITO', 'BOLETO'] as const
export type FormaPagamento = (typeof FORMAS_PAGAMENTO)[number]

export interface VendaResumo {
  venda_id: number
  data_venda: string
  status: StatusVenda
  forma_pagamento: FormaPagamento
  valor_total: number
  cliente_id: number
  cliente_nome: string
  vendedor_id: number
  vendedor_nome: string
  transicoes_permitidas: StatusVenda[]
}

export interface ItemVenda {
  item_venda_id: number
  produto_id: number
  codigo_sku: string
  produto_nome: string
  quantidade: number
  preco_unitario: number
  subtotal: number
}

// vendas.entrega: entrega integrada do Grupo 7, já no nosso modelo
export interface Entrega {
  entrega_id: number
  id_entrega_origem: number
  codigo_rastreio: string
  status_entrega: string
  data_prevista: string | null // AAAA-MM-DD
  data_saida: string | null
  data_entrega: string | null
  entregador: string | null
  cidade: string | null
  uf: string | null
  origem_atualizado_em: string
  integrado_em: string
  atualizado_em: string
}

export interface VendaDetalhe {
  venda_id: number
  data_venda: string
  status: StatusVenda
  forma_pagamento: FormaPagamento
  valor_total: number
  observacao: string | null
  criado_em: string
  atualizado_em: string
  cliente: { cliente_id: number; nome: string; cpf: string; email: string | null; cidade: string | null; uf: string | null }
  vendedor: { vendedor_id: number; nome: string; email: string }
  itens: ItemVenda[]
  entregas: Entrega[]
  transicoes_permitidas: StatusVenda[]
}

export interface VendaCriacao {
  cliente_id: number
  vendedor_id: number
  forma_pagamento: FormaPagamento
  observacao?: string | null
  itens: { produto_id: number; quantidade: number }[]
}

// PUT /vendas/:id: cliente e vendedor não mudam; itens é a lista completa
export interface VendaAtualizacao {
  forma_pagamento?: FormaPagamento
  observacao?: string | null
  status?: StatusVenda
  itens?: { produto_id: number; quantidade: number }[]
}

// -----------------------------------------------------------------------------
// Integração
// -----------------------------------------------------------------------------
export type StatusExecucao = 'EM_ANDAMENTO' | 'CONCLUIDA' | 'CONCLUIDA_COM_ERROS' | 'FALHOU'

export const TIPOS_ERRO = [
  'CAMPO_OBRIGATORIO',
  'TIPO_INVALIDO',
  'VALOR_INVALIDO',
  'REGISTRO_DUPLICADO',
  'REGISTRO_INEXISTENTE',
  'REGRA_NEGOCIO',
  'ERRO_ESTRUTURAL',
  'ERRO_CONEXAO',
] as const
export type TipoErro = (typeof TIPOS_ERRO)[number]

export interface Execucao {
  integracao_id: number
  data_inicio: string
  data_fim: string | null
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
  total_erros?: number
}

export interface ErroIntegracao {
  erro_id: number
  registro_origem: string | null
  campo: string | null
  tipo_erro: TipoErro
  descricao: string
  valor_recebido: string | null
  data_ocorrencia: string
}

export interface ExecucaoDetalhe extends Execucao {
  erros: ErroIntegracao[]
}

export interface ResultadoIntegracao {
  integracao_id: number
  origem: string
  destino: string
  data_inicio: string
  data_fim: string | null
  duracao_ms: number | null
  total_consultado: number
  processados: number
  inseridos: number
  atualizados: number
  sem_alteracao: number
  rejeitados: number
  erros: { registro: string | null; campo: string | null; tipo_erro: TipoErro; descricao: string; valor_recebido: string | null }[]
  status: StatusExecucao
  mensagem: string | null
  texto: string
}

export type SituacaoColuna = 'OK' | 'TIPO_DIFERENTE' | 'AUSENTE' | 'EXTRA'

export interface DiagnosticoProdutor {
  nivel: 'OK' | 'ALERTA' | 'ERRO'
  verificado_em: string
  conexao: { ok: boolean; mensagem: string; duracao_ms: number; destino: string }
  estrutura: {
    verificada: boolean
    view: string
    mensagem: string
    colunas: { nome: string; esperado: string | null; encontrado: string | null; situacao: SituacaoColuna }[]
  }
}

export interface PreviewProdutor {
  view: string
  limite: number | null
  total: number
  linhas: Record<string, string | number | null>[]
}
