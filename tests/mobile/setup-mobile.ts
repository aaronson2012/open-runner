/**
 * Mobile Testing Setup
 * 
 * Configures the test environment for mobile device simulation,
 * including device capabilities, battery API mocking, and thermal state simulation.
 */

import { beforeAll, beforeEach, afterEach, vi } from 'vitest';

// Mobile device profiles for testing
export const DEVICE_PROFILES = {
  lowEnd: {
    deviceType: 'mobile',
    tier: 'low',
    cpuCores: 2,
    totalMemory: 2,
    gpu: 'Adreno 506',
    screen: { width: 720, height: 1280, pixelRatio: 2 },
    maxFPS: 30,
    targetFPS: 24,
    thermalThrottleTemp: 45,
    batteryCapacity: 3000
  },
  midRange: {
    deviceType: 'mobile', 
    tier: 'medium',
    cpuCores: 4,
    totalMemory: 4,
    gpu: 'Adreno 640',
    screen: { width: 1080, height: 2340, pixelRatio: 3 },
    maxFPS: 60,
    targetFPS: 45,
    thermalThrottleTemp: 50,
    batteryCapacity: 4000
  },
  highEnd: {
    deviceType: 'mobile',
    tier: 'high', 
    cpuCores: 8,
    totalMemory: 8,
    gpu: 'Adreno 730',
    screen: { width: 1440, height: 3120, pixelRatio: 3.5 },
    maxFPS: 90,
    targetFPS: 60,
    thermalThrottleTemp: 55,
    batteryCapacity: 5000
  },
  flagship: {
    deviceType: 'mobile',
    tier: 'flagship',
    cpuCores: 8,
    totalMemory: 12,
    gpu: 'Adreno 750',
    screen: { width: 1440, height: 3200, pixelRatio: 4 },
    maxFPS: 120,
    targetFPS: 90,
    thermalThrottleTemp: 60,
    batteryCapacity: 6000
  }
};

// Current mobile simulation state
let currentProfile = DEVICE_PROFILES.midRange;
let batteryLevel = 1.0; // 100%
let isCharging = false;
let thermalState = 'normal';
let networkType = '4g';

/**
 * Mock mobile device APIs and capabilities
 */
function setupMobileAPIs() {
  // Mock Navigator properties
  Object.defineProperty(navigator, 'userAgent', {
    value: `Mozilla/5.0 (Linux; Android 10; ${currentProfile.tier}) AppleWebKit/537.36`,
    writable: true
  });

  Object.defineProperty(navigator, 'deviceMemory', {
    value: currentProfile.totalMemory,
    writable: true
  });

  Object.defineProperty(navigator, 'hardwareConcurrency', {
    value: currentProfile.cpuCores,
    writable: true
  });

  Object.defineProperty(navigator, 'connection', {
    value: {
      effectiveType: networkType,
      downlink: networkType === '4g' ? 10 : networkType === '3g' ? 1.5 : 0.5,
      rtt: networkType === '4g' ? 50 : networkType === '3g' ? 200 : 500,
      saveData: batteryLevel < 0.2 || thermalState === 'critical'
    },
    writable: true
  });

  // Mock Battery API
  Object.defineProperty(navigator, 'getBattery', {
    value: () => Promise.resolve({
      level: batteryLevel,
      charging: isCharging,
      chargingTime: isCharging ? 3600 : Infinity,
      dischargingTime: !isCharging ? 7200 : Infinity,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    }),
    writable: true
  });

  // Mock screen properties
  Object.defineProperty(screen, 'width', {
    value: currentProfile.screen.width,
    writable: true
  });
  
  Object.defineProperty(screen, 'height', {
    value: currentProfile.screen.height,
    writable: true
  });

  // Mock device pixel ratio
  Object.defineProperty(window, 'devicePixelRatio', {
    value: currentProfile.screen.pixelRatio,
    writable: true
  });

  // Mock WebGL context with mobile limitations
  const mockWebGLContext = {
    getParameter: vi.fn((param) => {
      switch (param) {
        case 0x8B4C: // GL_MAX_VERTEX_UNIFORM_VECTORS
          return currentProfile.tier === 'low' ? 128 : currentProfile.tier === 'medium' ? 256 : 512;
        case 0x8B4D: // GL_MAX_FRAGMENT_UNIFORM_VECTORS
          return currentProfile.tier === 'low' ? 64 : currentProfile.tier === 'medium' ? 128 : 256;
        case 0x8872: // GL_MAX_TEXTURE_SIZE
          return currentProfile.tier === 'low' ? 2048 : currentProfile.tier === 'medium' ? 4096 : 8192;
        case 0x9245: // GL_RENDERER
          return currentProfile.gpu;
        default:
          return null;
      }
    }),
    canvas: {
      width: currentProfile.screen.width,
      height: currentProfile.screen.height
    }
  };

  // Mock canvas getContext to return mobile-limited WebGL
  HTMLCanvasElement.prototype.getContext = vi.fn((type) => {
    if (type === 'webgl' || type === 'webgl2') {
      return mockWebGLContext;
    }
    return null;
  });
}

/**
 * Mock performance API with mobile characteristics
 */
function setupPerformanceAPIs() {
  // Mock performance.now() with mobile timing characteristics
  const originalNow = performance.now;
  performance.now = vi.fn(() => {
    const baseTime = originalNow.call(performance);
    // Add mobile timing variance
    const variance = currentProfile.tier === 'low' ? Math.random() * 2 : Math.random() * 0.5;
    return baseTime + variance;
  });

  // Mock memory info
  Object.defineProperty(performance, 'memory', {
    value: {
      get usedJSHeapSize() {
        const baseUsage = 50 * 1024 * 1024; // 50MB base
        const variableUsage = Math.random() * 100 * 1024 * 1024; // Up to 100MB variable
        return Math.min(baseUsage + variableUsage, currentProfile.totalMemory * 1024 * 1024 * 1024 * 0.8);
      },
      get totalJSHeapSize() {
        return currentProfile.totalMemory * 1024 * 1024 * 1024 * 0.8; // 80% of total memory
      },
      get jsHeapSizeLimit() {
        return currentProfile.totalMemory * 1024 * 1024 * 1024; // Full memory limit
      }
    },
    writable: true
  });
}

/**
 * Mock thermal management APIs
 */
function setupThermalAPIs() {
  let currentTemp = 35; // Starting temperature

  // Mock thermal state monitoring
  Object.defineProperty(navigator, 'thermal', {
    value: {
      get state() {
        if (currentTemp > currentProfile.thermalThrottleTemp + 10) return 'critical';
        if (currentTemp > currentProfile.thermalThrottleTemp + 5) return 'serious';
        if (currentTemp > currentProfile.thermalThrottleTemp) return 'fair';
        return 'normal';
      },
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    },
    writable: true
  });

  // Simulate temperature changes
  global.simulateTemperatureChange = (delta: number) => {
    currentTemp += delta;
    thermalState = navigator.thermal.state;
  };
}

/**
 * Mock touch and orientation APIs
 */
function setupMobileInputAPIs() {
  // Mock touch events
  Object.defineProperty(window, 'TouchEvent', {
    value: class TouchEvent extends Event {
      touches: any[];
      changedTouches: any[];
      targetTouches: any[];
      
      constructor(type: string, options: any = {}) {
        super(type, options);
        this.touches = options.touches || [];
        this.changedTouches = options.changedTouches || [];
        this.targetTouches = options.targetTouches || [];
      }
    },
    writable: true
  });

  // Mock screen orientation
  Object.defineProperty(screen, 'orientation', {
    value: {
      angle: 0,
      type: 'portrait-primary',
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    },
    writable: true
  });

  // Mock device orientation
  Object.defineProperty(window, 'DeviceOrientationEvent', {
    value: class DeviceOrientationEvent extends Event {
      alpha: number;
      beta: number;
      gamma: number;
      
      constructor(type: string, options: any = {}) {
        super(type, options);
        this.alpha = options.alpha || 0;
        this.beta = options.beta || 0;
        this.gamma = options.gamma || 0;
      }
    },
    writable: true
  });
}

/**
 * Utility functions for test setup
 */
export function setMobileProfile(profileName: keyof typeof DEVICE_PROFILES) {
  currentProfile = DEVICE_PROFILES[profileName];
  setupMobileAPIs();
  setupPerformanceAPIs();
}

export function setBatteryLevel(level: number, charging = false) {
  batteryLevel = Math.max(0, Math.min(1, level));
  isCharging = charging;
  setupMobileAPIs();
}

export function setNetworkType(type: '4g' | '3g' | 'slow-2g') {
  networkType = type;
  setupMobileAPIs();
}

export function setThermalState(state: 'normal' | 'fair' | 'serious' | 'critical') {
  thermalState = state;
  const tempMap = {
    normal: currentProfile.thermalThrottleTemp - 5,
    fair: currentProfile.thermalThrottleTemp + 2,
    serious: currentProfile.thermalThrottleTemp + 7,
    critical: currentProfile.thermalThrottleTemp + 12
  };
  
  (global as any).simulateTemperatureChange?.(tempMap[state] - 35);
}

export function getCurrentProfile() {
  return { ...currentProfile };
}

export function getMobileTestUtils() {
  return {
    setMobileProfile,
    setBatteryLevel,
    setNetworkType,
    setThermalState,
    getCurrentProfile,
    batteryLevel: () => batteryLevel,
    isCharging: () => isCharging,
    thermalState: () => thermalState,
    networkType: () => networkType
  };
}

// Setup before all mobile tests
beforeAll(() => {
  console.log('🔧 Setting up mobile test environment...');
  
  // Start with default mid-range profile
  setMobileProfile('midRange');
  setupThermalAPIs();
  setupMobileInputAPIs();
  
  console.log(`📱 Mobile profile: ${currentProfile.tier} (${currentProfile.cpuCores} cores, ${currentProfile.totalMemory}GB RAM)`);
});

// Reset to clean state before each test
beforeEach(() => {
  // Reset to defaults
  setBatteryLevel(0.8, false); // 80% battery
  setNetworkType('4g');
  setThermalState('normal');
  
  // Clear any timers or intervals
  vi.clearAllTimers();
});

// Cleanup after each test
afterEach(() => {
  // Reset any global state
  vi.clearAllMocks();
  vi.restoreAllMocks();
});