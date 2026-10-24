import * as z from 'zod'
import { UFS, booleanoQuery, buscaQuery, cpfValido, paginacaoSchema } from '../../http/validacao.js'

// Espelha as constraints de vendas.cliente (database/02_tabelas.sql)
export const clienteCriacaoSchema = z.object({
  nome: z.string().trim().min(1).max(120),
  cpf: z
    .string()
    .regex(/^\d{11}$/, 'CPF deve ter exatamente 11 dígitos numéricos')
    .refine(cpfValido, 'CPF inválido: dígito verificador não confere'),
  email: z.email('E-mail inválido').max(150).nullish(),
  telefone: z.string().trim().max(20).nullish(),
  cidade: z.string().trim().max(80).nullish(),
  uf: z.enum(UFS, 'UF inexistente').nullish(),
  ativo: z.boolean().default(true),
})

// PUT substitui o registro inteiro, então "ativo" também precisa ser informado
export const clienteAtualizacaoSchema = clienteCriacaoSchema.extend({ ativo: z.boolean() })

export const clienteFiltroSchema = paginacaoSchema.extend({
  busca: buscaQuery.optional(),
  ativo: booleanoQuery.optional(),
})

export type ClienteDados = z.infer<typeof clienteCriacaoSchema>
export type ClienteFiltro = z.infer<typeof clienteFiltroSchema>
