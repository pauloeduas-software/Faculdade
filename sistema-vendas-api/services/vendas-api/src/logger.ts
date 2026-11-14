import { randomUUID } from 'node:crypto'
import { styleText } from 'node:util'
import type { RequestHandler } from 'express'
import type { Db } from './db.ts'

// Rotas de infraestrutura e do painel nao sao integracao: ficam fora do log para nao poluir.
const IGNORADAS = ['/docs', '/openapi.json', '/health', '/api/v1/integracao', '/api/v1/admin']

export interface LogEntrada {
  direcao: 'ENTRADA' | 'SAIDA'
  sistema: string
  metodo: string
  url: string
  status: number | null
  duracaoMs: number
  tentativa?: number
  erro?: string | null
  correlacao?: string | null
}

let imprimir = false
export const ativarLogConsole = () => { imprimir = true }

// styleText ja respeita NO_COLOR / FORCE_COLOR e so emite cor quando stdout e um terminal.
function corStatus(status: number | null): 'green' | 'cyan' | 'yellow' | 'red' {
  if (status === null || status >= 500) return 'red'
  if (status >= 400) return 'yellow'
  return status >= 300 ? 'cyan' : 'green'
}
const corMetodo = { GET: 'blue', POST: 'green', PUT: 'yellow', DELETE: 'red' } as const

function imprimirLinha(l: LogEntrada): void {
  const url = l.url.replace(/^https?:\/\/[^/]+/, '')
  const metodo = styleText(['bold', corMetodo[l.metodo as keyof typeof corMetodo] ?? 'white'], l.metodo.padEnd(6))
  const status = styleText(['bold', corStatus(l.status)], String(l.status ?? 'ERRO').padEnd(4))
  const seta = l.direcao === 'ENTRADA' ? styleText('cyan', '← recebida') : styleText('magenta', `→ ${l.sistema}`)
  const extra = [
    l.tentativa && l.tentativa > 1 ? styleText('yellow', `tentativa ${l.tentativa}`) : '',
    l.erro ? styleText('red', l.erro) : '',
    l.correlacao ? styleText('dim', `req ${l.correlacao.slice(0, 8)}`) : '',
  ].filter(Boolean).join('  ')
  console.log(`${styleText('dim', new Date().toLocaleTimeString('pt-BR'))}  ${seta}  ${metodo} ${url}  ${status} ${styleText('dim', `${l.duracaoMs}ms`)}  ${extra}`)
}

// Devolve o id da linha, para anotarLog completar depois (ex.: resposta 2xx fora do contrato).
export function registrarLog(db: Db, l: LogEntrada): number {
  if (imprimir) imprimirLinha(l)
  const r = db.prepare(
    `INSERT INTO integracao_logs
       (direcao, sistema, metodo, url, status, duracao_ms, tentativa, erro, correlacao, criado_em)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    l.direcao,
    l.sistema,
    l.metodo,
    l.url,
    l.status,
    l.duracaoMs,
    l.tentativa ?? 1,
    l.erro ?? null,
    l.correlacao ?? null,
    new Date().toISOString(),
  )
  return Number(r.lastInsertRowid)
}

export function anotarLog(db: Db, id: number, erro: string): void {
  if (imprimir) console.log(`${' '.repeat(10)}${styleText('red', `↳ ${erro}`)}`)
  db.prepare('UPDATE integracao_logs SET erro = ? WHERE id = ?').run(erro, id)
}

// Atribui um id de correlacao a cada requisicao e registra todas as chamadas recebidas.
export function logEntrada(db: Db): RequestHandler {
  return (req, res, next) => {
    const inicio = Date.now()
    const correlacao = req.header('x-request-id') ?? randomUUID()
    res.locals.correlacao = correlacao
    res.setHeader('X-Request-Id', correlacao)
    res.on('finish', () => {
      if (IGNORADAS.some((r) => req.originalUrl.startsWith(r))) return
      // Consultas do proprio painel tambem nao sao integracao. Escritas ficam: mudam o que o G4 recebe.
      if (req.method === 'GET' && req.header('x-sistema-origem') === 'painel-vendas') return
      registrarLog(db, {
        direcao: 'ENTRADA',
        // Sem X-Sistema-Origem, a chave identifica o consumidor: a de leitura e a entregue ao G4 (contrato, secao 2).
        sistema: req.header('x-sistema-origem') ?? (res.locals.perfil === 'leitura' ? 'estoque-g4' : 'cliente'),
        metodo: req.method,
        url: req.originalUrl,
        status: res.statusCode,
        duracaoMs: Date.now() - inicio,
        correlacao,
      })
    })
    next()
  }
}
