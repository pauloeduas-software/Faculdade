import { Fragment, useEffect, useState } from 'react'
import { chamar, moeda, type ConsultaEntrega, type Resultado, type Venda } from '../api'
import { Aviso } from './Aviso'
import { Rastreio } from './Rastreio'

const STATUS: Record<string, string> = { CONFIRMADA: 'Confirmada', CANCELADA: 'Cancelada' }

export function Vendas({ recarregar }: { recarregar: number }) {
  const [vendas, setVendas] = useState<Venda[]>([])
  const [status, setStatus] = useState('')
  const [falha, setFalha] = useState<Resultado<unknown> | null>(null)
  const [aberta, setAberta] = useState<number | null>(null)
  // Ultima consulta ao G7 de cada venda; null = consultando.
  const [rastreios, setRastreios] = useState<Record<number, Resultado<ConsultaEntrega> | null>>({})
  const [versao, setVersao] = useState(0)
  const carregar = () => setVersao((v) => v + 1)

  // ativo descarta a resposta de um filtro anterior que chegue depois da atual.
  useEffect(() => {
    let ativo = true
    void chamar<Venda[]>('GET', `/vendas${status ? `?status=${status}` : ''}`).then((r) => {
      if (!ativo) return
      setFalha(r)
      if (r.ok) setVendas(r.dados ?? [])
    })
    return () => { ativo = false }
  }, [status, recarregar, versao])

  async function cancelar(v: Venda) {
    const r = await chamar<Venda>('PUT', `/vendas/${v.id}`, { cliente: v.cliente, entrega: v.entrega, status: 'CANCELADA' })
    setFalha(r)
    if (r.ok) carregar()
  }

  async function consultarEntrega(id: number) {
    setRastreios((r) => ({ ...r, [id]: null }))
    const r = await chamar<ConsultaEntrega>('GET', `/vendas/${id}/entrega`)
    setRastreios((x) => ({ ...x, [id]: r }))
  }

  async function excluir(v: Venda) {
    const r = await chamar('DELETE', `/vendas/${v.id}`)
    setFalha(r)
    if (r.ok) carregar()
  }

  return (
    <section>
      <div className="barra">
        <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filtrar por status">
          <option value="">Todos os status</option>
          <option value="CONFIRMADA">Confirmadas</option><option value="CANCELADA">Canceladas</option>
        </select>
        <button onClick={carregar}>Atualizar</button>
      </div>
      <Aviso r={falha} />
      <div className="kpis">
        <div className="kpi"><span>Vendas</span><b>{vendas.length}</b></div>
        <div className="kpi pos"><span>Confirmadas</span><b>{vendas.filter((v) => v.status === 'CONFIRMADA').length}</b></div>
        <div className="kpi ruim"><span>Canceladas</span><b>{vendas.filter((v) => v.status === 'CANCELADA').length}</b></div>
        <div className="kpi"><span>Faturamento</span><b>{moeda(vendas.filter((v) => v.status === 'CONFIRMADA').reduce((a, v) => a + (typeof v.valor_total === 'number' ? v.valor_total : 0), 0))}</b></div>
      </div>
      {vendas.length === 0 && falha?.ok && <p className="vazio">Nenhuma venda encontrada.</p>}
      {vendas.length > 0 && (
        <div className="tabela"><table>
          <thead><tr><th>Nº</th><th>Cliente</th><th>Cidade</th><th className="num">Total</th><th>Status</th><th /></tr></thead>
          <tbody>
            {vendas.map((v) => (
              <Fragment key={v.id}>
                <tr className="linha" onClick={() => setAberta(aberta === v.id ? null : v.id)}>
                  <td className="id">{v.id}</td><td>{v.cliente.nome}</td><td>{v.entrega.cidade}/{v.entrega.uf}</td>
                  <td className="num">{typeof v.valor_total === 'number' ? moeda(v.valor_total) : String(v.valor_total ?? '—')}</td>
                  <td><span className={`tag ${v.status}`}>{STATUS[v.status] ?? v.status}</span></td>
                  <td onClick={(e) => e.stopPropagation()}><div className="acoes">
                    {v.status === 'CONFIRMADA' && <button onClick={() => void cancelar(v)}>Cancelar</button>}
                    {v.status === 'CANCELADA' && <button className="perigo" onClick={() => void excluir(v)}>Excluir</button>}
                  </div></td>
                </tr>
                {aberta === v.id && (
                  <tr key={`d${v.id}`} className="detalhe"><td colSpan={6}>
                    <div>{v.entrega.endereco}, CEP {v.entrega.cep} · Doc. {v.cliente.documento}</div>
                    <ul>{v.itens.map((i) => (
                      <li key={i.produto_id}>{i.quantidade}× {i.nome_produto} (#{i.produto_id}) — {moeda(i.preco_unitario)} = {moeda(i.subtotal)}</li>
                    ))}</ul>
                    {v.motivo_cancelamento && <div className="motivo">Motivo: {v.motivo_cancelamento}</div>}
                    <div className="rastreio">
                      <button onClick={() => void consultarEntrega(v.id)} disabled={rastreios[v.id] === null}>
                        {rastreios[v.id] === null ? 'Consultando o G7…' : 'Consultar entrega (G7)'}
                      </button>
                      {rastreios[v.id] && <Rastreio r={rastreios[v.id]!} />}
                    </div>
                  </td></tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table></div>
      )}
    </section>
  )
}
