// Formatação pt-BR. Datas e horas sempre no fuso de São Paulo, qualquer que
// seja o fuso do computador que abre a tela.
const FUSO = 'America/Sao_Paulo'

const MOEDA = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const NUMERO = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 })
const DATA_HORA = new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, dateStyle: 'short', timeStyle: 'short' })
const DATA_HORA_SEGUNDOS = new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, dateStyle: 'short', timeStyle: 'medium' })
const DATA = new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, dateStyle: 'short' })

export function formatarMoeda(valor: number): string {
  return MOEDA.format(valor)
}

export function formatarPercentual(valor: number): string {
  return `${NUMERO.format(valor)}%`
}

export function formatarDataHora(valor: string | null | undefined, comSegundos = false): string {
  if (!valor) return '—'
  return (comSegundos ? DATA_HORA_SEGUNDOS : DATA_HORA).format(new Date(valor))
}

export function formatarData(valor: string | null | undefined): string {
  if (!valor) return '—'
  // Data sem hora (AAAA-MM-DD): new Date() a leria como meia-noite UTC, que em
  // São Paulo ainda é o dia anterior
  const soData = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor)
  if (soData) return `${soData[3]}/${soData[2]}/${soData[1]}`
  return DATA.format(new Date(valor))
}

export function formatarDuracao(ms: number | null | undefined): string {
  if (ms === null || ms === undefined) return '—'
  if (ms < 1000) return `${ms} ms`
  const segundos = ms / 1000
  if (segundos < 60) return `${NUMERO.format(Math.round(segundos * 10) / 10)} s`
  return `${Math.floor(segundos / 60)} min ${Math.round(segundos % 60)} s`
}

export function somenteDigitos(texto: string): string {
  return texto.replace(/\D/g, '')
}

// Dígitos verificadores do CPF (módulo 11), a mesma conta da API
// (server/http/validacao.ts). 11 dígitos iguais não são CPF válido.
export function cpfValido(cpf: string): boolean {
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false
  const digitos = [...cpf].map(Number)
  for (const n of [9, 10]) {
    const soma = digitos.slice(0, n).reduce((total, digito, i) => total + digito * (n + 1 - i), 0)
    if (((soma * 10) % 11) % 10 !== digitos[n]) return false
  }
  return true
}

// 12345678901 → 123.456.789-01; aplicada também enquanto o usuário digita
export function formatarCpf(texto: string): string {
  const d = somenteDigitos(texto).slice(0, 11)
  if (d.length <= 3) return d
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
}

const ROTULOS: Record<string, string> = {
  ABERTA: 'Aberta',
  CONFIRMADA: 'Confirmada',
  EM_ENTREGA: 'Em entrega',
  ENTREGUE: 'Entregue',
  CANCELADA: 'Cancelada',
  PIX: 'PIX',
  DINHEIRO: 'Dinheiro',
  CARTAO_CREDITO: 'Cartão de crédito',
  CARTAO_DEBITO: 'Cartão de débito',
  BOLETO: 'Boleto',
  EM_ANDAMENTO: 'Em andamento',
  CONCLUIDA: 'Concluída',
  CONCLUIDA_COM_ERROS: 'Concluída com erros',
  FALHOU: 'Falhou',
  AGUARDANDO_COLETA: 'Aguardando coleta',
  EM_TRANSPORTE: 'Em transporte',
  DEVOLVIDA: 'Devolvida',
  EXTRAVIADA: 'Extraviada',
}

export function rotulo(codigo: string): string {
  return ROTULOS[codigo] ?? codigo
}
