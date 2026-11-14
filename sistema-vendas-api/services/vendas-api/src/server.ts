import { styleText } from 'node:util'
import { criarApp } from './app.ts'
import { loadConfig } from './config.ts'
import { abrirBanco } from './db.ts'
import { ativarLogConsole } from './logger.ts'

ativarLogConsole()
const config = loadConfig()
const db = abrirBanco(config.dbPath)
const app = criarApp(config, db)

app.listen(config.port, '0.0.0.0', () => {
  const link = (u: string) => styleText(['cyan', 'underline'], u)
  console.log(`${styleText(['bold', 'green'], 'API de Vendas (G2)')}  ${link(`http://localhost:${config.port}/api/v1`)}`)
  console.log(`${styleText('dim', 'Documentacao     ')}  ${link(`http://localhost:${config.port}/docs`)}`)
  console.log(`${styleText('dim', 'Entregas (G7)    ')}  ${link(config.entregas.baseUrl)}`)
  if (!config.entregas.apiKey) {
    console.log(styleText('yellow', 'ENTREGAS_API_KEY nao configurada no .env: a consulta de entregas ao G7 vai falhar (401).'))
  }
})
