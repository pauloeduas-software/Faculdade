import { Router } from 'express'
import { AppError, erroPostgres, naoEncontrado } from '../../http/errors.js'
import { parseId } from '../../http/validacao.js'
import * as repositorio from './vendedores.repository.js'
import { vendedorAtualizacaoSchema, vendedorCriacaoSchema, vendedorFiltroSchema } from './vendedores.schema.js'

export const vendedoresRouter = Router()

vendedoresRouter.get('/', async (req, res) => {
  const filtro = vendedorFiltroSchema.parse(req.query)
  res.json(await repositorio.listar(filtro))
})

vendedoresRouter.get('/:id', async (req, res) => {
  const id = parseId(req.params.id)
  const vendedor = await repositorio.buscarPorId(id)
  if (!vendedor) throw naoEncontrado(`Vendedor ${id} não encontrado`)
  res.json(vendedor)
})

vendedoresRouter.post('/', async (req, res) => {
  const dados = vendedorCriacaoSchema.parse(req.body)
  const vendedor = await repositorio.criar(dados)
  res.status(201).location(`/api/vendedores/${vendedor.vendedor_id}`).json(vendedor)
})

vendedoresRouter.put('/:id', async (req, res) => {
  const id = parseId(req.params.id)
  const dados = vendedorAtualizacaoSchema.parse(req.body)
  const vendedor = await repositorio.atualizar(id, dados)
  if (!vendedor) throw naoEncontrado(`Vendedor ${id} não encontrado`)
  res.json(vendedor)
})

vendedoresRouter.delete('/:id', async (req, res) => {
  const id = parseId(req.params.id)
  let excluido: boolean
  try {
    excluido = await repositorio.excluir(id)
  } catch (err) {
    // fk_venda_vendedor é ON DELETE RESTRICT: o banco barra a exclusão de vendedor com vendas
    if (erroPostgres(err, '23503')) {
      throw new AppError(
        409,
        'VIOLACAO_INTEGRIDADE_REFERENCIAL',
        'Vendedor possui vendas e não pode ser excluído. Inative-o.',
        { constraint: err.constraint },
      )
    }
    throw err
  }
  if (!excluido) throw naoEncontrado(`Vendedor ${id} não encontrado`)
  res.status(204).end()
})
