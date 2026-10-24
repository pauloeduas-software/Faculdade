import type { PoolClient } from 'pg'
import { pool } from './pool.js'

// Executa fn em uma transação usando sempre o MESMO client (conexão):
// COMMIT se tudo der certo, ROLLBACK se qualquer passo lançar erro.
export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect()
  let conexaoQuebrada = false

  try {
    await client.query('BEGIN')
    const resultado = await fn(client)
    await client.query('COMMIT')
    return resultado
  } catch (err) {
    try {
      await client.query('ROLLBACK')
    } catch {
      // Se nem o ROLLBACK funcionou, a conexão está com problema e é descartada
      conexaoQuebrada = true
    }
    throw err
  } finally {
    client.release(conexaoQuebrada)
  }
}
