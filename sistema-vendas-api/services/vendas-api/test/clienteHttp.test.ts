import assert from 'node:assert/strict'
import { once } from 'node:events'
import { createServer, type IncomingHttpHeaders, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { after, afterEach, before, beforeEach, describe, test } from 'node:test'
import { criarClienteHttp, type Destino } from '../src/clienteHttp.ts'
import { abrirBanco, type Db } from '../src/db.ts'
import { HttpError } from '../src/errors.ts'

// Base do consumidor da API de Entregas (G7): timeout, novas tentativas e log de cada chamada.
// O outro grupo e simulado por um servidor que devolve as respostas da fila, na ordem.

const TIMEOUT_MS = 200

interface Resposta { status: number; corpo?: unknown; texto?: string; atrasoMs?: number; headers?: Record<string, string> }
interface LinhaLog { sistema: string; metodo: string; url: string; status: number | null; tentativa: number; erro: string | null; correlacao: string }

let servidor: Server
let url: string
let fila: Resposta[]
let recebidas: { metodo: string; caminho: string; headers: IncomingHttpHeaders; corpo: string }[]
let db: Db

before(async () => {
  servidor = createServer(async (req, res) => {
    let corpo = ''
    for await (const parte of req) corpo += parte
    recebidas.push({ metodo: req.method ?? '', caminho: req.url ?? '', headers: req.headers, corpo })
    const r = fila.shift() ?? { status: 200, corpo: {} }
    if (r.atrasoMs) await new Promise((ok) => setTimeout(ok, r.atrasoMs))
    if (res.destroyed) return
    res.writeHead(r.status, { 'Content-Type': r.texto === undefined ? 'application/json' : 'text/html', ...r.headers })
    res.end(r.texto ?? (r.corpo === undefined ? '' : JSON.stringify(r.corpo)))
  }).listen(0, '127.0.0.1')
  await once(servidor, 'listening')
  url = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}/api/v1`
})
after(() => {
  servidor.closeAllConnections()
  servidor.close()
})
beforeEach(() => {
  fila = []
  recebidas = []
  db = abrirBanco(':memory:')
})
afterEach(() => db.close())

const destino = (baseUrl = url): Destino => ({
  sistema: 'entregas-g7', nome: 'Entregas', prefixo: 'ENTREGAS', baseUrl, apiKey: 'chave-do-g7',
  timeoutMs: TIMEOUT_MS, retries: 2, retryDelayMs: 10,
})
const CORRELACAO = '3f6c1e2a-8b7d-4c11-9a52-0e4b7d9f1a23'
const ctx = { correlacao: CORRELACAO }
const logs = () => db.prepare("SELECT * FROM integracao_logs WHERE direcao = 'SAIDA' ORDER BY id").all() as unknown as LinhaLog[]
const erroDe = async (p: Promise<unknown>) => {
  try {
    await p
  } catch (e) {
    assert.ok(e instanceof HttpError)
    return e
  }
  assert.fail('deveria falhar')
}

describe('Cliente HTTP do consumidor (usado com o G7)', () => {
  test('envia chave, correlacao, origem e Idempotency-Key e registra a chamada no log', async () => {
    fila = [{ status: 201, corpo: { id: 7 } }]
    const r = await criarClienteHttp(destino(), db).chamar('POST', '/entregas', { venda_id: 1 }, { ...ctx, idempotencyKey: 'chave-1' })
    assert.deepEqual([r.status, r.corpo], [201, { id: 7 }])
    const [c] = recebidas
    assert.equal(c.caminho, '/api/v1/entregas')
    assert.equal(c.corpo, '{"venda_id":1}')
    assert.equal(c.headers['x-api-key'], 'chave-do-g7')
    assert.equal(c.headers['x-request-id'], CORRELACAO)
    assert.equal(c.headers['x-sistema-origem'], 'vendas-g2')
    assert.equal(c.headers['idempotency-key'], 'chave-1')
    const [l] = logs()
    assert.deepEqual([l.sistema, l.metodo, l.status, l.tentativa, l.correlacao], ['entregas-g7', 'POST', 201, 1, CORRELACAO])
  })

  test('X-Request-Id sempre em UUID v4: correlacao em outro formato e trocada por um UUID novo', async () => {
    await criarClienteHttp(destino(), db).chamar('GET', '/entregas', undefined, { correlacao: 'g4-123' })
    assert.match(String(recebidas[0].headers['x-request-id']), /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
    assert.equal(logs()[0].correlacao, 'g4-123')
  })

  test('503 passageiro: nova tentativa com a mesma Idempotency-Key e a chamada passa', async () => {
    fila = [{ status: 503 }, { status: 200, corpo: { ok: true } }]
    const r = await criarClienteHttp(destino(), db).chamar('POST', '/entregas', {}, { ...ctx, idempotencyKey: 'chave-1' })
    assert.equal(r.status, 200)
    assert.deepEqual(logs().map((l) => [l.status, l.tentativa]), [[503, 1], [200, 2]])
    assert.deepEqual(recebidas.map((c) => c.headers['idempotency-key']), ['chave-1', 'chave-1'])
  })

  test('503 em todas as tentativas: ENTREGAS_INDISPONIVEL depois de 3 chamadas', async () => {
    fila = [{ status: 503 }, { status: 503 }, { status: 503 }]
    const e = await erroDe(criarClienteHttp(destino(), db).chamar('GET', '/entregas/1', undefined, ctx))
    assert.deepEqual([e.status, e.codigo], [503, 'ENTREGAS_INDISPONIVEL'])
    assert.equal(recebidas.length, 3)
  })

  test('lentidao acima do timeout conta como indisponivel', async () => {
    fila = [1, 2, 3].map(() => ({ status: 200, corpo: {}, atrasoMs: TIMEOUT_MS + 100 }))
    const e = await erroDe(criarClienteHttp(destino(), db).chamar('GET', '/entregas/1', undefined, ctx))
    assert.equal(e.codigo, 'ENTREGAS_INDISPONIVEL')
    assert.match(e.message, /timeout/)
    assert.deepEqual(logs().map((l) => l.status), [null, null, null])
  })

  test('G7 fora do ar: 3 tentativas registradas, sem derrubar o G2', async () => {
    const e = await erroDe(criarClienteHttp(destino('http://127.0.0.1:1/api/v1'), db).chamar('GET', '/entregas/1', undefined, ctx))
    assert.equal(e.codigo, 'ENTREGAS_INDISPONIVEL')
    assert.deepEqual(logs().map((l) => [l.status, l.tentativa]), [[null, 1], [null, 2], [null, 3]])
  })

  test('corpo que nao e JSON: 502 ENTREGAS_RESPOSTA_INVALIDA, sem nova tentativa', async () => {
    fila = [{ status: 200, texto: '<html>Erro</html>' }]
    const e = await erroDe(criarClienteHttp(destino(), db).chamar('GET', '/entregas/1', undefined, ctx))
    assert.deepEqual([e.status, e.codigo], [502, 'ENTREGAS_RESPOSTA_INVALIDA'])
    assert.equal(recebidas.length, 1)
    assert.equal(logs()[0].erro, 'resposta nao e JSON valido')
  })

  test('500 tambem ganha novas tentativas; se persistir, 503 ENTREGAS_ERRO_INTERNO', async () => {
    fila = [1, 2, 3].map(() => ({ status: 500, corpo: { erro: { codigo: 'ERRO_INTERNO', mensagem: 'injetado no teste' } } }))
    const e = await erroDe(criarClienteHttp(destino(), db).chamar('GET', '/entregas/1', undefined, ctx))
    assert.deepEqual([e.status, e.codigo], [503, 'ENTREGAS_ERRO_INTERNO'])
    assert.match(e.message, /500 ERRO_INTERNO/)
    assert.deepEqual(logs().map((l) => [l.status, l.tentativa, l.erro]), [1, 2, 3].map((t) => [500, t, 'ERRO_INTERNO: injetado no teste']))
  })

  test('5xx com pagina HTML (proxy na frente do outro grupo) e falha passageira, nao resposta invalida', async () => {
    fila = [{ status: 502, texto: '<html>Bad gateway</html>' }, { status: 200, corpo: { ok: true } }]
    const r = await criarClienteHttp(destino(), db).chamar('GET', '/entregas/1', undefined, ctx)
    assert.equal(r.status, 200)
    assert.deepEqual(logs().map((l) => [l.status, l.erro]), [[502, 'servico respondeu 502'], [200, null]])
  })

  test('Retry-After do 503 e respeitado; acima de 10 s o G2 desiste sem esperar', async () => {
    fila = [{ status: 503, headers: { 'Retry-After': '1' } }, { status: 200, corpo: {} }]
    const inicio = Date.now()
    await criarClienteHttp(destino(), db).chamar('GET', '/entregas/1', undefined, ctx)
    assert.ok(Date.now() - inicio >= 1000, 'esperou o Retry-After')

    fila = [{ status: 503, headers: { 'Retry-After': '120' } }]
    recebidas = []
    const e = await erroDe(criarClienteHttp(destino(), db).chamar('GET', '/entregas/1', undefined, ctx))
    assert.equal(e.codigo, 'ENTREGAS_INDISPONIVEL')
    assert.match(e.message, /120 s/)
    assert.equal(recebidas.length, 1)
  })

  test('erroGenerico: 401/403 e status nao previsto, com o codigo do G7 na mensagem e no log', async () => {
    const cliente = criarClienteHttp(destino(), db)
    const casos: [number, string, number, string][] = [
      [401, 'NAO_AUTENTICADO', 502, 'ENTREGAS_AUTENTICACAO'],
      [404, 'NAO_ENCONTRADO', 502, 'ENTREGAS_RESPOSTA_INESPERADA'],
    ]
    for (const [status, codG7, esperado, cod] of casos) {
      fila = [{ status, corpo: { erro: { codigo: codG7, mensagem: 'injetado no teste' } } }]
      const r = await cliente.chamar('GET', '/entregas/1', undefined, ctx)
      const e = await erroDe(Promise.resolve().then(() => cliente.erroGenerico(r, 'consultar a entrega 1')))
      assert.deepEqual([e.status, e.codigo], [esperado, cod])
      assert.match(e.message, new RegExp(`${status} ${codG7}`))
    }
    assert.deepEqual(logs().map((l) => l.erro), ['NAO_AUTENTICADO: injetado no teste', 'NAO_ENCONTRADO: injetado no teste'])
  })

  test('violacao: resposta 200 fora do contrato e recusada e marcada no log', async () => {
    fila = [{ status: 200, corpo: { id: 7 } }]
    const cliente = criarClienteHttp(destino(), db)
    const r = await cliente.chamar('GET', '/entregas/7', undefined, ctx)
    const e = await erroDe(Promise.resolve().then(() =>
      cliente.violacao(r, 'Resposta do G7 sem status', [{ campo: 'status', problema: 'ausente' }])))
    assert.deepEqual([e.status, e.codigo], [502, 'ENTREGAS_CONTRATO_INVALIDO'])
    assert.deepEqual(e.detalhes, [{ campo: 'status', problema: 'ausente' }])
    assert.equal(logs()[0].erro, 'fora do contrato: status ausente')
  })
})
