import pg from 'pg'

// Erro de negócio com status HTTP e código estável para o cliente da API
export class AppError extends Error {
  readonly status: number
  readonly codigo: string
  readonly detalhes?: unknown

  constructor(status: number, codigo: string, mensagem: string, detalhes?: unknown) {
    super(mensagem)
    this.name = 'AppError'
    this.status = status
    this.codigo = codigo
    this.detalhes = detalhes
  }
}

export function naoEncontrado(mensagem: string): AppError {
  return new AppError(404, 'REGISTRO_NAO_ENCONTRADO', mensagem)
}

// Verifica se err veio do PostgreSQL com o SQLSTATE informado (ex.: '23503')
export function erroPostgres(err: unknown, codigo: string): err is pg.DatabaseError {
  return err instanceof pg.DatabaseError && err.code === codigo
}
