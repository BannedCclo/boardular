import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { port: 5180 },
  // a demonstração (npm run build:demo) sai em dist-demo/: dist/ é da biblioteca
  build: { outDir: 'dist-demo' },
});
