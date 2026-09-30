import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { fileURLToPath } from 'node:url';

// Preview-only: render the real Vue UI with synthetic local records, no cloud access.
export default defineConfig({
  root: fileURLToPath(new URL('../../', import.meta.url)),
  envDir: fileURLToPath(new URL('./', import.meta.url)),
  plugins: [vue()],
  resolve: { alias: { '../../supabase': fileURLToPath(new URL('./supabase.ts', import.meta.url)) } },
  server: { host: '127.0.0.1', port: 4173, strictPort: true },
});
