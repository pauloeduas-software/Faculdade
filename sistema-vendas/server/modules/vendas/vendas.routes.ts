import { Router } from 'express'
import { naoEncontrado } from '../../http/errors.js'
import { parseId } from '../../http/validacao.js'
import * as repositorio from './vendas.repository.js'
import {
  itemAtualizacaoSchema,
  itemCriacaoSchema,
  vendaAtualizacaoSchema,
  vendaCriacaoSchema,
  vendaFiltroSchema,
} from './vendas.schema.js'
import * as servico from './vendas.service.js'

export const vendasRouter = Router()

vendasRouter.get('/', async (req, res) => {
  const filtro = vendaFiltroSchema.parse(req.query)
  res.json(await repositorio.listar(filtro))
})

vendasRouter.get('/:id', async (req, res) => {
  const id = parseId(req.params.id)
  const venda = await repositorio.buscarPorId(id)
  if (!venda) throw naoEncontrado(`Venda ${id} não encontrada`)
  res.json(venda)
})

vendasRouter.post('/', async (req, res) => {
  const dados = vendaCriacaoSchema.parse(req.body)
  const venda = await servico.criar(dados)
  res.status(201).location(`/api/vendas/${venda.venda_id}`).json(venda)
})

vendasRouter.put('/:id', async (req, res) => {
  const id = parseId(req.params.id)
  const dados = vendaAtualizacaoSchema.parse(req.body)
  res.json(await servico.atualizar(id, dados))
})

vendasRouter.delete('/:id', async (req, res) => {
  const id = parseId(req.params.id)
  await servico.excluir(id)
  res.status(204).end()
})

// Itens: as rotas abaixo devolvem a venda completa, já com o valor_total recalculado

vendasRouter.post('/:id/itens', async (req, res) => {
  const id = parseId(req.params.id)
  const item = itemCriacaoSchema.parse(req.body)
  res.status(201).json(await servico.adicionarItem(id, item))
})

vendasRouter.put('/:id/itens/:itemId', async (req, res) => {
  const id = parseId(req.params.id)
  const itemId = parseId(req.params.itemId, 'itemId')
  const { quantidade } = itemAtualizacaoSchema.parse(req.body)
  res.json(await servico.alterarItem(id, itemId, quantidade))
})

vendasRouter.delete('/:id/itens/:itemId', async (req, res) => {
  const id = parseId(req.params.id)
  const itemId = parseId(req.params.itemId, 'itemId')
  res.json(await servico.removerItem(id, itemId))
})
