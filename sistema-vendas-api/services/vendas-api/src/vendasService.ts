import type { Db } from './db.ts'
import { emTransacao } from './db.ts'
import { HttpError } from './errors.ts'
import type { AtualizarVenda, CriarVenda } from './schemas.ts'
import { validarCliente, validarEntrega, validarSemantica } from './schemas.ts'

interface VendaRow {
  id: number
  cliente_nome: string
  cliente_documento: string
  entrega_endereco: string
  entrega_cidade: string
  entrega_uf: string
  entrega_cep: string
  status: string
  motivo_cancelamento: string | null
  valor_total: number
  criado_em: string
  atualizado_em: string
}

interface ItemRow {
  produto_id: number
  nome_produto: string
  quantidade: number
  preco_unitario: number
}

const arredondar = (n: number) => Math.round(n * 100) / 100

// Aceita AAAA-MM-DD e data-hora ISO 8601; o Date.parse sozinho aceitaria "1" ou "2026-02-31".
const DATA_ISO = /^(\d{4}-\d{2}-\d{2})(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})?)?$/

function dataIso(campo: string, valor: string): string {
  const m = DATA_ISO.exec(valor)
  const t = Date.parse(valor)
  // O dia precisa existir: 2026-02-31 viraria 2026-03-03.
  if (!m || Number.isNaN(t) || new Date(`${m[1]}T00:00:00Z`).toISOString().slice(0, 10) !== m[1]) {
    throw new HttpError(400, 'PARAMETRO_INVALIDO', `${campo} deve ser uma data ISO (AAAA-MM-DD)`)
  }
  // criado_em e gravado em UTC; com so a data, data_fim inclui o dia inteiro.
  if (!m[2]) return campo === 'data_fim' ? `${valor}T23:59:59.999Z` : `${valor}T00:00:00.000Z`
  return new Date(t).toISOString()
}

export function criarVendasService(db: Db) {
  function montar(v: VendaRow) {
    const itens = db
      .prepare('SELECT produto_id, nome_produto, quantidade, preco_unitario FROM itens_venda WHERE venda_id = ? ORDER BY id')
      .all(v.id) as unknown as ItemRow[]
    return {
      id: v.id,
      cliente: { nome: v.cliente_nome, documento: v.cliente_documento },
      entrega: { endereco: v.entrega_endereco, cidade: v.entrega_cidade, uf: v.entrega_uf, cep: v.entrega_cep },
      itens: itens.map((i) => ({
        produto_id: i.produto_id,
        nome_produto: i.nome_produto,
        quantidade: i.quantidade,
        preco_unitario: i.preco_unitario,
        subtotal: arredondar(i.quantidade * i.preco_unitario),
      })),
      valor_total: v.valor_total,
      status: v.status,
      motivo_cancelamento: v.motivo_cancelamento,
      criado_em: v.criado_em,
      atualizado_em: v.atualizado_em,
    }
  }

  function buscarRow(id: number): VendaRow {
    const row = db.prepare('SELECT * FROM vendas WHERE id = ?').get(id) as VendaRow | undefined
    if (!row) throw new HttpError(404, 'VENDA_NAO_ENCONTRADA', `Venda ${id} nao encontrada`)
    return row
  }

  function buscarPorChave(chave: string) {
    const row = db.prepare('SELECT * FROM vendas WHERE idempotency_key = ?').get(chave) as VendaRow | undefined
    return row ? montar(row) : undefined
  }

  return {
    listar(filtros: { status?: string; data_inicio?: string; data_fim?: string }) {
      const where: string[] = []
      const params: string[] = []
      if (filtros.status) {
        if (!['CONFIRMADA', 'CANCELADA'].includes(filtros.status)) {
          throw new HttpError(400, 'PARAMETRO_INVALIDO', 'status deve ser CONFIRMADA ou CANCELADA')
        }
        where.push('status = ?'); params.push(filtros.status)
      }
      for (const [campo, op] of [['data_inicio', '>='], ['data_fim', '<=']] as const) {
        const valor = filtros[campo]
        if (!valor) continue
        where.push(`criado_em ${op} ?`)
        params.push(dataIso(campo, valor))
      }
      const sql = `SELECT * FROM vendas ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY id`
      return (db.prepare(sql).all(...params) as unknown as VendaRow[]).map(montar)
    },

    obter(id: number) {
      return montar(buscarRow(id))
    },

    criar(dados: CriarVenda, chave: string | undefined) {
      const erros = validarSemantica(dados)
      if (erros.length) throw new HttpError(422, 'DADOS_INVALIDOS', 'Dados semanticamente invalidos', erros)

      if (chave) {
        const existente = buscarPorChave(chave)
        if (existente) return { venda: existente, repetida: true }
      }

      // Venda e itens na mesma transacao; a chave unica protege contra POST duplicado concorrente.
      const agora = new Date().toISOString()
      const total = arredondar(dados.itens.reduce((s, it) => s + it.quantidade * it.preco_unitario, 0))
      try {
        const id = emTransacao(db, () => {
          const r = db.prepare(
            `INSERT INTO vendas (cliente_nome, cliente_documento, entrega_endereco, entrega_cidade, entrega_uf,
               entrega_cep, status, valor_total, idempotency_key, criado_em, atualizado_em)
             VALUES (?, ?, ?, ?, ?, ?, 'CONFIRMADA', ?, ?, ?, ?)`,
          ).run(dados.cliente.nome.trim(), dados.cliente.documento.replace(/\D/g, ''), dados.entrega.endereco.trim(),
            dados.entrega.cidade.trim(), dados.entrega.uf.toUpperCase(), dados.entrega.cep.replace(/\D/g, ''),
            total, chave ?? null, agora, agora)
          const vendaId = Number(r.lastInsertRowid)
          for (const it of dados.itens) {
            db.prepare('INSERT INTO itens_venda (venda_id, produto_id, nome_produto, quantidade, preco_unitario) VALUES (?, ?, ?, ?, ?)')
              .run(vendaId, it.produto_id, it.nome_produto.trim(), it.quantidade, it.preco_unitario)
          }
          return vendaId
        })
        return { venda: montar(buscarRow(id)), repetida: false }
      } catch (e) {
        const existente = chave ? buscarPorChave(chave) : undefined
        if (existente) return { venda: existente, repetida: true }
        throw e
      }
    },

    atualizar(id: number, dados: AtualizarVenda) {
      const atual = buscarRow(id)
      const erros: string[] = []
      validarCliente(dados.cliente, erros)
      validarEntrega(dados.entrega, erros)
      if (erros.length) throw new HttpError(422, 'DADOS_INVALIDOS', 'Dados semanticamente invalidos', erros)
      if (atual.status === 'CANCELADA') {
        throw new HttpError(409, 'VENDA_CANCELADA', 'Venda cancelada nao pode ser alterada')
      }
      const novoStatus = dados.status ?? atual.status
      db.prepare(
        `UPDATE vendas SET cliente_nome = ?, cliente_documento = ?, entrega_endereco = ?, entrega_cidade = ?,
           entrega_uf = ?, entrega_cep = ?, status = ?, motivo_cancelamento = ?, atualizado_em = ? WHERE id = ?`,
      ).run(dados.cliente.nome.trim(), dados.cliente.documento.replace(/\D/g, ''), dados.entrega.endereco.trim(),
        dados.entrega.cidade.trim(), dados.entrega.uf.toUpperCase(), dados.entrega.cep.replace(/\D/g, ''),
        novoStatus, novoStatus === 'CANCELADA' ? 'cancelada via API' : null, new Date().toISOString(), id)
      return montar(buscarRow(id))
    },

    excluir(id: number) {
      const v = buscarRow(id)
      // Uma venda confirmada pode ja ter sido baixada pelo G4: cancelar antes avisa o Estoque para estornar.
      if (v.status === 'CONFIRMADA') {
        throw new HttpError(409, 'VENDA_CONFIRMADA', 'Venda CONFIRMADA nao pode ser excluida: cancele-a antes (PUT status=CANCELADA)')
      }
      db.prepare('DELETE FROM vendas WHERE id = ?').run(id)
    },
  }
}

export type VendasService = ReturnType<typeof criarVendasService>
