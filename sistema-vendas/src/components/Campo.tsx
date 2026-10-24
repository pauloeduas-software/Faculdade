import type { ReactNode } from 'react'

interface CampoProps {
  rotulo: string
  nome: string
  erro?: string
  dica?: string
  obrigatorio?: boolean
  children: ReactNode
}

// Rótulo + controle + mensagem de erro embaixo do campo
export function Campo({ rotulo, nome, erro, dica, obrigatorio, children }: CampoProps) {
  return (
    <div className={`campo ${erro ? 'campo-com-erro' : ''}`}>
      <label htmlFor={nome}>
        {rotulo}
        {obrigatorio && <span className="obrigatorio"> *</span>}
      </label>
      {children}
      {erro ? (
        <span className="campo-erro" id={`${nome}-erro`} role="alert">
          {erro}
        </span>
      ) : (
        dica && <span className="campo-dica">{dica}</span>
      )}
    </div>
  )
}
