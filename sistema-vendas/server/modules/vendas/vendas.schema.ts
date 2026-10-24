import * as z from 'zod'
import { idQuery, idSchema, paginacaoSchema } from '../../http/validacao.js'

// Mesmos valores das constraints ck_venda_status e ck_venda_forma_pagamento
export const STATUS_VENDA = ['ABERTA', 'CONFIRMADA', 'CANCELADA', 'EM_ENTREGA', 'ENTREGUE'] as const
export const FORMAS_PAGAMENTO = ['PIX', 'DINHEIRO', 'CARTAO_CREDITO', 'CARTAO_DEBITO', 'BOLETO'] as const

export type StatusVenda = (typeof STATUS_VENDA)[number]
export type FormaPagamento = (typeof FORMAS_PAGAMENTO)[number]

// Para quais status cada status pode ir. ENTREGUE e CANCELADA são finais.
export const TRANSICOES_STATUS: Record<StatusVenda, readonly StatusVenda[]> = {
  ABERTA: ['CONFIRMADA', 'CANCELADA'],
  CONFIRMADA: ['EM_ENTREGA', 'CANCELADA'],
  EM_ENTREGA: ['ENTREGUE'],
  ENTREGUE: [],
  CANCELADA: [],
}

const quantidade = z.number().int().positive('Quantidade deve ser maior que zero').max(100_000)
const observacao = z.string().trim().max(1000)

// O preço NÃO faz parte do item: ele é sempre lido do cadastro do produto
// (um "preco_unitario" enviado no corpo é descartado pelo zod)
export const itemCriacaoSchema = z.object({
  produto_id: idSchema,
  quantidade,
})

export const itemAtualizacaoSchema = z.object({ quantidade })

export const vendaCriacaoSchema = z.object({
  cliente_id: idSchema,
  vendedor_id: idSchema,
  forma_pagamento: z.enum(FORMAS_PAGAMENTO),
  observacao: observacao.nullish(),
  itens: z.array(itemCriacaoSchema).min(1, 'A venda precisa ter pelo menos 1 item').max(50),
})

// Só estes campos podem mudar; qualquer outro (ex.: cliente_id) é rejeitado.
// itens (opcional) é a lista completa: substitui a atual (tela "Editar venda")
export const vendaAtualizacaoSchema = z
  .strictObject({
    forma_pagamento: z.enum(FORMAS_PAGAMENTO).optional(),
    observacao: observacao.nullable().optional(),
    status: z.enum(STATUS_VENDA).optional(),
    itens: z.array(itemCriacaoSchema).min(1, 'A venda precisa ter pelo menos 1 item').max(50).optional(),
  })
  .refine((dados) => Object.keys(dados).length > 0, 'Informe forma_pagamento, observacao, status e/ou itens')

export const vendaFiltroSchema = paginacaoSchema
  .extend({
    status: z.enum(STATUS_VENDA).optional(),
    cliente_id: idQuery.optional(),
    data_inicio: z.iso.date().optional(),
    data_fim: z.iso.date().optional(),
  })
  .refine((f) => !f.data_inicio || !f.data_fim || f.data_inicio <= f.data_fim, {
    error: 'data_inicio deve ser anterior ou igual a data_fim',
    path: ['data_fim'],
  })

export type ItemCriacao = z.infer<typeof itemCriacaoSchema>
export type VendaCriacao = z.infer<typeof vendaCriacaoSchema>
export type VendaAtualizacao = z.infer<typeof vendaAtualizacaoSchema>
export type VendaFiltro = z.infer<typeof vendaFiltroSchema>
