import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [react()],
  server: {
    // The @food-dash/* packages live above this app's root — let Vite read them.
    fs: { allow: [fileURLToPath(new URL('../..', import.meta.url))] },
  },
});
