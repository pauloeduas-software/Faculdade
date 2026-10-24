import { Router } from 'express'
import { pool } from '../db/pool.js'

export const healthRouter = Router()

healthRouter.get('/health', async (_req, res) => {
  try {
    const { rows } = await pool.query<{ horario: Date }>('SELECT now() AS horario')
    res.json({ status: 'ok', banco: 'conectado', horario: rows[0].horario })
  } catch (err) {
    // O motivo técnico (ex.: ECONNREFUSED, senha recusada) fica só no log do servidor
    const motivo = err instanceof Error ? err.message || (err as NodeJS.ErrnoException).code || err.name : String(err)
    console.error(`[health] banco inacessível: ${motivo}`)
    res.status(503).json({ status: 'erro', banco: 'indisponível', mensagem: 'O banco de dados não está respondendo.' })
  }
})
