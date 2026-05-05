import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.js',
    coverage: {
      reporter: ['text', 'lcov'],
      include: ['src/**/*.{js,jsx}'],
      exclude: ['src/main.jsx', 'src/mock/**'],
    },
  },
  plugins: [react()],
  server: {
    port: 5174,
    proxy: {
      '/api': {
        target: 'http://localhost:8042',
        changeOrigin: true,
      },
    },
  },
})
