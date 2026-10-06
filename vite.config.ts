import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// Installable PWA: the app shell and covers are cached for offline browsing;
// audio streams from storage (range requests are not cached).
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      // Registered from main.tsx, and only on the web (not inside the Android app).
      injectRegister: false,
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Media Player',
        short_name: 'Media Player',
        description: 'Stream music: albums, mixes and genres.',
        theme_color: '#0b0b0f',
        background_color: '#0b0b0f',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        categories: ['music', 'entertainment'],
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        navigateFallback: '/index.html',
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        runtimeCaching: [
          {
            // Cover images from Supabase Storage.
            urlPattern: ({ url }) => url.pathname.includes('/storage/v1/object/public/music/covers/'),
            handler: 'CacheFirst',
            options: { cacheName: 'covers', expiration: { maxEntries: 400, maxAgeSeconds: 60 * 60 * 24 * 30 } },
          },
        ],
      },
    }),
  ],
})
