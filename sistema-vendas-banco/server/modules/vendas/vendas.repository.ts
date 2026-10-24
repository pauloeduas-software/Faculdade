import { pool, type Db } from '../../db/pool.js'
import {
  TRANSICOES_STATUS,
  type FormaPagamento,
  type StatusVenda,
  type VendaCriacao,
  type VendaFiltro,
} from './vendas.schema.js'

export interface VendaResumo {
  venda_id: number
  data_venda: Date
  status: StatusVenda
  forma_pagamento: FormaPagamento
  valor_total: number
  cliente_id: number
  cliente_nome: string
  vendedor_id: number
  vendedor_nome: string
}

export interface ItemVenda {
  item_venda_id: number
  produto_id: number
  codigo_sku: string
  produto_nome: string
  quantidade: number
  preco_unitario: number
  subtotal: number
}

// Entrega integrada do Sistema de Entregas (Grupo 7), já no nosso modelo
export interface EntregaVenda {
  entrega_id: number
  id_entrega_origem: number
  codigo_rastreio: string
  status_entrega: string
  data_prevista: string | null
  data_saida: Date | null
  data_entrega: Date | null
  entregador: string | null
  cidade: string | null
  uf: string | null
  origem_atualizado_em: Date
  integrado_em: Date
  atualizado_em: Date
}

export interface VendaDetalhe {
  venda_id: number
  data_venda: Date
  status: StatusVenda
  forma_pagamento: FormaPagamento
  valor_total: number
  observacao: string | null
  criado_em: Date
  atualizado_em: Date
  cliente: { cliente_id: number; nome: string; cpf: string; email: string | null; cidade: string | null; uf: string | null }
  vendedor: { vendedor_id: number; nome: string; email: string }
  itens: ItemVenda[]
  entregas: EntregaVenda[]
  transicoes_permitidas: readonly StatusVenda[]
}

export interface VendaTravada {
  venda_id: number
  status: StatusVenda
  forma_pagamento: FormaPagamento
  observacao: string | null
}

// Filtros opcionais: quando o parâmetro é NULL a condição correspondente é ignorada.
// data_fim inclui o dia inteiro (data_venda < data_fim + 1 dia).
export async function listar(filtro: VendaFiltro) {
  const filtros = [filtro.status ?? null, filtro.cliente_id ?? null, filtro.data_inicio ?? null, filtro.data_fim ?? null]

  const contagem = await pool.query<{ total: number }>(
    `SELECT count(*)::int AS total
       FROM vendas.venda v
      WHERE ($1::text IS NULL OR v.status = $1)
        AND ($2::int IS NULL OR v.cliente_id = $2)
        AND ($3::date IS NULL OR v.data_venda >= $3::date)
        AND ($4::date IS NULL OR v.data_venda < $4::date + 1)`,
    filtros,
  )

  const resultado = await pool.query<VendaResumo>(
    `SELECT v.venda_id, v.data_venda, v.status, v.forma_pagamento, v.valor_total,
            v.cliente_id, c.nome AS cliente_nome,
            v.vendedor_id, vd.nome AS vendedor_nome
       FROM vendas.venda v
       JOIN vendas.cliente c ON c.cliente_id = v.cliente_id
       JOIN vendas.vendedor vd ON vd.vendedor_id = v.vendedor_id
      WHERE ($1::text IS NULL OR v.status = $1)
        AND ($2::int IS NULL OR v.cliente_id = $2)
        AND ($3::date IS NULL OR v.data_venda >= $3::date)
        AND ($4::date IS NULL OR v.data_venda < $4::date + 1)
      ORDER BY v.data_venda DESC, v.venda_id DESC
      LIMIT $5 OFFSET $6`,
    [...filtros, filtro.limit, (filtro.page - 1) * filtro.limit],
  )

  // transicoes_permitidas: a lista mostra só os botões de status que a venda aceita
  const dados = resultado.rows.map((venda) => ({ ...venda, transicoes_permitidas: TRANSICOES_STATUS[venda.status] }))
  return { dados, pagina: filtro.page, limite: filtro.limit, total: contagem.rows[0].total }
}

export async function buscarPorId(id: number, db: Db = pool): Promise<VendaDetalhe | null> {
  const cabecalho = await db.query<Omit<VendaDetalhe, 'itens' | 'entregas' | 'transicoes_permitidas'>>(
    `SELECT v.venda_id, v.data_venda, v.status, v.forma_pagamento, v.valor_total, v.observacao,
            v.criado_em, v.atualizado_em,
            json_build_object('cliente_id', c.cliente_id, 'nome', c.nome, 'cpf', c.cpf,
                              'email', c.email, 'cidade', c.cidade, 'uf', c.uf) AS cliente,
            json_build_object('vendedor_id', vd.vendedor_id, 'nome', vd.nome, 'email', vd.email) AS vendedor
       FROM vendas.venda v
       JOIN vendas.cliente c ON c.cliente_id = v.cliente_id
       JOIN vendas.vendedor vd ON vd.vendedor_id = v.vendedor_id
      WHERE v.venda_id = $1`,
    [id],
  )
  if (cabecalho.rows.length === 0) return null

  const itens = await db.query<ItemVenda>(
    `SELECT i.item_venda_id, i.produto_id, p.codigo_sku, p.nome AS produto_nome,
            i.quantidade, i.preco_unitario, i.subtotal
       FROM vendas.item_venda i
       JOIN vendas.produto p ON p.produto_id = i.produto_id
      WHERE i.venda_id = $1
      ORDER BY i.item_venda_id`,
    [id],
  )

  // Uma venda pode ter mais de uma entrega (ex.: devolvida e reenviada).
  // data_prevista é date: vai como texto AAAA-MM-DD, sem fuso para deslocar o dia
  const entregas = await db.query<EntregaVenda>(
    `SELECT entrega_id, id_entrega_origem, codigo_rastreio, status_entrega, data_prevista::text AS data_prevista,
            data_saida, data_entrega, entregador, cidade, uf, origem_atualizado_em, integrado_em, atualizado_em
       FROM vendas.entrega
      WHERE venda_id = $1
      ORDER BY entrega_id`,
    [id],
  )

  const venda = cabecalho.rows[0]
  return {
    ...venda,
    itens: itens.rows,
    entregas: entregas.rows,
    transicoes_permitidas: TRANSICOES_STATUS[venda.status],
  }
}

// FOR UPDATE: a linha da venda fica bloqueada até o fim da transação, então
// duas requisições alterando a mesma venda são executadas uma depois da outra
export async function travar(id: number, db: Db): Promise<VendaTravada | null> {
  const resultado = await db.query<VendaTravada>(
    `SELECT venda_id, status, forma_pagamento, observacao
       FROM vendas.venda
      WHERE venda_id = $1
        FOR UPDATE`,
    [id],
  )
  return resultado.rows[0] ?? null
}

// status (ABERTA) e valor_total (0) vêm dos defaults da tabela
export async function inserir(dados: VendaCriacao, db: Db): Promise<number> {
  const resultado = await db.query<{ venda_id: number }>(
    `INSERT INTO vendas.venda (cliente_id, vendedor_id, forma_pagamento, observacao)
     VALUES ($1, $2, $3, $4)
     RETURNING venda_id`,
    [dados.cliente_id, dados.vendedor_id, dados.forma_pagamento, dados.observacao ?? null],
  )
  return resultado.rows[0].venda_id
}

export async function atualizar(
  id: number,
  campos: { status: StatusVenda; forma_pagamento: FormaPagamento; observacao: string | null },
  db: Db,
): Promise<void> {
  await db.query(
    `UPDATE vendas.venda
        SET status = $2, forma_pagamento = $3, observacao = $4
      WHERE venda_id = $1`,
    [id, campos.status, campos.forma_pagamento, campos.observacao],
  )
}

// Os itens são removidos junto pela FK fk_item_venda_venda (ON DELETE CASCADE)
export async function excluir(id: number, db: Db): Promise<void> {
  await db.query('DELETE FROM vendas.venda WHERE venda_id = $1', [id])
}

// A trigger trg_item_venda_valor_total recalcula venda.valor_total após cada
// INSERT, UPDATE e DELETE abaixo
export async function inserirItem(
  vendaId: number,
  produtoId: number,
  quantidade: number,
  precoUnitario: number,
  db: Db,
): Promise<void> {
  await db.query(
    `INSERT INTO vendas.item_venda (venda_id, produto_id, quantidade, preco_unitario)
     VALUES ($1, $2, $3, $4)`,
    [vendaId, produtoId, quantidade, precoUnitario],
  )
}

export async function listarIdsItens(vendaId: number, db: Db): Promise<number[]> {
  const resultado = await db.query<{ item_venda_id: number }>(
    'SELECT item_venda_id FROM vendas.item_venda WHERE venda_id = $1',
    [vendaId],
  )
  return resultado.rows.map((linha) => linha.item_venda_id)
}

// O filtro por venda_id garante que o item pertence à venda da URL
export async function atualizarQuantidadeItem(
  vendaId: number,
  itemId: number,
  quantidade: number,
  db: Db,
): Promise<boolean> {
  const resultado = await db.query(
    `UPDATE vendas.item_venda
        SET quantidade = $3
      WHERE venda_id = $1 AND item_venda_id = $2`,
    [vendaId, itemId, quantidade],
  )
  return resultado.rowCount === 1
}

export async function excluirItem(vendaId: number, itemId: number, db: Db): Promise<void> {
  await db.query('DELETE FROM vendas.item_venda WHERE venda_id = $1 AND item_venda_id = $2', [vendaId, itemId])
}
