import { useCallback, useEffect, useRef, useState } from 'react'

export interface Carregamento<T> {
  dados: T | null
  carregando: boolean
  erro: unknown
  recarregar: () => void
}

interface Resultado<T> {
  chave: string
  dados: T | null
  erro: unknown
}

// Carrega dados assíncronos e recarrega quando as dependências mudam.
// Enquanto a nova consulta não chega, os dados anteriores continuam na tela
// (carregando = true). Uma resposta atrasada de uma consulta antiga é
// descartada (ex.: digitar rápido na busca).
export function useCarregar<T>(buscar: () => Promise<T>, dependencias: readonly (string | number | boolean | undefined)[]): Carregamento<T> {
  const [versao, setVersao] = useState(0)
  const [resultado, setResultado] = useState<Resultado<T> | null>(null)
  const chave = JSON.stringify([...dependencias, versao])

  // Sempre a função da última renderização, sem refazer a consulta a cada render
  const buscarRef = useRef(buscar)
  useEffect(() => {
    buscarRef.current = buscar
  })

  useEffect(() => {
    let atual = true
    buscarRef.current().then(
      (dados) => atual && setResultado({ chave, dados, erro: null }),
      (erro: unknown) => atual && setResultado((anterior) => ({ chave, dados: anterior?.dados ?? null, erro })),
    )
    return () => {
      atual = false
    }
  }, [chave])

  const recarregar = useCallback(() => setVersao((v) => v + 1), [])

  return {
    dados: resultado?.dados ?? null,
    carregando: resultado?.chave !== chave,
    erro: resultado?.chave === chave ? resultado.erro : null,
    recarregar,
  }
}
