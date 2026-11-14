import { useEffect, useMemo, useState } from 'react'
import { chamar, type Log, type Resultado } from '../api'
import { Aviso } from './Aviso'

type Filtro = 'todos' | 'erros' | 'ok'

const classe = (s: number | null) => (s === null ? 'x' : s < 400 ? 'ok' : s < 500 ? 'warn' : 'err')
const falhou = (l: Log) => l.status === null || l.status >= 400
const hora = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR')
const caminho = (url: string) => url.replace(/^https?:\/\/[^/]+/, '').replace('/api/v1', '')

interface Grupo { chave: string; entrada?: Log; saidas: Log[]; ultimoId: number }

function agrupar(logs: Log[]): Grupo[] {
  const mapa = new Map<string, Grupo>()
  for (const l of logs) {
    const chave = l.correlacao ?? `log-${l.id}`
    const g = mapa.get(chave) ?? { chave, saidas: [], ultimoId: 0 }
    if (l.direcao === 'ENTRADA') g.entrada = l
    else g.saidas.push(l)
    g.ultimoId = Math.max(g.ultimoId, l.id)
    mapa.set(chave, g)
  }
  const grupos = [...mapa.values()]
  grupos.forEach((g) => g.saidas.sort((a, b) => a.id - b.id))
  return grupos.sort((a, b) => b.ultimoId - a.ultimoId)
}

const NOMES: Record<string, string> = { 'estoque-g4': 'Estoque (G4)', 'entregas-g7': 'Entregas (G7)', 'painel-vendas': 'Painel', cliente: 'Cliente externo' }
const origem = (l: Log) => NOMES[l.sistema] ?? l.sistema

function Linha({ l, sub, aberto, qtd, onClick }: { l: Log; sub?: boolean; aberto?: boolean; qtd?: number; onClick?: () => void }) {
  return (
    <>
      <tr className={sub ? 'sub' : `req${onClick ? ' clicavel' : ''}`} onClick={onClick}>
        <td className="hora">{hora(l.criado_em)}</td>
        <td className="origem">{sub ? <span className="seta">↳</span> : null}{origem(l)}</td>
        <td>
          <span className={`metodo m-${l.metodo}`}>{l.metodo}</span>
          <span className="caminho" title={l.url}>{caminho(l.url)}</span>
          {l.tentativa > 1 && <span className="tentativa">{l.tentativa}ª tentativa</span>}
        </td>
        <td className={`codigo ${classe(l.status)}`}>{l.status ?? 'sem resposta'}</td>
        <td className="ms">{l.duracao_ms} ms</td>
        <td className="extra">{qtd ? <>{qtd} {qtd === 1 ? 'chamada' : 'chamadas'} <span className="chev">{aberto ? '▾' : '▸'}</span></> : null}</td>
      </tr>
      {l.erro && <tr className={`erro-linha${sub ? ' sub' : ''}`}><td /><td colSpan={5}>{l.erro}</td></tr>}
    </>
  )
}

export function Integracao({ recarregar }: { recarregar: number }) {
  const [logs, setLogs] = useState<Log[]>([])
  const [filtro, setFiltro] = useState<Filtro>('todos')
  const [busca, setBusca] = useState('')
  const [auto, setAuto] = useState(true)
  const [falha, setFalha] = useState<Resultado<unknown> | null>(null)
  const [abertos, setAbertos] = useState<Set<string>>(new Set())
  const alternar = (k: string) => setAbertos((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n })

  const [versao, setVersao] = useState(0)
  const carregar = () => setVersao((v) => v + 1)

  useEffect(() => {
    let ativo = true
    void chamar<Log[]>('GET', '/integracao/logs?limite=300').then((r) => {
      if (!ativo) return
      setFalha(r)
      if (r.ok) setLogs(r.dados ?? [])
    })
    return () => { ativo = false }
  }, [recarregar, versao])
  useEffect(() => {
    if (!auto) return
    const t = setInterval(carregar, 3000)
    return () => clearInterval(t)
  }, [auto])

  const resumo = useMemo(() => {
    const saidas = logs.filter((l) => l.direcao === 'SAIDA')
    const tempos = logs.map((l) => l.duracao_ms)
    return {
      entrada: logs.length - saidas.length,
      saida: saidas.length,
      erros: logs.filter(falhou).length,
      retries: saidas.filter((l) => l.tentativa > 1).length,
      media: tempos.length ? Math.round(tempos.reduce((a, b) => a + b, 0) / tempos.length) : 0,
    }
  }, [logs])

  const grupos = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    return agrupar(logs).filter((g) => {
      const todos = [g.entrada, ...g.saidas].filter((x): x is Log => !!x)
      if (filtro === 'erros' && !todos.some(falhou)) return false
      if (filtro === 'ok' && todos.some(falhou)) return false
      return !termo || todos.some((l) => `${l.metodo} ${l.url} ${l.sistema} ${l.erro ?? ''} ${l.status ?? ''}`.toLowerCase().includes(termo))
    })
  }, [logs, filtro, busca])

  return (
    <section>
      <div className="barra">
        <div className="seg">
          {(['todos', 'erros', 'ok'] as const).map((f) => (
            <button key={f} className={f === filtro ? 'ativa' : ''} onClick={() => setFiltro(f)}>
              {{ todos: 'Todas', erros: 'Com erro', ok: 'Sucesso' }[f]}
            </button>
          ))}
        </div>
        <input className="busca" placeholder="Buscar rota, status ou erro" value={busca} onChange={(e) => setBusca(e.target.value)} />
        <label className="check"><input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} /> Atualizar a cada 3 s</label>
        <button onClick={carregar}>Atualizar</button>
      </div>

      <dl className="resumo">
        <div><dt>Recebidas</dt><dd>{resumo.entrada}</dd></div>
        <div><dt>Chamadas feitas</dt><dd>{resumo.saida}</dd></div>
        <div className={resumo.erros ? 'alerta' : ''}><dt>Com erro</dt><dd>{resumo.erros}</dd></div>
        <div><dt>Retentativas</dt><dd>{resumo.retries}</dd></div>
        <div><dt>Tempo médio</dt><dd>{resumo.media} ms</dd></div>
      </dl>

      <Aviso r={falha} />
      {falha?.ok && grupos.length === 0 && <p className="vazio">Nenhuma chamada registrada com esse filtro.</p>}

      {grupos.length > 0 && (
        <div className="tabela"><table className="log">
          <thead><tr><th>Hora</th><th>Origem</th><th>Requisição</th><th>Status</th><th className="ms">Tempo</th><th>Chamadas</th></tr></thead>
          {grupos.map((g) => {
            const principal = g.entrada ?? g.saidas[0]
            const filhas = g.entrada ? g.saidas : g.saidas.slice(1)
            const aberto = abertos.has(g.chave) || (filtro === 'erros' && filhas.some(falhou))
            return (
              <tbody key={g.chave} className={[g.entrada, ...g.saidas].some((l) => l && falhou(l)) ? 'com-erro' : ''}>
                <Linha l={principal} qtd={filhas.length} aberto={aberto} onClick={filhas.length ? () => alternar(g.chave) : undefined} />
                {aberto && filhas.map((l) => <Linha key={l.id} l={l} sub />)}
              </tbody>
            )
          })}
        </table></div>
      )}
    </section>
  )
}
