import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  // No GitHub Pages o site fica em /nome-do-repositorio/; o workflow define VITE_BASE. Localmente fica '/'.
  base: process.env.VITE_BASE || '/',
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    watch: {
      // Em drives que não são NTFS (pendrive, HD externo, rede) o monitor de arquivos
      // do Windows falha com "UNKNOWN: unknown error, watch". A varredura periódica funciona em qualquer drive.
      usePolling: true,
      interval: 300,
      // Ignora os protótipos HTML/CSS antigos da raiz, que não fazem parte do app React.
      ignored: (p: string) =>
        /[\\/](css|assets|dist|supabase)[\\/]/.test(p) ||
        (/\.html$/.test(p) && !/[\\/]index\.html$/.test(p)),
    },
  },
})
