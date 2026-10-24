import pg from 'pg'

// NUMERIC (OID 1700) chega do driver como string para não perder precisão.
// Os valores do sistema (preços, totais, comissão) cabem com folga em um number.
pg.types.setTypeParser(1700, (valor) => Number(valor))

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 5000,
  // Datas sem horário (ex.: filtro data_inicio/data_fim) são interpretadas no fuso do Brasil
  options: '-c TimeZone=America/Sao_Paulo',
})

// Sem este listener, um erro em conexão ociosa (ex.: banco reiniciado) derruba o processo
pool.on('error', (err) => {
  console.error('Erro inesperado no pool do PostgreSQL:', err.message)
})

// Quem executa SQL nos repositórios: o próprio pool ou o client de uma transação aberta
export type Db = Pick<pg.PoolClient, 'query'>
