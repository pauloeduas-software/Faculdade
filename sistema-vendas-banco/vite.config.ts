import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Prefixo '' = lê todas as variáveis do .env (não só as VITE_). Elas ficam só
  // aqui na configuração e não são enviadas para o navegador.
  const env = loadEnv(mode, process.cwd(), '')
  const frontPort = Number(env.FRONT_PORT)
  const backPort = Number(env.PORT)
  if (!frontPort || !backPort) {
    throw new Error('Defina FRONT_PORT e PORT no .env (veja o .env.example)')
  }

  return {
    plugins: [react()],
    // strictPort: se a porta estiver ocupada, o Vite falha em vez de escolher outra
    server: {
      port: frontPort,
      strictPort: true,
      proxy: {
        '/api': `http://localhost:${backPort}`,
      },
    },
    // O preview usa o mesmo proxy do server por padrão
    preview: {
      port: frontPort,
      strictPort: true,
    },
  }
})
