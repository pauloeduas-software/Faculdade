import { integracaoApi } from '../../api/recursos'
import { StatusBadge } from '../../components/Badge'
import { Carregando, ErroCarregamento } from '../../components/Estados'
import { useCarregar } from '../../hooks/useCarregar'
import { formatarDataHora, formatarMoeda } from '../../utils/formato'

// Colunas da view do Grupo 4, na ordem do contrato (o nome técnico fica no title)
const COLUNAS: [string, string][] = [
  // É o id do item no banco, não a posição na lista: itens de venda ABERTA não aparecem e deixam buracos
  ['codigo_item', 'Cód. item'],
  ['codigo_venda', 'Venda'],
  ['data_venda', 'Data da venda'],
  ['status_venda', 'Status'],
  ['codigo_sku', 'SKU'],
  ['nome_produto', 'Produto'],
  ['quantidade', 'Qtd.'],
  ['preco_unitario', 'Preço unit.'],
  ['data_atualizacao', 'Última alteração'],
]

function celula(coluna: string, valor: string | number | null) {
  if (valor === null) return <em className="texto-fraco">nulo</em>
  if (coluna === 'status_venda') return <StatusBadge status={String(valor)} />
  if (coluna.startsWith('data_')) return formatarDataHora(String(valor))
  if (coluna === 'preco_unitario') return formatarMoeda(Number(valor))
  if (coluna === 'codigo_sku') return <span className="mono">{valor}</span>
  return valor
}

// O lado produtor: não há o que executar, o Grupo 4 lê a view quando quiser.
// A tabela mostra TODAS as linhas da view, exatamente o que ele recebe.
export function EnviarGrupo4() {
  const view = useCarregar(() => integracaoApi.previewProdutor(), [])

  if (view.erro) return <ErroCarregamento erro={view.erro} aoTentarDeNovo={view.recarregar} />
  if (!view.dados) return <Carregando />

  return (
    <>
      <p className="resumo-execucao">
        Tudo o que o Grupo 4 (Estoque) lê do nosso banco: <strong>{view.dados.total} itens</strong> de vendas confirmadas, em entrega, entregues ou
        canceladas, na view <span className="mono">{view.dados.view}</span>. Ele só pode ler.
      </p>

      <div className="cartao sem-padding" data-testid="linhas-grupo4">
        <div className="tabela-rolagem">
          <table className="tabela tabela-compacta">
            <thead>
              <tr>
                {COLUNAS.map(([nome, titulo]) => (
                  <th key={nome} title={nome}>
                    {titulo}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {view.dados.linhas.length === 0 && (
                <tr>
                  <td colSpan={COLUNAS.length} className="texto-fraco">
                    Nenhum item ainda: só entram vendas que saíram de ABERTA.
                  </td>
                </tr>
              )}
              {view.dados.linhas.map((linha) => (
                <tr key={String(linha.codigo_item)}>
                  {COLUNAS.map(([nome]) => (
                    <td key={nome}>{celula(nome, linha[nome] ?? null)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
