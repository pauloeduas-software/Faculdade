import type { RequestHandler } from 'express'
import type { Config } from './config.ts'
import { HttpError } from './errors.ts'

export type Perfil = 'admin' | 'leitura'

// 401: chave ausente/desconhecida. 403: chave valida, mas sem permissao para a operacao.
export function autenticar(config: Config): RequestHandler {
  return (req, res, next) => {
    const chave = req.header('x-api-key')
    if (!chave) throw new HttpError(401, 'NAO_AUTENTICADO', 'Header X-API-Key ausente')
    const perfil = config.apiKeys[chave]
    if (!perfil) throw new HttpError(401, 'CHAVE_INVALIDA', 'X-API-Key invalida')
    res.locals.perfil = perfil
    if (perfil === 'leitura' && !['GET', 'HEAD'].includes(req.method)) {
      throw new HttpError(403, 'SEM_PERMISSAO', 'Esta chave permite apenas consultas (GET)')
    }
    next()
  }
}

export const apenasAdmin: RequestHandler = (_req, res, next) => {
  if (res.locals.perfil !== 'admin') {
    throw new HttpError(403, 'SEM_PERMISSAO', 'Operacao restrita a perfil admin')
  }
  next()
}
