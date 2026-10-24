// =============================================================================
// Etapa 1 – CONEXÃO com o banco do Grupo 7 (produtor)
//
// Pool SEPARADO do nosso (server/db/pool.ts): outro servidor, outro usuário
// (grupo2_consumidor, só leitura) e outras regras. Um problema do lado deles
// nunca derruba a nossa API.
// =============================================================================
import pg from 'pg'
import type { ErroRegistro } from './log.js'

export const MAX_TENTATIVAS = 3
const ESPERA_BASE_MS = 1000 // 1s antes da 2ª tentativa, 2s antes da 3ª
const TIMEOUT_CONEXAO_MS = 10000 // pelo túnel do Cloudflare a conexão leva de 2 a 4s

// Erro que interrompe a execução inteira (status FALHOU). Leva as linhas que
// vão para integracao.erro_integracao.
export class ErroFatal extends Error {
  readonly tipo: 'ERRO_CONEXAO' | 'ERRO_ESTRUTURAL'
  readonly erros: ErroRegistro[]

  constructor(tipo: 'ERRO_CONEXAO' | 'ERRO_ESTRUTURAL', mensagem: string, erros?: ErroRegistro[]) {
    super(mensagem)
    this.name = 'ErroFatal'
    this.tipo = tipo
    this.erros = erros ?? [{ registro_origem: null, campo: null, tipo_erro: tipo, descricao: mensagem, valor_recebido: null }]
  }
}

let poolGrupo7: pg.Pool | null = null

// Criado no primeiro uso, depois que o .env já foi carregado
function obterPool(): pg.Pool {
  if (poolGrupo7) return poolGrupo7

  const connectionString = process.env.GRUPO7_DATABASE_URL
  if (!connectionString) {
    throw new ErroFatal('ERRO_CONEXAO', 'GRUPO7_DATABASE_URL não está definida no .env')
  }

  poolGrupo7 = new pg.Pool({
    connectionString,
    max: 2,
    connectionTimeoutMillis: TIMEOUT_CONEXAO_MS,
    // Não segura conexões ociosas no banco deles (o usuário tem CONNECTION LIMIT 5)
    idleTimeoutMillis: 5000,
    application_name: 'grupo2_consumidor_entregas',
    options: '-c TimeZone=America/Sao_Paulo -c DateStyle=ISO',
    // Nenhuma conversão automática do driver: todo valor chega como o TEXTO que o
    // PostgreSQL enviou. A conversão para os nossos tipos é feita por nós, campo a
    // campo (transformacao.ts), e o que não converter vira TIPO_INVALIDO.
    types: { getTypeParser: () => (valor: string) => valor },
  })

  // Sem este listener, o servidor do Grupo 7 derrubando uma conexão ociosa
  // (ex.: pg_terminate_backend) derrubaria o nosso processo
  poolGrupo7.on('error', (err) => {
    console.error(`[integração] Conexão ociosa com o banco do Grupo 7 encerrada: ${err.message}`)
  })

  return poolGrupo7
}

// Usado pelo script de terminal, para o processo terminar
export async function encerrarConexaoGrupo7(): Promise<void> {
  await poolGrupo7?.end()
  poolGrupo7 = null
}

// Conecta com até MAX_TENTATIVAS, esperando cada vez mais entre elas. Só repete
// falhas de CONEXÃO (banco fora do ar, rede, timeout): senha errada, falta de
// permissão ou banco inexistente não se resolvem sozinhos, então falham na hora.
export async function conectarGrupo7(
  aoRepetir: (aviso: string) => void,
  maxTentativas = MAX_TENTATIVAS,
): Promise<{ client: pg.PoolClient; tentativas: number }> {
  const pool = obterPool()

  for (let tentativa = 1; ; tentativa++) {
    let client: pg.PoolClient | undefined
    try {
      client = await pool.connect()
      // Uma conexão ociosa do pool pode ter sido derrubada pelo servidor: só
      // considera conectado depois de uma resposta de verdade
      await client.query('SELECT 1')
      return { client, tentativas: tentativa }
    } catch (err) {
      client?.release(true) // descarta a conexão com problema

      const repetir = falhaDeConexao(err)
      if (!repetir) {
        throw new ErroFatal('ERRO_CONEXAO', `${traduzirErroConexao(err)} (sem nova tentativa: não é falha passageira)`)
      }
      if (tentativa >= maxTentativas) {
        const tentativas = maxTentativas > 1 ? ` após ${maxTentativas} tentativas` : ''
        throw new ErroFatal('ERRO_CONEXAO', `Banco do Grupo 7 indisponível${tentativas}: ${traduzirErroConexao(err)}`)
      }

      const espera = ESPERA_BASE_MS * tentativa
      aoRepetir(`tentativa ${tentativa} de ${maxTentativas} falhou (${traduzirErroConexao(err)}); nova tentativa em ${espera / 1000}s`)
      await new Promise((resolve) => setTimeout(resolve, espera))
    }
  }
}

// -----------------------------------------------------------------------------
// Classificação e tradução dos erros
// -----------------------------------------------------------------------------

// Falhas de conexão (vale a pena tentar de novo)
const CODIGOS_PASSAGEIROS = new Set([
  'ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'EHOSTUNREACH', 'ENETUNREACH', 'ENOTFOUND', 'EAI_AGAIN', 'EPIPE',
  '55000', // banco não aceita conexões (ALLOW_CONNECTIONS false / manutenção)
  '57P01', '57P02', '57P03', // servidor desligando, reiniciando ou subindo
  '53300', // limite de conexões atingido
  '08000', '08001', '08003', '08006', // classe 08: falha de conexão
])

// Conexão/permissão: viram ERRO_CONEXAO também quando acontecem na consulta
const CODIGOS_CONEXAO = new Set([...CODIGOS_PASSAGEIROS, '28P01', '28000', '42501', '3D000', '57014'])

function codigoDoErro(err: unknown): string | undefined {
  // SQLSTATE do PostgreSQL ou código de rede do Node (ECONNREFUSED vem às vezes
  // num AggregateError sem mensagem, só com code)
  return (err as { code?: string } | null)?.code
}

function mensagemDoErro(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

function falhaDeConexao(err: unknown): boolean {
  const codigo = codigoDoErro(err)
  if (codigo && CODIGOS_PASSAGEIROS.has(codigo)) return true
  // Timeout do driver (connectionTimeoutMillis) e conexão derrubada não têm código
  return /timeout|terminated/i.test(mensagemDoErro(err)) && !(err instanceof pg.DatabaseError)
}

export function ehErroDeConexao(err: unknown): boolean {
  const codigo = codigoDoErro(err)
  return (codigo !== undefined && CODIGOS_CONEXAO.has(codigo)) || falhaDeConexao(err)
}

// host:porta/banco, sem usuário e senha (vai para mensagens e para a tela)
export function hostDoGrupo7(): string {
  try {
    const url = new URL(process.env.GRUPO7_DATABASE_URL ?? '')
    return `${url.host}${url.pathname}`
  } catch {
    return 'banco do Grupo 7'
  }
}

export function traduzirErroConexao(err: unknown): string {
  const codigo = codigoDoErro(err)
  const mensagem = mensagemDoErro(err)
  const sufixo = codigo ? ` [${codigo}]` : ''

  switch (codigo) {
    case 'ECONNREFUSED':
      return `Conexão recusada em ${hostDoGrupo7()}: o servidor está fora do ar ou a porta está errada${sufixo}`
    case 'ETIMEDOUT':
    case 'EHOSTUNREACH':
    case 'ENETUNREACH':
      return `Servidor ${hostDoGrupo7()} inalcançável pela rede${sufixo}`
    case 'ENOTFOUND':
    case 'EAI_AGAIN':
      return `Endereço do servidor do Grupo 7 não encontrado (DNS)${sufixo}`
    case '28P01':
      return `Usuário ou senha recusados pelo banco do Grupo 7${sufixo}`
    case '28000':
      return `Acesso recusado pelas regras do servidor do Grupo 7 (pg_hba.conf)${sufixo}`
    case '42501':
      return `Permissão negada: ${mensagem}${sufixo}`
    case '3D000':
      return `O banco informado em GRUPO7_DATABASE_URL não existe${sufixo}`
    case '55000':
      return `O banco do Grupo 7 não está aceitando conexões (fora do ar ou em manutenção)${sufixo}`
    case '57P01':
    case '57P02':
    case '57P03':
      return `O servidor do Grupo 7 está desligando ou reiniciando${sufixo}`
    case '53300':
      return `Limite de conexões do nosso usuário no banco do Grupo 7 atingido${sufixo}`
    case '57014':
      return `Consulta cancelada por tempo (statement_timeout do Grupo 7)${sufixo}`
  }
  if (/timeout/i.test(mensagem)) {
    return `Tempo esgotado ao conectar em ${hostDoGrupo7()} (${TIMEOUT_CONEXAO_MS / 1000}s)`
  }
  if (/terminated/i.test(mensagem)) return 'A conexão foi encerrada pelo servidor do Grupo 7'
  return (mensagem || 'Erro desconhecido') + sufixo
}
