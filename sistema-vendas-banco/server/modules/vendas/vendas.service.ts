import type { PoolClient } from 'pg'
import { withTransaction } from '../../db/transaction.js'
import { AppError, naoEncontrado } from '../../http/errors.js'
import * as clientes from '../clientes/clientes.repository.js'
import * as produtos from '../produtos/produtos.repository.js'
import * as vendedores from '../vendedores/vendedores.repository.js'
import * as repositorio from './vendas.repository.js'
import {
  TRANSICOES_STATUS,
  type ItemCriacao,
  type StatusVenda,
  type VendaAtualizacao,
  type VendaCriacao,
} from './vendas.schema.js'

interface Problema {
  campo: string
  mensagem: string
}

function referenciaInvalida(problemas: Problema[]): AppError {
  return new AppError(422, 'REFERENCIA_INVALIDA', problemas.map((p) => p.mensagem).join('; '), problemas)
}

async function buscarDetalhe(id: number, client: PoolClient) {
  const venda = await repositorio.buscarPorId(id, client)
  if (!venda) throw naoEncontrado(`Venda ${id} não encontrada`)
  return venda
}

// Itens só podem mudar enquanto a venda está ABERTA
async function travarVendaAberta(id: number, client: PoolClient) {
  const venda = await repositorio.travar(id, client)
  if (!venda) throw naoEncontrado(`Venda ${id} não encontrada`)
  if (venda.status !== 'ABERTA') {
    throw new AppError(
      409,
      'VENDA_NAO_ABERTA',
      `Os itens só podem ser alterados em vendas ABERTAS (a venda ${id} está ${venda.status})`,
      { status: venda.status },
    )
  }
  return venda
}

export async function criar(dados: VendaCriacao) {
  // Tudo em UMA transação: se qualquer passo falhar, o ROLLBACK desfaz a venda e os itens já gravados
  return withTransaction(async (client) => {
    // a) Cliente, vendedor e produtos precisam existir e estar ativos.
    //    Os problemas são acumulados para responder todos de uma vez.
    const problemas: Problema[] = []

    const cliente = await clientes.buscarPorId(dados.cliente_id, client)
    if (!cliente) {
      problemas.push({ campo: 'cliente_id', mensagem: `Cliente ${dados.cliente_id} não encontrado` })
    } else if (!cliente.ativo) {
      problemas.push({ campo: 'cliente_id', mensagem: `Cliente ${dados.cliente_id} está inativo` })
    }

    const vendedor = await vendedores.buscarPorId(dados.vendedor_id, client)
    if (!vendedor) {
      problemas.push({ campo: 'vendedor_id', mensagem: `Vendedor ${dados.vendedor_id} não encontrado` })
    } else if (!vendedor.ativo) {
      problemas.push({ campo: 'vendedor_id', mensagem: `Vendedor ${dados.vendedor_id} está inativo` })
    }

    const encontrados = await produtos.buscarPorIds(dados.itens.map((item) => item.produto_id), client)
    const produtosPorId = new Map(encontrados.map((produto) => [produto.produto_id, produto]))
    const itens: { produto_id: number; quantidade: number; preco_unitario: number }[] = []

    for (const [indice, item] of dados.itens.entries()) {
      const produto = produtosPorId.get(item.produto_id)
      const campo = `itens.${indice}.produto_id`
      if (!produto) {
        problemas.push({ campo, mensagem: `Produto ${item.produto_id} não encontrado` })
      } else if (!produto.ativo) {
        problemas.push({ campo, mensagem: `Produto ${item.produto_id} (${produto.codigo_sku}) está inativo` })
      } else {
        itens.push({ produto_id: item.produto_id, quantidade: item.quantidade, preco_unitario: produto.preco_unitario })
      }
    }

    if (problemas.length > 0) throw referenciaInvalida(problemas)

    // b) Cabeçalho da venda
    const vendaId = await repositorio.inserir(dados, client)

    // c) Itens com o preço ATUAL do cadastro, lido do banco no passo (a).
    //    A cada item a trigger recalcula venda.valor_total.
    for (const item of itens) {
      await repositorio.inserirItem(vendaId, item.produto_id, item.quantidade, item.preco_unitario, client)
    }

    // d) Qualquer erro até aqui (nosso ou do banco) faz o withTransaction executar ROLLBACK
    return buscarDetalhe(vendaId, client)
  })
}

export async function atualizar(id: number, dados: VendaAtualizacao) {
  return withTransaction(async (client) => {
    const atual = await repositorio.travar(id, client)
    if (!atual) throw naoEncontrado(`Venda ${id} não encontrada`)

    const novoStatus: StatusVenda = dados.status ?? atual.status
    const permitidos = TRANSICOES_STATUS[atual.status]
    if (novoStatus !== atual.status && !permitidos.includes(novoStatus)) {
      const motivo =
        permitidos.length === 0
          ? `${atual.status} é um status final`
          : `a partir de ${atual.status} só é permitido ${permitidos.join(' ou ')}`
      throw new AppError(422, 'TRANSICAO_INVALIDA', `Transição de status inválida: ${atual.status} → ${novoStatus} (${motivo})`, {
        status_atual: atual.status,
        status_solicitado: novoStatus,
        permitidos,
      })
    }

    // Itens são validados contra o status ANTERIOR: só uma venda ABERTA aceita
    if (dados.itens) {
      if (atual.status !== 'ABERTA') {
        throw new AppError(
          409,
          'VENDA_NAO_ABERTA',
          `Os itens só podem ser alterados em vendas ABERTAS (a venda ${id} está ${atual.status})`,
          { status: atual.status },
        )
      }
      await substituirItens(id, dados.itens, client)
    }

    await repositorio.atualizar(
      id,
      {
        status: novoStatus,
        forma_pagamento: dados.forma_pagamento ?? atual.forma_pagamento,
        // observacao: null apaga; ausente mantém a atual
        observacao: dados.observacao !== undefined ? dados.observacao : atual.observacao,
      },
      client,
    )

    return buscarDetalhe(id, client)
  })
}

// A lista enviada vira a lista de itens da venda, comparando por produto:
// o que continua mantém o preço gravado (só a quantidade pode mudar), o que é
// novo usa o preço ATUAL do cadastro e o que saiu é apagado. Roda dentro da
// transação de atualizar(): um erro em qualquer item desfaz tudo.
async function substituirItens(id: number, itens: ItemCriacao[], client: PoolClient) {
  const atuais = new Map((await buscarDetalhe(id, client)).itens.map((item) => [item.produto_id, item]))
  const novos = itens.filter((item) => !atuais.has(item.produto_id))
  const encontrados = await produtos.buscarPorIds(novos.map((item) => item.produto_id), client)
  const produtosPorId = new Map(encontrados.map((produto) => [produto.produto_id, produto]))

  const problemas: Problema[] = []
  const repetidos: Problema[] = []
  const inserir: { produto_id: number; quantidade: number; preco_unitario: number }[] = []
  const vistos = new Set<number>()

  for (const [indice, item] of itens.entries()) {
    const campo = `itens.${indice}.produto_id`
    if (vistos.has(item.produto_id)) {
      repetidos.push({ campo, mensagem: `Produto ${item.produto_id} repetido: altere a quantidade do outro item` })
      continue
    }
    vistos.add(item.produto_id)
    if (atuais.has(item.produto_id)) continue

    const produto = produtosPorId.get(item.produto_id)
    if (!produto) {
      problemas.push({ campo, mensagem: `Produto ${item.produto_id} não encontrado` })
    } else if (!produto.ativo) {
      problemas.push({ campo, mensagem: `Produto ${item.produto_id} (${produto.codigo_sku}) está inativo` })
    } else {
      inserir.push({ produto_id: item.produto_id, quantidade: item.quantidade, preco_unitario: produto.preco_unitario })
    }
  }

  if (problemas.length > 0) throw referenciaInvalida(problemas)
  // Mesmo erro da constraint uq_item_venda_venda_produto
  if (repetidos.length > 0) {
    throw new AppError(409, 'REGISTRO_DUPLICADO', 'Cada produto só pode aparecer uma vez na venda; altere a quantidade do item existente', repetidos)
  }

  // A cada comando a trigger recalcula venda.valor_total
  for (const atual of atuais.values()) {
    if (!vistos.has(atual.produto_id)) await repositorio.excluirItem(id, atual.item_venda_id, client)
  }
  for (const item of itens) {
    const atual = atuais.get(item.produto_id)
    if (atual && atual.quantidade !== item.quantidade) {
      await repositorio.atualizarQuantidadeItem(id, atual.item_venda_id, item.quantidade, client)
    }
  }
  for (const item of inserir) {
    await repositorio.inserirItem(id, item.produto_id, item.quantidade, item.preco_unitario, client)
  }
}

export async function excluir(id: number) {
  await withTransaction(async (client) => {
    const atual = await repositorio.travar(id, client)
    if (!atual) throw naoEncontrado(`Venda ${id} não encontrada`)
    if (atual.status !== 'ABERTA') {
      const dica = TRANSICOES_STATUS[atual.status].includes('CANCELADA') ? ' Para desistir dela, mude o status para CANCELADA.' : ''
      throw new AppError(
        409,
        'OPERACAO_NAO_PERMITIDA',
        `Somente vendas ABERTAS podem ser excluídas (a venda ${id} está ${atual.status}).${dica}`,
        { status: atual.status },
      )
    }
    await repositorio.excluir(id, client)
  })
}

export async function adicionarItem(id: number, item: ItemCriacao) {
  return withTransaction(async (client) => {
    await travarVendaAberta(id, client)

    const produto = await produtos.buscarPorId(item.produto_id, client)
    if (!produto) {
      throw referenciaInvalida([{ campo: 'produto_id', mensagem: `Produto ${item.produto_id} não encontrado` }])
    }
    if (!produto.ativo) {
      throw referenciaInvalida([
        { campo: 'produto_id', mensagem: `Produto ${item.produto_id} (${produto.codigo_sku}) está inativo` },
      ])
    }

    // Produto repetido na venda é barrado pela constraint uq_item_venda_venda_produto (409)
    await repositorio.inserirItem(id, produto.produto_id, item.quantidade, produto.preco_unitario, client)
    return buscarDetalhe(id, client)
  })
}

export async function alterarItem(id: number, itemId: number, quantidade: number) {
  return withTransaction(async (client) => {
    await travarVendaAberta(id, client)
    const alterado = await repositorio.atualizarQuantidadeItem(id, itemId, quantidade, client)
    if (!alterado) throw naoEncontrado(`Item ${itemId} não encontrado na venda ${id}`)
    return buscarDetalhe(id, client)
  })
}

export async function removerItem(id: number, itemId: number) {
  return withTransaction(async (client) => {
    await travarVendaAberta(id, client)

    const itens = await repositorio.listarIdsItens(id, client)
    if (!itens.includes(itemId)) throw naoEncontrado(`Item ${itemId} não encontrado na venda ${id}`)
    if (itens.length === 1) {
      throw new AppError(
        409,
        'ULTIMO_ITEM',
        `O item ${itemId} é o último da venda ${id}; uma venda precisa de pelo menos 1 item. Para desistir da venda, exclua-a.`,
      )
    }

    await repositorio.excluirItem(id, itemId, client)
    return buscarDetalhe(id, client)
  })
}
