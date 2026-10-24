import { useEffect, useRef, useState } from 'react'

interface CampoBuscaProps {
  valor: string
  aoMudar: (valor: string) => void
  placeholder: string
  atraso?: number
}

// Debounce: o usuário digita à vontade e a busca só é disparada "atraso" ms
// depois da última tecla, em vez de uma consulta à API por letra
export function CampoBusca({ valor, aoMudar, placeholder, atraso = 400 }: CampoBuscaProps) {
  const [texto, setTexto] = useState(valor)
  const [valorAnterior, setValorAnterior] = useState(valor)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  // O valor mudou por fora (ex.: voltar no navegador): mostra o novo
  if (valor !== valorAnterior) {
    setValorAnterior(valor)
    setTexto(valor)
  }

  useEffect(() => () => clearTimeout(timer.current), [])

  function digitar(novo: string) {
    setTexto(novo)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => aoMudar(novo.trim()), atraso)
  }

  return (
    <input
      type="search"
      className="campo-busca"
      placeholder={placeholder}
      aria-label={placeholder}
      value={texto}
      onChange={(evento) => digitar(evento.target.value)}
    />
  )
}
