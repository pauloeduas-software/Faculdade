// =============================================================================
// Processo consumidor: Grupo 7 (Entregas) → Grupo 2 (Vendas)
// Orquestra as 7 etapas, cada uma no seu arquivo:
//
//   1 conexao.ts       conecta no banco do Grupo 7 (até 3 tentativas)
//     estrutura.ts     confere a view com o contrato ANTES de consultar
//   2 consulta.ts      SELECT na view, com colunas explícitas
//   3 validacao.ts     valida cada registro e junta todos os erros dele
//   4 transformacao.ts modelo DELES → modelo NOSSO
//   5 processamento.ts grava cada registro na sua própria transação
//   6 log.ts           integracao.integracao e erro_integracao
//   7 relatorio.ts     relatório em JSON e em texto
//
// Uma execução por vez: pg_try_advisory_lock no NOSSO banco. A trava pertence
// à conexão que a pegou; se o processo morrer, a conexão fecha e o PostgreSQL
// solta a trava sozinho.
// =============================================================================
import type { PoolClient } from 'pg'
import { pool } from '../db/pool.js'
import { AppError } from '../http/errors.js'
import { CHAVE_TRAVA, SISTEMA_DESTINO, SISTEMA_ORIGEM, VIEW, quedaSimuladaApos, type LinhaView } from './config.js'
import { ErroFatal, MAX_TENTATIVAS, conectarGrupo7 } from './conexao.js'
import { consultarView } from './consulta.js'
import { verificarEstrutura, type ResultadoEstrutura } from './estrutura.js'
import {
  MENSAGEM_INTERROMPIDA,
  atualizarTotais,
  buscarExecucao,
  execucaoEmAndamento,
  finalizarExecucao,
  iniciarExecucao,
  listarErros,
  registrarErros,
  type StatusExecucao,
  type Totais,
} from './log.js'
import { QuedaSimulada, processar, type ItemProcessamento, type ResultadoProcessamento, type VendaAlterada } from './processamento.js'
import { montarRelatorio, relatorioEmTexto, type Relatorio } from './relatorio.js'
import { transformar } from './transformacao.js'
import { validar } from './validacao.js'

export interface ResultadoIntegracao {
  relatorio: Relatorio
  texto: string
}

type Log = (etapa: string, texto: string) => void

function cronometro(): () => string {
  const inicio = performance.now()
  return () => `${Math.round(performance.now() - inicio)} ms`
}

// -----------------------------------------------------------------------------
// Execução única
// -----------------------------------------------------------------------------
async function adquirirTrava(): Promise<PoolClient> {
  const client = await pool.connect()
  let obtida = false
  try {
    const resultado = await client.query<{ obtida: boolean }>('SELECT pg_try_advisory_lock($1::bigint) AS obtida', [CHAVE_TRAVA])
    obtida = resultado.rows[0].obtida
  } finally {
    if (!obtida) client.release()
  }
  if (obtida) return client

  const emAndamento = await execucaoEmAndamento()
  throw new AppError(
    409,
    'INTEGRACAO_EM_ANDAMENTO',
    `Já existe uma integração de entregas em andamento${emAndamento ? ` (execução ${emAndamento})` : ''}. Aguarde ela terminar.`,
    { integracao_id: emAndamento },
  )
}

async function liberarTrava(client: PoolClient): Promise<void> {
  try {
    await client.query('SELECT pg_advisory_unlock($1::bigint)', [CHAVE_TRAVA])
    client.release()
  } catch {
    client.release(true) // fechar a conexão também solta a trava
  }
}

// -----------------------------------------------------------------------------
// Etapas 1 a 5. Os totais são preenchidos conforme as etapas avançam, para
// ficarem registrados mesmo se uma etapa posterior falhar.
// -----------------------------------------------------------------------------
async function executarEtapas(integracaoId: number, totais: Totais, log: Log) {
  // Etapa 1 – Conexão
  let tempo = cronometro()
  const { client, tentativas } = await conectarGrupo7((aviso) => log('Etapa 1 – Conexão', aviso))
  log('Etapa 1 – Conexão', `conectado ao banco do Grupo 7 em ${tempo()} (tentativa ${tentativas} de ${MAX_TENTATIVAS})`)

  let estrutura: ResultadoEstrutura
  let linhas: LinhaView[]
  let falhou = false
  try {
    // Verificação estrutural, antes de consultar
    tempo = cronometro()
    estrutura = await verificarEstrutura(client)
    for (const alerta of estrutura.alertas) log('Estrutura', `⚠ ERRO_ESTRUTURAL (alerta): ${alerta.descricao}`)
    for (const extra of estrutura.colunasExtras) log('Estrutura', `⚠ coluna fora do contrato, ignorada: ${extra}`)
    await registrarErros(integracaoId, estrutura.alertas)
    log('Estrutura', `${estrutura.colunasConferidas} colunas do contrato presentes na view, ${estrutura.alertas.length} alerta(s) de tipo, em ${tempo()}`)

    // Etapa 2 – Consulta
    tempo = cronometro()
    linhas = await consultarView(client)
    totais.total_registros = linhas.length
    log('Etapa 2 – Consulta', `${linhas.length} registros lidos de ${VIEW} em ${tempo()}`)
  } catch (err) {
    falhou = true
    throw err
  } finally {
    // A leitura acabou: a conexão com o Grupo 7 não fica presa durante a gravação
    client.release(falhou)
  }

  // Etapa 3 – Validação
  tempo = cronometro()
  const { validos, rejeitados } = await validar(linhas)
  const errosValidacao = rejeitados.flatMap((r) => r.erros)
  await registrarErros(integracaoId, errosValidacao)
  totais.rejeitados = rejeitados.length
  await atualizarTotais(integracaoId, totais)
  log('Etapa 3 – Validação', `${validos.length} válidos, ${rejeitados.length} rejeitados (${errosValidacao.length} erros) em ${tempo()}`)
  for (const r of rejeitados) {
    const tipos = [...new Set(r.erros.map((e) => e.tipo_erro))].join(', ')
    log('Etapa 3 – Validação', `  ✗ registro ${r.registro_origem ?? `(linha ${r.linha}, sem id_entrega)`}: ${tipos}`)
  }

  // Etapa 4 – Transformação
  tempo = cronometro()
  const itens: ItemProcessamento[] = validos.map(({ registro }) => ({
    registro_origem: String(registro.id_entrega),
    situacao: registro.situacao,
    entrega: transformar(registro),
  }))
  log('Etapa 4 – Transformação', `${itens.length} registros convertidos para o modelo de vendas.entrega em ${tempo()}`)

  // Etapa 5 – Processamento
  tempo = cronometro()
  const quedaApos = quedaSimuladaApos()
  if (quedaApos !== null) {
    log('Etapa 5 – Processamento', `⚠ INTEGRACAO_SIMULAR_QUEDA_APOS=${quedaApos}: o processo vai cair depois de ${quedaApos} registro(s)`)
  }
  // Processados = registros válidos = inseridos + atualizados + sem alteração
  // (item 12 do enunciado); rejeitados = os da validação + os da gravação.
  // Os totais vão para o banco a cada INTERVALO_TOTAIS registros e no fim.
  const rejeitadosNaValidacao = totais.rejeitados
  const somarAosTotais = (parcial: ResultadoProcessamento) => {
    totais.inseridos = parcial.inseridos
    totais.atualizados = parcial.atualizados
    totais.sem_alteracao = parcial.sem_alteracao
    totais.processados = parcial.inseridos + parcial.atualizados + parcial.sem_alteracao
    totais.rejeitados = rejeitadosNaValidacao + parcial.rejeitados
  }
  const resultado = await processar(integracaoId, itens, quedaApos, async (parcial) => {
    somarAosTotais(parcial)
    await atualizarTotais(integracaoId, totais)
  })
  somarAosTotais(resultado)
  log(
    'Etapa 5 – Processamento',
    `${resultado.inseridos} inseridos, ${resultado.atualizados} atualizados, ${resultado.sem_alteracao} sem alteração, ` +
      `${resultado.rejeitados} rejeitados na gravação, em ${tempo()}`,
  )
  for (const venda of resultado.vendasAlteradas) {
    log('Etapa 5 – Processamento', `  venda ${venda.venda_id}: ${venda.caminho.join(' → ')}`)
  }

  return { estrutura, vendasAlteradas: resultado.vendasAlteradas }
}

function descreverVendas(vendas: VendaAlterada[]): string {
  if (vendas.length === 0) return 'Nenhuma venda mudou de status.'
  return `Vendas atualizadas: ${vendas.map((v) => `${v.venda_id} (${v.caminho.join(' → ')})`).join('; ')}.`
}

// -----------------------------------------------------------------------------
// A integração completa
// -----------------------------------------------------------------------------
export async function executarIntegracaoEntregas(): Promise<ResultadoIntegracao> {
  const tempoTotal = cronometro()
  const trava = await adquirirTrava()

  try {
    // Etapa 6 – a execução é registrada EM_ANDAMENTO antes de qualquer outra coisa
    const { integracaoId, interrompidas } = await iniciarExecucao()
    const log: Log = (etapa, texto) => console.log(`[integração #${integracaoId}] ${etapa}: ${texto}`)

    log('Início', `${SISTEMA_ORIGEM} → ${SISTEMA_DESTINO}`)
    log('Etapa 6 – Registro', `execução ${integracaoId} criada EM_ANDAMENTO`)

    const observacoes: string[] = []
    if (interrompidas.length > 0) {
      const ids = interrompidas.join(', ')
      log('Etapa 6 – Registro', `⚠ execução ${ids} estava EM_ANDAMENTO (o processo caiu no meio): marcada como FALHOU`)
      observacoes.push(`Execução ${ids} estava EM_ANDAMENTO e foi marcada como FALHOU ("${MENSAGEM_INTERROMPIDA}").`)
    }

    const totais: Totais = { total_registros: 0, processados: 0, inseridos: 0, atualizados: 0, sem_alteracao: 0, rejeitados: 0 }
    let status: Exclude<StatusExecucao, 'EM_ANDAMENTO'>
    let mensagem: string

    try {
      const { estrutura, vendasAlteradas } = await executarEtapas(integracaoId, totais, log)

      if (estrutura.alertas.length > 0) {
        observacoes.push(`Tipo diferente do contrato em: ${estrutura.alertas.map((a) => a.campo).join(', ')}.`)
      }
      if (estrutura.colunasExtras.length > 0) {
        observacoes.push(`Colunas fora do contrato ignoradas: ${estrutura.colunasExtras.join(', ')}.`)
      }
      observacoes.push(descreverVendas(vendasAlteradas))

      status = totais.rejeitados > 0 || estrutura.alertas.length > 0 ? 'CONCLUIDA_COM_ERROS' : 'CONCLUIDA'
      mensagem = observacoes.join(' ')
    } catch (err) {
      // Simulação de queda: sai sem finalizar o log, como se o processo tivesse
      // morrido. A execução fica EM_ANDAMENTO no banco.
      if (err instanceof QuedaSimulada) {
        log('Etapa 5 – Processamento', `💥 ${err.message}`)
        throw err
      }

      let motivo: string
      if (err instanceof ErroFatal) {
        motivo = err.message
        await registrarErros(integracaoId, err.erros)
        log(err.tipo, motivo)
      } else {
        motivo = `Erro inesperado: ${err instanceof Error ? err.message : String(err)}`
        console.error(err)
      }
      status = 'FALHOU'
      mensagem = [motivo, ...observacoes].join(' ')
    }

    await finalizarExecucao(integracaoId, totais, status, mensagem)
    log('Etapa 6 – Registro', `execução ${integracaoId} finalizada: ${status}`)

    // Etapa 7 – Relatório, a partir do que ficou gravado
    const execucao = await buscarExecucao(integracaoId)
    const relatorio = montarRelatorio(execucao!, await listarErros(integracaoId))
    log('Etapa 7 – Relatório', `gerado; tempo total ${tempoTotal()}`)

    return { relatorio, texto: relatorioEmTexto(relatorio) }
  } finally {
    await liberarTrava(trava)
  }
}
