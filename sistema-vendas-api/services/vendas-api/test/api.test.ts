import assert from 'node:assert/strict'
import { once } from 'node:events'
import type { Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterEach, beforeEach, describe, test } from 'node:test'
import { criarApp } from '../src/app.ts'
import { loadConfig } from '../src/config.ts'
import { abrirBanco, type Db } from '../src/db.ts'

// Testa a API de Vendas por HTTP, como o G4 a usa (docs/contrato-vendas-estoque-g4.md).
// Cada teste comeca com banco vazio, em memoria: o vendas.db nao e usado.

const ADMIN = 'vendas-admin-key'
const LEITURA = 'estoque-key'

const NOVA_VENDA = {
  cliente: { nome: 'Ana Clara Ribeiro', documento: '529.982.247-25' },
  entrega: { endereco: 'Rua Augusta, 1520, ap. 34', cidade: 'São Paulo', uf: 'sp', cep: '01304-001' },
  itens: [
    { produto_id: 101, nome_produto: 'Teclado Mecanico', quantidade: 1, preco_unitario: 250.9 },
    { produto_id: 103, nome_produto: 'Mouse Optico', quantidade: 2, preco_unitario: 89.9 },
  ],
}

interface LinhaLog { direcao: string; sistema: string; metodo: string; url: string; status: number | null }

let g2: { url: string; db: Db; server: Server }

async function iniciarG2() {
  const config = loadConfig({ port: 0, dbPath: ':memory:', apiKeys: { [ADMIN]: 'admin', [LEITURA]: 'leitura' } })
  const db = abrirBanco(config.dbPath)
  const server = criarApp(config, db).listen(0, '127.0.0.1')
  await once(server, 'listening')
  return { url: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, db, server }
}

async function api(metodo: string, caminho: string, opcoes: { chave?: string | null; corpo?: unknown; headers?: Record<string, string> } = {}) {
  const { chave = ADMIN, corpo, headers = {} } = opcoes
  const res = await fetch(`${g2.url}${caminho}`, {
    method: metodo,
    headers: {
      ...(chave ? { 'X-API-Key': chave } : {}),
      ...(corpo !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    body: corpo === undefined ? undefined : typeof corpo === 'string' ? corpo : JSON.stringify(corpo),
  })
  const texto = await res.text()
  return { status: res.status, headers: res.headers, corpo: texto ? JSON.parse(texto) : undefined }
}

const criarVenda = (corpo: unknown = NOVA_VENDA, headers?: Record<string, string>) => api('POST', '/api/v1/vendas', { corpo, headers })
const atualizar = (id: number, status?: string, entrega = NOVA_VENDA.entrega) =>
  api('PUT', `/api/v1/vendas/${id}`, { corpo: { cliente: NOVA_VENDA.cliente, entrega, ...(status ? { status } : {}) } })
const cancelar = (id: number) => atualizar(id, 'CANCELADA')
const codigo = (r: { corpo?: { erro?: { codigo?: string } } }) => r.corpo?.erro?.codigo
const contar = (tabela: string) => (g2.db.prepare(`SELECT COUNT(*) AS n FROM ${tabela}`).get() as { n: number }).n
const comItem = (item: Record<string, unknown>) => ({ ...NOVA_VENDA, itens: [{ ...NOVA_VENDA.itens[0], ...item }] })

beforeEach(async () => { g2 = await iniciarG2() })
afterEach(() => {
  g2.server.closeAllConnections()
  g2.server.close()
  g2.db.close()
})

describe('Contrato com o G4: API de Vendas', () => {
  test('GET /health responde sem chave', async () => {
    const r = await api('GET', '/health', { chave: null })
    assert.equal(r.status, 200)
    assert.deepEqual(r.corpo, { status: 'ok', servico: 'vendas-g2', versao: '1.0' })
  })

  test('autenticacao: 401 sem chave ou com chave invalida, 403 para a chave do G4 em escrita (secao 2)', async () => {
    const sem = await api('GET', '/api/v1/vendas', { chave: null })
    assert.equal(sem.status, 401)
    assert.equal(codigo(sem), 'NAO_AUTENTICADO')
    const invalida = await api('GET', '/api/v1/vendas', { chave: 'chave-errada' })
    assert.equal(invalida.status, 401)
    assert.equal(codigo(invalida), 'CHAVE_INVALIDA')
    assert.equal((await api('GET', '/api/v1/vendas', { chave: LEITURA })).status, 200)

    for (const [metodo, caminho] of [['POST', '/api/v1/vendas'], ['PUT', '/api/v1/vendas/1'], ['DELETE', '/api/v1/vendas/1']]) {
      const r = await api(metodo, caminho, { chave: LEITURA, corpo: metodo === 'DELETE' ? undefined : NOVA_VENDA })
      assert.equal(r.status, 403, metodo)
      assert.equal(codigo(r), 'SEM_PERMISSAO', metodo)
    }
    assert.equal((await api('GET', '/api/v1/integracao/logs', { chave: LEITURA })).status, 403)
    // Sem chave, o 401 vem antes de olhar o corpo.
    assert.equal(codigo(await api('POST', '/api/v1/vendas', { chave: null, corpo: '{quebrado' })), 'NAO_AUTENTICADO')
    assert.equal(contar('vendas'), 0)
  })

  test('POST registra a venda CONFIRMADA, calcula subtotais e total e devolve 201 no formato 4.1 (3.3)', async () => {
    const r = await criarVenda()
    assert.equal(r.status, 201)
    // A numeracao comeca em 101, como as vendas do ambiente de testes do G7.
    assert.equal(r.headers.get('location'), '/api/v1/vendas/101')
    const v = r.corpo
    assert.deepEqual(Object.keys(v), ['id', 'cliente', 'entrega', 'itens', 'valor_total', 'status', 'motivo_cancelamento', 'criado_em', 'atualizado_em'])
    assert.deepEqual(v.cliente, { nome: 'Ana Clara Ribeiro', documento: '52998224725' })
    assert.deepEqual(v.entrega, { endereco: 'Rua Augusta, 1520, ap. 34', cidade: 'São Paulo', uf: 'SP', cep: '01304001' })
    assert.deepEqual(v.itens, [
      { produto_id: 101, nome_produto: 'Teclado Mecanico', quantidade: 1, preco_unitario: 250.9, subtotal: 250.9 },
      { produto_id: 103, nome_produto: 'Mouse Optico', quantidade: 2, preco_unitario: 89.9, subtotal: 179.8 },
    ])
    assert.equal(v.valor_total, 430.7)
    assert.equal(v.status, 'CONFIRMADA')
    assert.equal(v.motivo_cancelamento, null)
    assert.match(v.criado_em, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
    assert.equal(contar('itens_venda'), 2)
  })

  test('POST repetido com a mesma Idempotency-Key devolve a venda original, sem criar outra (3.3)', async () => {
    const primeira = await criarVenda(NOVA_VENDA, { 'Idempotency-Key': 'pedido-77' })
    const repetida = await criarVenda(NOVA_VENDA, { 'Idempotency-Key': 'pedido-77' })
    assert.equal(primeira.status, 201)
    assert.equal(repetida.status, 200)
    assert.equal(repetida.headers.get('idempotent-replayed'), 'true')
    assert.deepEqual(repetida.corpo, primeira.corpo)
    assert.equal(contar('vendas'), 1)
  })

  test('GET /vendas: o G4 encontra as vendas a baixar e as canceladas, e filtros invalidos dao 400 (3.1)', async () => {
    await criarVenda()
    await criarVenda()
    await cancelar(102)
    const hoje = new Date().toISOString().slice(0, 10)
    const listar = (q: string) => api('GET', `/api/v1/vendas${q}`, { chave: LEITURA })
    const ids = async (q: string) => (await listar(q)).corpo.map((v: { id: number }) => v.id)

    assert.deepEqual(await ids(''), [101, 102])
    assert.deepEqual(await ids('?status=CONFIRMADA'), [101])
    assert.deepEqual(await ids('?status=CANCELADA'), [102])
    assert.deepEqual(await ids(`?data_inicio=${hoje}&data_fim=${hoje}`), [101, 102])
    assert.deepEqual(await ids(`?status=CONFIRMADA&data_fim=${hoje}`), [101])
    assert.deepEqual(await ids('?data_fim=2000-01-01'), [])
    assert.deepEqual(await ids('?data_inicio=2999-01-01T00:00:00Z'), [])

    for (const q of ['?status=PENDENTE', '?data_inicio=1', '?data_fim=2026-02-31', '?data_inicio=ontem', '?status=CONFIRMADA&status=CANCELADA']) {
      const r = await listar(q)
      assert.equal(r.status, 400, q)
      assert.equal(codigo(r), 'PARAMETRO_INVALIDO', q)
    }
  })

  test('GET /vendas/{id}: 200, 404 VENDA_NAO_ENCONTRADA e 400 ID_INVALIDO (3.2)', async () => {
    await criarVenda()
    const r = await api('GET', '/api/v1/vendas/101', { chave: LEITURA })
    assert.equal(r.status, 200)
    assert.equal(r.corpo.id, 101)
    const inexistente = await api('GET', '/api/v1/vendas/999', { chave: LEITURA })
    assert.equal(inexistente.status, 404)
    assert.equal(codigo(inexistente), 'VENDA_NAO_ENCONTRADA')
    for (const id of ['abc', '0', '-1', '1.5', '99999999999999999999']) {
      const invalido = await api('GET', `/api/v1/vendas/${id}`, { chave: LEITURA })
      assert.equal(invalido.status, 400, id)
      assert.equal(codigo(invalido), 'ID_INVALIDO', id)
    }
  })

  test('POST separa formato (400) de regra de negocio (422) e nao grava nada (4.2)', async () => {
    const tipo = await api('POST', '/api/v1/vendas', { corpo: JSON.stringify(NOVA_VENDA), headers: { 'Content-Type': 'text/plain' } })
    assert.equal(tipo.status, 400)
    assert.equal(codigo(tipo), 'CONTENT_TYPE_INVALIDO')
    const malformado = await criarVenda('{"cliente": ')
    assert.equal(malformado.status, 400)
    assert.equal(codigo(malformado), 'JSON_INVALIDO')

    const texto = await criarVenda(comItem({ quantidade: '2' }))
    assert.equal(texto.status, 400)
    assert.equal(codigo(texto), 'FORMATO_INVALIDO')
    assert.deepEqual(texto.corpo.erro.detalhes.map((d: { campo: string }) => d.campo), ['itens.0.quantidade'])
    assert.equal(codigo(await criarVenda(comItem({ preco_unitario: '250.90' }))), 'FORMATO_INVALIDO')
    assert.equal(codigo(await criarVenda(comItem({ subtotal: 250.9 }))), 'FORMATO_INVALIDO')
    const { nome_produto: _, ...semNome } = NOVA_VENDA.itens[0]
    assert.equal(codigo(await criarVenda({ ...NOVA_VENDA, itens: [semNome] })), 'FORMATO_INVALIDO')
    assert.equal(codigo(await criarVenda({ cliente: NOVA_VENDA.cliente, itens: NOVA_VENDA.itens })), 'FORMATO_INVALIDO')

    const regras = await criarVenda({
      cliente: { nome: 'A', documento: 'abc52998224725' },
      entrega: { endereco: ' ', cidade: 'Recife', uf: 'XX', cep: '5000000' },
      itens: [
        { produto_id: 101, nome_produto: ' ', quantidade: 0, preco_unitario: 0 },
        { produto_id: 101, nome_produto: 'Teclado', quantidade: 1.5, preco_unitario: 10.999 },
        { produto_id: -3, nome_produto: 'Mouse', quantidade: 1, preco_unitario: 89.9 },
      ],
    })
    assert.equal(regras.status, 422)
    assert.equal(codigo(regras), 'DADOS_INVALIDOS')
    assert.equal(regras.corpo.erro.detalhes.length, 12)
    assert.ok(regras.corpo.erro.detalhes.every((d: unknown) => typeof d === 'string'))
    assert.equal(codigo(await criarVenda({ ...NOVA_VENDA, itens: [] })), 'DADOS_INVALIDOS')
    assert.equal(codigo(await criarVenda(comItem({ preco_unitario: -5 }))), 'DADOS_INVALIDOS')

    assert.equal(contar('vendas'), 0)
  })

  test('preco com 2 casas e aceito e o total sai arredondado em centavos', async () => {
    const r = await criarVenda(comItem({ quantidade: 3, preco_unitario: 0.1 }))
    assert.equal(r.status, 201)
    assert.equal(r.corpo.itens[0].subtotal, 0.3)
    assert.equal(r.corpo.valor_total, 0.3)
  })

  test('PUT segue a tabela de status; cancelar move a venda para ?status=CANCELADA (3.4)', async () => {
    await criarVenda()
    const editada = await atualizar(101, undefined, { ...NOVA_VENDA.entrega, endereco: 'Rua Augusta, 1600' })
    assert.equal(editada.status, 200)
    assert.equal(editada.corpo.entrega.endereco, 'Rua Augusta, 1600')
    assert.equal(editada.corpo.status, 'CONFIRMADA')
    assert.equal(codigo(await atualizar(101, 'PENDENTE')), 'FORMATO_INVALIDO')
    assert.equal((await atualizar(101, undefined, { ...NOVA_VENDA.entrega, cep: '123' })).status, 422)

    const cancelada = await cancelar(101)
    assert.equal(cancelada.status, 200)
    assert.equal(cancelada.corpo.status, 'CANCELADA')
    assert.equal(cancelada.corpo.motivo_cancelamento, 'cancelada via API')
    assert.ok(cancelada.corpo.atualizado_em >= editada.corpo.atualizado_em)
    const canceladas = await api('GET', '/api/v1/vendas?status=CANCELADA', { chave: LEITURA })
    assert.deepEqual(canceladas.corpo.map((v: { id: number }) => v.id), [101])

    const outra = await atualizar(101, 'CONFIRMADA')
    assert.equal(outra.status, 409)
    assert.equal(codigo(outra), 'VENDA_CANCELADA')
    assert.equal(codigo(await atualizar(999)), 'VENDA_NAO_ENCONTRADA')
  })

  test('DELETE: 409 para venda confirmada, 204 depois de cancelada (3.5)', async () => {
    await criarVenda()
    const confirmada = await api('DELETE', '/api/v1/vendas/101')
    assert.equal(confirmada.status, 409)
    assert.equal(codigo(confirmada), 'VENDA_CONFIRMADA')
    await cancelar(101)
    const r = await api('DELETE', '/api/v1/vendas/101')
    assert.equal(r.status, 204)
    assert.equal(r.corpo, undefined)
    // O G4 que ja tinha baixado esta venda recebe 404 e a trata como cancelada (secao 6).
    assert.equal(codigo(await api('GET', '/api/v1/vendas/101', { chave: LEITURA })), 'VENDA_NAO_ENCONTRADA')
    assert.equal(contar('itens_venda'), 0)
    assert.equal(codigo(await api('DELETE', '/api/v1/vendas/abc')), 'ID_INVALIDO')
  })

  test('o id de uma venda excluida nao e reutilizado (secao 4.1)', async () => {
    await criarVenda()
    await cancelar(101)
    await api('DELETE', '/api/v1/vendas/101')
    const r = await criarVenda()
    assert.equal(r.corpo.id, 102)
  })

  test('rota inexistente: 404 ROTA_NAO_ENCONTRADA', async () => {
    const r = await api('GET', '/api/v1/pedidos', { chave: LEITURA })
    assert.equal(r.status, 404)
    assert.equal(codigo(r), 'ROTA_NAO_ENCONTRADA')
  })

  test('registra as chamadas recebidas com correlacao; a chave do G4 aparece como estoque-g4 (secao 7)', async () => {
    const r = await api('GET', '/api/v1/vendas', { chave: LEITURA, headers: { 'X-Request-Id': 'g4-123' } })
    assert.equal(r.headers.get('x-request-id'), 'g4-123')
    await api('GET', '/api/v1/vendas', { headers: { 'X-Sistema-Origem': 'financeiro-g6' } })
    // Consultas do proprio painel nao entram no log de integracao.
    await api('GET', '/api/v1/vendas', { headers: { 'X-Sistema-Origem': 'painel-vendas' } })
    const logs = (await api('GET', '/api/v1/integracao/logs?direcao=ENTRADA')).corpo as LinhaLog[]
    assert.deepEqual(logs.map((l) => [l.sistema, l.status]), [['financeiro-g6', 200], ['estoque-g4', 200]])
  })
})
