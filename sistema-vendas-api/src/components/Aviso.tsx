import type { Resultado } from '../api'

export function Aviso({ r }: { r: Resultado<unknown> | null }) {
  if (!r || r.ok) return null
  const det = Array.isArray(r.erro?.detalhes) ? r.erro.detalhes : []
  return (
    <div className="aviso" role="alert">
      <strong>{r.status || 'Erro'} · {r.erro?.codigo}</strong>
      <div>{r.erro?.mensagem}</div>
      {det.length > 0 && (
        <ul>{det.map((d, i) => <li key={i}>{typeof d === 'string' ? d : `${d.campo}: ${d.problema}`}</li>)}</ul>
      )}
    </div>
  )
}
