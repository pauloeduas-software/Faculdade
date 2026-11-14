import { z } from 'zod'
import { criarClienteHttp, problemasZod, type Contexto, type Problema } from './clienteHttp.ts'
import type { Config } from './config.ts'
import type { Db } from './db.ts'

// Consumidor da API de Entregas do G7 (docs/contrato-vendas-entregas-g7.md e o
// /openapi.json do G7). O G2 so consulta: a chave do G2 e somente leitura.
// Campos que o G2 nao conhece sao ignorados (regra 7 do contrato); o resto e validado (regra 3).

export const STATUS_ENTREGA = [
  'AGUARDANDO_COLETA', 'EM_TRANSITO', 'SAIU_PARA_ENTREGA', 'ENTREGUE', 'NAO_ENTREGUE', 'DEVOLVIDA', 'CANCELADA',
] as const

const statusEntrega = z.enum(STATUS_ENTREGA)
const data = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'deve ser data AAAA-MM-DD')
const dataHora = z.string().refine((v) => /^\d{4}-\d{2}-\d{2}T/.test(v) && !Number.isNaN(Date.parse(v)), 'deve ser data-hora ISO 8601')

const entrega = z
  .object({
    id_entrega: z.number().int().positive(),
    codigo_rastreio: z.string().min(1),
    id_pedido: z.number().int().positive(),
    id_cliente: z.number().int().nullable(),
    nome_destinatario: z.string(),
    transportadora: z.string().nullable(),
    endereco_destino: z.object({
      logradouro: z.string(),
      numero: z.string().nullable(),
      complemento: z.string().nullable(),
      bairro: z.string().nullable(),
      cidade: z.string(),
      uf: z.string(),
      cep: z.string(),
    }),
    data_prevista: data.nullable(),
    valor_frete: z.number().min(0).nullable(),
    status_entrega: statusEntrega,
    data_entrega: data.nullable(),
    origem: z.string(),
    pendencias: z.array(z.string()),
    data_criacao: dataHora,
    data_atualizacao: dataHora,
  })
  .superRefine((e, ctx) => {
    // Regra 4: esses campos so podem vir nulos enquanto a entrega tem pendencias.
    if (e.pendencias.length === 0) {
      const anulaveis = {
        transportadora: e.transportadora,
        data_prevista: e.data_prevista,
        valor_frete: e.valor_frete,
        'endereco_destino.numero': e.endereco_destino.numero,
        'endereco_destino.bairro': e.endereco_destino.bairro,
      }
      for (const [campo, valor] of Object.entries(anulaveis)) {
        if (valor === null) ctx.addIssue({ code: 'custom', path: campo.split('.'), message: 'nulo sem pendencias' })
      }
    }
    if (e.status_entrega === 'ENTREGUE' && e.data_entrega === null) {
      ctx.addIssue({ code: 'custom', path: ['data_entrega'], message: 'obrigatoria com status ENTREGUE' })
    }
  })

const listaEntregas = z.object({
  dados: z.array(entrega),
  paginacao: z.object({
    pagina: z.number().int(), tamanho: z.number().int(), total_registros: z.number().int(), total_paginas: z.number().int(),
  }),
})

const historico = z.object({
  dados: z.array(z.object({ status_entrega: statusEntrega, data_hora: dataHora, observacao: z.string().nullable() })),
})

export type Entrega = z.infer<typeof entrega>
export type ItemHistorico = z.infer<typeof historico>['dados'][number]

export function criarEntregasClient(config: Config, db: Db) {
  const http = criarClienteHttp({ sistema: 'entregas-g7', nome: 'Entregas (G7)', prefixo: 'ENTREGAS', ...config.entregas }, db)

  return {
    // GET /entregas?id_pedido={venda}. Lista vazia: o pedido ainda nao gerou entrega no G7.
    async porVenda(vendaId: number, ctx: Contexto): Promise<Entrega[]> {
      const r = await http.chamar('GET', `/entregas?id_pedido=${vendaId}&tamanho=100`, undefined, ctx)
      if (r.status !== 200) return http.erroGenerico(r, `consultar as entregas da venda ${vendaId}`)
      const p = listaEntregas.safeParse(r.corpo)
      if (!p.success) return http.violacao(r, `Resposta do G7 para a venda ${vendaId} nao segue o contrato`, problemasZod(p.error))
      const problemas: Problema[] = []
      p.data.dados.forEach((e, i) => {
        if (e.id_pedido !== vendaId) problemas.push({ campo: `dados.${i}.id_pedido`, problema: `esperado ${vendaId}, recebido ${e.id_pedido}` })
      })
      // O id_pedido e unico entre as entregas nao canceladas (contrato do G7).
      if (p.data.dados.filter((e) => e.status_entrega !== 'CANCELADA').length > 1) {
        problemas.push({ campo: 'dados', problema: 'mais de uma entrega nao cancelada para a mesma venda' })
      }
      if (problemas.length) return http.violacao(r, `Resposta do G7 para a venda ${vendaId} nao segue o contrato`, problemas)
      return p.data.dados
    },

    // GET /entregas/{id}/historico, da mudanca mais antiga para a mais recente.
    async historico(idEntrega: number, ctx: Contexto): Promise<ItemHistorico[]> {
      const r = await http.chamar('GET', `/entregas/${idEntrega}/historico`, undefined, ctx)
      if (r.status !== 200) return http.erroGenerico(r, `consultar o historico da entrega ${idEntrega}`)
      const p = historico.safeParse(r.corpo)
      if (!p.success) return http.violacao(r, `Historico da entrega ${idEntrega} nao segue o contrato`, problemasZod(p.error))
      return p.data.dados
    },
  }
}

export type EntregasClient = ReturnType<typeof criarEntregasClient>
