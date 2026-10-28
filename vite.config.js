import path from 'node:path'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

const projectRoot = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const neonDataApiUrl = env.VITE_NEON_DATA_API_URL || env.NEON_DATA_API_URL || ''

  return {
    resolve: {
      alias: {
        '@': path.resolve(projectRoot, 'src'),
      },
    },
    define: {
      'import.meta.env.VITE_NEON_DATA_API_URL': JSON.stringify(neonDataApiUrl),
    },
    plugins: [react()],
  }
});
