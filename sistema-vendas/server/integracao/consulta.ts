// =============================================================================
// Etapa 2 – CONSULTA: lê a view do Grupo 7 inteira (contrato §4.2: volume
// pequeno, leitura completa a cada execução).
//
// Colunas explícitas, nunca SELECT *: uma coluna nova na view não muda o que
// lemos. A lista vem do contrato (config.ts), a mesma que estrutura.ts conferiu;
// são constantes nossas, nunca entrada de usuário.
// =============================================================================
import type pg from 'pg'
import { COLUNAS_VIEW, VIEW, type LinhaView } from './config.js'
import { ErroFatal, ehErroDeConexao, traduzirErroConexao } from './conexao.js'

export const SQL_CONSULTA = `SELECT ${COLUNAS_VIEW.map((c) => c.nome).join(', ')}
  FROM ${VIEW}
 ORDER BY id_entrega`

export async function consultarView(client: pg.PoolClient): Promise<LinhaView[]> {
  try {
    const resultado = await client.query<LinhaView>(SQL_CONSULTA)
    return resultado.rows
  } catch (err) {
    // Permissão retirada, conexão caída, statement_timeout...
    if (ehErroDeConexao(err)) throw new ErroFatal('ERRO_CONEXAO', traduzirErroConexao(err))
    // Coluna sumiu entre a verificação estrutural e a consulta
    if (err instanceof Error && ['42703', '42P01'].includes((err as { code?: string }).code ?? '')) {
      throw new ErroFatal('ERRO_ESTRUTURAL', `A consulta à view falhou: ${err.message}. Nada foi processado.`)
    }
    throw err
  }
}
