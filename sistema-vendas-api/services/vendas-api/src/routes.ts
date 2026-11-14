import { Router, type Request } from 'express'
import { apenasAdmin } from './auth.ts'
import type { Db } from './db.ts'
import type { EntregasService } from './entregasService.ts'
import { HttpError } from './errors.ts'
import { atualizarVendaSchema, criarVendaSchema } from './schemas.ts'
import type { VendasService } from './vendasService.ts'

function idDaRota(raw: string): number {
  const id = Number(raw)
  if (!/^\d+$/.test(raw) || id < 1 || !Number.isSafeInteger(id)) throw new HttpError(400, 'ID_INVALIDO', 'id deve ser um inteiro positivo')
  return id
}

function validarFormato<T>(schema: { safeParse(v: unknown): { success: boolean; data?: T; error?: { issues: { path: PropertyKey[]; message: string }[] } } }, corpo: unknown): T {
  const r = schema.safeParse(corpo)
  if (!r.success) {
    throw new HttpError(400, 'FORMATO_INVALIDO', 'Corpo da requisicao fora do contrato',
      r.error!.issues.map((i) => ({ campo: i.path.join('.'), problema: i.message })))
  }
  return r.data as T
}

export function rotasVendas(servico: VendasService, entregas: EntregasService): Router {
  const r = Router()

  r.get('/', (req, res) => {
    const texto = (nome: string) => {
      const v = req.query[nome]
      if (v === undefined || typeof v === 'string') return v
      throw new HttpError(400, 'PARAMETRO_INVALIDO', `${nome} deve ser informado uma unica vez`)
    }
    res.json(servico.listar({ status: texto('status'), data_inicio: texto('data_inicio'), data_fim: texto('data_fim') }))
  })

  r.get('/:id', (req, res) => {
    res.json(servico.obter(idDaRota(req.params.id)))
  })

  // Consulta a entrega da venda na API do G7 e guarda o rastreio na venda. Fora do contrato com o G4.
  r.get('/:id/entrega', apenasAdmin, async (req: Request<{ id: string }>, res) => {
    res.json(await entregas.consultar(idDaRota(req.params.id), { correlacao: res.locals.correlacao }))
  })

  r.post('/', (req, res) => {
    if (!req.is('application/json')) {
      throw new HttpError(400, 'CONTENT_TYPE_INVALIDO', 'Content-Type deve ser application/json')
    }
    const dados = validarFormato(criarVendaSchema, req.body)
    const chave = req.header('idempotency-key') || undefined
    const { venda, repetida } = servico.criar(dados, chave)
    if (repetida) res.setHeader('Idempotent-Replayed', 'true')
    res.status(repetida ? 200 : 201).location(`/api/v1/vendas/${venda.id}`).json(venda)
  })

  r.put('/:id', (req, res) => {
    if (!req.is('application/json')) {
      throw new HttpError(400, 'CONTENT_TYPE_INVALIDO', 'Content-Type deve ser application/json')
    }
    const id = idDaRota(req.params.id)
    const dados = validarFormato(atualizarVendaSchema, req.body)
    res.json(servico.atualizar(id, dados))
  })

  r.delete('/:id', (req, res) => {
    servico.excluir(idDaRota(req.params.id))
    res.status(204).end()
  })

  return r
}

export function rotasLogs(db: Db): Router {
  const r = Router()
  r.get('/', (req, res) => {
    const limite = Math.min(Number(req.query.limite) || 50, 500)
    const direcao = req.query.direcao === 'ENTRADA' || req.query.direcao === 'SAIDA' ? req.query.direcao : null
    const sql = `SELECT * FROM integracao_logs ${direcao ? 'WHERE direcao = ?' : ''} ORDER BY id DESC LIMIT ?`
    res.json(db.prepare(sql).all(...(direcao ? [direcao, limite] : [limite])))
  })
  return r
}
