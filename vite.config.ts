import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages serves under /InternalTool/
export default defineConfig({
  plugins: [react()],
  base: '/InternalTool/',
  build: {
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        // Split the heavyweight vendors out of the main chunk so first paint
        // doesn't wait on PDF rendering / the rich-text editor. The browser
        // fetches these in parallel and caches them across deploys (their
        // hash only changes when the dependency itself changes).
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom', '@tanstack/react-query'],
          'vendor-pdf': ['react-pdf', 'pdfjs-dist'],
          'vendor-editor': ['@tiptap/react', '@tiptap/starter-kit', '@tiptap/extension-placeholder', '@tiptap/extension-link'],
          'vendor-supabase': ['@supabase/supabase-js'],
        },
      },
    },
  },
});
