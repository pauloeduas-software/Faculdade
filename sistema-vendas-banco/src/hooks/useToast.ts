import { createContext, useContext } from 'react'

export type TipoToast = 'sucesso' | 'erro' | 'info'

export interface ToastApi {
  mostrar: (tipo: TipoToast, mensagem: string) => void
  sucesso: (mensagem: string) => void
  erro: (mensagem: string) => void
}

export const ToastContexto = createContext<ToastApi | null>(null)

export function useToast(): ToastApi {
  const contexto = useContext(ToastContexto)
  if (!contexto) throw new Error('useToast precisa estar dentro de <ToastProvider>')
  return contexto
}
