import type { CrudApi } from '../../api/recursos'
import type { Coluna } from '../../components/TabelaPaginada'

export type Valores = Record<string, string | boolean>

// Um campo do formulário. As regras espelham os schemas zod da API
// (server/modules/*/*.schema.ts), com as mesmas mensagens.
export interface DefinicaoCampo {
  nome: string
  rotulo: string
  tipo: 'texto' | 'email' | 'cpf' | 'uf' | 'decimal' | 'textarea' | 'sku'
  obrigatorio?: boolean
  maximo?: number
  dica?: string
  placeholder?: string
  largura?: 'cheia' | 'meia'
  validar?: (valor: string) => string | null
}

// Tudo o que muda entre Clientes, Vendedores e Produtos
export interface ConfigCadastro<T, D> {
  titulo: string // "Clientes"
  singular: string // "cliente"
  novo: string // "Novo cliente"
  rota: string // "/clientes"
  api: CrudApi<T, D>
  id: (registro: T) => number
  descricao: (registro: T) => string
  ativo: (registro: T) => boolean
  colunas: Coluna<T>[]
  placeholderBusca: string
  campos: DefinicaoCampo[]
  valoresIniciais: (registro?: T) => Valores
  paraApi: (valores: Valores) => D
  comSituacao: (registro: T, ativo: boolean) => D // corpo do PUT de Desativar/Ativar
}
