/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/*.png', 'assets/logos/*'],
      manifest: {
        name: 'SKY Happy Customers – Smart Photo Booth',
        short_name: 'SKY Booth',
        description: 'Capture happy customers and generate branch posters – works offline.',
        theme_color: '#0a1633',
        background_color: '#0a1633',
        display: 'standalone',
        orientation: 'any',
        start_url: '/',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // App shell + thumbnails are precached. Full-resolution templates (~10 MB each)
        // are cached at runtime on first use (or via Settings → "Prepare offline").
        // Customer photos live only in IndexedDB as Blobs and are never fetched over the network.
        globPatterns: ['**/*.{js,css,html,svg,woff2}', 'icons/*.png', 'assets/logos/*', 'assets/thumbs/*.jpg'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        navigateFallback: '/index.html',
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/assets/templates/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'sky-templates-v1',
              expiration: { maxEntries: 80 },
              cacheableResponse: { statuses: [0, 200] },
              rangeRequests: false,
            },
          },
          {
            urlPattern: ({ url }) => url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com',
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'sky-fonts', expiration: { maxEntries: 20 } },
          },
        ],
      },
    }),
  ],
  build: { chunkSizeWarningLimit: 700 },
  test: {
    environment: 'node',
    include: ['src/tests/unit/**/*.test.ts', 'src/tests/integration/**/*.test.ts'],
    setupFiles: ['src/tests/setup.ts'],
  },
});
