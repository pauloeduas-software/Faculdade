import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api, ErroApi, mensagemDeErro } from '../../api/cliente'
import { integracaoApi } from '../../api/recursos'
import { StatusBadge } from '../../components/Badge'
import { Alerta } from '../../components/Estados'
import { TabelaPaginada, type Coluna } from '../../components/TabelaPaginada'
import { useCarregar, type Carregamento } from '../../hooks/useCarregar'
import { useToast } from '../../hooks/useToast'
import type { DiagnosticoProdutor, Execucao, ResultadoIntegracao, StatusExecucao, TipoErro } from '../../types'
import { formatarDataHora, formatarDuracao } from '../../utils/formato'
import { BlocoRelatorio, TipoErroBadge } from './componentes'
import { resumoExecucao } from './textos'

const SEMAFORO = { OK: 'verde', ALERTA: 'amarelo', ERRO: 'vermelho' } as const
const TEXTO_NIVEL = {
  OK: 'Banco do Grupo 7 conectado: pronto para receber.',
  ALERTA: 'Banco do Grupo 7 conectado, mas a view está diferente do contrato.',
  ERRO: 'Não dá para receber do Grupo 7 agora.',
} as const
const ERROS_NO_RESUMO = 5

export function ReceberGrupo7({ pagina, aoMudarPagina }: { pagina: number; aoMudarPagina: (p: number) => void }) {
  // Muda a cada execução terminada, para o histórico recarregar
  const [execucoes, setExecucoes] = useState(0)

  return (
    <>
      <CartaoExecucao aoTerminar={() => setExecucoes((n) => n + 1)} />
      <Historico pagina={pagina} aoMudarPagina={aoMudarPagina} recarga={execucoes} />
    </>
  )
}

// -----------------------------------------------------------------------------
// Situação do banco do Grupo 7 (conexão + estrutura, sem processar nada) e o
// botão de executar. A situação é verificada ao abrir a tela e depois de cada execução.
// -----------------------------------------------------------------------------
function SituacaoGrupo7({ situacao }: { situacao: Carregamento<DiagnosticoProdutor> }) {
  const { carregando, erro } = situacao
  // Se a verificação falhou, o diagnóstico anterior já não vale
  const diagnostico = erro === null ? situacao.dados : null
  // O que impede (ou atrapalha) a integração; no verde não há nada a dizer
  const problema = !diagnostico || diagnostico.nivel === 'OK' ? null : diagnostico.conexao.ok ? diagnostico.estrutura.mensagem : diagnostico.conexao.mensagem

  return (
    <div className="situacao-grupo7" data-testid="diagnostico">
      <div className="linha-acoes">
        <p className={`semaforo ${diagnostico && !carregando ? SEMAFORO[diagnostico.nivel] : ''}`} data-testid="nivel-diagnostico">
          {carregando ? 'Verificando o banco do Grupo 7…' : diagnostico ? TEXTO_NIVEL[diagnostico.nivel] : 'Não foi possível verificar o banco do Grupo 7.'}
        </p>
        <button type="button" className="botao botao-pequeno" onClick={situacao.recarregar} disabled={carregando}>
          Verificar de novo
        </button>
      </div>
      {erro !== null && !carregando && <Alerta tipo="erro">{mensagemDeErro(erro)}</Alerta>}
      {problema && !carregando && <Alerta tipo={diagnostico?.nivel === 'ALERTA' ? 'aviso' : 'erro'}>{problema}</Alerta>}
    </div>
  )
}

function CartaoExecucao({ aoTerminar }: { aoTerminar: () => void }) {
  const toast = useToast()
  const situacao = useCarregar(() => integracaoApi.diagnostico(), [])
  const [resultado, setResultado] = useState<ResultadoIntegracao | null>(null)
  const [executando, setExecutando] = useState(false)
  const [segundos, setSegundos] = useState(0)
  const [aviso, setAviso] = useState<{ tipo: 'erro' | 'aviso'; texto: string } | null>(null)

  // Enquanto não houver uma execução nesta tela, mostra a última registrada
  const ultima = useCarregar(async () => {
    const pagina = await integracaoApi.listar(1, 1)
    const execucao = pagina.dados[0]
    if (!execucao) return null
    const [detalhe, texto] = await Promise.all([
      integracaoApi.buscar(execucao.integracao_id),
      api.get<string>(`/integracoes/${execucao.integracao_id}/relatorio`),
    ])
    return { execucao: detalhe, texto }
  }, [])

  useEffect(() => {
    if (!executando) return
    const timer = setInterval(() => setSegundos((s) => s + 1), 1000)
    return () => clearInterval(timer)
  }, [executando])

  async function executar() {
    setExecutando(true)
    setSegundos(0)
    setAviso(null)
    try {
      const novo = await integracaoApi.executar()
      setResultado(novo)
      if (novo.status === 'FALHOU') toast.erro(`Execução ${novo.integracao_id} falhou. O motivo está no resultado.`)
      else toast.sucesso(`Execução ${novo.integracao_id} concluída: ${novo.inseridos} inseridos, ${novo.atualizados} atualizados, ${novo.rejeitados} rejeitados.`)
    } catch (erro) {
      if (erro instanceof ErroApi && erro.codigo === 'INTEGRACAO_EM_ANDAMENTO') {
        setAviso({ tipo: 'aviso', texto: `Já existe uma integração rodando agora. ${erro.message} Nada foi feito por esta tentativa.` })
      } else {
        setAviso({ tipo: 'erro', texto: mensagemDeErro(erro) })
      }
    } finally {
      setExecutando(false)
      aoTerminar()
      situacao.recarregar()
    }
  }

  return (
    <div className="cartao" data-testid="cartao-execucao">
      <div className="cabecalho-cartao cabecalho-execucao">
        <SituacaoGrupo7 situacao={situacao} />
        <button type="button" className="botao botao-primario" onClick={executar} disabled={executando}>
          {executando ? 'Executando…' : 'Executar integração'}
        </button>
      </div>

      {executando && (
        <div role="status">
          <div className="progresso" />
          <span className="texto-fraco">
            Conectando → lendo a view → conferindo → transformando → gravando → registrando → relatório… ({segundos}s)
          </span>
        </div>
      )}
      {aviso && <Alerta tipo={aviso.tipo}>{aviso.texto}</Alerta>}

      {resultado ? (
        <ResultadoExecucao
          id={resultado.integracao_id}
          status={resultado.status}
          titulo="Resultado desta execução"
          totais={resultado}
          duracao={resultado.duracao_ms}
          mensagem={resultado.mensagem}
          erros={resultado.erros}
          texto={resultado.texto}
        />
      ) : (
        ultima.dados && (
          <ResultadoExecucao
            id={ultima.dados.execucao.integracao_id}
            status={ultima.dados.execucao.status}
            titulo={`Última execução (${formatarDataHora(ultima.dados.execucao.data_inicio)})`}
            totais={{ ...ultima.dados.execucao, total_consultado: ultima.dados.execucao.total_registros }}
            duracao={null}
            mensagem={ultima.dados.execucao.mensagem}
            erros={ultima.dados.execucao.erros.map((e) => ({ ...e, registro: e.registro_origem }))}
            texto={ultima.dados.texto}
          />
        )
      )}
    </div>
  )
}

interface ResultadoExecucaoProps {
  id: number
  status: StatusExecucao
  titulo: string
  totais: { total_consultado: number; inseridos: number; atualizados: number; sem_alteracao: number; rejeitados: number }
  duracao: number | null
  mensagem: string | null
  erros: { registro: string | null; tipo_erro: TipoErro; descricao: string }[]
  texto: string
}

function ResultadoExecucao({ id, status, titulo, totais, duracao, mensagem, erros, texto }: ResultadoExecucaoProps) {
  const [verRelatorio, setVerRelatorio] = useState(false)

  return (
    <div data-testid="resultado-execucao">
      <h3>
        {titulo}: execução {id} <StatusBadge status={status} />
        {duracao !== null && <span className="texto-fraco">{formatarDuracao(duracao)}</span>}
      </h3>
      <p className="resumo-execucao">{resumoExecucao(totais, status)}</p>
      {mensagem && (
        <Alerta tipo={status === 'FALHOU' ? 'erro' : 'info'}>
          <strong>{status === 'FALHOU' ? 'Motivo:' : 'Observações:'}</strong> {mensagem}
        </Alerta>
      )}

      {erros.length > 0 && (
        <div className="problemas">
          <h4>Problemas encontrados ({erros.length})</h4>
          <ul>
            {erros.slice(0, ERROS_NO_RESUMO).map((erro, i) => (
              <li key={i}>
                <TipoErroBadge tipo={erro.tipo_erro} />
                <span>
                  <strong>{erro.registro ? `Registro ${erro.registro}:` : 'Execução:'}</strong> {erro.descricao}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="linha-acoes">
        <Link className="botao botao-pequeno" to={`/integracao/execucoes/${id}`}>
          {erros.length > ERROS_NO_RESUMO ? `Ver os ${erros.length} problemas e detalhes` : 'Ver detalhes'}
        </Link>
        <button type="button" className="botao botao-pequeno" aria-expanded={verRelatorio} onClick={() => setVerRelatorio((v) => !v)}>
          {verRelatorio ? 'Esconder relatório' : 'Ver relatório'}
        </button>
      </div>

      {verRelatorio && (
        <div className="detalhes-relatorio">
          <BlocoRelatorio texto={texto} />
        </div>
      )}
    </div>
  )
}

// -----------------------------------------------------------------------------
// Execuções anteriores (integracao.integracao)
// -----------------------------------------------------------------------------
const LIMITE_HISTORICO = 10

const COLUNAS_HISTORICO: Coluna<Execucao>[] = [
  { titulo: 'Nº', celula: (e) => <span className="mono">{e.integracao_id}</span>, largura: '3.5rem' },
  { titulo: 'Início', celula: (e) => formatarDataHora(e.data_inicio, true) },
  { titulo: 'Consultados', celula: (e) => e.total_registros, alinhamento: 'direita' },
  { titulo: 'Inseridos', celula: (e) => e.inseridos, alinhamento: 'direita' },
  { titulo: 'Atualizados', celula: (e) => e.atualizados, alinhamento: 'direita', secundaria: true },
  { titulo: 'Rejeitados', celula: (e) => e.rejeitados, alinhamento: 'direita' },
  { titulo: 'Status', celula: (e) => <StatusBadge status={e.status} /> },
]

function Historico({ pagina, aoMudarPagina, recarga }: { pagina: number; aoMudarPagina: (p: number) => void; recarga: number }) {
  const navegar = useNavigate()
  const execucoes = useCarregar(() => integracaoApi.listar(pagina, LIMITE_HISTORICO), [pagina, recarga])

  return (
    <div className="cartao" data-testid="historico">
      <h3>Execuções anteriores</h3>
      <p className="texto-fraco">Clique numa execução para ver os problemas dela.</p>
      <TabelaPaginada
        colunas={COLUNAS_HISTORICO}
        linhas={execucoes.dados?.dados ?? null}
        chave={(e) => e.integracao_id}
        carregando={execucoes.carregando}
        erro={execucoes.erro}
        aoTentarDeNovo={execucoes.recarregar}
        textoVazio="Nenhuma execução ainda. Use o botão “Executar integração” acima."
        aoClicarLinha={(e) => navegar(`/integracao/execucoes/${e.integracao_id}`)}
        pagina={pagina}
        limite={LIMITE_HISTORICO}
        total={execucoes.dados?.total ?? 0}
        aoMudarPagina={aoMudarPagina}
      />
    </div>
  )
}
