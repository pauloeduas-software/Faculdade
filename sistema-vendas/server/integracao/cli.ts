// Executa a integração pelo terminal e imprime o relatório: npm run integrar
//
// Código de saída: 0 = CONCLUIDA ou CONCLUIDA_COM_ERROS, 2 = FALHOU,
// 1 = não executou até o fim (outra execução em andamento, queda simulada...)

// Precisa ser o primeiro import: carrega o .env antes de qualquer pool ser criado
import 'dotenv/config'
import { pool } from '../db/pool.js'
import { encerrarConexaoGrupo7 } from './conexao.js'
import { executarIntegracaoEntregas } from './executar.js'

let codigoSaida = 0

try {
  const { relatorio, texto } = await executarIntegracaoEntregas()
  console.log(`\n${texto}`)
  codigoSaida = relatorio.status === 'FALHOU' ? 2 : 0
} catch (err) {
  console.error(`\n✖ ${err instanceof Error ? err.message : String(err)}`)
  codigoSaida = 1
} finally {
  await encerrarConexaoGrupo7()
  await pool.end()
}

process.exitCode = codigoSaida
