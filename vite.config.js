import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base "./" makes the built files work from any folder or GitHub Pages path.
export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom'],
          charts: ['chart.js', 'react-chartjs-2'],
          xlsx: ['xlsx'],
        },
      },
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
  },
});
