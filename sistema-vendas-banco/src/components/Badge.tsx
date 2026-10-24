import type { ReactNode } from 'react'
import { rotulo } from '../utils/formato'

// Cor de cada status (vendas, entregas, execuções da integração)
const COR: Record<string, string> = {
  ABERTA: 'cinza',
  CONFIRMADA: 'azul',
  EM_ENTREGA: 'roxo',
  ENTREGUE: 'verde',
  CANCELADA: 'vermelho',
  EM_ANDAMENTO: 'azul',
  CONCLUIDA: 'verde',
  CONCLUIDA_COM_ERROS: 'amarelo',
  FALHOU: 'vermelho',
  AGUARDANDO_COLETA: 'cinza',
  EM_TRANSPORTE: 'roxo',
  DEVOLVIDA: 'amarelo',
  EXTRAVIADA: 'vermelho',
}

export function StatusBadge({ status }: { status: string }) {
  return <span className={`badge badge-${COR[status] ?? 'cinza'}`}>{rotulo(status)}</span>
}

export function AtivoBadge({ ativo }: { ativo: boolean }) {
  return <span className={`badge badge-${ativo ? 'verde' : 'cinza'}`}>{ativo ? 'Ativo' : 'Inativo'}</span>
}

export function Badge({ cor, children }: { cor: string; children: ReactNode }) {
  return <span className={`badge badge-${cor}`}>{children}</span>
}
