// Cliente HTTP da API (/api, que o Vite repassa para o Express em dev).
// Todo erro da API tem o formato { erro, mensagem, detalhes? } e vira um ErroApi.

type Detalhes = unknown
export type ValorQuery = string | number | boolean | null | undefined

export class ErroApi extends Error {
  readonly status: number
  readonly codigo: string
  readonly detalhes: Detalhes
  // Mensagens por campo do formulário: DADOS_INVALIDOS e REFERENCIA_INVALIDA
  // trazem [{ campo, mensagem }]; REGISTRO_DUPLICADO e regras do banco trazem
  // { campo } (a constraint que barrou)
  readonly errosDeCampo: Record<string, string>

  constructor(status: number, codigo: string, mensagem: string, detalhes?: Detalhes) {
    super(mensagem)
    this.name = 'ErroApi'
    this.status = status
    this.codigo = codigo
    this.detalhes = detalhes
    this.errosDeCampo = extrairErrosDeCampo(mensagem, detalhes)
  }

  get dica(): string | undefined {
    const detalhes = this.detalhes as { dica?: unknown } | null
    return typeof detalhes?.dica === 'string' ? detalhes.dica : undefined
  }
}

function extrairErrosDeCampo(mensagem: string, detalhes: Detalhes): Record<string, string> {
  const erros: Record<string, string> = {}
  if (Array.isArray(detalhes)) {
    for (const item of detalhes) {
      const { campo, mensagem: texto } = (item ?? {}) as { campo?: unknown; mensagem?: unknown }
      if (typeof campo === 'string' && typeof texto === 'string' && !(campo in erros)) erros[campo] = texto
    }
  } else if (detalhes && typeof detalhes === 'object') {
    const { campo } = detalhes as { campo?: unknown }
    if (typeof campo === 'string') erros[campo] = mensagem
  }
  return erros
}

const MENSAGEM_SEM_SERVIDOR = 'Servidor indisponível. Verifique se a API está rodando.'
const MENSAGEM_ERRO_INTERNO = 'Erro interno no servidor. Tente de novo em instantes; se continuar, verifique o banco de dados e o log da API.'

function montarUrl(caminho: string, query?: Record<string, ValorQuery>): string {
  const params = new URLSearchParams()
  for (const [chave, valor] of Object.entries(query ?? {})) {
    if (valor !== undefined && valor !== null && valor !== '') params.set(chave, String(valor))
  }
  const texto = params.toString()
  return `/api${caminho}${texto ? `?${texto}` : ''}`
}

async function requisitar<T>(metodo: string, caminho: string, corpo?: unknown, query?: Record<string, ValorQuery>): Promise<T> {
  let resposta: Response
  try {
    resposta = await fetch(montarUrl(caminho, query), {
      method: metodo,
      headers: corpo === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
    })
  } catch {
    throw new ErroApi(0, 'SEM_CONEXAO', MENSAGEM_SEM_SERVIDOR)
  }
  // 502/503/504: o proxy do Vite (ou outro intermediário) não alcançou a API
  if ([502, 503, 504].includes(resposta.status)) throw new ErroApi(resposta.status, 'SEM_CONEXAO', MENSAGEM_SEM_SERVIDOR)

  if (resposta.status === 204) return undefined as T

  const ehJson = resposta.headers.get('content-type')?.includes('application/json')
  const conteudo: unknown = ehJson ? await resposta.json().catch(() => null) : await resposta.text()

  if (!resposta.ok) {
    const erro = conteudo as { erro?: unknown; mensagem?: unknown; detalhes?: unknown } | null
    if (resposta.status >= 500) throw new ErroApi(resposta.status, 'ERRO_INTERNO', MENSAGEM_ERRO_INTERNO)
    if (erro && typeof erro === 'object' && typeof erro.erro === 'string') {
      throw new ErroApi(resposta.status, erro.erro, String(erro.mensagem ?? erro.erro), erro.detalhes)
    }
    throw new ErroApi(resposta.status, 'ERRO_HTTP', `O servidor respondeu ${resposta.status} ${resposta.statusText}`)
  }

  return conteudo as T
}

export const api = {
  get: <T>(caminho: string, query?: Record<string, ValorQuery>) => requisitar<T>('GET', caminho, undefined, query),
  post: <T>(caminho: string, corpo?: unknown) => requisitar<T>('POST', caminho, corpo ?? {}),
  put: <T>(caminho: string, corpo: unknown) => requisitar<T>('PUT', caminho, corpo),
  delete: <T = void>(caminho: string) => requisitar<T>('DELETE', caminho),
}

// Mensagem para mostrar ao usuário a partir de qualquer erro
export function mensagemDeErro(erro: unknown): string {
  return erro instanceof Error ? erro.message : String(erro)
}
