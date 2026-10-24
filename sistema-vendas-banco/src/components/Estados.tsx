import type { ReactNode } from 'react'
import { ErroApi, mensagemDeErro } from '../api/cliente'

export function Carregando({ texto = 'Carregando…' }: { texto?: string }) {
  return (
    <div className="estado" role="status">
      <span className="spinner" aria-hidden="true" />
      {texto}
    </div>
  )
}

export function Vazio({ texto }: { texto: string }) {
  return <div className="estado estado-vazio">{texto}</div>
}

export function ErroCarregamento({ erro, aoTentarDeNovo }: { erro: unknown; aoTentarDeNovo?: () => void }) {
  return (
    <div className="estado estado-erro" role="alert">
      <div>
        <strong>Não foi possível carregar.</strong> {mensagemDeErro(erro)}
        {erro instanceof ErroApi && erro.codigo !== 'SEM_CONEXAO' && <span className="texto-fraco"> ({erro.codigo})</span>}
      </div>
      {aoTentarDeNovo && (
        <button type="button" className="botao" onClick={aoTentarDeNovo}>
          Tentar de novo
        </button>
      )}
    </div>
  )
}

export function Alerta({ tipo, children }: { tipo: 'erro' | 'aviso' | 'info' | 'sucesso'; children: ReactNode }) {
  return (
    <div className={`alerta alerta-${tipo}`} role={tipo === 'erro' ? 'alert' : undefined}>
      {children}
    </div>
  )
}
