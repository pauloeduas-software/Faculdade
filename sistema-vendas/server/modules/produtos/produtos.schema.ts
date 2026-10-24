import * as z from 'zod'
import { MENSAGEM_DUAS_CASAS, booleanoQuery, buscaQuery, paginacaoSchema } from '../../http/validacao.js'

// Espelha as constraints de vendas.produto (database/02_tabelas.sql)
export const produtoCriacaoSchema = z.object({
  codigo_sku: z.string().regex(/^PRD-\d{4}$/, 'SKU deve estar no formato PRD-0000'),
  nome: z.string().trim().min(1).max(120),
  descricao: z.string().trim().nullish(),
  // numeric(12,2): no máximo 10 dígitos antes da vírgula
  preco_unitario: z
    .number()
    .positive('Preço deve ser maior que zero')
    .max(9_999_999_999.99)
    .multipleOf(0.01, MENSAGEM_DUAS_CASAS),
  ativo: z.boolean().default(true),
})

// PUT substitui o registro inteiro, então "ativo" também precisa ser informado
export const produtoAtualizacaoSchema = produtoCriacaoSchema.extend({ ativo: z.boolean() })

export const produtoFiltroSchema = paginacaoSchema.extend({
  busca: buscaQuery.optional(),
  ativo: booleanoQuery.optional(),
})

export type ProdutoDados = z.infer<typeof produtoCriacaoSchema>
export type ProdutoFiltro = z.infer<typeof produtoFiltroSchema>
