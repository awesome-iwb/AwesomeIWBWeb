import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'
import fs from 'fs'

// Read projects to generate dynamic routes
const data = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../backend/src/data.json'), 'utf-8'));
const projectRoutes = data.categories.flatMap((c: any) => 
  c.projects.map((p: any) => `/project/${encodeURIComponent(p.name)}`)
);

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Awesome IWB',
        short_name: 'AIWB',
        theme_color: '#0B1120',
        icons: [{ src: '/favicon.svg', sizes: '192x192', type: 'image/svg+xml' }]
      }
    })
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8080',
        changeOrigin: true
      }
    }
  },
  // @ts-ignore
  ssgOptions: {
    script: 'async',
    formatting: 'minify',
    includedRoutes(paths: string[]) {
      // Exclude wildcard routes
      return paths.filter(i => !i.includes(':')).concat(projectRoutes);
    },
  }
})