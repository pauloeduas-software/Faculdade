import type { Contexto } from './clienteHttp.ts'
import type { Db } from './db.ts'
import type { EntregasClient } from './entregasClient.ts'
import { HttpError } from './errors.ts'

interface Leitura {
  id_entrega: number
  codigo_rastreio: string
  status_entrega: string
  data_atualizacao: string
}

// Rastreio da entrega de cada venda, lido da API do G7 (contrato do G7, regras 5 e 6).
export function criarEntregasService(db: Db, g7: EntregasClient) {
  return {
    async consultar(vendaId: number, ctx: Contexto) {
      if (!db.prepare('SELECT 1 FROM vendas WHERE id = ?').get(vendaId)) {
        throw new HttpError(404, 'VENDA_NAO_ENCONTRADA', `Venda ${vendaId} nao encontrada`)
      }
      const entregas = await g7.porVenda(vendaId, ctx)
      // Vale a entrega nao cancelada; se todas foram canceladas, a mais recente.
      const entrega = entregas.find((e) => e.status_entrega !== 'CANCELADA') ?? entregas.sort((a, b) => b.id_entrega - a.id_entrega)[0]
      const historico = entrega ? await g7.historico(entrega.id_entrega, ctx) : []

      // So grava depois de todas as respostas do G7 passarem na validacao (regra 3).
      const anterior = db
        .prepare('SELECT id_entrega, codigo_rastreio, status_entrega, data_atualizacao FROM entregas_venda WHERE venda_id = ?')
        .get(vendaId) as Leitura | undefined
      if (entrega) {
        db.prepare(
          `INSERT INTO entregas_venda (venda_id, id_entrega, codigo_rastreio, status_entrega, data_atualizacao, consultado_em)
           VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT (venda_id) DO UPDATE SET id_entrega = excluded.id_entrega, codigo_rastreio = excluded.codigo_rastreio,
             status_entrega = excluded.status_entrega, data_atualizacao = excluded.data_atualizacao, consultado_em = excluded.consultado_em`,
        ).run(vendaId, entrega.id_entrega, entrega.codigo_rastreio, entrega.status_entrega, entrega.data_atualizacao, new Date().toISOString())
      } else {
        // O pedido ainda nao gerou entrega, ou a entrega foi excluida no G7.
        db.prepare('DELETE FROM entregas_venda WHERE venda_id = ?').run(vendaId)
      }

      return {
        venda_id: vendaId,
        entrega: entrega ?? null,
        historico,
        leitura_anterior: anterior ?? null,
        // Regra 6: a entrega mudou se a data_atualizacao (ou a propria entrega) e outra.
        alterada: anterior?.id_entrega !== entrega?.id_entrega || anterior?.data_atualizacao !== entrega?.data_atualizacao,
      }
    },
  }
}

export type EntregasService = ReturnType<typeof criarEntregasService>
