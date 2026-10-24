import { padraoBusca } from '../../db/busca.js'
import { pool, type Db } from '../../db/pool.js'
import type { ClienteDados, ClienteFiltro } from './clientes.schema.js'

export interface Cliente {
  cliente_id: number
  nome: string
  cpf: string
  email: string | null
  telefone: string | null
  cidade: string | null
  uf: string | null
  ativo: boolean
  criado_em: Date
  atualizado_em: Date
}

// Filtros opcionais: quando o parâmetro é NULL a condição correspondente é ignorada
export async function listar(filtro: ClienteFiltro) {
  const busca = filtro.busca ? padraoBusca(filtro.busca) : null
  const ativo = filtro.ativo ?? null

  const contagem = await pool.query<{ total: number }>(
    `SELECT count(*)::int AS total
       FROM vendas.cliente
      WHERE ($1::text IS NULL OR nome ILIKE $1 OR cpf LIKE $1)
        AND ($2::boolean IS NULL OR ativo = $2)`,
    [busca, ativo],
  )

  const resultado = await pool.query<Cliente>(
    `SELECT cliente_id, nome, cpf, email, telefone, cidade, uf, ativo, criado_em, atualizado_em
       FROM vendas.cliente
      WHERE ($1::text IS NULL OR nome ILIKE $1 OR cpf LIKE $1)
        AND ($2::boolean IS NULL OR ativo = $2)
      ORDER BY nome, cliente_id
      LIMIT $3 OFFSET $4`,
    [busca, ativo, filtro.limit, (filtro.page - 1) * filtro.limit],
  )

  return { dados: resultado.rows, pagina: filtro.page, limite: filtro.limit, total: contagem.rows[0].total }
}

export async function buscarPorId(id: number, db: Db = pool): Promise<Cliente | null> {
  const resultado = await db.query<Cliente>(
    `SELECT cliente_id, nome, cpf, email, telefone, cidade, uf, ativo, criado_em, atualizado_em
       FROM vendas.cliente
      WHERE cliente_id = $1`,
    [id],
  )
  return resultado.rows[0] ?? null
}

export async function criar(dados: ClienteDados): Promise<Cliente> {
  const resultado = await pool.query<Cliente>(
    `INSERT INTO vendas.cliente (nome, cpf, email, telefone, cidade, uf, ativo)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING cliente_id, nome, cpf, email, telefone, cidade, uf, ativo, criado_em, atualizado_em`,
    [dados.nome, dados.cpf, dados.email ?? null, dados.telefone ?? null, dados.cidade ?? null, dados.uf ?? null, dados.ativo],
  )
  return resultado.rows[0]
}

export async function atualizar(id: number, dados: ClienteDados): Promise<Cliente | null> {
  const resultado = await pool.query<Cliente>(
    `UPDATE vendas.cliente
        SET nome = $2, cpf = $3, email = $4, telefone = $5, cidade = $6, uf = $7, ativo = $8
      WHERE cliente_id = $1
     RETURNING cliente_id, nome, cpf, email, telefone, cidade, uf, ativo, criado_em, atualizado_em`,
    [id, dados.nome, dados.cpf, dados.email ?? null, dados.telefone ?? null, dados.cidade ?? null, dados.uf ?? null, dados.ativo],
  )
  return resultado.rows[0] ?? null
}

export async function excluir(id: number): Promise<boolean> {
  const resultado = await pool.query('DELETE FROM vendas.cliente WHERE cliente_id = $1', [id])
  return resultado.rowCount === 1
}
