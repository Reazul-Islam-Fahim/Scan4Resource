import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const target = env.API_TARGET
  console.log('API_TARGET =', target || '(not set: the proxy is OFF)')

  return {
    plugins: [react(), ...(mode === 'phone' ? [basicSsl()] : [])],
    server: {
      host: true,
      proxy: target
        ? { '/api': { target, changeOrigin: true, secure: true, rewrite: (path) => path.replace(/^\/api/, '') } }
        : undefined,
    },
  }
})