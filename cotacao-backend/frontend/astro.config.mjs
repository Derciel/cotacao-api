import { defineConfig } from 'astro/config';
import vue from '@astrojs/vue';

// https://astro.build/config
export default defineConfig({
  output: 'static',
  integrations: [vue()],
  vite: {
    server: {
      proxy: {
        '/api': {
          target: 'http://localhost:3005',
          changeOrigin: true
        }
      }
    }
  }
});