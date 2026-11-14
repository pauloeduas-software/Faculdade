// Sobe a API de Vendas e a tela (Vite) juntas, com saida colorida por servico.
import { spawn } from 'node:child_process'
import { styleText } from 'node:util'

const bin = (nome) => `node_modules/.bin/${nome}`
const procs = [
  ['api', 'green', bin('tsx'), ['--env-file-if-exists=.env', 'services/vendas-api/src/server.ts']],
  ['web', 'cyan', bin('vite'), []],
]

// Filhos escrevem em pipe (nao-TTY) e perderiam as cores; se aqui ha terminal, pedimos cor explicitamente.
// FORCE_COLOR/NO_COLOR do usuario tem prioridade.
const comCor = process.stdout.isTTY && !process.env.NO_COLOR
const env = { ...process.env, ...(comCor && !process.env.FORCE_COLOR ? { FORCE_COLOR: '1' } : {}) }

const filhos = procs.map(([nome, cor, cmd, args]) => {
  const tag = styleText(['bold', cor], `${nome.padEnd(7)}│`)
  const p = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], env })
  const prefixo = (d) => String(d).trimEnd().split('\n').forEach((l) => console.log(`${tag} ${l}`))
  p.stdout.on('data', prefixo)
  p.stderr.on('data', prefixo)
  p.on('exit', (c) => console.log(`${tag} ${styleText(c ? 'red' : 'dim', `encerrou (${c})`)}`))
  return p
})

const sair = () => { filhos.forEach((p) => p.kill()); process.exit(0) }
process.on('SIGINT', sair)
process.on('SIGTERM', sair)
