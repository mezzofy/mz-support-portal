import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

// Vitest config — Support Console (CR-support-console-v1.0, Gate 3).
// jsdom env for component/DOM tests; v8 coverage scoped to the modules under
// test (viewmodels, mappers, datasource, entities, state-machine components).
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@/presentation': path.resolve(__dirname, './src/presentation'),
      '@/shared': path.resolve(__dirname, './src/shared'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.{ts,tsx}'],
    css: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'json-summary'],
      reportsDirectory: './tests/results/coverage',
      // Scope coverage to the units this Gate-3 suite targets.
      include: [
        'src/data/mappers/**',
        'src/data/datasources/**',
        'src/domain/entities/support-ticket.entity.ts',
        'src/domain/entities/message.entity.ts',
        'src/presentation/features/support/viewmodels/**',
        'src/presentation/features/support/hooks/**',
        'src/presentation/features/support/components/StatusTransitionMenu.tsx',
        'src/presentation/features/support/components/AssignAgentDialog.tsx',
        'src/presentation/features/support/components/SupportChatPanel.tsx',
      ],
      // useLayoutViewModel is sidebar/layout state — out of this Gate-3 scope.
      exclude: ['src/presentation/features/support/viewmodels/useLayoutViewModel.ts'],
      all: true,
    },
  },
})
