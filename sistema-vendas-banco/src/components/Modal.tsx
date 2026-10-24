import { useEffect, useRef, type ReactNode } from 'react'

interface ModalProps {
  aberto: boolean
  titulo: string
  aoFechar: () => void
  children: ReactNode
  rodape?: ReactNode
}

const SELETOR_FOCAVEL =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

// Enquanto está aberto, o modal fica com o foco: recebe o foco ao abrir, o Tab e
// o Shift+Tab circulam só dentro dele, Esc fecha e, ao fechar, o foco volta para
// quem o abriu (ex.: o botão "Excluir" da linha).
export function Modal({ aberto, titulo, aoFechar, children, rodape }: ModalProps) {
  const caixa = useRef<HTMLDivElement>(null)
  // aoFechar muda a cada renderização; com a ref o efeito não roda de novo (e
  // não perde quem tinha o foco antes de o modal abrir)
  const aoFecharRef = useRef(aoFechar)
  useEffect(() => {
    aoFecharRef.current = aoFechar
  })

  useEffect(() => {
    if (!aberto) return
    const origem = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const focaveis = () => [...(caixa.current?.querySelectorAll<HTMLElement>(SELETOR_FOCAVEL) ?? [])]
    ;(focaveis()[0] ?? caixa.current)?.focus()

    const aoTeclar = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') {
        aoFecharRef.current()
        return
      }
      if (evento.key !== 'Tab') return
      const lista = focaveis()
      if (lista.length === 0) {
        evento.preventDefault()
        return
      }
      const ativo = document.activeElement
      const dentro = caixa.current?.contains(ativo) ?? false
      if (evento.shiftKey && (!dentro || ativo === lista[0])) {
        evento.preventDefault()
        lista[lista.length - 1].focus()
      } else if (!evento.shiftKey && (!dentro || ativo === lista[lista.length - 1])) {
        evento.preventDefault()
        lista[0].focus()
      }
    }
    window.addEventListener('keydown', aoTeclar)
    return () => {
      window.removeEventListener('keydown', aoTeclar)
      if (origem?.isConnected) origem.focus()
    }
  }, [aberto])

  if (!aberto) return null

  return (
    <div className="modal-fundo" onMouseDown={aoFechar}>
      <div ref={caixa} tabIndex={-1} className="modal" role="dialog" aria-modal="true" aria-label={titulo} onMouseDown={(e) => e.stopPropagation()}>
        <h2 className="modal-titulo">{titulo}</h2>
        <div className="modal-corpo">{children}</div>
        {rodape && <div className="modal-rodape">{rodape}</div>}
      </div>
    </div>
  )
}

interface ModalConfirmacaoProps {
  aberto: boolean
  titulo: string
  children: ReactNode
  textoConfirmar: string
  // Texto do botão que fecha sem fazer nada ("Voltar" quando a ação já se chama "Cancelar venda")
  textoCancelar?: string
  perigo?: boolean
  ocupado?: boolean
  aoConfirmar: () => void
  aoCancelar: () => void
  // Ações extras ao lado do botão principal (ex.: "Desativar" quando a exclusão é barrada)
  acoesExtras?: ReactNode
  ocultarConfirmar?: boolean
}

// Substitui o window.confirm: o usuário vê o que vai acontecer antes de confirmar
export function ModalConfirmacao({
  aberto,
  titulo,
  children,
  textoConfirmar,
  textoCancelar = 'Cancelar',
  perigo,
  ocupado,
  aoConfirmar,
  aoCancelar,
  acoesExtras,
  ocultarConfirmar,
}: ModalConfirmacaoProps) {
  return (
    <Modal
      aberto={aberto}
      titulo={titulo}
      aoFechar={ocupado ? () => {} : aoCancelar}
      rodape={
        <>
          <button type="button" className="botao" onClick={aoCancelar} disabled={ocupado}>
            {ocultarConfirmar ? 'Fechar' : textoCancelar}
          </button>
          {acoesExtras}
          {!ocultarConfirmar && (
            <button type="button" className={`botao ${perigo ? 'botao-perigo' : 'botao-primario'}`} onClick={aoConfirmar} disabled={ocupado}>
              {ocupado ? 'Aguarde…' : textoConfirmar}
            </button>
          )}
        </>
      }
    >
      {children}
    </Modal>
  )
}
