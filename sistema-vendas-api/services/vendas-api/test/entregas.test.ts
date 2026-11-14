import assert from 'node:assert/strict'
import { once } from 'node:events'
import { createServer, type IncomingHttpHeaders, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { after, afterEach, before, beforeEach, describe, test } from 'node:test'
import { criarApp } from '../src/app.ts'
import { loadConfig } from '../src/config.ts'
import { abrirBanco, type Db } from '../src/db.ts'

// Consumo da API de Entregas do G7 (docs/contrato-vendas-entregas-g7.md).
// O G7 e simulado por um servidor que devolve as respostas da fila, na ordem; os corpos sao
// os do ambiente de testes do G7. Cada teste comeca com banco vazio, em memoria.

const ADMIN = 'vendas-admin-key'
const LEITURA = 'estoque-key'
const CHAVE_G7 = 'chave-do-g2-no-g7'
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

const NOVA_VENDA = {
  cliente: { nome: 'João Silva', documento: '52998224725' },
  entrega: { endereco: 'Rua 10, 250, Setor Oeste', cidade: 'Goiânia', uf: 'GO', cep: '74120020' },
  itens: [{ produto_id: 103, nome_produto: 'Mouse Optico', quantidade: 1, preco_unitario: 89.9 }],
}

// Entrega 1 do G7 (venda 101), como o G7 devolve.
const ENTREGA = {
  id_entrega: 1, codigo_rastreio: 'ENT-2026-000001', id_pedido: 101, id_cliente: 1, nome_destinatario: 'João Silva',
  transportadora: 'Jadlog',
  endereco_destino: { logradouro: 'Rua 10', numero: '250', complemento: null, bairro: 'Setor Oeste', cidade: 'Goiânia', uf: 'GO', cep: '74120-020' },
  data_prevista: '2026-11-17', valor_frete: 15.7, status_entrega: 'EM_TRANSITO', data_entrega: null, origem: 'PEDIDOS_G5', pendencias: [],
  data_criacao: '2026-11-13T12:13:56.407-03:00', data_atualizacao: '2026-11-13T12:20:28.100-03:00',
}

// Entrega 16 do G7 (venda 117), importada do G5 com pendencias, trazida para a venda 101.
const COM_PENDENCIAS = {
  ...ENTREGA, id_entrega: 16, codigo_rastreio: 'ENT-2026-000016', transportadora: null, data_prevista: null, valor_frete: null,
  endereco_destino: { ...ENTREGA.endereco_destino, numero: null, bairro: null }, status_entrega: 'AGUARDANDO_COLETA',
  pendencias: ['transportadora', 'endereco_destino.numero', 'endereco_destino.bairro', 'data_prevista', 'valor_frete'],
}

const HISTORICO = {
  status: 200,
  corpo: {
    dados: [
      { status_entrega: 'AGUARDANDO_COLETA', data_hora: '2026-11-13T12:13:56-03:00', observacao: 'Importada do pedido 101 do G5' },
      { status_entrega: 'EM_TRANSITO', data_hora: '2026-11-13T12:20:28-03:00', observacao: 'Mock: em transito' },
    ],
  },
}

const lista = (...dados: unknown[]) => ({
  status: 200,
  corpo: { dados, paginacao: { pagina: 1, tamanho: 100, total_registros: dados.length, total_paginas: dados.length ? 1 : 0 } },
})

interface RespostaG7 { status: number; corpo?: unknown }
interface LinhaLog { sistema: string; status: number | null; tentativa: number; erro: string | null; correlacao: string }

let g7: Server
let fila: RespostaG7[]
let recebidas: { caminho: string; headers: IncomingHttpHeaders }[]
let g2: { url: string; db: Db; server: Server }

before(async () => {
  g7 = createServer((req, res) => {
    recebidas.push({ caminho: req.url ?? '', headers: req.headers })
    const r = fila.shift() ?? { status: 200, corpo: {} }
    res.writeHead(r.status, { 'Content-Type': 'application/json' })
    res.end(r.corpo === undefined ? '' : JSON.stringify(r.corpo))
  }).listen(0, '127.0.0.1')
  await once(g7, 'listening')
})
after(() => {
  g7.closeAllConnections()
  g7.close()
})

beforeEach(async () => {
  fila = []
  recebidas = []
  const config = loadConfig({
    port: 0, dbPath: ':memory:', apiKeys: { [ADMIN]: 'admin', [LEITURA]: 'leitura' },
    entregas: {
      baseUrl: `http://127.0.0.1:${(g7.address() as AddressInfo).port}/api/v1`, apiKey: CHAVE_G7,
      timeoutMs: 500, retries: 1, retryDelayMs: 10,
    },
  })
  const db = abrirBanco(config.dbPath)
  const server = criarApp(config, db).listen(0, '127.0.0.1')
  await once(server, 'listening')
  g2 = { url: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, db, server }
  // Venda 101: a primeira do banco.
  const r = await fetch(`${g2.url}/api/v1/vendas`, {
    method: 'POST', headers: { 'X-API-Key': ADMIN, 'Content-Type': 'application/json' }, body: JSON.stringify(NOVA_VENDA),
  })
  assert.equal(JSON.parse(await r.text()).id, 101)
})
afterEach(() => {
  g2.server.closeAllConnections()
  g2.server.close()
  g2.db.close()
})

async function consultar(id = 101, chave = ADMIN, headers: Record<string, string> = {}) {
  const res = await fetch(`${g2.url}/api/v1/vendas/${id}/entrega`, { headers: { 'X-API-Key': chave, ...headers } })
  return { status: res.status, corpo: JSON.parse(await res.text()) }
}

const guardada = () => g2.db.prepare('SELECT id_entrega, codigo_rastreio, status_entrega, data_atualizacao FROM entregas_venda WHERE venda_id = 101').get()
const logs = () => g2.db.prepare("SELECT * FROM integracao_logs WHERE direcao = 'SAIDA' ORDER BY id").all() as unknown as LinhaLog[]

describe('Consumo da API de Entregas do G7', () => {
  test('consulta a entrega da venda e o historico, guarda o rastreio na venda e diz se mudou (regras 1, 5 e 6)', async () => {
    fila = [lista(ENTREGA), HISTORICO]
    const r = await consultar()
    assert.equal(r.status, 200)
    assert.deepEqual(r.corpo.entrega, ENTREGA)
    assert.deepEqual(r.corpo.historico, HISTORICO.corpo.dados)
    assert.deepEqual([r.corpo.leitura_anterior, r.corpo.alterada], [null, true])

    assert.deepEqual(recebidas.map((c) => c.caminho), ['/api/v1/entregas?id_pedido=101&tamanho=100', '/api/v1/entregas/1/historico'])
    for (const c of recebidas) {
      assert.equal(c.headers['x-api-key'], CHAVE_G7)
      assert.match(String(c.headers['x-request-id']), UUID_V4)
    }
    assert.deepEqual({ ...guardada() }, { id_entrega: 1, codigo_rastreio: 'ENT-2026-000001', status_entrega: 'EM_TRANSITO', data_atualizacao: ENTREGA.data_atualizacao })
    // As duas chamadas ficam no log com a mesma correlacao, que e o X-Request-Id enviado ao G7.
    const [l1, l2] = logs()
    assert.deepEqual([l1.sistema, l1.status, l2.status], ['entregas-g7', 200, 200])
    assert.equal(l1.correlacao, l2.correlacao)
    assert.equal(l1.correlacao, recebidas[0].headers['x-request-id'])

    fila = [lista(ENTREGA), HISTORICO]
    const igual = await consultar()
    assert.equal(igual.corpo.alterada, false)
    assert.equal(igual.corpo.leitura_anterior.status_entrega, 'EM_TRANSITO')

    const entregue = { ...ENTREGA, status_entrega: 'ENTREGUE', data_entrega: '2026-11-13', data_atualizacao: '2026-11-13T12:20:29.159-03:00' }
    fila = [lista(entregue), HISTORICO]
    const mudou = await consultar()
    assert.deepEqual([mudou.corpo.alterada, mudou.corpo.leitura_anterior.status_entrega], [true, 'EM_TRANSITO'])
    assert.equal((guardada() as { status_entrega: string }).status_entrega, 'ENTREGUE')
  })

  test('venda sem entrega no G7 (pedido ainda aberto): 200 com entrega null, sem chamar o historico', async () => {
    fila = [lista()]
    const r = await consultar(101, ADMIN, { 'X-Request-Id': 'painel-1' })
    assert.equal(r.status, 200)
    assert.deepEqual([r.corpo.entrega, r.corpo.historico, r.corpo.alterada], [null, [], false])
    assert.equal(recebidas.length, 1)
    // Correlacao recebida fora do formato UUID: o G7 recebe um UUID v4 novo.
    assert.match(String(recebidas[0].headers['x-request-id']), UUID_V4)
  })

  test('com pendencias, campos nulos sao normais; sem pendencias, nulo e quebra de contrato e a venda nao muda (regras 3 e 4)', async () => {
    fila = [lista(COM_PENDENCIAS), HISTORICO]
    const r = await consultar()
    assert.equal(r.status, 200)
    assert.equal(r.corpo.entrega.transportadora, null)

    fila = [lista({ ...ENTREGA, transportadora: null, endereco_destino: { ...ENTREGA.endereco_destino, bairro: null } })]
    const quebrada = await consultar()
    assert.equal(quebrada.status, 502)
    assert.equal(quebrada.corpo.erro.codigo, 'ENTREGAS_CONTRATO_INVALIDO')
    assert.deepEqual(quebrada.corpo.erro.detalhes.map((d: { campo: string }) => d.campo), ['dados.0.transportadora', 'dados.0.endereco_destino.bairro'])
    assert.equal((guardada() as { id_entrega: number }).id_entrega, 16, 'a leitura anterior continua valendo')
    assert.match(String(logs().at(-1)?.erro), /^fora do contrato: dados\.0\.transportadora nulo sem pendencias/)
  })

  test('resposta fora do contrato e recusada: status fora do enum, outra venda, campo ausente, tipo errado (regra 3)', async () => {
    const { codigo_rastreio: _, ...semRastreio } = ENTREGA
    const casos: [unknown, string][] = [
      [{ ...ENTREGA, status_entrega: 'EXTRAVIADA' }, 'dados.0.status_entrega'],
      [{ ...ENTREGA, id_pedido: 102 }, 'dados.0.id_pedido'],
      [semRastreio, 'dados.0.codigo_rastreio'],
      [{ ...ENTREGA, valor_frete: '15.70' }, 'dados.0.valor_frete'],
      [{ ...ENTREGA, status_entrega: 'ENTREGUE' }, 'dados.0.data_entrega'],
    ]
    for (const [entrega, campo] of casos) {
      fila = [lista(entrega)]
      const r = await consultar()
      assert.equal(r.status, 502, campo)
      assert.equal(r.corpo.erro.codigo, 'ENTREGAS_CONTRATO_INVALIDO', campo)
      assert.deepEqual(r.corpo.erro.detalhes.map((d: { campo: string }) => d.campo), [campo])
    }
    fila = [{ status: 200, corpo: { dados: [ENTREGA] } }]
    assert.equal((await consultar()).corpo.erro.detalhes[0].campo, 'paginacao')
    fila = [lista(ENTREGA, { ...ENTREGA, id_entrega: 2 })]
    assert.equal((await consultar()).corpo.erro.detalhes[0].problema, 'mais de uma entrega nao cancelada para a mesma venda')
    assert.equal(guardada(), undefined)
  })

  test('campos novos sao ignorados (regra 7) e, com mais de uma entrega, vale a nao cancelada', async () => {
    const cancelada = { ...COM_PENDENCIAS, id_entrega: 9, status_entrega: 'CANCELADA' }
    fila = [lista(cancelada, { ...ENTREGA, campo_novo: 'x' }), HISTORICO]
    const r = await consultar()
    assert.equal(r.status, 200)
    assert.equal(r.corpo.entrega.id_entrega, 1)
    assert.equal('campo_novo' in r.corpo.entrega, false)
  })

  test('falhas do G7: 503 passageiro e superado; 401 vira 502 ENTREGAS_AUTENTICACAO; G7 fora do ar vira 503', async () => {
    fila = [{ status: 503 }, lista(ENTREGA), HISTORICO]
    assert.equal((await consultar()).status, 200)
    assert.deepEqual(logs().map((l) => [l.status, l.tentativa]), [[503, 1], [200, 2], [200, 1]])

    fila = [{ status: 401, corpo: { erro: { status: 401, codigo: 'NAO_AUTENTICADO', mensagem: 'X-API-Key ausente ou inválida.', detalhes: [] } } }]
    const negado = await consultar()
    assert.deepEqual([negado.status, negado.corpo.erro.codigo], [502, 'ENTREGAS_AUTENTICACAO'])

    fila = [{ status: 503 }, { status: 503 }]
    const fora = await consultar()
    assert.deepEqual([fora.status, fora.corpo.erro.codigo], [503, 'ENTREGAS_INDISPONIVEL'])
  })

  test('venda inexistente: 404 sem chamar o G7; a chave do G4 nao usa a rota (403)', async () => {
    const r = await consultar(999)
    assert.deepEqual([r.status, r.corpo.erro.codigo], [404, 'VENDA_NAO_ENCONTRADA'])
    const g4 = await consultar(101, LEITURA)
    assert.deepEqual([g4.status, g4.corpo.erro.codigo], [403, 'SEM_PERMISSAO'])
    assert.equal(recebidas.length, 0)
  })
})
