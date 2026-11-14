import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), ''), ...process.env }
  return {
    plugins: [react()],
    server: {
      port: Number(env.FRONT_PORT ?? 3000),
      host: true,
      strictPort: true,
      // O navegador chama /api no proprio Vite, que repassa para a API de Vendas.
      proxy: { '/api': `http://localhost:${env.PORT ?? 3001}`, '/health': `http://localhost:${env.PORT ?? 3001}` },
    },
  }
})
