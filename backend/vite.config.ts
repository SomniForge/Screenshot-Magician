// vite.config.ts
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vuetify from 'vite-plugin-vuetify' // Import Vuetify plugin

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    // ... other plugins
  ],
  resolve: {
    // ... alias
  },
  server: { // Add this section
    proxy: {
      // Proxy /api requests to your backend server
      '/api': {
        target: 'http://localhost:3001', // Your backend port (from .env or default)
        changeOrigin: true,
        // secure: false, // uncomment if backend uses self-signed SSL cert
        // rewrite: (path) => path.replace(/^\/api/, '') // uncomment if backend doesn't expect /api prefix
      }
    }
  }
})
