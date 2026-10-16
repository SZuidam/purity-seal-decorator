/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // Relative base so the build works from a GitHub Pages sub-path (/purity-seal-decorator/).
  base: './',
  plugins: [react()],
  test: {
    environment: 'jsdom',
  },
});
