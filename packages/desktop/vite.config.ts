import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],

  // Vite options tailored for Electron development
  clearScreen: false,

  // Electron dev script expects port 5174 (avoiding conflict)
  server: {
    port: 5174,
    strictPort: true,
  },

  // Environment variables
  envPrefix: ["VITE_"],

  build: {
    // Electron supports modern browsers
    target: "esnext",
    // Minify for production
    minify: true,
    // Produce sourcemaps for debugging
    sourcemap: true,
  },
})