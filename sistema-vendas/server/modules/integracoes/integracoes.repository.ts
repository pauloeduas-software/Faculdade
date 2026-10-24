// Consultas de apoio à tela de integração, no NOSSO banco: o lado produtor
// (a view que o Grupo 4 lê) e as permissões dos usuários. As permissões são
// sempre perguntadas ao PostgreSQL (has_*_privilege), nunca escritas à mão.
import { pool } from '../../db/pool.js'

export const VIEW_GRUPO4 = 'integracao.vw_integracao_vendas'
export const USUARIO_GRUPO4 = 'grupo4_integracao'

export interface Privilegio {
  objeto: string
  privilegio: string
  concedido: boolean
}

export interface UsuarioBanco {
  usuario: string
  papel: string
  limite_conexoes: number | null
  configuracoes: string[]
  privilegios: Privilegio[]
}

interface Verificacao {
  objeto: string
  tipo: 'database' | 'schema' | 'table'
  nome: string
  privilegios: string[]
}

// O que perguntamos sobre cada usuário: o que ele deve ter E o que ele NÃO deve ter
const VERIFICACOES_GRUPO4: Verificacao[] = [
  { objeto: 'banco', tipo: 'database', nome: '', privilegios: ['CONNECT', 'CREATE', 'TEMPORARY'] },
  { objeto: 'schema integracao', tipo: 'schema', nome: 'integracao', privilegios: ['USAGE', 'CREATE'] },
  { objeto: 'schema vendas', tipo: 'schema', nome: 'vendas', privilegios: ['USAGE'] },
  { objeto: VIEW_GRUPO4, tipo: 'table', nome: VIEW_GRUPO4, privilegios: ['SELECT', 'INSERT', 'UPDATE', 'DELETE'] },
  { objeto: 'vendas.venda', tipo: 'table', nome: 'vendas.venda', privilegios: ['SELECT'] },
  { objeto: 'vendas.item_venda', tipo: 'table', nome: 'vendas.item_venda', privilegios: ['SELECT'] },
  { objeto: 'integracao.integracao', tipo: 'table', nome: 'integracao.integracao', privilegios: ['SELECT'] },
]

const VERIFICACOES_API: Verificacao[] = [
  { objeto: 'banco', tipo: 'database', nome: '', privilegios: ['CONNECT', 'CREATE', 'TEMPORARY'] },
  { objeto: 'schema vendas', tipo: 'schema', nome: 'vendas', privilegios: ['USAGE', 'CREATE'] },
  { objeto: 'vendas.venda', tipo: 'table', nome: 'vendas.venda', privilegios: ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE'] },
  { objeto: 'vendas.entrega', tipo: 'table', nome: 'vendas.entrega', privilegios: ['SELECT', 'INSERT', 'UPDATE', 'DELETE'] },
  { objeto: 'integracao.integracao', tipo: 'table', nome: 'integracao.integracao', privilegios: ['SELECT', 'INSERT', 'UPDATE', 'DELETE'] },
  { objeto: 'integracao.erro_integracao', tipo: 'table', nome: 'integracao.erro_integracao', privilegios: ['SELECT', 'INSERT', 'UPDATE', 'DELETE'] },
  { objeto: VIEW_GRUPO4, tipo: 'table', nome: VIEW_GRUPO4, privilegios: ['SELECT'] },
]

async function privilegios(usuario: string, verificacoes: Verificacao[]): Promise<Privilegio[]> {
  const linhas = verificacoes.flatMap((v) => v.privilegios.map((privilegio) => ({ ...v, privilegio })))
  const resultado = await pool.query<Privilegio>(
    `SELECT CASE WHEN v.tipo = 'database' THEN 'banco ' || current_database() ELSE v.objeto END AS objeto,
            v.privilegio,
            CASE v.tipo
              WHEN 'database' THEN has_database_privilege($1, current_database(), v.privilegio)
              WHEN 'schema'   THEN has_schema_privilege($1, v.nome, v.privilegio)
              ELSE has_table_privilege($1, v.nome, v.privilegio)
            END AS concedido
       FROM unnest($2::text[], $3::text[], $4::text[], $5::text[]) WITH ORDINALITY AS v(objeto, tipo, nome, privilegio, ordem)
      ORDER BY v.ordem`,
    [usuario, linhas.map((l) => l.objeto), linhas.map((l) => l.tipo), linhas.map((l) => l.nome), linhas.map((l) => l.privilegio)],
  )
  return resultado.rows
}

async function descreverUsuario(usuario: string, papel: string, verificacoes: Verificacao[]): Promise<UsuarioBanco | null> {
  const papelBanco = await pool.query<{ rolconnlimit: number; rolconfig: string[] | null }>(
    'SELECT rolconnlimit, rolconfig FROM pg_roles WHERE rolname = $1',
    [usuario],
  )
  if (papelBanco.rows.length === 0) return null
  const { rolconnlimit, rolconfig } = papelBanco.rows[0]
  return {
    usuario,
    papel,
    limite_conexoes: rolconnlimit >= 0 ? rolconnlimit : null,
    configuracoes: rolconfig ?? [],
    privilegios: await privilegios(usuario, verificacoes),
  }
}

// O usuário da nossa API é o da DATABASE_URL (current_user da conexão)
export async function usuariosDoNossoBanco(): Promise<UsuarioBanco[]> {
  const atual = await pool.query<{ usuario: string }>('SELECT current_user AS usuario')
  const usuarios = await Promise.all([
    descreverUsuario(atual.rows[0].usuario, 'API do Sistema de Vendas (nós), no nosso banco', VERIFICACOES_API),
    descreverUsuario(USUARIO_GRUPO4, 'Grupo 4 – Estoque, lendo o nosso banco', VERIFICACOES_GRUPO4),
  ])
  return usuarios.filter((u) => u !== null)
}

// -----------------------------------------------------------------------------
// O que o Grupo 4 enxerga: as linhas da view
// -----------------------------------------------------------------------------

// limite null = todas as linhas (LIMIT NULL no PostgreSQL não limita)
export async function previewViewGrupo4(limite: number | null) {
  const total = await pool.query<{ total: number }>(`SELECT count(*)::int AS total FROM ${VIEW_GRUPO4}`)
  const linhas = await pool.query(
    `SELECT codigo_item, codigo_venda, data_venda, status_venda, codigo_sku, nome_produto,
            quantidade, preco_unitario, data_atualizacao
       FROM ${VIEW_GRUPO4}
      ORDER BY codigo_venda, codigo_item
      LIMIT $1`,
    [limite],
  )
  return { view: VIEW_GRUPO4, limite, total: total.rows[0].total, linhas: linhas.rows }
}
