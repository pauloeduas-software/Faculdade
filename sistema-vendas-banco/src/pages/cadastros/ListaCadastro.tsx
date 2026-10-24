import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ErroApi, mensagemDeErro } from '../../api/cliente'
import { CampoBusca } from '../../components/CampoBusca'
import { Alerta } from '../../components/Estados'
import { ModalConfirmacao } from '../../components/Modal'
import { TabelaPaginada, type Coluna } from '../../components/TabelaPaginada'
import { useCarregar } from '../../hooks/useCarregar'
import { useFiltrosUrl } from '../../hooks/useFiltrosUrl'
import { useToast } from '../../hooks/useToast'
import type { ConfigCadastro } from './tipos'

const LIMITE = 50

interface Exclusao<T> {
  registro: T
  bloqueio: string | null // mensagem do 409 quando o registro tem vendas
  ocupado: boolean
}

export function ListaCadastro<T, D>({ config }: { config: ConfigCadastro<T, D> }) {
  const navegar = useNavigate()
  const toast = useToast()
  const [filtros, alterarFiltros] = useFiltrosUrl({ busca: '', ativo: 'todos', page: '1' })
  const pagina = Math.max(1, Number(filtros.page) || 1)
  const [exclusao, setExclusao] = useState<Exclusao<T> | null>(null)
  const [alternando, setAlternando] = useState<number | null>(null) // id com Desativar/Ativar em andamento

  const lista = useCarregar(
    () =>
      config.api.listar({
        busca: filtros.busca || undefined,
        ativo: filtros.ativo === 'todos' ? undefined : filtros.ativo === 'true',
        page: pagina,
        limit: LIMITE,
      }),
    [filtros.busca, filtros.ativo, pagina],
  )

  async function excluir() {
    if (!exclusao) return
    const { registro } = exclusao
    setExclusao({ ...exclusao, ocupado: true })
    try {
      await config.api.excluir(config.id(registro))
      toast.sucesso(`${config.descricao(registro)} excluído.`)
      setExclusao(null)
      lista.recarregar()
    } catch (erro) {
      // 409: o banco barrou a exclusão (ON DELETE RESTRICT); a saída é desativar
      if (erro instanceof ErroApi && erro.status === 409) {
        setExclusao({ registro, bloqueio: erro.message, ocupado: false })
      } else {
        toast.erro(mensagemDeErro(erro))
        setExclusao(null)
      }
    }
  }

  // Desativar/Ativar: PUT com o próprio registro, trocando só o "ativo"
  async function alterarSituacao(registro: T, ativo: boolean) {
    await config.api.atualizar(config.id(registro), config.comSituacao(registro, ativo))
    toast.sucesso(`${config.descricao(registro)} ${ativo ? 'ativado' : 'desativado'}.`)
    lista.recarregar()
  }

  // Botão da linha
  async function alternar(registro: T) {
    setAlternando(config.id(registro))
    try {
      await alterarSituacao(registro, !config.ativo(registro))
    } catch (erro) {
      toast.erro(mensagemDeErro(erro))
    } finally {
      setAlternando(null)
    }
  }

  // Botão do modal de exclusão bloqueada
  async function desativar() {
    if (!exclusao) return
    const { registro } = exclusao
    setExclusao({ ...exclusao, ocupado: true })
    try {
      await alterarSituacao(registro, false)
      setExclusao(null)
    } catch (erro) {
      toast.erro(mensagemDeErro(erro))
      setExclusao({ ...exclusao, ocupado: false })
    }
  }

  const colunas: Coluna<T>[] = [
    ...config.colunas,
    {
      titulo: 'Ações',
      alinhamento: 'direita',
      fixaDireita: true,
      celula: (registro) => (
        <div className="acoes-linha" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            className="botao botao-pequeno"
            disabled={alternando === config.id(registro)}
            onClick={() => alternar(registro)}
          >
            {config.ativo(registro) ? 'Desativar' : 'Ativar'}
          </button>
          <Link className="botao botao-pequeno" to={`${config.rota}/${config.id(registro)}`}>
            Editar
          </Link>
          <button
            type="button"
            className="botao botao-pequeno botao-perigo-contorno"
            onClick={() => setExclusao({ registro, bloqueio: null, ocupado: false })}
          >
            Excluir
          </button>
        </div>
      ),
    },
  ]

  return (
    <section>
      <header className="cabecalho-pagina">
        <h1>{config.titulo}</h1>
        <Link className="botao botao-primario" to={`${config.rota}/novo`}>
          + {config.novo}
        </Link>
      </header>

      <div className="barra-filtros">
        <CampoBusca valor={filtros.busca} aoMudar={(busca) => alterarFiltros({ busca })} placeholder={config.placeholderBusca} />
        <select aria-label="Situação" value={filtros.ativo} onChange={(e) => alterarFiltros({ ativo: e.target.value })}>
          <option value="todos">Todos</option>
          <option value="true">Ativos</option>
          <option value="false">Inativos</option>
        </select>
      </div>

      <TabelaPaginada
        colunas={colunas}
        linhas={lista.dados?.dados ?? null}
        chave={config.id}
        carregando={lista.carregando}
        erro={lista.erro}
        aoTentarDeNovo={lista.recarregar}
        textoVazio={filtros.busca ? `Nenhum ${config.singular} encontrado para "${filtros.busca}".` : `Nenhum ${config.singular} cadastrado.`}
        aoClicarLinha={(registro) => navegar(`${config.rota}/${config.id(registro)}`)}
        pagina={pagina}
        limite={LIMITE}
        total={lista.dados?.total ?? 0}
        aoMudarPagina={(p) => alterarFiltros({ page: String(p) })}
      />

      {exclusao && (
        <ModalConfirmacao
          aberto
          titulo={exclusao.bloqueio ? 'Exclusão não permitida' : `Excluir ${config.singular}?`}
          textoConfirmar="Excluir"
          perigo
          ocupado={exclusao.ocupado}
          ocultarConfirmar={exclusao.bloqueio !== null}
          aoConfirmar={excluir}
          aoCancelar={() => setExclusao(null)}
          acoesExtras={
            exclusao.bloqueio !== null &&
            config.ativo(exclusao.registro) && (
              <button type="button" className="botao botao-primario" onClick={desativar} disabled={exclusao.ocupado}>
                Desativar
              </button>
            )
          }
        >
          {exclusao.bloqueio ? (
            <>
              <Alerta tipo="aviso">{exclusao.bloqueio}</Alerta>
              <p>
                {config.ativo(exclusao.registro)
                  ? `Desativar mantém o histórico de vendas e esconde ${config.descricao(exclusao.registro)} das novas vendas.`
                  : `${config.descricao(exclusao.registro)} já está inativo.`}
              </p>
            </>
          ) : (
            <p>
              <strong>{config.descricao(exclusao.registro)}</strong> será excluído definitivamente.
            </p>
          )}
        </ModalConfirmacao>
      )}
    </section>
  )
}
