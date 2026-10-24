import { Router } from 'express'
import { AppError, erroPostgres, naoEncontrado } from '../../http/errors.js'
import { parseId } from '../../http/validacao.js'
import * as repositorio from './clientes.repository.js'
import { clienteAtualizacaoSchema, clienteCriacaoSchema, clienteFiltroSchema } from './clientes.schema.js'

export const clientesRouter = Router()

clientesRouter.get('/', async (req, res) => {
  const filtro = clienteFiltroSchema.parse(req.query)
  res.json(await repositorio.listar(filtro))
})

clientesRouter.get('/:id', async (req, res) => {
  const id = parseId(req.params.id)
  const cliente = await repositorio.buscarPorId(id)
  if (!cliente) throw naoEncontrado(`Cliente ${id} não encontrado`)
  res.json(cliente)
})

clientesRouter.post('/', async (req, res) => {
  const dados = clienteCriacaoSchema.parse(req.body)
  const cliente = await repositorio.criar(dados)
  res.status(201).location(`/api/clientes/${cliente.cliente_id}`).json(cliente)
})

clientesRouter.put('/:id', async (req, res) => {
  const id = parseId(req.params.id)
  const dados = clienteAtualizacaoSchema.parse(req.body)
  const cliente = await repositorio.atualizar(id, dados)
  if (!cliente) throw naoEncontrado(`Cliente ${id} não encontrado`)
  res.json(cliente)
})

clientesRouter.delete('/:id', async (req, res) => {
  const id = parseId(req.params.id)
  let excluido: boolean
  try {
    excluido = await repositorio.excluir(id)
  } catch (err) {
    // fk_venda_cliente é ON DELETE RESTRICT: o banco barra a exclusão de cliente com vendas
    if (erroPostgres(err, '23503')) {
      throw new AppError(
        409,
        'VIOLACAO_INTEGRIDADE_REFERENCIAL',
        'Cliente possui vendas e não pode ser excluído. Inative-o.',
        { constraint: err.constraint },
      )
    }
    throw err
  }
  if (!excluido) throw naoEncontrado(`Cliente ${id} não encontrado`)
  res.status(204).end()
})
