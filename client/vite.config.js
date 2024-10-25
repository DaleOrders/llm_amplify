import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  server: {
    host: '0.0.0.0',
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''), 
      },
    },
  },
  plugins: [react()],
  build: {
    outDir: './dist',
    rollupOptions: {  // PROBLEM? TRY REMOVING THIS KEY
      input: './src/main.jsx',
      output: {
        entryFileNames: '[name].js', // No hash, just [name].js
        chunkFileNames: '[name].js', // No hash for chunks
        assetFileNames: '[name].[ext]', // No hash for other assets like CSS
      },
    },
  },
})
