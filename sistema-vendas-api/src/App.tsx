import { useEffect, useState } from 'react'
import { chaveSalva, salvarChave } from './api'
import './App.css'
import { Integracao } from './components/Integracao'
import { NovaVenda } from './components/NovaVenda'
import { Vendas } from './components/Vendas'

const ABAS = ['Vendas', 'Nova venda', 'Integração'] as const
const RESUMO: Record<(typeof ABAS)[number], string> = {
  Vendas: 'Vendas registradas na API. O Estoque (G4) consulta as confirmadas para dar baixa e as canceladas para estornar. Abra uma venda para consultar a entrega dela na API do G7.',
  'Nova venda': 'A venda é gravada como confirmada, com o nome e o preço informados em cada item.',
  Integração: 'Requisições recebidas pela API (como as do Estoque, G4) e chamadas feitas à API de Entregas (G7).',
}
const slug = (a: string) => a.toLowerCase().normalize('NFD').replace(/[^a-z]/g, '')
const abaInicial = () => ABAS.find((a) => slug(a) === location.hash.slice(1)) ?? 'Vendas'

function App() {
  const [aba, setAba] = useState<(typeof ABAS)[number]>(abaInicial)
  const [tick, setTick] = useState(0)
  const [chave, setChave] = useState(chaveSalva)
  const [no, setNo] = useState<boolean | null>(null)

  useEffect(() => {
    const checar = () => fetch('/health').then((r) => setNo(r.ok), () => setNo(false))
    void checar()
    const t = setInterval(() => void checar(), 5000)
    return () => clearInterval(t)
  }, [])

  return (
    <div className="app">
      <header className="cabecalho-sistema">
        <div className="marca">
          <span className="marca-logo" aria-hidden="true">G2</span>
          <div>
            <strong>Sistema de Vendas</strong>
            <small>Grupo 2 · Integração via API REST</small>
          </div>
        </div>
        <nav className="menu" aria-label="Menu principal">
          {ABAS.map((a) => (
            <button key={a} className={a === aba ? 'ativa' : ''} onClick={() => { setAba(a); history.replaceState(null, '', `#${slug(a)}`) }}>
              {a}
            </button>
          ))}
        </nav>
        <div className="topo">
          <span className={`status ${no === null ? '' : no ? 'on' : 'off'}`}>{no === null ? '…' : no ? 'API online' : 'API offline'}</span>
          <label>X-API-Key
            <input value={chave} onChange={(e) => { setChave(e.target.value); salvarChave(e.target.value) }} />
          </label>
        </div>
      </header>
      <main>
        <div className="pagina">
          <h1>{aba}</h1>
          <p>{RESUMO[aba]}</p>
        </div>
        {aba === 'Vendas' && <Vendas recarregar={tick} />}
        {aba === 'Nova venda' && <NovaVenda aoCriar={() => setTick(tick + 1)} />}
        {aba === 'Integração' && <Integracao recarregar={tick} />}
      </main>
    </div>
  )
}

export default App
