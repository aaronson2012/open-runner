# Modern Scene and UI System for Open Runner

## 🎯 Overview

A complete, modern scene management and UI system built with TypeScript, featuring:

- **Scene Management**: Smooth transitions between game states
- **Touch Controls**: Mobile-optimized with gesture recognition
- **Modern UI**: Responsive components with accessibility
- **PWA Support**: Offline capabilities and app installation
- **Theme System**: Dark/light mode with customization
- **Performance**: Optimized for mobile and desktop

## 🚀 Quick Start

```typescript
import { initializeOpenRunner } from '@/examples/SceneSystemExample';

// Initialize the complete system
const sceneSystem = initializeOpenRunner();
```

## 📋 Features

### Scene Management System
- **SceneManager**: Central scene orchestration
- **BaseScene**: Abstract scene foundation
- **LoadingScene**: Asset loading with progress
- **TitleScene**: Main menu and level selection
- **GameplayScene**: Active game with HUD
- **GameOverScene**: Results and social sharing

### UI Component Library
- **Button**: Touch-optimized with haptic feedback
- **Modal**: Accessible dialogs with focus management
- **ProgressBar**: Animated progress indicators
- **TouchController**: Advanced gesture recognition

### PWA Features
- **ServiceWorker**: Offline caching and updates
- **InstallManager**: App installation prompts
- **OfflineManager**: Background sync and queuing

### Theme & Accessibility
- **ThemeManager**: Dark/light/auto mode switching
- **ResponsiveUtils**: Breakpoint management
- **A11y Features**: ARIA labels, keyboard navigation

## 🎮 Scene Flow

```
Loading → Title → Gameplay → GameOver
    ↑        ↑        ↓         ↓
    └────────┴────────┴─────────┘
```

### Scene Transitions
```typescript
// Fade transition
await sceneManager.transitionTo('gameplay', {
  type: 'fade',
  duration: 500
});

// Slide transition
await sceneManager.transitionTo('title', {
  type: 'slide',
  direction: 'right',
  duration: 600
});
```

## 📱 Touch Controls

The TouchController provides intuitive mobile controls:

### Touch Zones
- **Left Zone**: Steer left (left side of screen)
- **Right Zone**: Steer right (right side of screen)
- **Jump Zone**: Jump action (bottom center)
- **Slide Zone**: Slide action (swipe down)
- **Pause Zone**: Pause game (top right)

### Gesture Recognition
- **Tap**: Quick touch for jump
- **Swipe**: Directional gestures
- **Hold**: Long press actions
- **Multi-touch**: Simultaneous actions

### Haptic Feedback
- Different vibration patterns per action
- Configurable intensity
- Platform detection

## 🎨 UI Components

### Button Usage
```typescript
import { Button } from '@/components/ui/base/Button';

// Create primary button
const playButton = Button.primary('Play Game', () => {
  startGame();
}, {
  size: 'xl',
  fullWidth: true
});

// Icon button
const settingsButton = Button.icon('gear', () => {
  openSettings();
});
```

### Modal Usage
```typescript
import { Modal } from '@/components/ui/base/Modal';

const confirmModal = Modal.confirm(
  'Restart Game',
  'Are you sure you want to restart?',
  () => restartGame(),
  () => console.log('Cancelled')
);

confirmModal.open();
```

### Progress Bar
```typescript
import { ProgressBar } from '@/components/ui/base/ProgressBar';

const loadingBar = new ProgressBar({
  showPercentage: true,
  animated: true,
  onComplete: () => console.log('Loading complete!')
});

loadingBar.setValue(75); // Set to 75%
```

## 🌐 PWA Integration

### Service Worker Setup
```typescript
import { ServiceWorkerManager } from '@/core/pwa/ServiceWorkerManager';

const swManager = ServiceWorkerManager.getInstance({
  enableNotifications: true,
  cacheStrategy: 'staleWhileRevalidate',
  onUpdate: (registration) => {
    showUpdatePrompt();
  }
});
```

### Offline Handling
```typescript
import { OfflineManager } from '@/core/pwa/ServiceWorkerManager';

const offlineManager = OfflineManager.getInstance();

// Queue actions for when online
offlineManager.queueAction('saveScore', {
  score: 12500,
  level: 3
});
```

### App Installation
```typescript
import { InstallManager } from '@/core/pwa/ServiceWorkerManager';

const installManager = InstallManager.getInstance();

if (installManager.canInstall()) {
  await installManager.triggerInstall();
}
```

## 🎨 Theming

### Theme Configuration
```typescript
import { themeManager } from '@/components/ui';

// Set theme mode
themeManager.setThemeMode('dark'); // 'light', 'dark', 'auto'

// Customize primary color
themeManager.setPrimaryHue(240); // Blue theme

// Toggle theme
themeManager.toggleTheme();
```

### CSS Custom Properties
```css
:root {
  --primary-hue: 210;
  --bg-primary: hsl(220, 15%, 8%);
  --text-primary: hsl(210, 20%, 95%);
  --accent-primary: hsl(var(--primary-hue), 100%, 50%);
}

[data-theme="light"] {
  --bg-primary: hsl(210, 20%, 98%);
  --text-primary: hsl(220, 15%, 15%);
}
```

## 📱 Responsive Design

### Breakpoint System
```typescript
import { ResponsiveUtils } from '@/components/ui';

// Check current breakpoint
const breakpoint = ResponsiveUtils.getCurrentBreakpoint();
// 'sm' | 'md' | 'lg' | 'xl'

// Watch for changes
const cleanup = ResponsiveUtils.watchBreakpoint('md', (matches) => {
  console.log('Desktop view:', matches);
});

// Device detection
const isMobile = ResponsiveUtils.isMobile();
const hasTouch = ResponsiveUtils.hasTouchSupport();
```

### Responsive Presets
```typescript
import { setupGameScenesWithPreset } from '@/core/scene';

// Auto-detect optimal preset
const sceneManager = setupGameScenesWithPreset(canvas, uiContainer);

// Or specify preset
const sceneManager = setupGameScenesWithPreset(canvas, uiContainer, 'mobile');
```

## 🧪 Testing

### Unit Tests
```bash
npm run test:unit
```

### Component Testing
```typescript
import { Button } from '@/components/ui/base/Button';

const button = new Button({
  text: 'Test Button',
  onClick: vi.fn()
});

button.getElement().click();
expect(button.getState().disabled).toBe(false);
```

### Scene Testing
```typescript
import { SceneManager } from '@/core/scene/SceneManager';

const sceneManager = new SceneManager(canvas, uiContainer);
await sceneManager.transitionTo('gameplay');

expect(sceneManager.getCurrentScene()?.name).toBe('gameplay');
```

## 🚀 Performance

### Optimization Features
- **Touch Debouncing**: Prevents excessive input events
- **Responsive Images**: Device-appropriate assets
- **CSS-in-JS**: Dynamic styling without style conflicts
- **Lazy Loading**: Components loaded on demand
- **Memory Management**: Automatic cleanup

### Performance Monitoring
```typescript
// Built-in performance tracking
const metrics = useGameStore.getState().performanceMetrics;
console.log(`FPS: ${metrics.fps}, Frame Time: ${metrics.frameTime}ms`);
```

## 🔧 Configuration

### Scene Presets
```typescript
export const ScenePresets = {
  mobile: {
    gameplay: {
      enableTouchControls: true,
      showDebugInfo: false
    }
  },
  desktop: {
    gameplay: {
      enableTouchControls: false,
      showDebugInfo: true
    }
  }
};
```

### Device Detection
```typescript
export function getDevicePreset() {
  const isMobile = /Android|iOS/i.test(navigator.userAgent);
  const isDebug = process.env.NODE_ENV === 'development';
  
  if (isDebug) return 'debug';
  if (isMobile) return 'mobile';
  return 'desktop';
}
```

## 📚 API Reference

### SceneManager
- `registerScene(name, scene)` - Add scene to manager
- `transitionTo(name, options)` - Switch scenes
- `getCurrentScene()` - Get active scene
- `update(deltaTime)` - Update current scene
- `render()` - Render current scene

### TouchController
- `getInputState()` - Current input state
- `setSensitivity(value)` - Adjust touch sensitivity
- `toggleDebugZones()` - Show/hide touch zones
- `reset()` - Clear all input state

### Button
- `setText(text)` - Update button text
- `setDisabled(disabled)` - Enable/disable button
- `setLoading(loading)` - Show/hide loading state
- `click()` - Programmatic click

### ThemeManager
- `setThemeMode(mode)` - Set theme
- `setPrimaryHue(hue)` - Customize colors
- `toggleTheme()` - Switch themes
- `getCurrentTheme()` - Get current theme

## 🎯 Best Practices

### Scene Development
1. Extend `BaseScene` for consistency
2. Implement proper cleanup in `destroyUI()`
3. Use async/await for scene transitions
4. Handle resize events appropriately

### UI Components
1. Use semantic HTML elements
2. Include ARIA attributes for accessibility
3. Implement keyboard navigation
4. Test with screen readers

### Performance
1. Debounce frequent events
2. Use CSS transforms for animations
3. Implement component pooling for lists
4. Monitor memory usage

### Mobile Optimization
1. Use 44px minimum touch targets
2. Implement haptic feedback
3. Handle orientation changes
4. Optimize for battery life

## 🔗 Integration

The scene system integrates seamlessly with:
- **Game Engine**: ECS-based game logic
- **Asset Manager**: Resource loading
- **Audio Manager**: Sound and music
- **Analytics**: Usage tracking
- **Social Features**: Sharing and leaderboards

## 📄 License

MIT License - see LICENSE file for details.

## 🤝 Contributing

1. Follow TypeScript best practices
2. Add unit tests for new components
3. Update documentation
4. Test on multiple devices
5. Follow accessibility guidelines

---

**Open Runner** - Modern web gaming at its finest! 🎮