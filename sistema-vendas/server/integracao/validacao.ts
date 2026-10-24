// =============================================================================
// Etapa 3 – VALIDAÇÃO: decide, registro a registro, o que pode ser integrado.
//
// Cada registro é conferido por inteiro e TODOS os seus problemas são juntados
// (um registro pode gerar várias linhas em erro_integracao), em três níveis:
//   1. o registro sozinho → CAMPO_OBRIGATORIO, TIPO_INVALIDO, VALOR_INVALIDO e
//                           as regras de datas da própria entrega
//   2. o lote             → REGISTRO_DUPLICADO
//   3. o nosso banco      → REGISTRO_INEXISTENTE e REGRA_NEGOCIO (status e
//                           data da venda)
// Em valor_recebido vai o valor original, como veio da view.
// =============================================================================
import { pool, type Db } from '../db/pool.js'
import type { StatusVenda } from '../modules/vendas/vendas.schema.js'
import {
  COLUNAS_VIEW,
  DE_PARA_STATUS,
  EFEITO_NA_VENDA,
  TOLERANCIA_FUTURO_MS,
  UFS,
  type LinhaView,
  type NomeColuna,
  type SituacaoGrupo7,
  type StatusEntrega,
  type TipoErro,
} from './config.js'
import type { ErroRegistro } from './log.js'
import {
  deParaStatus,
  formatarDataHora,
  paraData,
  paraInstante,
  paraInteiro,
  type Conversao,
  type Instante,
  type RegistroGrupo7,
} from './transformacao.js'

export interface RegistroValido {
  linha: number // posição na consulta (1 = primeira)
  registro: RegistroGrupo7
}

export interface RegistroRejeitado {
  linha: number
  registro_origem: string | null
  erros: ErroRegistro[]
}

export interface ResultadoValidacao {
  validos: RegistroValido[]
  rejeitados: RegistroRejeitado[]
}

// Situação de um registro durante a validação: os valores que converteram
// (null = ausente ou inválido) e os erros encontrados até agora
interface Analise {
  linha: number
  bruto: LinhaView
  registro_origem: string | null
  erros: ErroRegistro[]
  id_entrega: number | null
  num_venda: number | null
  situacao: SituacaoGrupo7 | null
  dt_prevista: string | null
  dt_saida: Instante | null
  dt_entrega: Instante | null
  ultima_alteracao: Instante | null
}

interface VendaAtual {
  venda_id: number
  status: StatusVenda
  data_venda: Date
}

function vazio(valor: string | null): boolean {
  return valor === null || valor.trim() === ''
}

const VOCABULARIO = Object.keys(DE_PARA_STATUS).join(', ')

// -----------------------------------------------------------------------------
// Contrato §6: o que uma entrega faz com a venda. Usado aqui e de novo no
// processamento, com a venda travada (o status pode ter mudado no meio tempo).
// -----------------------------------------------------------------------------
export type EfeitoNaVenda =
  | { ok: true; transicoes: readonly StatusVenda[] }
  | { ok: false; campo: NomeColuna; descricao: string }

export function avaliarEfeitoNaVenda(
  vendaId: number,
  statusVenda: StatusVenda,
  statusEntrega: StatusEntrega,
  situacao: string,
): EfeitoNaVenda {
  const transicoes = EFEITO_NA_VENDA[statusEntrega][statusVenda]
  if (transicoes) return { ok: true, transicoes }

  if (statusVenda === 'ABERTA') {
    return { ok: false, campo: 'num_venda', descricao: `A venda ${vendaId} está ABERTA: ainda pode mudar e não pode ter entrega (contrato §6).` }
  }
  if (statusVenda === 'CANCELADA') {
    return { ok: false, campo: 'num_venda', descricao: `A venda ${vendaId} está CANCELADA: só aceita entrega CANCELADA (contrato §6).` }
  }
  return {
    ok: false,
    campo: 'situacao',
    descricao:
      `Conflito de status: a entrega ${situacao} (${statusEntrega} no Sistema de Vendas) indica um estado anterior ` +
      `ao da venda ${vendaId}, que já está ${statusVenda}; a venda não regride (contrato §6).`,
  }
}

// -----------------------------------------------------------------------------
// 1. O registro sozinho
// -----------------------------------------------------------------------------
function analisarLinha(bruto: LinhaView, linha: number, agora: number): Analise {
  const registroOrigem = vazio(bruto.id_entrega) ? null : bruto.id_entrega!.trim()
  const erros: ErroRegistro[] = []

  const erro = (campo: NomeColuna, tipo_erro: TipoErro, descricao: string) => {
    erros.push({ registro_origem: registroOrigem, campo, tipo_erro, descricao, valor_recebido: bruto[campo] })
  }

  // CAMPO_OBRIGATORIO: colunas obrigatórias do contrato (§3), nulas ou em branco
  for (const coluna of COLUNAS_VIEW) {
    if (coluna.obrigatorio && vazio(bruto[coluna.nome])) {
      const como = bruto[coluna.nome] === null ? 'nulo' : 'em branco'
      erro(coluna.nome, 'CAMPO_OBRIGATORIO', `${coluna.nome} é obrigatório e veio ${como}.`)
    }
  }

  // TIPO_INVALIDO: o valor está lá, mas não converte para o tipo do contrato
  function converter<T>(campo: NomeColuna, conversor: (texto: string) => Conversao<T>, tipo: string): T | null {
    const valor = bruto[campo]
    if (vazio(valor)) return null
    const resultado = conversor(valor!)
    if (resultado.ok) return resultado.valor
    erro(campo, 'TIPO_INVALIDO', `${campo} deveria ser ${tipo}: "${valor}" ${resultado.motivo}.`)
    return null
  }

  const id_entrega = converter('id_entrega', paraInteiro, 'integer')
  let num_venda = converter('num_venda', paraInteiro, 'integer')
  const dt_prevista = converter('dt_prevista', paraData, 'date')
  const dt_saida = converter('dt_saida', paraInstante, 'timestamptz')
  const dt_entrega = converter('dt_entrega', paraInstante, 'timestamptz')
  const ultima_alteracao = converter('ultima_alteracao', paraInstante, 'timestamptz')

  // VALOR_INVALIDO: tipo certo, valor fora do que o contrato permite
  if (num_venda !== null && num_venda <= 0) {
    erro('num_venda', 'VALOR_INVALIDO', `num_venda deve ser um número de venda positivo; veio ${num_venda}.`)
    num_venda = null // não adianta procurar a venda no nosso banco
  }

  let situacao: SituacaoGrupo7 | null = null
  if (!vazio(bruto.situacao)) {
    const valor = bruto.situacao!.trim()
    if (deParaStatus(valor)) {
      situacao = valor as SituacaoGrupo7
    } else {
      erro('situacao', 'VALOR_INVALIDO', `situacao "${valor}" fora do vocabulário do contrato (${VOCABULARIO}).`)
    }
  }

  if (!vazio(bruto.uf_destino)) {
    const uf = bruto.uf_destino!.trim().toUpperCase()
    if (!(UFS as readonly string[]).includes(uf)) {
      erro('uf_destino', 'VALOR_INVALIDO', `UF "${bruto.uf_destino}" inválida.`)
    }
  }

  for (const coluna of COLUNAS_VIEW) {
    if ('tamanho' in coluna && coluna.nome !== 'uf_destino' && coluna.nome !== 'situacao') {
      const valor = bruto[coluna.nome]?.trim()
      if (valor && valor.length > coluna.tamanho) {
        erro(coluna.nome, 'VALOR_INVALIDO', `${coluna.nome} tem ${valor.length} caracteres; o máximo do contrato é ${coluna.tamanho}.`)
      }
    }
  }

  // REGRA_NEGOCIO da própria entrega (datas exigidas pela situação e ordem das datas)
  if (situacao && situacao !== 'AGUARDANDO_COLETA' && situacao !== 'CANCELADA' && vazio(bruto.dt_saida)) {
    erro('dt_saida', 'REGRA_NEGOCIO', `Entrega ${situacao} sem dt_saida: só AGUARDANDO_COLETA e CANCELADA podem não ter saído (contrato §3).`)
  }
  if (situacao === 'ENTREGUE' && vazio(bruto.dt_entrega)) {
    erro('dt_entrega', 'REGRA_NEGOCIO', 'Entrega ENTREGUE sem dt_entrega (contrato §3).')
  }
  for (const [campo, data] of [['dt_saida', dt_saida], ['dt_entrega', dt_entrega]] as const) {
    if (data && data.ms > agora + TOLERANCIA_FUTURO_MS) {
      erro(campo, 'REGRA_NEGOCIO', `${campo} (${formatarDataHora(data.ms)}) está no futuro: mais de 5 minutos depois de agora (${formatarDataHora(agora)}).`)
    }
  }
  if (dt_saida && dt_entrega && dt_entrega.ms < dt_saida.ms) {
    erro(
      'dt_entrega',
      'REGRA_NEGOCIO',
      `dt_entrega (${formatarDataHora(dt_entrega.ms)}) é anterior à dt_saida (${formatarDataHora(dt_saida.ms)}).`,
    )
  }

  return {
    linha,
    bruto,
    registro_origem: registroOrigem,
    erros,
    id_entrega,
    num_venda,
    situacao,
    dt_prevista,
    dt_saida,
    dt_entrega,
    ultima_alteracao,
  }
}

// -----------------------------------------------------------------------------
// 2. O lote: o mesmo id_entrega mais de uma vez na mesma leitura.
//    Cópias idênticas → a 1ª segue, as demais são rejeitadas.
//    Cópias diferentes → todas rejeitadas (não dá para saber qual é a certa).
// -----------------------------------------------------------------------------
function marcarDuplicados(analises: Analise[]): void {
  const grupos = new Map<string, Analise[]>()
  for (const analise of analises) {
    if (analise.registro_origem === null) continue
    const grupo = grupos.get(analise.registro_origem) ?? []
    grupo.push(analise)
    grupos.set(analise.registro_origem, grupo)
  }

  for (const [id, grupo] of grupos) {
    if (grupo.length < 2) continue

    const linhas = grupo.map((a) => a.linha).join(', ')
    const assinatura = (a: Analise) => JSON.stringify(COLUNAS_VIEW.map((c) => a.bruto[c.nome]))
    const identicas = grupo.every((a) => assinatura(a) === assinatura(grupo[0]))

    const rejeitar = identicas ? grupo.slice(1) : grupo
    const descricao = identicas
      ? `id_entrega ${id} veio ${grupo.length} vezes na mesma leitura (linhas ${linhas}) com dados idênticos: só a primeira cópia (linha ${grupo[0].linha}) é processada.`
      : `id_entrega ${id} veio ${grupo.length} vezes na mesma leitura (linhas ${linhas}) com dados diferentes: nenhuma cópia é processada, não dá para saber qual é a certa.`

    for (const analise of rejeitar) {
      analise.erros.push({
        registro_origem: id,
        campo: 'id_entrega',
        tipo_erro: 'REGISTRO_DUPLICADO',
        descricao,
        valor_recebido: analise.bruto.id_entrega,
      })
    }
  }
}

// -----------------------------------------------------------------------------
// 3. O nosso banco: uma única consulta traz todas as vendas citadas no lote
// -----------------------------------------------------------------------------
async function carregarVendas(ids: number[], db: Db): Promise<Map<number, VendaAtual>> {
  if (ids.length === 0) return new Map()
  const resultado = await db.query<VendaAtual>(
    'SELECT venda_id, status, data_venda FROM vendas.venda WHERE venda_id = ANY($1::int[])',
    [ids],
  )
  return new Map(resultado.rows.map((venda) => [venda.venda_id, venda]))
}

function conferirVenda(analise: Analise, vendas: Map<number, VendaAtual>): void {
  if (analise.num_venda === null) return
  const erro = (campo: NomeColuna, tipo_erro: TipoErro, descricao: string) => {
    analise.erros.push({
      registro_origem: analise.registro_origem,
      campo,
      tipo_erro,
      descricao,
      valor_recebido: analise.bruto[campo],
    })
  }

  const venda = vendas.get(analise.num_venda)
  if (!venda) {
    erro('num_venda', 'REGISTRO_INEXISTENTE', `A venda ${analise.num_venda} não existe no Sistema de Vendas.`)
    return
  }

  if (analise.dt_entrega && analise.dt_entrega.ms < venda.data_venda.getTime()) {
    erro(
      'dt_entrega',
      'REGRA_NEGOCIO',
      `dt_entrega (${formatarDataHora(analise.dt_entrega.ms)}) é anterior à data da venda ${venda.venda_id} ` +
        `(${formatarDataHora(venda.data_venda)}).`,
    )
  }

  if (analise.situacao) {
    const efeito = avaliarEfeitoNaVenda(venda.venda_id, venda.status, DE_PARA_STATUS[analise.situacao], analise.situacao)
    if (!efeito.ok) erro(efeito.campo, 'REGRA_NEGOCIO', efeito.descricao)
  }
}

export async function validar(linhas: LinhaView[], db: Db = pool): Promise<ResultadoValidacao> {
  const agora = Date.now()
  const analises = linhas.map((linha, indice) => analisarLinha(linha, indice + 1, agora))

  marcarDuplicados(analises)

  const idsVenda = [...new Set(analises.map((a) => a.num_venda).filter((id) => id !== null))]
  const vendas = await carregarVendas(idsVenda, db)
  for (const analise of analises) conferirVenda(analise, vendas)

  const resultado: ResultadoValidacao = { validos: [], rejeitados: [] }
  for (const a of analises) {
    if (a.erros.length > 0) {
      resultado.rejeitados.push({ linha: a.linha, registro_origem: a.registro_origem, erros: a.erros })
      continue
    }
    // Sem erros, todos os obrigatórios estão presentes e convertidos
    resultado.validos.push({
      linha: a.linha,
      registro: {
        id_entrega: a.id_entrega!,
        num_venda: a.num_venda!,
        cod_rastreio: a.bruto.cod_rastreio!,
        situacao: a.situacao!,
        dt_prevista: a.dt_prevista,
        dt_saida: a.dt_saida,
        dt_entrega: a.dt_entrega,
        nome_entregador: a.bruto.nome_entregador,
        cidade_destino: a.bruto.cidade_destino,
        uf_destino: a.bruto.uf_destino,
        ultima_alteracao: a.ultima_alteracao!,
      },
    })
  }
  return resultado
}
