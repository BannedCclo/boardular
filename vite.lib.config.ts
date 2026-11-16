import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/** Build da biblioteca (npm run build): ESM e CommonJS em dist/, com o CSS embutido no JS e as dependências de fora do pacote. */
export default defineConfig({
  plugins: [react()],
  publicDir: false,
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
    lib: {
      entry: 'src/boardular/index.ts',
      formats: ['es', 'cjs'],
      fileName: format => (format === 'es' ? 'boardular.js' : 'boardular.cjs'),
    },
    rollupOptions: {
      // React vem do app; three, gsap e animejs são dependências do pacote (instaladas junto, não embutidas).
      // Os extras do three (three/examples) entram embutidos: só existem em ESM e quebrariam o require() do build CommonJS
      external: [/^react($|\/)/, /^react-dom($|\/)/, /^three$/,/^gsap($|\/)/, /^animejs($|\/)/],
    },
  },
});
