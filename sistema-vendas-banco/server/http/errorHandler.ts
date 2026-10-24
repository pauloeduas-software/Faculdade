import type { ErrorRequestHandler } from 'express'
import pg from 'pg'
import { ZodError } from 'zod'
import { AppError } from './errors.js'

// SQLSTATE do PostgreSQL → resposta HTTP
const ERROS_POSTGRES: Record<string, { status: number; codigo: string; mensagem: string }> = {
  '23505': { status: 409, codigo: 'REGISTRO_DUPLICADO', mensagem: 'Registro duplicado' },
  '23503': {
    status: 409,
    codigo: 'VIOLACAO_INTEGRIDADE_REFERENCIAL',
    mensagem: 'A operação viola a integridade referencial',
  },
  '23514': { status: 422, codigo: 'VALOR_INVALIDO', mensagem: 'Valor não permitido pelas regras do banco' },
  '23502': { status: 422, codigo: 'VALOR_INVALIDO', mensagem: 'Campo obrigatório não informado' },
  '22001': { status: 422, codigo: 'VALOR_INVALIDO', mensagem: 'Texto maior que o tamanho permitido' },
  '22003': { status: 422, codigo: 'VALOR_INVALIDO', mensagem: 'Número fora do intervalo permitido' },
  '22P02': { status: 400, codigo: 'TIPO_INVALIDO', mensagem: 'Valor com tipo inválido' },
  '22007': { status: 400, codigo: 'TIPO_INVALIDO', mensagem: 'Data em formato inválido' },
  '22008': { status: 400, codigo: 'TIPO_INVALIDO', mensagem: 'Data inexistente' },
  '22021': { status: 400, codigo: 'VALOR_INVALIDO', mensagem: 'O texto contém um caractere inválido (NUL)' },
}

// Regras garantidas por triggers em database/02_tabelas.sql, com SQLSTATE próprio.
// A mensagem enviada ao cliente é a que a própria trigger escreveu.
const ERROS_TRIGGER: Record<string, { status: number; codigo: string; campo?: string }> = {
  VD001: { status: 409, codigo: 'OPERACAO_NAO_PERMITIDA', campo: 'codigo_sku' }, // SKU de produto já vendido
  VD002: { status: 409, codigo: 'VENDA_NAO_ABERTA' }, // item de venda que não está ABERTA
  VD003: { status: 409, codigo: 'OPERACAO_NAO_PERMITIDA' }, // exclusão de venda que não está ABERTA
  VD004: { status: 422, codigo: 'TRANSICAO_INVALIDA', campo: 'status' }, // transição de status fora da sequência
}

// Mensagens específicas para as constraints de database/02_tabelas.sql
const MENSAGENS_CONSTRAINT: Record<string, string> = {
  uq_cliente_cpf: 'Já existe um cliente com este CPF',
  uq_cliente_email: 'Já existe um cliente com este e-mail',
  uq_vendedor_email: 'Já existe um vendedor com este e-mail',
  uq_produto_codigo_sku: 'Já existe um produto com este SKU',
  uq_item_venda_venda_produto:
    'Cada produto só pode aparecer uma vez na venda; altere a quantidade do item existente',
  fk_venda_cliente: 'Cliente informado não existe',
  fk_venda_vendedor: 'Vendedor informado não existe',
  fk_item_venda_produto: 'Produto informado não existe',
  ck_cliente_cpf: 'CPF deve ter 11 dígitos numéricos',
  ck_cliente_nome: 'Nome é obrigatório',
  ck_vendedor_nome: 'Nome é obrigatório',
  ck_produto_nome: 'Nome é obrigatório',
  ck_produto_sku: 'SKU deve estar no formato PRD-0000',
  ck_vendedor_comissao: 'Comissão deve estar entre 0 e 100',
  ck_produto_preco: 'Preço deve ser maior que zero',
  ck_venda_status: 'Status de venda inválido',
  ck_venda_forma_pagamento: 'Forma de pagamento inválida',
  ck_item_venda_quantidade: 'Quantidade deve ser maior que zero',
  ck_item_venda_preco: 'Preço do item deve ser maior que zero',
}

// Campo do formulário a que cada constraint se refere: o front mostra o erro embaixo dele
const CAMPOS_CONSTRAINT: Record<string, string> = {
  uq_cliente_cpf: 'cpf',
  uq_cliente_email: 'email',
  uq_vendedor_email: 'email',
  uq_produto_codigo_sku: 'codigo_sku',
  ck_cliente_cpf: 'cpf',
  ck_cliente_nome: 'nome',
  ck_vendedor_nome: 'nome',
  ck_produto_nome: 'nome',
  ck_produto_sku: 'codigo_sku',
  ck_vendedor_comissao: 'comissao_percentual',
  ck_produto_preco: 'preco_unitario',
  ck_item_venda_quantidade: 'quantidade',
}

// O texto técnico do PostgreSQL (ex.: "Key (cpf)=(...) already exists") fica só
// no log do servidor; o cliente recebe a nossa mensagem e o campo
function registrarNoLog(req: Parameters<ErrorRequestHandler>[1], err: pg.DatabaseError): void {
  console.warn(`[banco] ${req.method} ${req.originalUrl} → ${err.code}${err.constraint ? ` ${err.constraint}` : ''}: ${err.message}${err.detail ? ` (${err.detail})` : ''}`)
}

// Express 5 encaminha para cá também os erros lançados em handlers async
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (err instanceof AppError) {
    res.status(err.status).json({ erro: err.codigo, mensagem: err.message, detalhes: err.detalhes })
    return
  }

  if (err instanceof ZodError) {
    res.status(400).json({
      erro: 'DADOS_INVALIDOS',
      mensagem: 'Dados inválidos na requisição',
      detalhes: err.issues.map((issue) => ({
        campo: issue.path.join('.') || '(corpo)',
        mensagem: issue.message,
      })),
    })
    return
  }

  // As mensagens e dicas das triggers VD00x são nossas (escritas em português
  // em database/02_tabelas.sql), por isso vão para o cliente
  if (err instanceof pg.DatabaseError && err.code && ERROS_TRIGGER[err.code]) {
    const { status, codigo, campo } = ERROS_TRIGGER[err.code]
    res.status(status).json({ erro: codigo, mensagem: err.message, detalhes: { dica: err.hint, campo } })
    return
  }

  if (err instanceof pg.DatabaseError && err.code && ERROS_POSTGRES[err.code]) {
    registrarNoLog(req, err)
    const { status, codigo, mensagem } = ERROS_POSTGRES[err.code]
    res.status(status).json({
      erro: codigo,
      mensagem: (err.constraint && MENSAGENS_CONSTRAINT[err.constraint]) || mensagem,
      detalhes: { campo: err.constraint ? CAMPOS_CONSTRAINT[err.constraint] : undefined },
    })
    return
  }

  // Erros do express.json(): JSON malformado, corpo grande demais...
  if (err?.type === 'entity.parse.failed') {
    res.status(400).json({ erro: 'DADOS_INVALIDOS', mensagem: 'JSON malformado no corpo da requisição' })
    return
  }
  if (typeof err?.status === 'number' && err.status >= 400 && err.status < 500) {
    res.status(err.status).json({ erro: 'REQUISICAO_INVALIDA', mensagem: err.message })
    return
  }

  // O detalhe fica só no log do servidor; o cliente recebe uma mensagem genérica
  console.error(err)
  res.status(500).json({ erro: 'ERRO_INTERNO', mensagem: 'Erro interno no servidor' })
}
