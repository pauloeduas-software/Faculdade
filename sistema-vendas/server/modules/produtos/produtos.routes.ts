import { Router } from 'express'
import { AppError, erroPostgres, naoEncontrado } from '../../http/errors.js'
import { parseId } from '../../http/validacao.js'
import * as repositorio from './produtos.repository.js'
import { produtoAtualizacaoSchema, produtoCriacaoSchema, produtoFiltroSchema } from './produtos.schema.js'

export const produtosRouter = Router()

produtosRouter.get('/', async (req, res) => {
  const filtro = produtoFiltroSchema.parse(req.query)
  res.json(await repositorio.listar(filtro))
})

produtosRouter.get('/:id', async (req, res) => {
  const id = parseId(req.params.id)
  const produto = await repositorio.buscarPorId(id)
  if (!produto) throw naoEncontrado(`Produto ${id} não encontrado`)
  res.json(produto)
})

produtosRouter.post('/', async (req, res) => {
  const dados = produtoCriacaoSchema.parse(req.body)
  const produto = await repositorio.criar(dados)
  res.status(201).location(`/api/produtos/${produto.produto_id}`).json(produto)
})

produtosRouter.put('/:id', async (req, res) => {
  const id = parseId(req.params.id)
  const dados = produtoAtualizacaoSchema.parse(req.body)
  const produto = await repositorio.atualizar(id, dados)
  if (!produto) throw naoEncontrado(`Produto ${id} não encontrado`)
  res.json(produto)
})

produtosRouter.delete('/:id', async (req, res) => {
  const id = parseId(req.params.id)
  let excluido: boolean
  try {
    excluido = await repositorio.excluir(id)
  } catch (err) {
    // fk_item_venda_produto é ON DELETE RESTRICT: o banco barra a exclusão de produto já vendido
    if (erroPostgres(err, '23503')) {
      throw new AppError(
        409,
        'VIOLACAO_INTEGRIDADE_REFERENCIAL',
        'Produto aparece em vendas e não pode ser excluído. Inative-o.',
        { constraint: err.constraint },
      )
    }
    throw err
  }
  if (!excluido) throw naoEncontrado(`Produto ${id} não encontrado`)
  res.status(204).end()
})
