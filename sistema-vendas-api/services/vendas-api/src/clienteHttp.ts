import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import type { Db } from './db.ts'
import { HttpError } from './errors.ts'
import { anotarLog, registrarLog } from './logger.ts'

// Chamadas do G2 a API de outro grupo: timeout, novas tentativas e registro em integracao_logs.
// Usado pelo consumidor da API de Entregas do G7 (entregasClient.ts).

export interface Destino {
  sistema: string // nome no log, ex.: entregas-g7
  nome: string // nome nas mensagens, ex.: Entregas (G7)
  prefixo: string // prefixo dos codigos de erro, ex.: ENTREGAS -> ENTREGAS_INDISPONIVEL
  baseUrl: string
  apiKey: string
  timeoutMs: number
  retries: number
  retryDelayMs: number
}

export interface Contexto {
  correlacao: string
  idempotencyKey?: string
}

export interface Resposta {
  status: number
  corpo: unknown
  logId: number
}

export type Problema = { campo: string; problema: string }

// Corpo de erro no padrao {"erro": {"codigo", "mensagem"}}. So enriquece mensagens e logs; a decisao e pelo status HTTP.
const corpoErro = z.object({ erro: z.object({ codigo: z.string(), mensagem: z.string().optional() }) })

export const codigoErro = (corpo: unknown) => {
  const p = corpoErro.safeParse(corpo)
  return p.success ? p.data.erro : undefined
}

export const problemasZod = (e: z.ZodError): Problema[] => e.issues.map((i) => ({ campo: i.path.join('.'), problema: i.message }))

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

// Um Retry-After maior que isso deixaria a tela esperando demais: o G2 desiste e devolve 503.
const ESPERA_MAXIMA_MS = 10_000

// Retry-After vem em segundos ou como data HTTP.
function retryAfterMs(valor: string | null): number | null {
  if (!valor) return null
  if (/^\d+$/.test(valor)) return Number(valor) * 1000
  const t = Date.parse(valor)
  return Number.isNaN(t) ? null : Math.max(0, t - Date.now())
}

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms))

export function criarClienteHttp(d: Destino, db: Db) {
  // Faz a chamada com timeout e novas tentativas (falha de rede, timeout ou 5xx), com espera
  // crescente (retryDelayMs, 2x, 4x) ou a pedida no Retry-After do 503.
  // Em POST/PUT, a mesma Idempotency-Key em todas as tentativas evita gravar duas vezes no outro sistema.
  async function chamar(metodo: string, caminho: string, corpo: unknown, ctx: Contexto): Promise<Resposta> {
    const url = `${d.baseUrl}${caminho}`
    const tentativas = d.retries + 1
    // O X-Request-Id enviado e um UUID v4 (exigencia do G7). A correlacao ja e um, a nao ser que
    // quem chamou o G2 tenha mandado um id proprio em outro formato.
    const requestId = UUID_V4.test(ctx.correlacao) ? ctx.correlacao : randomUUID()
    let ultimoErro = 'falha desconhecida'
    let ultimoStatus: number | null = null

    for (let tentativa = 1; tentativa <= tentativas; tentativa++) {
      const inicio = Date.now()
      let espera = d.retryDelayMs * 2 ** (tentativa - 1)
      try {
        const res = await fetch(url, {
          method: metodo,
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'X-API-Key': d.apiKey,
            'X-Request-Id': requestId,
            'X-Sistema-Origem': 'vendas-g2',
            ...(ctx.idempotencyKey ? { 'Idempotency-Key': ctx.idempotencyKey } : {}),
          },
          body: corpo === undefined ? undefined : JSON.stringify(corpo),
          signal: AbortSignal.timeout(d.timeoutMs),
        })
        const texto = await res.text()
        let json: unknown = undefined
        let erro: string | null = null
        if (texto) {
          try {
            json = JSON.parse(texto)
          } catch {
            erro = 'resposta nao e JSON valido'
          }
        }
        // 5xx e falha passageira mesmo sem corpo JSON (ex.: pagina de erro do proxy na frente do outro grupo).
        const transitorio = res.status >= 500
        const erroDestino = res.ok ? undefined : codigoErro(json)
        const descricao = erroDestino ? `${erroDestino.codigo}${erroDestino.mensagem ? `: ${erroDestino.mensagem}` : ''}` : null
        const logId = registrarLog(db, {
          direcao: 'SAIDA', sistema: d.sistema, metodo, url, status: res.status,
          duracaoMs: Date.now() - inicio, tentativa, correlacao: ctx.correlacao,
          erro: descricao ?? (transitorio ? `servico respondeu ${res.status}` : erro),
        })
        if (!transitorio) {
          if (erro) throw new HttpError(502, `${d.prefixo}_RESPOSTA_INVALIDA`, `${d.nome} devolveu resposta invalida (${res.status}): ${erro}`)
          return { status: res.status, corpo: json, logId }
        }
        ultimoStatus = res.status
        ultimoErro = `${d.nome} respondeu ${[res.status, erroDestino?.codigo].filter(Boolean).join(' ')}`
        const pedida = res.status === 503 ? retryAfterMs(res.headers.get('retry-after')) : null
        if (pedida !== null) espera = Math.max(espera, pedida)
      } catch (e) {
        if (e instanceof HttpError) throw e
        ultimoStatus = null
        ultimoErro = e instanceof Error && e.name === 'TimeoutError' ? `timeout apos ${d.timeoutMs}ms` : `falha de rede (${e instanceof Error ? e.message : e})`
        registrarLog(db, {
          direcao: 'SAIDA', sistema: d.sistema, metodo, url, status: null,
          duracaoMs: Date.now() - inicio, tentativa, erro: ultimoErro, correlacao: ctx.correlacao,
        })
      }
      if (tentativa === tentativas) break
      if (espera > ESPERA_MAXIMA_MS) {
        ultimoErro += ` e pediu nova tentativa so daqui a ${Math.ceil(espera / 1000)} s`
        break
      }
      await esperar(espera)
    }
    if (ultimoStatus === 500) throw new HttpError(503, `${d.prefixo}_ERRO_INTERNO`, `${d.nome} falhou em todas as tentativas: ${ultimoErro}`)
    throw new HttpError(503, `${d.prefixo}_INDISPONIVEL`, `Servico de ${d.nome} indisponivel: ${ultimoErro}`)
  }

  // Status com o codigo de erro do outro sistema, quando houver: "404 NAO_ENCONTRADO".
  const descrever = (r: Resposta) => [r.status, codigoErro(r.corpo)?.codigo].filter(Boolean).join(' ')

  // Resposta sem tratamento especifico na operacao (os 5xx ja viraram 503 em chamar).
  function erroGenerico(r: Resposta, operacao: string): never {
    if (r.status === 401 || r.status === 403) {
      throw new HttpError(502, `${d.prefixo}_AUTENTICACAO`, `${d.nome} recusou nossas credenciais (${descrever(r)}) ao ${operacao}`)
    }
    throw new HttpError(502, `${d.prefixo}_RESPOSTA_INESPERADA`, `${d.nome} respondeu ${descrever(r)} ao ${operacao}`)
  }

  // Resposta 2xx que nao segue o contrato: marca a chamada no log e recusa a operacao.
  function violacao(r: Resposta, mensagem: string, problemas: Problema[]): never {
    anotarLog(db, r.logId, `fora do contrato: ${problemas.map((p) => `${p.campo || 'corpo'} ${p.problema}`).join('; ')}`)
    throw new HttpError(502, `${d.prefixo}_CONTRATO_INVALIDO`, mensagem, problemas)
  }

  return { chamar, descrever, erroGenerico, violacao }
}

export type ClienteHttp = ReturnType<typeof criarClienteHttp>
