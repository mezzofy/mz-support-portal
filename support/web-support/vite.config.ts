import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// web-support — Support-Staff Console (CR-support-console-v1.0)
// Dev server on port 5182 (route /support). Production build emits into
// ../svc-support/public so svc-support (port 8005) serves the SPA alongside
// the GraphQL API at /support/api/graphql (mirrors svc-tickets serving model).
export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE_PATH || '/support',
  server: {
    port: parseInt(process.env.PORT || '5182'),
    host: true,
    strictPort: true,
  },
  preview: {
    port: parseInt(process.env.PORT || '5182'),
    host: true,
  },
  build: {
    outDir: '../svc-support/public',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'ui-vendor': ['lucide-react'],
          'i18n-vendor': ['react-i18next', 'i18next'],
        },
      },
    },
    chunkSizeWarningLimit: 1000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@/presentation': path.resolve(__dirname, './src/presentation'),
      '@/shared': path.resolve(__dirname, './src/shared'),
    },
  },
})
