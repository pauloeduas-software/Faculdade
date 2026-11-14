export interface Config {
  port: number
  dbPath: string
  // chave -> perfil. "admin" faz tudo; "leitura" so consulta (GET).
  apiKeys: Record<string, 'admin' | 'leitura'>
  // API de Entregas do G7, consumida pelo G2 (URL e chave no contrato do G7).
  entregas: { baseUrl: string; apiKey: string; timeoutMs: number; retries: number; retryDelayMs: number }
}

function parseKeys(raw: string): Config['apiKeys'] {
  const keys: Config['apiKeys'] = {}
  for (const par of raw.split(',')) {
    const [chave, perfil] = par.split(':').map((s) => s.trim())
    if (chave && (perfil === 'admin' || perfil === 'leitura')) keys[chave] = perfil
  }
  return keys
}

export function loadConfig(overrides: Partial<Config> = {}): Config {
  const env = process.env
  return {
    port: Number(env.PORT ?? 3001),
    dbPath: env.DB_PATH ?? 'services/vendas-api/vendas.db',
    apiKeys: parseKeys(env.API_KEYS ?? 'vendas-admin-key:admin,estoque-key:leitura'),
    entregas: {
      baseUrl: env.ENTREGAS_URL ?? 'https://grupo7-apirest.ioshuavps.com.br/api/v1',
      apiKey: env.ENTREGAS_API_KEY ?? '',
      // Contrato do G7: 5 s por chamada e ate 3 novas tentativas (1 s, 2 s e 4 s).
      timeoutMs: Number(env.ENTREGAS_TIMEOUT_MS ?? 5000),
      retries: 3,
      retryDelayMs: 1000,
    },
    ...overrides,
  }
}
