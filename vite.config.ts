import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages serves under /InternalTool/
export default defineConfig({
  plugins: [react()],
  base: '/InternalTool/',
  build: {
    chunkSizeWarningLimit: 1500,
  },
});
