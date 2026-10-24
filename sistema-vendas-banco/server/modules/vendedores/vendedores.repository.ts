import { padraoBusca } from '../../db/busca.js'
import { pool, type Db } from '../../db/pool.js'
import type { VendedorDados, VendedorFiltro } from './vendedores.schema.js'

export interface Vendedor {
  vendedor_id: number
  nome: string
  email: string
  comissao_percentual: number
  ativo: boolean
  criado_em: Date
  atualizado_em: Date
}

// Filtros opcionais: quando o parâmetro é NULL a condição correspondente é ignorada
export async function listar(filtro: VendedorFiltro) {
  const busca = filtro.busca ? padraoBusca(filtro.busca) : null
  const ativo = filtro.ativo ?? null

  const contagem = await pool.query<{ total: number }>(
    `SELECT count(*)::int AS total
       FROM vendas.vendedor
      WHERE ($1::text IS NULL OR nome ILIKE $1)
        AND ($2::boolean IS NULL OR ativo = $2)`,
    [busca, ativo],
  )

  const resultado = await pool.query<Vendedor>(
    `SELECT vendedor_id, nome, email, comissao_percentual, ativo, criado_em, atualizado_em
       FROM vendas.vendedor
      WHERE ($1::text IS NULL OR nome ILIKE $1)
        AND ($2::boolean IS NULL OR ativo = $2)
      ORDER BY nome, vendedor_id
      LIMIT $3 OFFSET $4`,
    [busca, ativo, filtro.limit, (filtro.page - 1) * filtro.limit],
  )

  return { dados: resultado.rows, pagina: filtro.page, limite: filtro.limit, total: contagem.rows[0].total }
}

export async function buscarPorId(id: number, db: Db = pool): Promise<Vendedor | null> {
  const resultado = await db.query<Vendedor>(
    `SELECT vendedor_id, nome, email, comissao_percentual, ativo, criado_em, atualizado_em
       FROM vendas.vendedor
      WHERE vendedor_id = $1`,
    [id],
  )
  return resultado.rows[0] ?? null
}

export async function criar(dados: VendedorDados): Promise<Vendedor> {
  const resultado = await pool.query<Vendedor>(
    `INSERT INTO vendas.vendedor (nome, email, comissao_percentual, ativo)
     VALUES ($1, $2, $3, $4)
     RETURNING vendedor_id, nome, email, comissao_percentual, ativo, criado_em, atualizado_em`,
    [dados.nome, dados.email, dados.comissao_percentual, dados.ativo],
  )
  return resultado.rows[0]
}

export async function atualizar(id: number, dados: VendedorDados): Promise<Vendedor | null> {
  const resultado = await pool.query<Vendedor>(
    `UPDATE vendas.vendedor
        SET nome = $2, email = $3, comissao_percentual = $4, ativo = $5
      WHERE vendedor_id = $1
     RETURNING vendedor_id, nome, email, comissao_percentual, ativo, criado_em, atualizado_em`,
    [id, dados.nome, dados.email, dados.comissao_percentual, dados.ativo],
  )
  return resultado.rows[0] ?? null
}

export async function excluir(id: number): Promise<boolean> {
  const resultado = await pool.query('DELETE FROM vendas.vendedor WHERE vendedor_id = $1', [id])
  return resultado.rowCount === 1
}
