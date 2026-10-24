import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { mensagemDeErro } from '../../api/cliente'
import { clientesApi, vendasApi } from '../../api/recursos'
import { StatusBadge } from '../../components/Badge'
import { ModalConfirmacao } from '../../components/Modal'
import { TabelaPaginada, type Coluna } from '../../components/TabelaPaginada'
import { useCarregar } from '../../hooks/useCarregar'
import { useFiltrosUrl } from '../../hooks/useFiltrosUrl'
import { useToast } from '../../hooks/useToast'
import { STATUS_VENDA, type StatusVenda, type VendaResumo } from '../../types'
import { formatarDataHora, formatarMoeda, rotulo } from '../../utils/formato'

const LIMITE = 50

// Botão do próximo passo da venda (as transições permitidas vêm da API).
// Cancelar tem botão próprio, com confirmação
const PROXIMO_PASSO: Partial<Record<StatusVenda, string>> = {
  CONFIRMADA: 'Confirmar',
  EM_ENTREGA: 'Enviar p/ entrega',
  ENTREGUE: 'Marcar entregue',
}

// Por que Cancelar/Excluir aparecem desabilitados (vira a dica do botão)
const SEM_CANCELAR: Partial<Record<StatusVenda, string>> = {
  EM_ENTREGA: 'Já saiu para entrega: não pode mais ser cancelada',
  ENTREGUE: 'Venda concluída: não pode ser cancelada',
  CANCELADA: 'Esta venda já está cancelada',
}

interface Confirmacao {
  acao: 'cancelar' | 'excluir'
  venda: VendaResumo
  ocupado: boolean
}

// Uma linha por venda, como nos cadastros (a forma de pagamento fica na tela de edição)
const COLUNAS: Coluna<VendaResumo>[] = [
  { titulo: 'Nº', celula: (v) => <span className="mono">{v.venda_id}</span>, largura: '4rem' },
  { titulo: 'Data', celula: (v) => <span className="sem-quebra">{formatarDataHora(v.data_venda)}</span> },
  { titulo: 'Cliente', celula: (v) => <span className="sem-quebra">{v.cliente_nome}</span> },
  { titulo: 'Vendedor', celula: (v) => <span className="sem-quebra">{v.vendedor_nome}</span>, secundaria: true },
  { titulo: 'Total', celula: (v) => formatarMoeda(v.valor_total), alinhamento: 'direita' },
  { titulo: 'Status', celula: (v) => <StatusBadge status={v.status} /> },
]

export function VendasLista() {
  const navegar = useNavigate()
  const toast = useToast()
  const [filtros, alterarFiltros] = useFiltrosUrl({ status: '', cliente_id: '', data_inicio: '', data_fim: '', page: '1' })
  const pagina = Math.max(1, Number(filtros.page) || 1)
  const [confirmacao, setConfirmacao] = useState<Confirmacao | null>(null)
  const [avancando, setAvancando] = useState<number | null>(null) // venda com mudança de status em andamento

  const clientes = useCarregar(() => clientesApi.listar({ limit: 100 }), [])
  const vendas = useCarregar(
    () =>
      vendasApi.listar({
        status: (filtros.status || undefined) as StatusVenda | undefined,
        cliente_id: filtros.cliente_id ? Number(filtros.cliente_id) : undefined,
        data_inicio: filtros.data_inicio || undefined,
        data_fim: filtros.data_fim || undefined,
        page: pagina,
        limit: LIMITE,
      }),
    [filtros.status, filtros.cliente_id, filtros.data_inicio, filtros.data_fim, pagina],
  )

  const temFiltro = Boolean(filtros.status || filtros.cliente_id || filtros.data_inicio || filtros.data_fim)

  // Confirmar, Enviar p/ entrega e Marcar entregue: sem modal, como Desativar nos cadastros
  async function avancar(venda: VendaResumo, status: StatusVenda) {
    setAvancando(venda.venda_id)
    try {
      await vendasApi.mudarStatus(venda.venda_id, status)
      toast.sucesso(`Venda ${venda.venda_id}: ${rotulo(status).toLowerCase()}.`)
      vendas.recarregar()
    } catch (erro) {
      toast.erro(mensagemDeErro(erro))
    } finally {
      setAvancando(null)
    }
  }

  async function confirmar() {
    if (!confirmacao) return
    const { acao, venda } = confirmacao
    setConfirmacao({ ...confirmacao, ocupado: true })
    try {
      if (acao === 'cancelar') {
        await vendasApi.mudarStatus(venda.venda_id, 'CANCELADA')
        toast.sucesso(`Venda ${venda.venda_id} cancelada.`)
      } else {
        await vendasApi.excluir(venda.venda_id)
        toast.sucesso(`Venda ${venda.venda_id} excluída.`)
      }
      vendas.recarregar()
    } catch (erro) {
      toast.erro(mensagemDeErro(erro))
    } finally {
      setConfirmacao(null)
    }
  }

  const colunas: Coluna<VendaResumo>[] = [
    ...COLUNAS,
    {
      titulo: 'Ações',
      alinhamento: 'direita',
      fixaDireita: true,
      celula: (venda) => {
        const proximo = venda.transicoes_permitidas.find((status) => status !== 'CANCELADA')
        const podeCancelar = venda.transicoes_permitidas.includes('CANCELADA')
        const podeExcluir = venda.status === 'ABERTA'
        // Os botões que mudam o status ficam juntos; Editar e Excluir depois, como nos cadastros
        return (
          <div className="acoes-linha" onClick={(e) => e.stopPropagation()}>
            {proximo && (
              <button type="button" className="botao botao-pequeno" disabled={avancando === venda.venda_id} onClick={() => avancar(venda, proximo)}>
                {PROXIMO_PASSO[proximo]}
              </button>
            )}
            <button
              type="button"
              className="botao botao-pequeno botao-perigo-contorno"
              disabled={!podeCancelar}
              title={podeCancelar ? undefined : SEM_CANCELAR[venda.status]}
              onClick={() => setConfirmacao({ acao: 'cancelar', venda, ocupado: false })}
            >
              Cancelar
            </button>
            <Link className="botao botao-pequeno" to={`/vendas/${venda.venda_id}`}>
              Editar
            </Link>
            <button
              type="button"
              className="botao botao-pequeno botao-perigo-contorno"
              disabled={!podeExcluir}
              title={podeExcluir ? undefined : 'Só vendas abertas podem ser excluídas; as outras ficam no histórico (use Cancelar)'}
              onClick={() => setConfirmacao({ acao: 'excluir', venda, ocupado: false })}
            >
              Excluir
            </button>
          </div>
        )
      },
    },
  ]

  return (
    <section>
      <header className="cabecalho-pagina">
        <h1>Vendas</h1>
        <Link className="botao botao-primario" to="/vendas/nova">
          + Nova venda
        </Link>
      </header>

      <div className="barra-filtros">
        <select aria-label="Status" value={filtros.status} onChange={(e) => alterarFiltros({ status: e.target.value })}>
          <option value="">Todos os status</option>
          {STATUS_VENDA.map((status) => (
            <option key={status} value={status}>
              {rotulo(status)}
            </option>
          ))}
        </select>
        <select aria-label="Cliente" value={filtros.cliente_id} onChange={(e) => alterarFiltros({ cliente_id: e.target.value })}>
          <option value="">Todos os clientes</option>
          {clientes.dados?.dados.map((c) => (
            <option key={c.cliente_id} value={c.cliente_id}>
              {c.nome}
            </option>
          ))}
        </select>
        <label className="filtro-data">
          De
          <input type="date" value={filtros.data_inicio} onChange={(e) => alterarFiltros({ data_inicio: e.target.value })} />
        </label>
        <label className="filtro-data">
          até
          <input type="date" value={filtros.data_fim} onChange={(e) => alterarFiltros({ data_fim: e.target.value })} />
        </label>
        {temFiltro && (
          <button type="button" className="botao botao-link" onClick={() => alterarFiltros({ status: '', cliente_id: '', data_inicio: '', data_fim: '' })}>
            Limpar filtros
          </button>
        )}
      </div>

      <TabelaPaginada
        colunas={colunas}
        linhas={vendas.dados?.dados ?? null}
        chave={(v) => v.venda_id}
        carregando={vendas.carregando}
        erro={vendas.erro}
        aoTentarDeNovo={vendas.recarregar}
        textoVazio={temFiltro ? 'Nenhuma venda com esses filtros.' : 'Nenhuma venda cadastrada.'}
        aoClicarLinha={(v) => navegar(`/vendas/${v.venda_id}`)}
        pagina={pagina}
        limite={LIMITE}
        total={vendas.dados?.total ?? 0}
        aoMudarPagina={(p) => alterarFiltros({ page: String(p) })}
      />

      {confirmacao?.acao === 'cancelar' && (
        <ModalConfirmacao
          aberto
          titulo={`Cancelar a venda ${confirmacao.venda.venda_id}?`}
          textoConfirmar="Cancelar venda"
          textoCancelar="Voltar"
          perigo
          ocupado={confirmacao.ocupado}
          aoConfirmar={confirmar}
          aoCancelar={() => setConfirmacao(null)}
        >
          <p>
            Venda de <strong>{confirmacao.venda.cliente_nome}</strong>, {formatarMoeda(confirmacao.venda.valor_total)}.
          </p>
          <p>CANCELADA é um status final: a venda não poderá mais mudar de status nem de itens.</p>
          {confirmacao.venda.status !== 'ABERTA' && <p>O Sistema de Estoque (Grupo 4) verá o cancelamento e estornará a baixa dos itens.</p>}
        </ModalConfirmacao>
      )}

      {confirmacao?.acao === 'excluir' && (
        <ModalConfirmacao
          aberto
          titulo={`Excluir a venda ${confirmacao.venda.venda_id}?`}
          textoConfirmar="Excluir"
          perigo
          ocupado={confirmacao.ocupado}
          aoConfirmar={confirmar}
          aoCancelar={() => setConfirmacao(null)}
        >
          <p>
            A venda de <strong>{confirmacao.venda.cliente_nome}</strong> ({formatarMoeda(confirmacao.venda.valor_total)}) e os seus itens serão excluídos
            definitivamente.
          </p>
        </ModalConfirmacao>
      )}
    </section>
  )
}
