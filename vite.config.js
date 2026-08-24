import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import basicSsl from '@vitejs/plugin-basic-ssl' // 1. Import plugin
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    tailwindcss(),
    basicSsl() // 2. Add plugin here
  ],
  server: {
    host: '0.0.0.0',  // Allow access from any IP
    port: 5173,
    strictPort: false,
    https: true // 3. Enable HTTPS mode
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
})