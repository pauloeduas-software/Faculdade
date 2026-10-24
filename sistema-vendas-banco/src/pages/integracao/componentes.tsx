// Peças compartilhadas pela tela de integração e pelo detalhe da execução
import { useState } from 'react'
import { Badge } from '../../components/Badge'
import { useToast } from '../../hooks/useToast'
import type { TipoErro } from '../../types'
import { TIPO_ERRO } from './textos'

export interface Totais {
  total_consultado: number
  inseridos: number
  atualizados: number
  sem_alteracao: number
  rejeitados: number
}

// Os nomes do enunciado (consultados, inseridos...) com o significado embaixo
export function CartoesTotais({ totais }: { totais: Totais }) {
  return (
    <div className="grade-cartoes">
      <div className="numero destaque-azul">
        <span>Consultados</span>
        <strong>{totais.total_consultado}</strong>
        <small>lidos do Grupo 7</small>
      </div>
      <div className="numero destaque-verde">
        <span>Inseridos</span>
        <strong>{totais.inseridos}</strong>
        <small>novos no nosso banco</small>
      </div>
      <div className="numero destaque-verde">
        <span>Atualizados</span>
        <strong>{totais.atualizados}</strong>
        <small>já existiam e mudaram</small>
      </div>
      <div className="numero">
        <span>Sem alteração</span>
        <strong>{totais.sem_alteracao}</strong>
        <small>já existiam iguais</small>
      </div>
      <div className={`numero ${totais.rejeitados > 0 ? 'destaque-vermelho' : ''}`}>
        <span>Rejeitados</span>
        <strong>{totais.rejeitados}</strong>
        <small>com problema, não gravados</small>
      </div>
    </div>
  )
}

export function TipoErroBadge({ tipo }: { tipo: TipoErro }) {
  return (
    <span className="tipo-erro">
      <Badge cor={TIPO_ERRO[tipo].cor}>{TIPO_ERRO[tipo].rotulo}</Badge>
      <small className="mono">{tipo}</small>
    </span>
  )
}

// Relatório em texto (formato do enunciado), com botão de copiar
export function BlocoRelatorio({ texto }: { texto: string }) {
  const toast = useToast()
  const [copiado, setCopiado] = useState(false)

  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch {
      toast.erro('Não foi possível copiar: selecione o texto e use Ctrl+C.')
    }
  }

  return (
    <div className="relatorio">
      <button type="button" className="botao botao-pequeno botao-copiar" onClick={copiar}>
        {copiado ? 'Copiado ✔' : 'Copiar'}
      </button>
      <pre data-testid="relatorio-texto">{texto}</pre>
    </div>
  )
}
