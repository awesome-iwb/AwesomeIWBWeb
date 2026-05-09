import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'
import fs from 'fs'

const data = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../backend/src/data.json'), 'utf-8'));
const projectRoutes = data.categories.flatMap((c: any) => 
  c.projects.map((p: any) => `/project/${encodeURIComponent(p.name)}`)
);

const projectMap: Record<string, any> = {};
data.categories.forEach((c: any) => {
  c.projects.forEach((p: any) => {
    projectMap[p.name] = p;
  });
});

const baseUrl = 'https://aiwb.stcn.moe';

function injectHeadTags(html: string, route: string): string {
  html = html.replace('<html lang="en">', '<html lang="zh-CN">');
  let title = 'Awesome IWB - 交互式白板软件合集';
  let description = 'Awesome IWB 是交互式白板软件的精选合集，收录了希沃白板工具、课堂管理软件、课表看板、随机点名等优质开源项目，助力教师高效教学。';
  let ogImage = `${baseUrl}/assets/brand/aiwb-icon.webp`;
  let ogType = 'website';
  let canonicalUrl = `${baseUrl}${route}`;
  let jsonLd: string[] = [];

  if (route === '/') {
    jsonLd.push(JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'Awesome IWB',
      url: baseUrl,
      description: '交互式白板软件精选合集',
      potentialAction: {
        '@type': 'SearchAction',
        target: `${baseUrl}/?q={search_term_string}`,
        'query-input': 'required name=search_term_string'
      }
    }));
    jsonLd.push(JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'Awesome IWB',
      url: baseUrl,
      logo: `${baseUrl}/assets/brand/aiwb-icon.webp`
    }));
  } else if (route.startsWith('/project/')) {
    const projectName = decodeURIComponent(route.replace('/project/', ''));
    const project = projectMap[projectName];
    if (project) {
      title = `${project.name} - Awesome IWB`;
      description = project.description || title;
      ogImage = project.banner || project.icon || project.avatar || ogImage;
      ogType = 'article';
      const schema: any = {
        '@context': 'https://schema.org',
        '@type': 'SoftwareApplication',
        name: project.name,
        description: project.description,
        applicationCategory: 'EducationalApplication',
        operatingSystem: 'Windows',
        author: { '@type': 'Person', name: project.developer },
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'CNY' },
        url: canonicalUrl
      };
      if (project.language) schema.programmingLanguage = project.language;
      if (project.stars) {
        schema.aggregateRating = {
          '@type': 'AggregateRating',
          ratingValue: Math.min(5, 3 + Math.log10(Math.max(1, project.stars)) * 0.8).toFixed(1),
          ratingCount: String(project.stars)
        };
      }
      jsonLd.push(JSON.stringify(schema));
    }
  } else if (route === '/today') {
    title = '精选推荐 - Awesome IWB';
    description = 'Awesome IWB 精选推荐，发现最优质的交互式白板开源软件和专题故事。';
  } else if (route === '/about') {
    title = '关于我们 - Awesome IWB';
    description = '了解 Awesome IWB 团队、贡献者、运营组和友情链接。我们致力于收录和推广交互式白板开源软件。';
  } else if (route === '/compare') {
    title = '横向对比 - Awesome IWB';
    description = '对比 Awesome IWB 中收录的交互式白板软件，从星级、下载量、语言等维度进行横向比较。';
  } else if (route === '/submit') {
    title = '提交新项目 - Awesome IWB';
    description = '向 Awesome IWB 提交新的交互式白板开源项目，帮助更多教师发现优质软件工具。';
  }

  const headTags: string[] = [];
  headTags.push(`<title>${escapeHtml(title)}</title>`);
  headTags.push(`<meta name="description" content="${escapeHtml(description)}">`);
  headTags.push(`<meta property="og:title" content="${escapeHtml(title)}">`);
  headTags.push(`<meta property="og:description" content="${escapeHtml(description)}">`);
  headTags.push(`<meta property="og:image" content="${escapeHtml(ogImage)}">`);
  headTags.push(`<meta property="og:url" content="${escapeHtml(canonicalUrl)}">`);
  headTags.push(`<meta property="og:type" content="${ogType}">`);
  headTags.push(`<meta property="og:locale" content="zh_CN">`);
  headTags.push(`<meta name="twitter:card" content="summary_large_image">`);
  headTags.push(`<meta name="twitter:title" content="${escapeHtml(title)}">`);
  headTags.push(`<meta name="twitter:description" content="${escapeHtml(description)}">`);
  headTags.push(`<link rel="canonical" href="${escapeHtml(canonicalUrl)}">`);
  jsonLd.forEach(schema => {
    headTags.push(`<script type="application/ld+json">${schema}</script>`);
  });

  const existingTitleMatch = html.match(/<title>[^<]*<\/title>/i);
  if (existingTitleMatch) {
    html = html.replace(existingTitleMatch[0], '');
  }

  return html.replace('</head>', `${headTags.join('')}</head>`);
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

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
    onPageRendered(route: string, html: string) {
      return injectHeadTags(html, route);
    },
    async onFinished() {
      const staticRoutes = ['/', '/today', '/about', '/compare'];
      const allRoutes = [...staticRoutes, ...projectRoutes];
      const urls = allRoutes.map(route => `  <url>\n    <loc>${baseUrl}${route}</loc>\n    <changefreq>weekly</changefreq>\n    <priority>${route === '/' ? '1.0' : route.startsWith('/project/') ? '0.8' : '0.6'}</priority>\n  </url>`).join('\n');
      const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`;
      const distDir = path.resolve(__dirname, 'dist');
      fs.writeFileSync(path.join(distDir, 'sitemap.xml'), sitemap, 'utf-8');
    }
  }
})
