import { z } from 'zod'

// Validacao de FORMATO (tipos e campos obrigatorios) -> 400.
// Validacao SEMANTICA (regras de negocio) fica em validarSemantica -> 422.
export const clienteSchema = z.object({ nome: z.string(), documento: z.string() }).strict()
export const entregaSchema = z
  .object({ endereco: z.string(), cidade: z.string(), uf: z.string(), cep: z.string() })
  .strict()

export const criarVendaSchema = z
  .object({
    cliente: clienteSchema,
    entrega: entregaSchema,
    itens: z.array(z.object({
      produto_id: z.number(), nome_produto: z.string(), quantidade: z.number(), preco_unitario: z.number(),
    }).strict()),
  })
  .strict()

export const atualizarVendaSchema = z
  .object({
    cliente: clienteSchema,
    entrega: entregaSchema,
    status: z.enum(['CONFIRMADA', 'CANCELADA']).optional(),
  })
  .strict()

export type CriarVenda = z.infer<typeof criarVendaSchema>
export type AtualizarVenda = z.infer<typeof atualizarVendaSchema>

const UFS = new Set('AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' '))

// 250.9 e 250.90 sao aceitos; 250.901 nao (tolerancia para a representacao em ponto flutuante).
const centavos = (n: number) => Math.abs(n * 100 - Math.round(n * 100)) < 1e-6

// Pontuacao e aceita e removida; letras e outros simbolos nao.
const semPontuacao = (v: string) => v.replace(/[\s./-]/g, '')

export function validarCliente(c: { nome: string; documento: string }, erros: string[]): void {
  if (c.nome.trim().length < 2) erros.push('cliente.nome deve ter ao menos 2 caracteres')
  if (!/^(\d{11}|\d{14})$/.test(semPontuacao(c.documento))) erros.push('cliente.documento deve ter 11 (CPF) ou 14 (CNPJ) digitos')
}

export function validarEntrega(e: { endereco: string; cidade: string; uf: string; cep: string }, erros: string[]): void {
  if (!e.endereco.trim()) erros.push('entrega.endereco nao pode ser vazio')
  if (!e.cidade.trim()) erros.push('entrega.cidade nao pode ser vazia')
  if (!UFS.has(e.uf.toUpperCase())) erros.push('entrega.uf invalida')
  if (!/^\d{8}$/.test(semPontuacao(e.cep))) erros.push('entrega.cep deve ter 8 digitos')
}

export function validarSemantica(v: CriarVenda): string[] {
  const erros: string[] = []
  validarCliente(v.cliente, erros)
  validarEntrega(v.entrega, erros)
  if (v.itens.length === 0) erros.push('itens deve ter ao menos um item')
  const vistos = new Set<number>()
  v.itens.forEach((it, i) => {
    if (!Number.isInteger(it.produto_id) || it.produto_id <= 0) erros.push(`itens[${i}].produto_id deve ser inteiro positivo`)
    if (!it.nome_produto.trim()) erros.push(`itens[${i}].nome_produto nao pode ser vazio`)
    if (!Number.isInteger(it.quantidade) || it.quantidade <= 0) erros.push(`itens[${i}].quantidade deve ser inteiro positivo`)
    if (!(it.preco_unitario > 0) || !centavos(it.preco_unitario)) erros.push(`itens[${i}].preco_unitario deve ser maior que zero, com ate 2 casas decimais`)
    if (vistos.has(it.produto_id)) erros.push(`itens[${i}].produto_id repetido`)
    vistos.add(it.produto_id)
  })
  return erros
}
