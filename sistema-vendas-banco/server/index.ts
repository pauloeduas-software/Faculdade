// Precisa ser o primeiro import: carrega o .env antes de db/pool.ts ler DATABASE_URL
import 'dotenv/config'
import cors from 'cors'
import express from 'express'
import { errorHandler } from './http/errorHandler.js'
import { clientesRouter } from './modules/clientes/clientes.routes.js'
import { integracoesRouter } from './modules/integracoes/integracoes.routes.js'
import { produtosRouter } from './modules/produtos/produtos.routes.js'
import { vendasRouter } from './modules/vendas/vendas.routes.js'
import { vendedoresRouter } from './modules/vendedores/vendedores.routes.js'
import { healthRouter } from './routes/health.js'

const app = express()

// Sem o cabeçalho "X-Powered-By: Express" (não anunciar a tecnologia do servidor)
app.disable('x-powered-by')

// CORS só para o front (FRONT_PORT do .env). O próprio front usa o proxy do
// Vite (mesma origem) e nem precisa disso; outro site aberto no navegador não
// consegue ler nem alterar dados da API.
const frontPort = process.env.FRONT_PORT
app.use(cors({ origin: frontPort ? [`http://localhost:${frontPort}`] : false }))
app.use(express.json())

app.use('/api', healthRouter)
app.use('/api/clientes', clientesRouter)
app.use('/api/vendedores', vendedoresRouter)
app.use('/api/produtos', produtosRouter)
app.use('/api/vendas', vendasRouter)
app.use('/api/integracoes', integracoesRouter)

app.use('/api', (req, res) => {
  res.status(404).json({ erro: 'ROTA_NAO_ENCONTRADA', mensagem: `Rota ${req.method} ${req.originalUrl} não existe` })
})

// Precisa ser o último middleware
app.use(errorHandler)

const port = Number(process.env.PORT ?? 3001)

// No Express 5 o erro de inicialização (ex.: porta ocupada) chega neste callback
app.listen(port, (err) => {
  if (err) {
    console.error(`Não foi possível iniciar o servidor na porta ${port}: ${err.message}`)
    process.exit(1)
  }
  console.log(`Servidor rodando em http://localhost:${port}`)
})
