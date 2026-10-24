import { useCallback, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

// Filtros e página guardados na query string: dá para recarregar a página,
// voltar no navegador ou compartilhar o link sem perder a busca.
// Valores iguais ao padrão não aparecem na URL; mudar qualquer filtro volta
// para a página 1.
export function useFiltrosUrl<T extends Record<string, string>>(padroes: T): [T, (mudancas: Partial<T>) => void] {
  const [params, setParams] = useSearchParams()
  // Os padrões da primeira renderização (o objeto literal é recriado a cada render)
  const [padroesFixos] = useState(padroes)

  const valores = useMemo(() => {
    const atuais = { ...padroesFixos }
    for (const chave of Object.keys(padroesFixos) as (keyof T)[]) {
      const valor = params.get(chave as string)
      if (valor !== null) atuais[chave] = valor as T[keyof T]
    }
    return atuais
  }, [params, padroesFixos])

  const alterar = useCallback(
    (mudancas: Partial<T>) => {
      setParams(
        (anteriores) => {
          const novos = new URLSearchParams(anteriores)
          for (const [chave, valor] of Object.entries(mudancas)) {
            if (valor === undefined || valor === '' || valor === padroesFixos[chave]) novos.delete(chave)
            else novos.set(chave, valor)
          }
          if (!('page' in mudancas)) novos.delete('page')
          return novos
        },
        { replace: true },
      )
    },
    [setParams, padroesFixos],
  )

  return [valores, alterar]
}
