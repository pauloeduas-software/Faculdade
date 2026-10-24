import { StatusBadge } from '../../components/Badge'
import type { Entrega } from '../../types'
import { formatarData, formatarDataHora } from '../../utils/formato'

// Entrega integrada do Sistema de Entregas (Grupo 7), mostrada na tela da venda
export function BlocoEntrega({ entrega }: { entrega: Entrega }) {
  return (
    <div className="cartao">
      <div className="cabecalho-cartao">
        <strong className="mono">{entrega.codigo_rastreio}</strong>
        <StatusBadge status={entrega.status_entrega} />
      </div>
      <dl className="dados-grade">
        <div>
          <dt>Previsão</dt>
          <dd>{formatarData(entrega.data_prevista)}</dd>
        </div>
        <div>
          <dt>Saída</dt>
          <dd>{formatarDataHora(entrega.data_saida)}</dd>
        </div>
        <div>
          <dt>Entregue em</dt>
          <dd>{formatarDataHora(entrega.data_entrega)}</dd>
        </div>
        <div>
          <dt>Entregador</dt>
          <dd>{entrega.entregador ?? '—'}</dd>
        </div>
        <div>
          <dt>Destino</dt>
          <dd>{entrega.cidade ? `${entrega.cidade}/${entrega.uf ?? ''}` : '—'}</dd>
        </div>
        <div>
          <dt>Id no Grupo 7</dt>
          <dd className="mono">{entrega.id_entrega_origem}</dd>
        </div>
        <div>
          <dt>Integrada em</dt>
          <dd>{formatarDataHora(entrega.integrado_em, true)}</dd>
        </div>
        <div>
          <dt>Última alteração no Grupo 7</dt>
          <dd>{formatarDataHora(entrega.origem_atualizado_em, true)}</dd>
        </div>
      </dl>
    </div>
  )
}
