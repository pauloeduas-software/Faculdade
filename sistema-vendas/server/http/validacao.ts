import * as z from 'zod'
import { AppError } from './errors.js'

// Mensagens padrão do zod em português
z.config(z.locales.pt())

// Maior valor do tipo integer do PostgreSQL (colunas *_id)
const ID_MAXIMO = 2_147_483_647

export const idSchema = z.number().int().positive().max(ID_MAXIMO)

// Na query string tudo chega como texto, por isso o coerce
export const idQuery = z.coerce.number().int().positive().max(ID_MAXIMO)

export const paginacaoSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

// z.coerce.boolean() trataria o texto "false" como true
export const booleanoQuery = z.enum(['true', 'false']).transform((valor) => valor === 'true')

export const buscaQuery = z.string().trim().min(1).max(100)

// Preço e comissão: no máximo 2 casas decimais. O numeric(…,2) do banco
// arredondaria em silêncio (12.345 viraria 12.35)
export const MENSAGEM_DUAS_CASAS = 'Use no máximo 2 casas decimais'

// As 27 UFs do Brasil (a mesma lista do front, src/pages/cadastros/validacao.ts)
export const UFS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA',
  'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
] as const

// Dígitos verificadores do CPF (módulo 11). 11 dígitos iguais passam na conta,
// mas não são CPFs válidos.
export function cpfValido(cpf: string): boolean {
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false
  const digitos = [...cpf].map(Number)
  for (const n of [9, 10]) {
    const soma = digitos.slice(0, n).reduce((total, digito, i) => total + digito * (n + 1 - i), 0)
    if (((soma * 10) % 11) % 10 !== digitos[n]) return false
  }
  return true
}

// Valida o :id da URL antes de ele chegar ao banco
export function parseId(valor: string, nome = 'id'): number {
  const id = Number(valor)
  if (!/^\d+$/.test(valor) || id < 1 || id > ID_MAXIMO) {
    throw new AppError(400, 'TIPO_INVALIDO', `O parâmetro ${nome} deve ser um número inteiro positivo`, {
      [nome]: valor,
    })
  }
  return id
}
