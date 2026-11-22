import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Bind IPv4 too — otherwise http://127.0.0.1:5173 can hit a stale proxy
  // while only http://localhost:5173 reaches Vite ([::1]).
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
  },
})
