const CHAVE_STORAGE = 'vendas.apiKey'

export const chaveSalva = () => {
  try { return localStorage.getItem(CHAVE_STORAGE) ?? 'vendas-admin-key' } catch { return 'vendas-admin-key' }
}
export const salvarChave = (k: string) => {
  try { localStorage.setItem(CHAVE_STORAGE, k) } catch { /* sem storage */ }
}

export interface Item { produto_id: number; nome_produto: string; quantidade: number; preco_unitario: number; subtotal: number }
export interface Venda {
  id: number
  cliente: { nome: string; documento: string }
  entrega: { endereco: string; cidade: string; uf: string; cep: string }
  itens: Item[]
  valor_total: number
  status: 'CONFIRMADA' | 'CANCELADA'
  motivo_cancelamento: string | null
  criado_em: string
}
// Resposta de GET /vendas/{id}/entrega: a entrega da venda lida da API do G7.
export interface EntregaG7 {
  id_entrega: number; codigo_rastreio: string; transportadora: string | null; status_entrega: string
  data_prevista: string | null; data_entrega: string | null; valor_frete: number | null; pendencias: string[]; data_atualizacao: string
}
export interface ConsultaEntrega {
  venda_id: number
  entrega: EntregaG7 | null
  historico: { status_entrega: string; data_hora: string; observacao: string | null }[]
  leitura_anterior: { id_entrega: number; status_entrega: string; data_atualizacao: string } | null
  alterada: boolean
}
export interface Log {
  id: number; direcao: 'ENTRADA' | 'SAIDA'; sistema: string; metodo: string; url: string
  status: number | null; duracao_ms: number; tentativa: number; erro: string | null; correlacao: string | null; criado_em: string
}

export interface Resultado<T> { ok: boolean; status: number; dados?: T; erro?: { codigo: string; mensagem: string; detalhes?: unknown } }

export async function chamar<T>(metodo: string, caminho: string, corpo?: unknown, extra: Record<string, string> = {}): Promise<Resultado<T>> {
  try {
    const res = await fetch(`/api/v1${caminho}`, {
      method: metodo,
      headers: { 'X-API-Key': chaveSalva(), 'Content-Type': 'application/json', 'X-Sistema-Origem': 'painel-vendas', ...extra },
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
    })
    if (res.status === 204) return { ok: true, status: 204 }
    const json = await res.json().catch(() => undefined)
    if (res.ok) return { ok: true, status: res.status, dados: json as T }
    return { ok: false, status: res.status, erro: json?.erro ?? { codigo: 'ERRO', mensagem: `HTTP ${res.status}` } }
  } catch {
    return { ok: false, status: 0, erro: { codigo: 'SEM_CONEXAO', mensagem: 'Nao foi possivel falar com a API de Vendas: confira se ela esta rodando (npm run dev)' } }
  }
}

export const moeda = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
