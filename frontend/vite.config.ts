import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'
import fs from 'fs'

// Source-of-truth rule:
// - build/SSG routes are generated from backend/src/data.json
// - runtime files under backend/runtime are NOT used by Vite build directly
// See docs/architecture/data-flow.md for the full policy.
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
      return paths.filter(i => !i.includes(':')).concat(projectRoutes);
    },
    async onFinished() {
      const baseUrl = 'https://aiwb.stcn.moe';
      const staticRoutes = ['/', '/today', '/about', '/compare'];
      const allRoutes = [...staticRoutes, ...projectRoutes];
      const urls = allRoutes.map(route => `  <url>\n    <loc>${baseUrl}${route}</loc>\n    <changefreq>weekly</changefreq>\n    <priority>${route === '/' ? '1.0' : route.startsWith('/project/') ? '0.8' : '0.6'}</priority>\n  </url>`).join('\n');
      const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`;
      const distDir = path.resolve(__dirname, 'dist');
      fs.writeFileSync(path.join(distDir, 'sitemap.xml'), sitemap, 'utf-8');
    }
  }
})