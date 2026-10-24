import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ErroApi, mensagemDeErro } from '../../api/cliente'
import { clientesApi, produtosApi, vendasApi, vendedoresApi } from '../../api/recursos'
import { StatusBadge } from '../../components/Badge'
import { Campo } from '../../components/Campo'
import { Alerta, Carregando, ErroCarregamento } from '../../components/Estados'
import { useCarregar } from '../../hooks/useCarregar'
import { useToast } from '../../hooks/useToast'
import { FORMAS_PAGAMENTO, type Cliente, type FormaPagamento, type Produto, type StatusVenda, type VendaDetalhe, type Vendedor } from '../../types'
import { formatarCpf, formatarDataHora, formatarMoeda, rotulo } from '../../utils/formato'
import { BlocoEntrega } from './BlocoEntrega'

interface LinhaItem {
  chave: number
  produto_id: string
  quantidade: string
}

// Produto como aparece no seletor de itens
interface OpcaoProduto {
  produto_id: number
  codigo_sku: string
  nome: string
  preco_unitario: number
}

let proximaChave = 1
const novaLinha = (produto_id = '', quantidade = '1'): LinhaItem => ({ chave: proximaChave++, produto_id, quantidade })

const MOTIVO_SOMENTE_LEITURA: Record<StatusVenda, string> = {
  ABERTA: '',
  CONFIRMADA: 'Depois de confirmada, o Sistema de Estoque (Grupo 4) já pode ter dado baixa nos produtos.',
  EM_ENTREGA: 'Os produtos já saíram para entrega.',
  ENTREGUE: 'A venda foi concluída.',
  CANCELADA: 'A venda foi cancelada.',
}

// Nova venda e Editar venda são a mesma tela (como nos cadastros). Na edição,
// carrega a venda e só então monta o formulário com os valores dela
export function FormularioVenda() {
  const { id } = useParams()
  const venda = useCarregar(() => (id !== undefined ? vendasApi.buscar(Number(id)) : Promise.resolve(null)), [id])
  // Só cadastros ativos podem entrar numa venda (a API recusa os inativos)
  const cadastros = useCarregar(
    () =>
      Promise.all([
        clientesApi.listar({ ativo: true, limit: 100 }),
        vendedoresApi.listar({ ativo: true, limit: 100 }),
        produtosApi.listar({ ativo: true, limit: 100 }),
      ]),
    [],
  )

  const erro = venda.erro ?? cadastros.erro
  if (erro) return <ErroCarregamento erro={erro} aoTentarDeNovo={venda.erro ? venda.recarregar : cadastros.recarregar} />
  if (!cadastros.dados || (id !== undefined && (!venda.dados || venda.carregando))) return <Carregando />
  const [clientes, vendedores, produtos] = cadastros.dados
  return <Formulario key={id} venda={venda.dados ?? undefined} clientes={clientes.dados} vendedores={vendedores.dados} produtos={produtos.dados} />
}

interface FormularioProps {
  venda?: VendaDetalhe
  clientes: Cliente[]
  vendedores: Vendedor[]
  produtos: Produto[]
}

function Formulario({ venda, clientes, vendedores, produtos }: FormularioProps) {
  // Itens só mudam enquanto a venda está ABERTA; forma de pagamento e observação, sempre
  const itensEditaveis = !venda || venda.status === 'ABERTA'
  const navegar = useNavigate()
  const toast = useToast()

  const [clienteId, setClienteId] = useState(venda ? String(venda.cliente.cliente_id) : '')
  const [vendedorId, setVendedorId] = useState(venda ? String(venda.vendedor.vendedor_id) : '')
  const [formaPagamento, setFormaPagamento] = useState<FormaPagamento | ''>(venda?.forma_pagamento ?? '')
  const [observacao, setObservacao] = useState(venda?.observacao ?? '')
  const [itens, setItens] = useState<LinhaItem[]>(() =>
    venda ? venda.itens.map((item) => novaLinha(String(item.produto_id), String(item.quantidade))) : [novaLinha()],
  )
  const [erros, setErros] = useState<Record<string, string>>({})
  const [erroGeral, setErroGeral] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)

  // Item que já está na venda mantém o preço gravado nela; item novo usa o preço
  // atual do cadastro (é o que o servidor faz ao salvar)
  const itemGravado = new Map(venda?.itens.map((item) => [item.produto_id, item]))
  const opcoes: OpcaoProduto[] = [
    ...produtos.filter((p) => !itemGravado.has(p.produto_id)),
    ...(venda?.itens ?? []).map((item) => ({ produto_id: item.produto_id, codigo_sku: item.codigo_sku, nome: item.produto_nome, preco_unitario: item.preco_unitario })),
  ].sort((a, b) => a.codigo_sku.localeCompare(b.codigo_sku))
  const opcaoPorId = new Map(opcoes.map((p) => [p.produto_id, p]))

  const precoDe = (linha: LinhaItem) => opcaoPorId.get(Number(linha.produto_id))?.preco_unitario ?? 0
  const previa = itens.reduce((soma, linha) => soma + precoDe(linha) * (Number(linha.quantidade) || 0), 0)

  function alterarItem(chave: number, mudanca: Partial<LinhaItem>) {
    setItens((linhas) => linhas.map((linha) => (linha.chave === chave ? { ...linha, ...mudanca } : linha)))
  }

  function validar(): Record<string, string> {
    const encontrados: Record<string, string> = {}
    if (!clienteId) encontrados.cliente_id = 'Escolha o cliente'
    if (!vendedorId) encontrados.vendedor_id = 'Escolha o vendedor'
    if (!formaPagamento) encontrados.forma_pagamento = 'Escolha a forma de pagamento'
    if (observacao.trim().length > 1000) encontrados.observacao = 'Máximo de 1000 caracteres'
    if (!itensEditaveis) return encontrados
    if (itens.length === 0) encontrados.itens = 'A venda precisa ter pelo menos 1 item'

    const vistos = new Set<string>()
    itens.forEach((linha, indice) => {
      if (!linha.produto_id) encontrados[`itens.${indice}.produto_id`] = 'Escolha o produto'
      else if (vistos.has(linha.produto_id)) encontrados[`itens.${indice}.produto_id`] = 'Produto repetido: aumente a quantidade da outra linha'
      vistos.add(linha.produto_id)
      const quantidade = Number(linha.quantidade)
      if (!Number.isInteger(quantidade) || quantidade <= 0) encontrados[`itens.${indice}.quantidade`] = 'Quantidade deve ser maior que zero'
      else if (quantidade > 100_000) encontrados[`itens.${indice}.quantidade`] = 'Quantidade máxima é 100000'
    })
    return encontrados
  }

  async function salvar(evento: FormEvent) {
    evento.preventDefault()
    setErroGeral(null)
    const encontrados = validar()
    setErros(encontrados)
    if (Object.keys(encontrados).length > 0) return

    const listaItens = itens.map((linha) => ({ produto_id: Number(linha.produto_id), quantidade: Number(linha.quantidade) }))
    setSalvando(true)
    try {
      if (venda) {
        // Itens só vão quando mudaram: assim a venda que deixou de estar ABERTA
        // ainda pode ter a forma de pagamento e a observação corrigidas
        const original = venda.itens.map((item) => `${item.produto_id}:${item.quantidade}`).sort().join()
        const mudouItens = listaItens.map((item) => `${item.produto_id}:${item.quantidade}`).sort().join() !== original
        await vendasApi.atualizar(venda.venda_id, {
          forma_pagamento: formaPagamento as FormaPagamento,
          observacao: observacao.trim() || null,
          ...(itensEditaveis && mudouItens ? { itens: listaItens } : {}),
        })
        toast.sucesso(`Venda ${venda.venda_id} atualizada.`)
      } else {
        const criada = await vendasApi.criar({
          cliente_id: Number(clienteId),
          vendedor_id: Number(vendedorId),
          forma_pagamento: formaPagamento as FormaPagamento,
          observacao: observacao.trim() || null,
          itens: listaItens,
        })
        // O total que vale é o calculado pelo banco (trigger), com o preço do cadastro
        toast.sucesso(`Venda ${criada.venda_id} criada: total ${formatarMoeda(criada.valor_total)}.`)
      }
      navegar('/vendas')
    } catch (erro) {
      if (erro instanceof ErroApi && Object.keys(erro.errosDeCampo).length > 0) setErros(erro.errosDeCampo)
      setErroGeral(mensagemDeErro(erro))
    } finally {
      setSalvando(false)
    }
  }

  return (
    <section>
      <header className="cabecalho-pagina">
        <h1>
          {venda ? (
            <>
              Editar venda {venda.venda_id} <StatusBadge status={venda.status} />
            </>
          ) : (
            'Nova venda'
          )}
        </h1>
        <Link className="botao" to="/vendas">
          Voltar
        </Link>
      </header>

      <form className="cartao formulario" onSubmit={salvar} noValidate>
        {erroGeral && <Alerta tipo="erro">{erroGeral}</Alerta>}

        <div className="grade-campos">
          {/* Cliente e vendedor não mudam depois de criada a venda (a API recusa) */}
          {venda ? (
            <>
              <Campo rotulo="Cliente" nome="cliente_id" dica="Não muda depois de criada a venda.">
                <input id="cliente_id" value={`${venda.cliente.nome} (${formatarCpf(venda.cliente.cpf)})`} disabled />
              </Campo>
              <Campo rotulo="Vendedor" nome="vendedor_id" dica="Não muda depois de criada a venda.">
                <input id="vendedor_id" value={venda.vendedor.nome} disabled />
              </Campo>
            </>
          ) : (
            <>
              <Campo rotulo="Cliente" nome="cliente_id" erro={erros.cliente_id} obrigatorio>
                <select id="cliente_id" value={clienteId} onChange={(e) => setClienteId(e.target.value)}>
                  <option value="">Escolha…</option>
                  {clientes.map((c) => (
                    <option key={c.cliente_id} value={c.cliente_id}>
                      {c.nome} ({formatarCpf(c.cpf)})
                    </option>
                  ))}
                </select>
              </Campo>
              <Campo rotulo="Vendedor" nome="vendedor_id" erro={erros.vendedor_id} obrigatorio>
                <select id="vendedor_id" value={vendedorId} onChange={(e) => setVendedorId(e.target.value)}>
                  <option value="">Escolha…</option>
                  {vendedores.map((v) => (
                    <option key={v.vendedor_id} value={v.vendedor_id}>
                      {v.nome}
                    </option>
                  ))}
                </select>
              </Campo>
            </>
          )}
          <Campo rotulo="Forma de pagamento" nome="forma_pagamento" erro={erros.forma_pagamento} obrigatorio>
            <select id="forma_pagamento" value={formaPagamento} onChange={(e) => setFormaPagamento(e.target.value as FormaPagamento)}>
              <option value="">Escolha…</option>
              {FORMAS_PAGAMENTO.map((forma) => (
                <option key={forma} value={forma}>
                  {rotulo(forma)}
                </option>
              ))}
            </select>
          </Campo>
          <div className="largura-cheia">
            <Campo rotulo="Observação" nome="observacao" erro={erros.observacao}>
              <textarea id="observacao" rows={2} value={observacao} onChange={(e) => setObservacao(e.target.value)} />
            </Campo>
          </div>
        </div>

        <h2 className="subtitulo">Itens</h2>
        {erros.itens && <Alerta tipo="erro">{erros.itens}</Alerta>}
        {venda && !itensEditaveis ? (
          <>
            <Alerta tipo="info">
              Itens só podem ser alterados enquanto a venda está ABERTA, e esta está {venda.status}. {MOTIVO_SOMENTE_LEITURA[venda.status]}
            </Alerta>
            <ItensSomenteLeitura venda={venda} />
          </>
        ) : (
          <>
            <div className="tabela-rolagem">
              <table className="tabela tabela-itens">
                <thead>
                  <tr>
                    <th>Produto</th>
                    <th style={{ width: '8rem' }}>Quantidade</th>
                    <th className="alinhar-direita">Preço unitário</th>
                    <th className="alinhar-direita">Subtotal</th>
                    <th aria-label="Remover" />
                  </tr>
                </thead>
                <tbody>
                  {itens.map((linha, indice) => (
                    <tr key={linha.chave}>
                      <td>
                        <select
                          aria-label={`Produto do item ${indice + 1}`}
                          value={linha.produto_id}
                          onChange={(e) => alterarItem(linha.chave, { produto_id: e.target.value })}
                          aria-invalid={erros[`itens.${indice}.produto_id`] ? true : undefined}
                        >
                          <option value="">Escolha o produto…</option>
                          {opcoes.map((p) => (
                            <option key={p.produto_id} value={p.produto_id}>
                              {p.codigo_sku} – {p.nome}
                            </option>
                          ))}
                        </select>
                        {erros[`itens.${indice}.produto_id`] && <span className="campo-erro">{erros[`itens.${indice}.produto_id`]}</span>}
                      </td>
                      <td>
                        <input
                          aria-label={`Quantidade do item ${indice + 1}`}
                          inputMode="numeric"
                          value={linha.quantidade}
                          onChange={(e) => alterarItem(linha.chave, { quantidade: e.target.value.replace(/\D/g, '') })}
                          aria-invalid={erros[`itens.${indice}.quantidade`] ? true : undefined}
                        />
                        {erros[`itens.${indice}.quantidade`] && <span className="campo-erro">{erros[`itens.${indice}.quantidade`]}</span>}
                      </td>
                      <td className="alinhar-direita">{linha.produto_id ? formatarMoeda(precoDe(linha)) : '—'}</td>
                      <td className="alinhar-direita">{linha.produto_id ? formatarMoeda(precoDe(linha) * (Number(linha.quantidade) || 0)) : '—'}</td>
                      <td className="alinhar-direita">
                        <button
                          type="button"
                          className="botao botao-pequeno"
                          disabled={itens.length === 1}
                          title={itens.length === 1 ? 'Uma venda precisa de pelo menos 1 item' : undefined}
                          onClick={() => setItens((linhas) => linhas.filter((l) => l.chave !== linha.chave))}
                        >
                          Remover
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={3}>
                      <button type="button" className="botao botao-pequeno" onClick={() => setItens((linhas) => [...linhas, novaLinha()])}>
                        + Adicionar item
                      </button>
                    </td>
                    <td className="alinhar-direita total">{formatarMoeda(previa)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
            <p className="texto-fraco">
              {venda
                ? 'Itens que já estavam na venda mantêm o preço da época; itens novos usam o preço atual do cadastro. O total oficial é calculado pelo banco ao salvar.'
                : 'Prévia com os preços atuais do cadastro. O total oficial é calculado pelo banco ao salvar.'}
            </p>
          </>
        )}

        {venda && (
          <p className="texto-fraco">
            Venda feita em {formatarDataHora(venda.data_venda)} · atualizada em {formatarDataHora(venda.atualizado_em)}
          </p>
        )}

        <div className="acoes-formulario">
          <Link className="botao" to="/vendas">
            Cancelar
          </Link>
          <button type="submit" className="botao botao-primario" disabled={salvando}>
            {salvando ? 'Salvando…' : venda ? 'Salvar' : 'Criar venda'}
          </button>
        </div>
      </form>

      {venda && (
        <>
          <h2 className="subtitulo">Entrega (recebida do Grupo 7)</h2>
          {venda.entregas.length === 0 ? (
            <div className="cartao texto-fraco">Nenhuma entrega integrada do Sistema de Entregas (Grupo 7) para esta venda.</div>
          ) : (
            venda.entregas.map((entrega) => <BlocoEntrega key={entrega.entrega_id} entrega={entrega} />)
          )}
        </>
      )}
    </section>
  )
}

function ItensSomenteLeitura({ venda }: { venda: VendaDetalhe }) {
  return (
    <div className="tabela-rolagem">
      <table className="tabela tabela-itens">
        <thead>
          <tr>
            <th>SKU</th>
            <th>Produto</th>
            <th>Quantidade</th>
            <th className="alinhar-direita">Preço unitário</th>
            <th className="alinhar-direita">Subtotal</th>
          </tr>
        </thead>
        <tbody>
          {venda.itens.map((item) => (
            <tr key={item.item_venda_id}>
              <td className="mono">{item.codigo_sku}</td>
              <td>{item.produto_nome}</td>
              <td>{item.quantidade}</td>
              <td className="alinhar-direita">{formatarMoeda(item.preco_unitario)}</td>
              <td className="alinhar-direita">{formatarMoeda(item.subtotal)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={4} className="alinhar-direita">
              <strong>Total</strong>
            </td>
            <td className="alinhar-direita total">{formatarMoeda(venda.valor_total)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
