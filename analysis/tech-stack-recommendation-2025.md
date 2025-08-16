# Open Runner 2025 Tech Stack Recommendation

## Executive Summary

Based on comprehensive analysis of the current Open Runner codebase and modern 2025 web game development standards, this document provides specific technology recommendations for the complete rewrite. The selection prioritizes performance for 3D mobile games, GitHub Pages compatibility, modern development experience, and long-term maintainability.

## Current State Analysis

### Critical Issues Identified:
- **Three.js 0.163.0** (outdated - current 0.179.1 has WebGPU support)
- **No build system** - manual CDN imports via import maps
- **No TypeScript** - runtime errors and poor IDE support
- **Memory leaks** in chunk management and asset disposal
- **Poor mobile performance** - no adaptive quality system
- **1,045-line monolithic classes** requiring refactoring

### Performance Targets:
- **Desktop**: 60fps stable (120fps capable), 8-12 chunk render distance
- **Mobile**: 60fps on mid-range devices, <200MB memory, <10% battery/30min
- **Bundle Size**: <5MB initial load, progressive asset streaming
- **GitHub Pages**: Full compatibility with CI/CD deployment

## Recommended Tech Stack 2025

### 1. Core Framework: Three.js (Latest)

**Selected: Three.js 0.179.1+**

**Rationale:**
- Industry leader with 95k+ GitHub stars and active development
- **WebGPU integration** available (2-3x performance improvement)
- Comprehensive ecosystem with excellent TypeScript support
- Proven track record for mobile 3D games
- **Bundle size**: Tree-shakeable modules (import only what you need)

**vs Alternatives:**
- **Babylon.js**: More feature-complete but 40% larger bundle size
- **Phaser**: Limited 3D capabilities, better for 2D games
- **PlayCanvas**: Excellent but requires engine lock-in

**Implementation:**
```typescript
// Modern Three.js with WebGPU fallback
import { WebGPURenderer, WebGLRenderer, Scene, PerspectiveCamera } from 'three';

const createRenderer = async () => {
  if (navigator.gpu) {
    const renderer = new WebGPURenderer({ canvas });
    await renderer.init();
    return renderer;
  }
  return new WebGLRenderer({ canvas, antialias: true });
};
```

### 2. Build System: Vite

**Selected: Vite 5.x**

**Rationale:**
- **Lightning-fast development** with native ES modules
- **Optimal for GitHub Pages** with base path configuration
- **Excellent TypeScript integration** out-of-the-box
- **Tree shaking** and code splitting for optimal bundle sizes
- **Asset optimization** with built-in plugins

**vs Alternatives:**
- **Webpack 5**: More mature but slower dev server
- **Rollup**: Lower-level, requires more configuration
- **Parcel**: Good but less control over optimization

**Configuration:**
```typescript
// vite.config.ts
export default defineConfig({
  base: '/open-runner/',
  build: {
    target: 'es2022',
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
          game: ['./src/core/**'],
          utils: ['./src/utils/**']
        }
      }
    },
    assetsInlineLimit: 0 // No base64 inlining for better caching
  },
  plugins: [
    viteCompression(), // Gzip/Brotli compression
    vitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,glb}']
      }
    })
  ]
});
```

### 3. Language: TypeScript

**Selected: TypeScript 5.3+**

**Rationale:**
- **Essential for large codebases** - eliminates runtime type errors
- **Excellent Three.js support** with @types/three
- **Better IDE experience** with autocomplete and refactoring
- **Gradual migration path** from existing JavaScript
- **Performance**: No runtime overhead, compiles to optimized JS

**Migration Strategy:**
```typescript
// Phase 1: Core types
interface GameEntity {
  id: string;
  position: THREE.Vector3;
  mesh?: THREE.Mesh;
  update(deltaTime: number): void;
}

// Phase 2: Component interfaces
interface Component {
  entity: GameEntity;
  update(deltaTime: number): void;
  dispose(): void;
}

// Phase 3: Manager classes
class ChunkManager {
  private chunks = new Map<string, TerrainChunk>();
  
  async loadChunk(x: number, z: number): Promise<TerrainChunk> {
    // Type-safe implementation
  }
}
```

### 4. State Management: Zustand

**Selected: Zustand 4.x**

**Rationale:**
- **Lightweight** (<1KB) vs Redux (~20KB)
- **TypeScript-first** design
- **Simple API** perfect for game state
- **No providers** or complex setup
- **React-independent** (can be used in vanilla TS)

**vs Alternatives:**
- **Redux Toolkit**: More complex, React-focused
- **MobX**: Reactive but larger learning curve
- **Valtio**: Good but less mature ecosystem

**Implementation:**
```typescript
import { create } from 'zustand';

interface GameState {
  score: number;
  level: string;
  playerHealth: number;
  powerups: PowerupState[];
  
  // Actions
  updateScore: (points: number) => void;
  setLevel: (level: string) => void;
  applyDamage: (damage: number) => void;
}

export const useGameStore = create<GameState>((set, get) => ({
  score: 0,
  level: 'forest',
  playerHealth: 100,
  powerups: [],
  
  updateScore: (points) => set(state => ({ 
    score: state.score + points 
  })),
  setLevel: (level) => set({ level }),
  applyDamage: (damage) => set(state => ({ 
    playerHealth: Math.max(0, state.playerHealth - damage) 
  }))
}));
```

### 5. Testing: Vitest + Testing Library

**Selected: Vitest 1.x + @testing-library/dom**

**Rationale:**
- **Vite-native** - same config, instant startup
- **Jest-compatible** API with better performance
- **TypeScript support** out-of-the-box
- **Mock system** for Three.js components
- **Coverage reports** with c8

**Configuration:**
```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      provider: 'c8',
      reporter: ['text', 'html', 'lcov']
    },
    testTimeout: 10000 // For async Three.js operations
  }
});

// tests/setup.ts
import { vi } from 'vitest';

// Mock WebGL context for testing
Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
  value: vi.fn(() => ({
    clearColor: vi.fn(),
    clear: vi.fn(),
    // ... other WebGL methods
  }))
});
```

### 6. Mobile/PWA: Workbox + Vite PWA

**Selected: @vite/plugin-pwa with Workbox**

**Rationale:**
- **Offline-first** strategy for mobile reliability
- **App-like experience** with install prompts
- **Background sync** for score updates
- **Push notifications** for updates
- **GitHub Pages compatible**

**Configuration:**
```typescript
// PWA manifest
{
  "name": "Open Runner",
  "short_name": "OpenRunner",
  "description": "3D Endless Runner Game",
  "theme_color": "#1a1a1a",
  "background_color": "#000000",
  "display": "fullscreen",
  "orientation": "landscape-primary",
  "icons": [
    {
      "src": "icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ]
}
```

### 7. Deployment: GitHub Actions + GitHub Pages

**Selected: GitHub Actions with automated deployment**

**Configuration:**
```yaml
# .github/workflows/deploy.yml
name: Deploy to GitHub Pages

on:
  push:
    branches: [ main ]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pages: write
      id-token: write
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run tests
        run: npm run test
      
      - name: Build game
        run: npm run build
        
      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: dist
          
      - name: Deploy to GitHub Pages
        uses: actions/deploy-pages@v4
```

### 8. Performance Monitoring: Custom + Web Vitals

**Selected: Custom performance monitoring with web-vitals**

**Implementation:**
```typescript
import { getCLS, getFID, getFCP, getLCP, getTTFB } from 'web-vitals';

class PerformanceMonitor {
  private metrics = new Map<string, number>();
  
  constructor() {
    this.initWebVitals();
    this.initGameMetrics();
  }
  
  private initWebVitals() {
    getCLS(metric => this.metrics.set('CLS', metric.value));
    getFID(metric => this.metrics.set('FID', metric.value));
    getFCP(metric => this.metrics.set('FCP', metric.value));
    getLCP(metric => this.metrics.set('LCP', metric.value));
    getTTFB(metric => this.metrics.set('TTFB', metric.value));
  }
  
  private initGameMetrics() {
    setInterval(() => {
      this.metrics.set('FPS', this.calculateFPS());
      this.metrics.set('Memory', performance.memory?.usedJSHeapSize || 0);
      this.metrics.set('DrawCalls', this.renderer.info.render.calls);
    }, 1000);
  }
}
```

## Complete Package.json

```json
{
  "name": "open-runner",
  "version": "2.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest --coverage",
    "lint": "eslint src --ext ts,tsx --report-unused-disable-directives --max-warnings 0",
    "lint:fix": "eslint src --ext ts,tsx --fix",
    "format": "prettier --write src/**/*.{ts,tsx,css,md}"
  },
  "dependencies": {
    "three": "^0.179.1",
    "zustand": "^4.4.7",
    "web-vitals": "^3.5.0"
  },
  "devDependencies": {
    "@types/three": "^0.179.0",
    "@typescript-eslint/eslint-plugin": "^6.14.0",
    "@typescript-eslint/parser": "^6.14.0",
    "@vitejs/plugin-react": "^4.2.1",
    "@vitest/ui": "^1.0.4",
    "c8": "^8.0.1",
    "eslint": "^8.55.0",
    "jsdom": "^23.0.1",
    "prettier": "^3.1.0",
    "typescript": "^5.3.3",
    "vite": "^5.0.8",
    "vite-plugin-compression": "^0.5.1",
    "vite-plugin-pwa": "^0.17.4",
    "vitest": "^1.0.4"
  }
}
```

## Project Structure

```
src/
├── core/                    # Core game systems
│   ├── Game.ts             # Main game class
│   ├── EntityManager.ts    # ECS entity management
│   ├── SystemManager.ts    # ECS system coordination
│   └── AssetManager.ts     # Asset loading and caching
├── systems/                # ECS Systems
│   ├── RenderSystem.ts     # Rendering pipeline
│   ├── PhysicsSystem.ts    # Physics simulation
│   ├── InputSystem.ts      # Input handling
│   ├── ChunkSystem.ts      # World generation
│   └── CollisionSystem.ts  # Collision detection
├── components/             # ECS Components
│   ├── TransformComponent.ts
│   ├── MeshComponent.ts
│   ├── ColliderComponent.ts
│   ├── VelocityComponent.ts
│   └── HealthComponent.ts
├── entities/               # Entity factories
│   ├── PlayerEntity.ts
│   ├── EnemyEntity.ts
│   └── TerrainEntity.ts
├── rendering/              # Rendering subsystem
│   ├── WebGPURenderer.ts   # WebGPU implementation
│   ├── WebGLRenderer.ts    # WebGL fallback
│   ├── MaterialSystem.ts   # Material management
│   └── LightingSystem.ts   # Dynamic lighting
├── physics/                # Physics subsystem
│   ├── CollisionDetection.ts
│   ├── SpatialGrid.ts
│   └── RigidBody.ts
├── audio/                  # Audio subsystem
│   ├── AudioManager.ts
│   ├── SpatialAudio.ts
│   └── AudioPool.ts
├── mobile/                 # Mobile-specific code
│   ├── TouchControls.ts
│   ├── PerformanceAdapter.ts
│   ├── BatteryManager.ts
│   └── PWAManager.ts
├── utils/                  # Utilities
│   ├── MathUtils.ts
│   ├── PerformanceMonitor.ts
│   ├── DeviceDetection.ts
│   └── Logger.ts
├── store/                  # State management
│   ├── gameStore.ts        # Main game state
│   ├── settingsStore.ts    # User preferences
│   └── leaderboardStore.ts # Score tracking
└── types/                  # TypeScript definitions
    ├── GameTypes.ts
    ├── ComponentTypes.ts
    └── SystemTypes.ts

public/
├── assets/
│   ├── models/            # 3D models (optimized GLTF/GLB)
│   ├── textures/          # Compressed textures (ASTC/ETC2)
│   ├── audio/             # Compressed audio (OGG/AAC)
│   └── fonts/             # Web fonts
├── manifest.json          # PWA manifest
└── sw.js                  # Service worker

tests/
├── unit/                  # Unit tests
├── integration/           # Integration tests
├── performance/           # Performance benchmarks
└── setup.ts              # Test configuration
```

## Configuration Files

### TypeScript Configuration
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable", "WebWorker"],
    "allowJs": false,
    "skipLibCheck": true,
    "esModuleInterop": false,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "declaration": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### ESLint Configuration
```json
{
  "extends": [
    "@typescript-eslint/recommended",
    "prettier"
  ],
  "parser": "@typescript-eslint/parser",
  "rules": {
    "@typescript-eslint/no-unused-vars": "error",
    "@typescript-eslint/no-explicit-any": "warn",
    "prefer-const": "error",
    "no-var": "error"
  }
}
```

## Performance Optimization Strategy

### Bundle Size Optimization
- **Tree shaking**: Import only used Three.js modules
- **Code splitting**: Lazy load non-critical systems
- **Asset optimization**: Compressed textures, optimized models
- **Target**: <2MB initial bundle, <5MB total

### Runtime Optimization
- **WebGPU**: 2-3x rendering performance improvement
- **Object pooling**: Reduce garbage collection
- **Spatial optimization**: Frustum culling, LOD system
- **Memory management**: Automatic disposal patterns

### Mobile Optimization
- **Adaptive quality**: Device-based settings
- **Battery management**: Performance throttling
- **Touch optimization**: Low-latency input handling
- **PWA features**: Offline capability, install prompt

## Migration Plan

### Phase 1: Foundation (Week 1-2)
1. Set up Vite + TypeScript build system
2. Convert core Game class to TypeScript
3. Implement basic ECS architecture
4. Set up testing framework

### Phase 2: Systems (Week 3-4)
1. Implement ECS systems (Render, Physics, Input)
2. Convert managers to TypeScript components
3. Add state management with Zustand
4. Implement WebGPU renderer

### Phase 3: Optimization (Week 5-6)
1. Add performance monitoring
2. Implement mobile optimizations
3. Add PWA features
4. Optimize asset pipeline

### Phase 4: Deployment (Week 7)
1. Set up GitHub Actions CI/CD
2. Configure GitHub Pages deployment
3. Add performance benchmarks
4. Final testing and optimization

## Success Metrics

### Technical KPIs
- **Bundle Size**: <2MB initial, <5MB total
- **Performance**: 60fps on mid-range mobile devices
- **Memory**: <200MB peak usage
- **Load Time**: <3s on 4G connection

### Development KPIs
- **Type Safety**: 100% TypeScript coverage
- **Test Coverage**: >80% unit test coverage
- **Build Time**: <30s production build
- **Deploy Time**: <5min from commit to live

## Conclusion

This technology stack provides the optimal foundation for Open Runner's 2025 rewrite, balancing performance, developer experience, and maintainability. The selection emphasizes:

1. **Modern tooling** for excellent developer experience
2. **Performance-first** approach for mobile gaming
3. **GitHub Pages compatibility** for easy deployment
4. **Long-term maintainability** with TypeScript and testing
5. **Progressive enhancement** with PWA features

The recommended stack will deliver 2-3x performance improvements while establishing a solid foundation for future development.