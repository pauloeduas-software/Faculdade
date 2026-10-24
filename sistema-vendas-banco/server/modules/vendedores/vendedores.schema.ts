import * as z from 'zod'
import { MENSAGEM_DUAS_CASAS, booleanoQuery, buscaQuery, paginacaoSchema } from '../../http/validacao.js'

// Espelha as constraints de vendas.vendedor (database/02_tabelas.sql)
export const vendedorCriacaoSchema = z.object({
  nome: z.string().trim().min(1).max(120),
  email: z.email('E-mail inválido').max(150),
  comissao_percentual: z
    .number()
    .min(0, 'Comissão mínima é 0')
    .max(100, 'Comissão máxima é 100')
    .multipleOf(0.01, MENSAGEM_DUAS_CASAS),
  ativo: z.boolean().default(true),
})

// PUT substitui o registro inteiro, então "ativo" também precisa ser informado
export const vendedorAtualizacaoSchema = vendedorCriacaoSchema.extend({ ativo: z.boolean() })

export const vendedorFiltroSchema = paginacaoSchema.extend({
  busca: buscaQuery.optional(),
  ativo: booleanoQuery.optional(),
})

export type VendedorDados = z.infer<typeof vendedorCriacaoSchema>
export type VendedorFiltro = z.infer<typeof vendedorFiltroSchema>
