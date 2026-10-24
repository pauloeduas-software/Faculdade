// =============================================================================
// Etapa 4 – TRANSFORMAÇÃO: funções puras (sem banco, sem efeitos) que levam o
// modelo DELES (view do Grupo 7) para o NOSSO (vendas.entrega).
//
//   tipos  → conversores de texto para inteiro, data e instante. A validação
//            (Etapa 3) usa os mesmos conversores: o que não converte é TIPO_INVALIDO
//   nomes  → id_entrega → id_entrega_origem, num_venda → venda_id, ... (contrato §5.1)
//   status → de-para EM_TRANSITO → EM_TRANSPORTE, ... (contrato §5.2)
// =============================================================================
import { DE_PARA_STATUS, type SituacaoGrupo7, type StatusEntrega } from './config.js'

export type Conversao<T> = { ok: true; valor: T } | { ok: false; motivo: string }

// Instante (timestamptz) como texto ISO 8601 com fuso, na precisão do PostgreSQL
// (microssegundos). Um Date do JavaScript só guarda milissegundos: a
// ultima_alteracao 20:26:37.912345 viraria .912 e nunca mais seria "igual" à
// gravada em origem_atualizado_em. O "ms" serve só para comparar datas na validação.
export interface Instante {
  iso: string
  ms: number
}

// O registro do Grupo 7 já com os tipos certos (nomes DELES)
export interface RegistroGrupo7 {
  id_entrega: number
  num_venda: number
  cod_rastreio: string
  situacao: SituacaoGrupo7
  dt_prevista: string | null // AAAA-MM-DD
  dt_saida: Instante | null
  dt_entrega: Instante | null
  nome_entregador: string | null
  cidade_destino: string | null
  uf_destino: string | null
  ultima_alteracao: Instante
}

// A entrega no NOSSO modelo: exatamente as colunas de vendas.entrega
export interface EntregaNossa {
  id_entrega_origem: number
  venda_id: number
  codigo_rastreio: string
  status_entrega: StatusEntrega
  data_prevista: string | null
  data_saida: string | null
  data_entrega: string | null
  entregador: string | null
  cidade: string | null
  uf: string | null
  origem_atualizado_em: string
}

// -----------------------------------------------------------------------------
// Conversores de tipo (texto → nosso tipo)
// -----------------------------------------------------------------------------

const INTEGER_MIN = -2_147_483_648
const INTEGER_MAX = 2_147_483_647

export function paraInteiro(texto: string): Conversao<number> {
  const limpo = texto.trim()
  if (!/^[+-]?\d+$/.test(limpo)) return { ok: false, motivo: 'não é um número inteiro' }
  const valor = Number(limpo)
  if (valor < INTEGER_MIN || valor > INTEGER_MAX) return { ok: false, motivo: 'fora do intervalo do tipo integer' }
  return { ok: true, valor }
}

function dataExiste(ano: number, mes: number, dia: number): boolean {
  const data = new Date(Date.UTC(ano, mes - 1, dia))
  return data.getUTCFullYear() === ano && data.getUTCMonth() === mes - 1 && data.getUTCDate() === dia
}

export function paraData(texto: string): Conversao<string> {
  const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(texto.trim())
  if (!partes) return { ok: false, motivo: 'não está no formato de data AAAA-MM-DD' }
  if (!dataExiste(Number(partes[1]), Number(partes[2]), Number(partes[3]))) {
    return { ok: false, motivo: 'data inexistente' }
  }
  return { ok: true, valor: partes[0] }
}

// Formato do PostgreSQL (DateStyle ISO): 2026-10-17 10:20:00-03 ou
// 2026-10-22 17:26:37.912345-03. Sem fuso o instante seria ambíguo: inválido.
const INSTANTE = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,6}))?)?(Z|[+-]\d{2}(?::?\d{2})?)$/

export function paraInstante(texto: string): Conversao<Instante> {
  const p = INSTANTE.exec(texto.trim())
  if (!p) return { ok: false, motivo: 'não é data e hora com fuso horário' }

  const [, ano, mes, dia, hora, minuto, segundo = '00', fracao = '', fuso] = p
  if (!dataExiste(Number(ano), Number(mes), Number(dia)) || Number(hora) > 23 || Number(minuto) > 59 || Number(segundo) > 59) {
    return { ok: false, motivo: 'data ou hora inexistente' }
  }

  // Fuso normalizado para ±HH:MM (o PostgreSQL manda só -03 quando os minutos são zero)
  const fusoIso = fuso === 'Z' ? 'Z' : `${fuso.slice(0, 3)}:${fuso.replace(':', '').slice(3) || '00'}`
  const base = `${ano}-${mes}-${dia}T${hora}:${minuto}:${segundo}`
  return {
    ok: true,
    valor: {
      iso: `${base}.${fracao.padEnd(6, '0')}${fusoIso}`,
      ms: Date.parse(`${base}.${fracao.padEnd(3, '0').slice(0, 3)}${fusoIso}`),
    },
  }
}

// Contrato §5.2. Fora do vocabulário → null (a validação rejeita com VALOR_INVALIDO)
export function deParaStatus(situacao: string): StatusEntrega | null {
  return Object.hasOwn(DE_PARA_STATUS, situacao) ? DE_PARA_STATUS[situacao as SituacaoGrupo7] : null
}

// Texto opcional: sem espaços nas pontas; vazio vira nulo
function textoOpcional(texto: string | null): string | null {
  const limpo = texto?.trim()
  return limpo ? limpo : null
}

// -----------------------------------------------------------------------------
// Modelo DELES → modelo NOSSO (contrato §5.1)
// -----------------------------------------------------------------------------
export function transformar(r: RegistroGrupo7): EntregaNossa {
  return {
    id_entrega_origem: r.id_entrega,
    venda_id: r.num_venda,
    codigo_rastreio: r.cod_rastreio.trim(),
    status_entrega: DE_PARA_STATUS[r.situacao],
    data_prevista: r.dt_prevista,
    data_saida: r.dt_saida?.iso ?? null,
    data_entrega: r.dt_entrega?.iso ?? null,
    entregador: textoOpcional(r.nome_entregador),
    cidade: textoOpcional(r.cidade_destino),
    uf: textoOpcional(r.uf_destino)?.toUpperCase() ?? null,
    origem_atualizado_em: r.ultima_alteracao.iso,
  }
}

// Data e hora para as mensagens de erro, no fuso do Brasil
const FORMATO_DATA_HORA = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  dateStyle: 'short',
  timeStyle: 'short',
})

export function formatarDataHora(data: Date | number): string {
  return FORMATO_DATA_HORA.format(data)
}
