import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { ToastContexto, type ToastApi, type TipoToast } from '../hooks/useToast'

interface Toast {
  id: number
  tipo: TipoToast
  mensagem: string
}

let proximoId = 1

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const fechar = useCallback((id: number) => setToasts((lista) => lista.filter((t) => t.id !== id)), [])

  const mostrar = useCallback(
    (tipo: TipoToast, mensagem: string) => {
      const id = proximoId++
      setToasts((lista) => [...lista, { id, tipo, mensagem }])
      setTimeout(() => fechar(id), tipo === 'erro' ? 7000 : 4000)
    },
    [fechar],
  )

  const api = useMemo<ToastApi>(
    () => ({ mostrar, sucesso: (m) => mostrar('sucesso', m), erro: (m) => mostrar('erro', m) }),
    [mostrar],
  )

  return (
    <ToastContexto.Provider value={api}>
      {children}
      <div className="toasts" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast toast-${toast.tipo}`} role={toast.tipo === 'erro' ? 'alert' : 'status'}>
            <span>{toast.mensagem}</span>
            <button type="button" className="toast-fechar" aria-label="Fechar" onClick={() => fechar(toast.id)}>
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContexto.Provider>
  )
}
