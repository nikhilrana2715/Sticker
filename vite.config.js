import { defineConfig } from 'vite';

export default defineConfig({
  // host: true → also listen on the LAN IP, so other devices on the same Wi-Fi can open it.
  server: { host: true, port: 5173, open: true },
  preview: { host: true, port: 4173 },
  // Pre-bundle the lazily imported libs; otherwise the dev server returns
  // 504 "Outdated Optimize Dep" the first time they are imported.
  optimizeDeps: { include: ['xlsx', 'jspdf', 'pdfjs-dist'] },
  build: {
    outDir: 'dist',
    target: 'es2020',
    sourcemap: false,
    chunkSizeWarningLimit: 1500
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js']
  }
});
