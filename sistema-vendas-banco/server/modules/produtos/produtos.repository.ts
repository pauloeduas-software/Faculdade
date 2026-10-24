import { padraoBusca } from '../../db/busca.js'
import { pool, type Db } from '../../db/pool.js'
import type { ProdutoDados, ProdutoFiltro } from './produtos.schema.js'

export interface Produto {
  produto_id: number
  codigo_sku: string
  nome: string
  descricao: string | null
  preco_unitario: number
  ativo: boolean
  criado_em: Date
  atualizado_em: Date
}

// Filtros opcionais: quando o parâmetro é NULL a condição correspondente é ignorada
export async function listar(filtro: ProdutoFiltro) {
  const busca = filtro.busca ? padraoBusca(filtro.busca) : null
  const ativo = filtro.ativo ?? null

  const contagem = await pool.query<{ total: number }>(
    `SELECT count(*)::int AS total
       FROM vendas.produto
      WHERE ($1::text IS NULL OR nome ILIKE $1 OR codigo_sku ILIKE $1)
        AND ($2::boolean IS NULL OR ativo = $2)`,
    [busca, ativo],
  )

  const resultado = await pool.query<Produto>(
    `SELECT produto_id, codigo_sku, nome, descricao, preco_unitario, ativo, criado_em, atualizado_em
       FROM vendas.produto
      WHERE ($1::text IS NULL OR nome ILIKE $1 OR codigo_sku ILIKE $1)
        AND ($2::boolean IS NULL OR ativo = $2)
      ORDER BY codigo_sku
      LIMIT $3 OFFSET $4`,
    [busca, ativo, filtro.limit, (filtro.page - 1) * filtro.limit],
  )

  return { dados: resultado.rows, pagina: filtro.page, limite: filtro.limit, total: contagem.rows[0].total }
}

export async function buscarPorId(id: number, db: Db = pool): Promise<Produto | null> {
  const resultado = await db.query<Produto>(
    `SELECT produto_id, codigo_sku, nome, descricao, preco_unitario, ativo, criado_em, atualizado_em
       FROM vendas.produto
      WHERE produto_id = $1`,
    [id],
  )
  return resultado.rows[0] ?? null
}

// Vários produtos de uma vez: o array vai como UM parâmetro ($1::int[])
export async function buscarPorIds(ids: number[], db: Db = pool): Promise<Produto[]> {
  const resultado = await db.query<Produto>(
    `SELECT produto_id, codigo_sku, nome, descricao, preco_unitario, ativo, criado_em, atualizado_em
       FROM vendas.produto
      WHERE produto_id = ANY($1::int[])`,
    [ids],
  )
  return resultado.rows
}

export async function criar(dados: ProdutoDados): Promise<Produto> {
  const resultado = await pool.query<Produto>(
    `INSERT INTO vendas.produto (codigo_sku, nome, descricao, preco_unitario, ativo)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING produto_id, codigo_sku, nome, descricao, preco_unitario, ativo, criado_em, atualizado_em`,
    [dados.codigo_sku, dados.nome, dados.descricao ?? null, dados.preco_unitario, dados.ativo],
  )
  return resultado.rows[0]
}

export async function atualizar(id: number, dados: ProdutoDados): Promise<Produto | null> {
  const resultado = await pool.query<Produto>(
    `UPDATE vendas.produto
        SET codigo_sku = $2, nome = $3, descricao = $4, preco_unitario = $5, ativo = $6
      WHERE produto_id = $1
     RETURNING produto_id, codigo_sku, nome, descricao, preco_unitario, ativo, criado_em, atualizado_em`,
    [id, dados.codigo_sku, dados.nome, dados.descricao ?? null, dados.preco_unitario, dados.ativo],
  )
  return resultado.rows[0] ?? null
}

export async function excluir(id: number): Promise<boolean> {
  const resultado = await pool.query('DELETE FROM vendas.produto WHERE produto_id = $1', [id])
  return resultado.rowCount === 1
}
