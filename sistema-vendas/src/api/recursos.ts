// Uma função por endpoint da API, já com os tipos de entrada e saída
import type {
  Cliente,
  ClienteDados,
  DiagnosticoProdutor,
  Execucao,
  ExecucaoDetalhe,
  Pagina,
  PreviewProdutor,
  Produto,
  ProdutoDados,
  ResultadoIntegracao,
  StatusVenda,
  VendaAtualizacao,
  VendaCriacao,
  VendaDetalhe,
  VendaResumo,
  Vendedor,
  VendedorDados,
} from '../types'
import { api, type ValorQuery } from './cliente'

export interface FiltroCadastro {
  busca?: string
  ativo?: boolean
  page?: number
  limit?: number
}

export interface CrudApi<T, D> {
  listar: (filtro: FiltroCadastro) => Promise<Pagina<T>>
  buscar: (id: number) => Promise<T>
  criar: (dados: D) => Promise<T>
  atualizar: (id: number, dados: D) => Promise<T>
  excluir: (id: number) => Promise<void>
}

function crud<T, D>(base: string): CrudApi<T, D> {
  return {
    listar: (filtro) => api.get<Pagina<T>>(base, { ...filtro }),
    buscar: (id) => api.get<T>(`${base}/${id}`),
    criar: (dados) => api.post<T>(base, dados),
    atualizar: (id, dados) => api.put<T>(`${base}/${id}`, dados),
    excluir: (id) => api.delete(`${base}/${id}`),
  }
}

export const clientesApi = crud<Cliente, ClienteDados>('/clientes')
export const vendedoresApi = crud<Vendedor, VendedorDados>('/vendedores')
export const produtosApi = crud<Produto, ProdutoDados>('/produtos')

export interface FiltroVendas extends Record<string, ValorQuery> {
  status?: StatusVenda
  cliente_id?: number
  data_inicio?: string
  data_fim?: string
  page?: number
  limit?: number
}

export const vendasApi = {
  listar: (filtro: FiltroVendas) => api.get<Pagina<VendaResumo>>('/vendas', filtro),
  buscar: (id: number) => api.get<VendaDetalhe>(`/vendas/${id}`),
  criar: (dados: VendaCriacao) => api.post<VendaDetalhe>('/vendas', dados),
  // Uma transação só no servidor: dados da venda e itens juntos
  atualizar: (id: number, dados: VendaAtualizacao) => api.put<VendaDetalhe>(`/vendas/${id}`, dados),
  mudarStatus: (id: number, status: StatusVenda) => api.put<VendaDetalhe>(`/vendas/${id}`, { status }),
  excluir: (id: number) => api.delete(`/vendas/${id}`),
}

export const integracaoApi = {
  executar: () => api.post<ResultadoIntegracao>('/integracoes/entregas/executar'),
  diagnostico: () => api.get<DiagnosticoProdutor>('/integracoes/entregas/status'),
  listar: (page: number, limit: number) => api.get<Pagina<Execucao>>('/integracoes', { page, limit }),
  buscar: (id: number) => api.get<ExecucaoDetalhe>(`/integracoes/${id}`),
  urlRelatorio: (id: number) => `/api/integracoes/${id}/relatorio`,
  // Sem limit: todas as linhas da view
  previewProdutor: (limit?: number) => api.get<PreviewProdutor>('/integracoes/produtor/preview', { limit }),
}
