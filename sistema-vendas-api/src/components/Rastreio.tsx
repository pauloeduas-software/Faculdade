import { moeda, type ConsultaEntrega, type Resultado } from '../api'
import { Aviso } from './Aviso'

const STATUS: Record<string, string> = {
  AGUARDANDO_COLETA: 'Aguardando coleta', EM_TRANSITO: 'Em trânsito', SAIU_PARA_ENTREGA: 'Saiu para entrega',
  ENTREGUE: 'Entregue', NAO_ENTREGUE: 'Não entregue', DEVOLVIDA: 'Devolvida', CANCELADA: 'Cancelada',
}
const nome = (s: string) => STATUS[s] ?? s
const dia = (d: string | null) => (d ? d.split('-').reverse().join('/') : '—')
const quando = (iso: string) => new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })

// Resultado de GET /vendas/{id}/entrega: a entrega da venda na API do G7.
export function Rastreio({ r }: { r: Resultado<ConsultaEntrega> }) {
  if (!r.ok || !r.dados) return <Aviso r={r} />
  const { entrega: e, historico, leitura_anterior: antes, alterada } = r.dados
  if (!e) {
    return <p className="motivo">O G7 ainda não tem entrega para esta venda{antes ? ' (a entrega lida antes não existe mais)' : ''}.</p>
  }
  const mudanca = !antes ? 'Primeira leitura' : alterada ? `Mudou desde a última consulta (antes: ${nome(antes.status_entrega)})` : 'Sem mudança desde a última consulta'
  return (
    <div className="entrega">
      <div className="entrega-topo">
        <span className={`tag ent-${e.status_entrega}`}>{nome(e.status_entrega)}</span>
        <b>{e.codigo_rastreio}</b>
        <span className="motivo">{mudanca}</span>
      </div>
      <dl>
        <div><dt>Transportadora</dt><dd>{e.transportadora ?? '—'}</dd></div>
        <div><dt>Previsão</dt><dd>{dia(e.data_prevista)}</dd></div>
        <div><dt>Entregue em</dt><dd>{dia(e.data_entrega)}</dd></div>
        <div><dt>Frete</dt><dd>{e.valor_frete === null ? '—' : moeda(e.valor_frete)}</dd></div>
      </dl>
      {e.pendencias.length > 0 && <div className="motivo">Dados ainda pendentes no G7: {e.pendencias.join(', ')}</div>}
      {historico.length > 0 && (
        <ol>{historico.map((h, i) => (
          <li key={i}><span>{quando(h.data_hora)}</span> · {nome(h.status_entrega)}{h.observacao ? ` — ${h.observacao}` : ''}</li>
        ))}</ol>
      )}
    </div>
  )
}
