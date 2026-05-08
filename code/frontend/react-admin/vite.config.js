import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd())
  const port = parseInt(env.VITE_PORT || '5173', 10)

  return {
    plugins: [react()],
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: './src/tests/setup.js',
      css: false,
      coverage: {
        provider: 'v8',
        reporter: ['text', 'html', 'lcov'],
        include: ['src/**/*.{js,jsx}'],
        exclude: ['src/tests/**', 'src/main.jsx'],
      },
    },
    server: {
      port,
      proxy: {
        '/api': {
          target: 'http://localhost:8042',
          changeOrigin: true,
        },
      },
    },
  }
})
