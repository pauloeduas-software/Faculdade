import { EnviarGrupo4 } from './EnviarGrupo4'
import { ReceberGrupo7 } from './ReceberGrupo7'
import { useFiltrosUrl } from '../../hooks/useFiltrosUrl'

const ABAS = [
  { id: 'receber', titulo: 'Receber do Grupo 7' },
  { id: 'enviar', titulo: 'Enviar ao Grupo 4' },
]

// O que importa na demonstração é executar e ver o resultado. A documentação
// da view, dos usuários e das permissões fica em Docs/.
export function IntegracaoPagina() {
  // A aba e a página do histórico ficam na URL (?aba=enviar, ?page=2): dá para voltar direto a elas
  const [filtros, alterar] = useFiltrosUrl({ aba: 'receber', page: '1' })
  const aba = ABAS.some((a) => a.id === filtros.aba) ? filtros.aba : 'receber'

  return (
    <section>
      <header className="cabecalho-pagina">
        <h1>Integração</h1>
      </header>

      <div className="abas" role="tablist">
        {ABAS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={aba === item.id}
            className={`aba ${aba === item.id ? 'ativa' : ''}`}
            onClick={() => alterar({ aba: item.id, page: '1' })}
          >
            {item.titulo}
          </button>
        ))}
      </div>

      {aba === 'receber' && <ReceberGrupo7 pagina={Math.max(1, Number(filtros.page) || 1)} aoMudarPagina={(p) => alterar({ page: String(p) })} />}
      {aba === 'enviar' && <EnviarGrupo4 />}
    </section>
  )
}
