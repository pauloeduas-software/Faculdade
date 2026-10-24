import { Link, useParams } from 'react-router-dom'
import { api } from '../../api/cliente'
import { integracaoApi } from '../../api/recursos'
import { StatusBadge } from '../../components/Badge'
import { Alerta, Carregando, ErroCarregamento } from '../../components/Estados'
import { TabelaPaginada, type Coluna } from '../../components/TabelaPaginada'
import { useCarregar } from '../../hooks/useCarregar'
import { useFiltrosUrl } from '../../hooks/useFiltrosUrl'
import type { ErroIntegracao, TipoErro } from '../../types'
import { formatarDataHora, formatarDuracao } from '../../utils/formato'
import { BlocoRelatorio, CartoesTotais, TipoErroBadge } from './componentes'
import { resumoExecucao, TIPO_ERRO } from './textos'

const COLUNAS: Coluna<ErroIntegracao>[] = [
  { titulo: 'Registro', celula: (e) => <span className="mono">{e.registro_origem ?? '(execução)'}</span> },
  { titulo: 'Problema', celula: (e) => <TipoErroBadge tipo={e.tipo_erro} /> },
  { titulo: 'O que aconteceu', celula: (e) => e.descricao },
  { titulo: 'Campo', celula: (e) => <span className="mono">{e.campo ?? '—'}</span>, secundaria: true },
  { titulo: 'Valor recebido', celula: (e) => <span className="mono">{e.valor_recebido ?? <em className="texto-fraco">nulo</em>}</span> },
]

export function ExecucaoDetalhePagina() {
  const id = Number(useParams().id)
  const [filtros, alterar] = useFiltrosUrl({ tipo: '' })
  const execucao = useCarregar(() => integracaoApi.buscar(id), [id])
  const relatorio = useCarregar(() => api.get<string>(`/integracoes/${id}/relatorio`), [id])

  if (execucao.erro) return <ErroCarregamento erro={execucao.erro} aoTentarDeNovo={execucao.recarregar} />
  if (!execucao.dados) return <Carregando />
  const e = execucao.dados
  const totais = { ...e, total_consultado: e.total_registros }

  // Quantos erros de cada tipo, para o filtro
  const contagem = new Map<TipoErro, number>()
  for (const erro of e.erros) contagem.set(erro.tipo_erro, (contagem.get(erro.tipo_erro) ?? 0) + 1)
  const filtrados = filtros.tipo ? e.erros.filter((erro) => erro.tipo_erro === filtros.tipo) : e.erros
  const duracao = e.data_fim ? new Date(e.data_fim).getTime() - new Date(e.data_inicio).getTime() : null

  return (
    <section>
      <header className="cabecalho-pagina">
        <h1>
          Execução {e.integracao_id} <StatusBadge status={e.status} />
        </h1>
        <div className="linha-acoes">
          <a className="botao" href={integracaoApi.urlRelatorio(e.integracao_id)} target="_blank" rel="noreferrer">
            Relatório em texto ↗
          </a>
          <Link className="botao" to="/integracao">
            Voltar
          </Link>
        </div>
      </header>

      <p className="resumo-execucao">{resumoExecucao(totais, e.status)}</p>

      <div className="cartao">
        <dl className="dados-grade">
          <div>
            <dt>De</dt>
            <dd>{e.sistema_origem}</dd>
          </div>
          <div>
            <dt>Para</dt>
            <dd>{e.sistema_destino}</dd>
          </div>
          <div>
            <dt>Início</dt>
            <dd>{formatarDataHora(e.data_inicio, true)}</dd>
          </div>
          <div>
            <dt>Duração</dt>
            <dd>{formatarDuracao(duracao)}</dd>
          </div>
        </dl>
        {e.mensagem && (
          <Alerta tipo={e.status === 'FALHOU' ? 'erro' : 'info'}>
            <strong>{e.status === 'FALHOU' ? 'Motivo:' : 'Observações:'}</strong> {e.mensagem}
          </Alerta>
        )}
      </div>

      <CartoesTotais totais={totais} />

      <div className="cabecalho-cartao">
        <h2 className="subtitulo">Problemas encontrados ({e.erros.length})</h2>
        <select aria-label="Filtrar por tipo de erro" value={filtros.tipo} onChange={(ev) => alterar({ tipo: ev.target.value })}>
          <option value="">Todos os tipos ({e.erros.length})</option>
          {[...contagem].map(([tipo, quantidade]) => (
            <option key={tipo} value={tipo}>
              {TIPO_ERRO[tipo].rotulo} ({quantidade})
            </option>
          ))}
        </select>
      </div>
      <TabelaPaginada
        colunas={COLUNAS}
        linhas={filtrados}
        chave={(erro) => erro.erro_id}
        carregando={false}
        textoVazio={e.erros.length === 0 ? 'Nenhum problema nesta execução.' : 'Nenhum problema deste tipo.'}
      />

      <h2 className="subtitulo">Relatório no formato do enunciado</h2>
      {relatorio.dados ? <BlocoRelatorio texto={relatorio.dados} /> : <Carregando />}
    </section>
  )
}
