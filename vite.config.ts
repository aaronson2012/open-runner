import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import { resolve } from 'path';
import { compression } from 'vite-plugin-compression2';

// GitHub Pages deployment configuration
const isGitHubPages = process.env.GITHUB_PAGES === 'true' || process.env.CI;
const repoName = process.env.GITHUB_REPOSITORY?.split('/')[1] || 'open-runner';
const basePath = isGitHubPages ? `/${repoName}/` : '/';

export default defineConfig(({ mode }) => ({
  // GitHub Pages base path configuration
  base: basePath,
  
  // Build configuration optimized for performance
  build: {
    target: 'es2022',
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: mode === 'development',
    minify: mode === 'production' ? 'terser' : false,
    
    // Rollup-specific options for optimal bundling
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
      },
      output: {
        // Manual chunk splitting for better caching
        manualChunks: {
          // Three.js and related modules
          three: ['three'],
          
          // Game core systems
          'game-core': [
            './src/core/Game',
            './src/core/EntityManager',
            './src/core/SystemManager',
          ],
          
          // Rendering subsystem
          'game-rendering': [
            './src/systems/RenderSystem',
            './src/rendering/WebGPURenderer',
            './src/rendering/WebGLRenderer',
          ],
          
          // Physics and collision
          'game-physics': [
            './src/systems/PhysicsSystem',
            './src/systems/CollisionSystem',
            './src/physics/CollisionDetection',
          ],
          
          // Audio subsystem
          'game-audio': [
            './src/audio/AudioManager',
            './src/audio/SpatialAudio',
          ],
          
          // Mobile and PWA features
          'game-mobile': [
            './src/mobile/TouchControls',
            './src/mobile/PerformanceAdapter',
            './src/mobile/PWAManager',
          ],
          
          // Utilities and helpers
          'game-utils': [
            './src/utils/MathUtils',
            './src/utils/PerformanceMonitor',
            './src/utils/Logger',
          ],
        },
        
        // Asset file naming for better caching
        assetFileNames: (assetInfo) => {
          const info = assetInfo.name?.split('.') || [];
          let extType = info[info.length - 1];
          
          // Group assets by type for better organization
          if (/\.(mp3|wav|ogg|aac)$/i.test(assetInfo.name || '')) {
            extType = 'audio';
          } else if (/\.(png|jpg|jpeg|gif|svg|webp)$/i.test(assetInfo.name || '')) {
            extType = 'images';
          } else if (/\.(woff|woff2|eot|ttf|otf)$/i.test(assetInfo.name || '')) {
            extType = 'fonts';
          } else if (/\.(glb|gltf|obj|fbx)$/i.test(assetInfo.name || '')) {
            extType = 'models';
          }
          
          return `assets/${extType}/[name]-[hash][extname]`;
        },
        
        // JavaScript file naming
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
      },
    },
    
    // Asset optimization
    assetsInlineLimit: 0, // Don't inline assets for better caching
    
    // Terser options for production optimization
    terserOptions: {
      compress: {
        drop_console: mode === 'production',
        drop_debugger: mode === 'production',
        pure_funcs: mode === 'production' ? ['console.log', 'console.debug'] : [],
      },
      mangle: {
        safari10: true,
      },
    },
  },
  
  // Development server configuration
  server: {
    host: true,
    port: 5173,
    strictPort: false,
    open: true,
    cors: true,
    headers: {
      // Enable SharedArrayBuffer for performance
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin',
    },
  },
  
  // Preview server configuration
  preview: {
    host: true,
    port: 4173,
    strictPort: false,
    open: true,
    cors: true,
  },
  
  // Path resolution
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@assets': resolve(__dirname, 'public/assets'),
      '@components': resolve(__dirname, 'src/components'),
      '@core': resolve(__dirname, 'src/core'),
      '@systems': resolve(__dirname, 'src/systems'),
      '@utils': resolve(__dirname, 'src/utils'),
      '@types': resolve(__dirname, 'src/types'),
    },
  },
  
  // Plugin configuration
  plugins: [
    // PWA configuration for mobile-first experience
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
      manifest: {
        name: 'Open Runner',
        short_name: 'OpenRunner',
        description: '3D Endless Runner Game',
        theme_color: '#1a1a1a',
        background_color: '#000000',
        display: 'fullscreen',
        orientation: 'landscape-primary',
        start_url: basePath,
        scope: basePath,
        icons: [
          {
            src: 'assets/icons/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'assets/icons/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'assets/icons/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,glb,gltf,wav,mp3,ogg}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
              },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'gstatic-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
              },
            },
          },
          {
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'images-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
              },
            },
          },
          {
            urlPattern: /\.(?:glb|gltf|obj)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'models-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 * 90, // 90 days
              },
            },
          },
          {
            urlPattern: /\.(?:wav|mp3|ogg|aac)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'audio-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 * 60, // 60 days
              },
            },
          },
        ],
      },
    }),
    
    // Asset compression for better performance
    compression({
      algorithm: 'gzip',
      include: /\.(js|css|html|svg|json)$/,
      threshold: 1024,
    }),
    
    compression({
      algorithm: 'brotliCompress',
      include: /\.(js|css|html|svg|json)$/,
      threshold: 1024,
    }),
    
    // Copy static assets with optimization
    viteStaticCopy({
      targets: [
        {
          src: 'public/assets/**/*',
          dest: 'assets',
        },
      ],
    }),
  ],
  
  // Environment variables
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
    __GITHUB_PAGES__: JSON.stringify(isGitHubPages),
    __BASE_PATH__: JSON.stringify(basePath),
  },
  
  // CSS configuration
  css: {
    devSourcemap: mode === 'development',
    modules: {
      localsConvention: 'camelCase',
    },
    preprocessorOptions: {
      scss: {
        additionalData: `@import "@/styles/variables.scss";`,
      },
    },
  },
  
  // Worker configuration for advanced features
  worker: {
    format: 'es',
    plugins: () => [
      compression({
        algorithm: 'gzip',
        include: /\.(js)$/,
      }),
    ],
  },
  
  // Optimization configuration
  optimizeDeps: {
    include: ['three', 'zustand'],
    exclude: ['@vite/client', '@vite/env'],
  },
  
  // JSON configuration
  json: {
    namedExports: true,
    stringify: false,
  },
}));