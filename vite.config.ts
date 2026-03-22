import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { TanStackRouterVite } from '@tanstack/router-plugin/vite'

export default defineConfig({
  plugins: [
    TanStackRouterVite({ routesDirectory: './src/app/routes', generatedRouteTree: './src/app/routeTree.gen.ts' }),
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': '/src',
      'sql.js': 'sql.js/dist/sql-wasm.js',
    },
  },
})
