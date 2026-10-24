import type { ReactNode } from 'react'
import { Carregando, ErroCarregamento, Vazio } from './Estados'

export interface Coluna<T> {
  titulo: string
  celula: (linha: T) => ReactNode
  alinhamento?: 'direita' | 'centro'
  largura?: string
  // Some abaixo de 1200 px de largura (ex.: projetor 1024×768)
  secundaria?: boolean
  // Fica presa à direita quando a tabela rola (coluna de ações)
  fixaDireita?: boolean
}

function classesDaColuna<T>(coluna: Coluna<T>): string | undefined {
  const classes = [
    coluna.alinhamento && `alinhar-${coluna.alinhamento}`,
    coluna.secundaria && 'col-secundaria',
    coluna.fixaDireita && 'col-fixa-direita',
  ].filter(Boolean)
  return classes.length > 0 ? classes.join(' ') : undefined
}

interface TabelaPaginadaProps<T> {
  colunas: Coluna<T>[]
  linhas: T[] | null
  chave: (linha: T) => string | number
  carregando: boolean
  erro?: unknown
  aoTentarDeNovo?: () => void
  textoVazio?: string
  aoClicarLinha?: (linha: T) => void
  pagina?: number
  limite?: number
  total?: number
  aoMudarPagina?: (pagina: number) => void
}

export function TabelaPaginada<T>({
  colunas,
  linhas,
  chave,
  carregando,
  erro,
  aoTentarDeNovo,
  textoVazio = 'Nenhum registro encontrado.',
  aoClicarLinha,
  pagina,
  limite,
  total,
  aoMudarPagina,
}: TabelaPaginadaProps<T>) {
  if (erro) return <ErroCarregamento erro={erro} aoTentarDeNovo={aoTentarDeNovo} />
  if (!linhas) return <Carregando />

  return (
    <div className={`tabela-container ${carregando ? 'atualizando' : ''}`}>
      {linhas.length === 0 ? (
        <Vazio texto={textoVazio} />
      ) : (
        <div className="tabela-rolagem">
          <table className="tabela">
            <thead>
              <tr>
                {colunas.map((coluna) => (
                  <th key={coluna.titulo} className={classesDaColuna(coluna)} style={{ width: coluna.largura }}>
                    {coluna.titulo}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {linhas.map((linha) => (
                <tr
                  key={chave(linha)}
                  className={aoClicarLinha ? 'clicavel' : undefined}
                  onClick={aoClicarLinha ? () => aoClicarLinha(linha) : undefined}
                >
                  {colunas.map((coluna) => (
                    <td key={coluna.titulo} className={classesDaColuna(coluna)}>
                      {coluna.celula(linha)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {pagina !== undefined && limite !== undefined && total !== undefined && aoMudarPagina && (
        <Paginacao pagina={pagina} limite={limite} total={total} aoMudar={aoMudarPagina} />
      )}
    </div>
  )
}

export function Paginacao({ pagina, limite, total, aoMudar }: { pagina: number; limite: number; total: number; aoMudar: (p: number) => void }) {
  const paginas = Math.max(1, Math.ceil(total / limite))
  const inicio = total === 0 ? 0 : (pagina - 1) * limite + 1
  const fim = Math.min(total, pagina * limite)
  return (
    <div className="paginacao">
      <span className="texto-fraco">
        {inicio}–{fim} de {total}
      </span>
      <div className="paginacao-botoes">
        <button type="button" className="botao botao-pequeno" disabled={pagina <= 1} onClick={() => aoMudar(pagina - 1)}>
          ‹ Anterior
        </button>
        <span>
          Página {pagina} de {paginas}
        </span>
        <button type="button" className="botao botao-pequeno" disabled={pagina >= paginas} onClick={() => aoMudar(pagina + 1)}>
          Próxima ›
        </button>
      </div>
    </div>
  )
}
