import { defineConfig } from 'astro/config';

// Served from GitHub Pages at https://canl.github.io/daily-news/
export default defineConfig({
  site: 'https://canl.github.io',
  base: '/daily-news',
  output: 'static',
  trailingSlash: 'ignore',
});
