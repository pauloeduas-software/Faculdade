import cors from 'cors'
import express from 'express'
import swaggerUi from 'swagger-ui-express'
import { apenasAdmin, autenticar } from './auth.ts'
import type { Config } from './config.ts'
import type { Db } from './db.ts'
import { naoEncontrado, tratarErros } from './errors.ts'
import { logEntrada } from './logger.ts'
import { openapi } from './openapi.ts'
import { rotasLogs, rotasVendas } from './routes.ts'
import { criarEntregasClient } from './entregasClient.ts'
import { criarEntregasService } from './entregasService.ts'
import { criarVendasService } from './vendasService.ts'

export function criarApp(config: Config, db: Db) {
  const app = express()
  app.set('etag', false)
  const servico = criarVendasService(db)
  const entregas = criarEntregasService(db, criarEntregasClient(config, db))

  app.use(cors({ exposedHeaders: ['Location', 'Idempotent-Replayed', 'X-Request-Id'] }))
  app.use(logEntrada(db))

  // Publico: saude e documentacao
  app.get('/health', (_req, res) => { res.json({ status: 'ok', servico: 'vendas-g2', versao: '1.0' }) })
  app.get('/openapi.json', (_req, res) => { res.json(openapi) })
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(openapi))

  // Protegido por X-API-Key
  const v1 = express.Router()
  v1.use(autenticar(config))
  // Depois da autenticacao: sem chave a resposta e 401, mesmo com corpo malformado.
  v1.use(express.json())
  v1.use('/integracao/logs', apenasAdmin, rotasLogs(db))
  v1.use('/vendas', rotasVendas(servico, entregas))
  app.use('/api/v1', v1)

  app.use(naoEncontrado)
  app.use(tratarErros)
  return app
}
