import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    vueDevTools(),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;

          if (id.includes('vuetify')) {
            return 'vuetify';
          }

          if (id.includes('vue-router') || id.includes('pinia') || id.includes('vue-gtag')) {
            return 'app-vendor';
          }

          if (id.includes('html2canvas')) {
            return 'html2canvas';
          }

          if (id.includes('/vue/')) {
            return 'vue-core';
          }
        }
      }
    }
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    },
  },
  server: {
    watch: {
      usePolling: true,
      interval: 100 // Optional: Adjust polling interval if needed
    }
  }
})
