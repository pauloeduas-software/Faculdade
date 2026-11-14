import type { ErrorRequestHandler, RequestHandler } from 'express'

export class HttpError extends Error {
  status: number
  codigo: string
  detalhes?: unknown

  constructor(status: number, codigo: string, mensagem: string, detalhes?: unknown) {
    super(mensagem)
    this.status = status
    this.codigo = codigo
    this.detalhes = detalhes
  }
}

export const naoEncontrado: RequestHandler = (req, _res, next) => {
  next(new HttpError(404, 'ROTA_NAO_ENCONTRADA', `Rota ${req.method} ${req.path} nao existe`))
}

export const tratarErros: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({
      erro: { codigo: err.codigo, mensagem: err.message, detalhes: err.detalhes },
    })
    return
  }
  // Corpo recusado pelo body-parser: JSON malformado, grande demais, charset nao suportado
  if (err?.type && typeof err.status === 'number' && err.status < 500) {
    const malformado = err.type === 'entity.parse.failed'
    res.status(400).json({
      erro: {
        codigo: 'JSON_INVALIDO',
        mensagem: malformado ? 'Corpo da requisicao nao e um JSON valido' : `Corpo da requisicao recusado: ${err.message}`,
      },
    })
    return
  }
  console.error(err)
  res.status(500).json({
    erro: { codigo: 'ERRO_INTERNO', mensagem: 'Erro interno no servidor' },
  })
}
