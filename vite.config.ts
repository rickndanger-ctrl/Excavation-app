import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/model-studio-api': {
        target: 'http://127.0.0.1:8777',
        changeOrigin: false,
        rewrite: (path) => path.replace(/^\/model-studio-api/, '/api'),
      },
    },
  },
})
