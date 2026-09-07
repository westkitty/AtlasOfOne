import { cloudflare } from '@cloudflare/vite-plugin';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/atlas.svg', 'assets/greyson/map/*.png'],
      manifest: {
        name: 'Atlas of One',
        short_name: 'Atlas',
        description: 'A personality-cartography game.',
        theme_color: '#10151f',
        background_color: '#10151f',
        display: 'standalone',
        orientation: 'portrait-primary',
        icons: [
          {
            src: '/icons/atlas.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable'
          }
        ]
      }
    }),
    cloudflare()
  ]
});
