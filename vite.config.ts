import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            // Core framework
            'vendor-react': ['react', 'react-dom', 'react-router-dom'],
            // UI library
            'vendor-ui': ['@base-ui/react', 'lucide-react', 'sonner', 'motion'],
            // Data & utilities
            'vendor-data': ['@supabase/supabase-js', 'date-fns'],
            // Charts
            'vendor-charts': ['recharts'],
            // Maps
            leaflet: ['leaflet', 'react-leaflet'],
          },
        },
      },
    },
  };
});
