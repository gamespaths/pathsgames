import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd())
  const port = parseInt(env.VITE_PORT || '5172', 10)

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
        // The admin console only calls /api/admin/** — proxy to the dedicated admin port.
        '/api': {
          target: 'http://localhost:8044',
          changeOrigin: true,
        },
      },
    },
  }
})
