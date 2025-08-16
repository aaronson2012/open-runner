import { vi, beforeEach } from 'vitest';

// Enhanced performance testing setup
declare global {
  interface Window {
    __PERFORMANCE_TEST__: boolean;
  }
}

// Mock performance APIs with enhanced monitoring
const performanceMock = {
  now: vi.fn(() => Date.now()),
  mark: vi.fn((name: string) => {
    performanceEntries.push({
      name,
      entryType: 'mark',
      startTime: Date.now(),
      duration: 0
    });
  }),
  measure: vi.fn((name: string, startMark?: string, endMark?: string) => {
    const entry = {
      name,
      entryType: 'measure',
      startTime: Date.now(),
      duration: Math.random() * 16.67 // Random duration up to 16ms
    };
    performanceEntries.push(entry);
    return entry;
  }),
  getEntriesByType: vi.fn((type: string) => 
    performanceEntries.filter(entry => entry.entryType === type)
  ),
  getEntriesByName: vi.fn((name: string) => 
    performanceEntries.filter(entry => entry.name === name)
  ),
  clearMarks: vi.fn((name?: string) => {
    if (name) {
      performanceEntries = performanceEntries.filter(
        entry => !(entry.entryType === 'mark' && entry.name === name)
      );
    } else {
      performanceEntries = performanceEntries.filter(entry => entry.entryType !== 'mark');
    }
  }),
  clearMeasures: vi.fn((name?: string) => {
    if (name) {
      performanceEntries = performanceEntries.filter(
        entry => !(entry.entryType === 'measure' && entry.name === name)
      );
    } else {
      performanceEntries = performanceEntries.filter(entry => entry.entryType !== 'measure');
    }
  })
};

let performanceEntries: any[] = [];

// Memory usage tracking
const memoryMock = {
  usedJSHeapSize: 1024 * 1024 * 10, // 10MB
  totalJSHeapSize: 1024 * 1024 * 50, // 50MB
  jsHeapSizeLimit: 1024 * 1024 * 100 // 100MB
};

// Enhanced WebGL mock for performance testing
const enhancedWebGLMock = {
  ...global.HTMLCanvasElement.prototype.getContext('webgl'),
  getParameter: vi.fn((param) => {
    switch (param) {
      case 0x8B8C: // MAX_VERTEX_TEXTURE_IMAGE_UNITS
        return 16;
      case 0x8872: // MAX_TEXTURE_SIZE
        return 4096;
      case 0x0D33: // MAX_TEXTURE_SIZE
        return 4096;
      case 0x8073: // MAX_TEXTURE_IMAGE_UNITS
        return 16;
      case 0x8B4D: // MAX_VERTEX_ATTRIBS
        return 16;
      case 0x8DFB: // MAX_COLOR_ATTACHMENTS
        return 8;
      case 0x8824: // MAX_DRAW_BUFFERS
        return 8;
      case 0x8B49: // MAX_VARYING_VECTORS
        return 30;
      case 0x8B4A: // MAX_VERTEX_UNIFORM_VECTORS
        return 256;
      case 0x8B4B: // MAX_FRAGMENT_UNIFORM_VECTORS
        return 256;
      default:
        return null;
    }
  }),
  // Mock GPU timing extensions
  getExtension: vi.fn((name: string) => {
    if (name === 'EXT_disjoint_timer_query') {
      return {
        createQueryEXT: vi.fn(),
        deleteQueryEXT: vi.fn(),
        beginQueryEXT: vi.fn(),
        endQueryEXT: vi.fn(),
        queryCounterEXT: vi.fn(),
        getQueryEXT: vi.fn(),
        getQueryObjectEXT: vi.fn(() => Math.random() * 1000000) // Random nanoseconds
      };
    }
    return null;
  }),
  finish: vi.fn(),
  flush: vi.fn()
};

// Mock RAF with performance tracking
let rafCallbacks: ((time: number) => void)[] = [];
let rafId = 0;
let currentFrameTime = 0;

const mockRAF = vi.fn((callback: (time: number) => void) => {
  const id = ++rafId;
  rafCallbacks.push(callback);
  
  // Simulate frame timing
  setTimeout(() => {
    currentFrameTime += 16.67; // 60fps
    callback(currentFrameTime);
  }, 16);
  
  return id;
});

const mockCancelRAF = vi.fn((id: number) => {
  // Remove callback if exists
});

// Mock Worker for physics threading
class MockWorker {
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  
  constructor(scriptURL: string | URL) {
    // Simulate worker initialization delay
    setTimeout(() => {
      this.postMessage({ type: 'ready' });
    }, 10);
  }
  
  postMessage(message: any): void {
    // Simulate worker processing time
    setTimeout(() => {
      if (this.onmessage) {
        this.onmessage(new MessageEvent('message', { 
          data: { 
            type: 'result', 
            result: message,
            processingTime: Math.random() * 5 // 0-5ms processing time
          } 
        }));
      }
    }, Math.random() * 10);
  }
  
  terminate(): void {
    this.onmessage = null;
    this.onerror = null;
  }
}

// Battery API mock for mobile testing
const batteryMock = {
  level: 0.8,
  charging: false,
  chargingTime: Infinity,
  dischargingTime: 3600, // 1 hour
  addEventListener: vi.fn(),
  removeEventListener: vi.fn()
};

// Device capabilities mock
const deviceCapabilitiesMock = {
  deviceMemory: 4, // GB
  hardwareConcurrency: 4,
  connection: {
    effectiveType: '4g',
    downlink: 10,
    rtt: 100,
    saveData: false
  }
};

// Setup global mocks
beforeEach(() => {
  // Reset performance state
  performanceEntries = [];
  currentFrameTime = 0;
  rafCallbacks = [];
  
  // Setup performance mock
  Object.defineProperty(global, 'performance', {
    value: {
      ...performanceMock,
      memory: memoryMock
    },
    writable: true
  });
  
  // Setup enhanced WebGL mock
  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
    value: vi.fn((type: string) => {
      if (type === 'webgl' || type === 'webgl2') {
        return enhancedWebGLMock;
      }
      return null;
    })
  });
  
  // Setup RAF mock
  global.requestAnimationFrame = mockRAF;
  global.cancelAnimationFrame = mockCancelRAF;
  
  // Setup Worker mock
  global.Worker = MockWorker as any;
  
  // Setup Navigator enhancements
  Object.defineProperty(navigator, 'deviceMemory', {
    value: deviceCapabilitiesMock.deviceMemory,
    writable: true
  });
  
  Object.defineProperty(navigator, 'connection', {
    value: deviceCapabilitiesMock.connection,
    writable: true
  });
  
  // Battery API
  Object.defineProperty(navigator, 'getBattery', {
    value: vi.fn(() => Promise.resolve(batteryMock)),
    writable: true
  });
  
  // Performance testing flag
  window.__PERFORMANCE_TEST__ = true;
  
  // Clear all mocks
  vi.clearAllMocks();
});

// Performance testing utilities
export class PerformanceTestUtils {
  static async measureAsync<T>(
    testName: string,
    fn: () => Promise<T>,
    maxExecutionTime: number = 16.67
  ): Promise<{ result: T; executionTime: number; withinBudget: boolean }> {
    const startTime = performance.now();
    const result = await fn();
    const executionTime = performance.now() - startTime;
    
    return {
      result,
      executionTime,
      withinBudget: executionTime <= maxExecutionTime
    };
  }
  
  static measure<T>(
    testName: string,
    fn: () => T,
    maxExecutionTime: number = 16.67
  ): { result: T; executionTime: number; withinBudget: boolean } {
    const startTime = performance.now();
    const result = fn();
    const executionTime = performance.now() - startTime;
    
    return {
      result,
      executionTime,
      withinBudget: executionTime <= maxExecutionTime
    };
  }
  
  static async stressTest<T>(
    testName: string,
    fn: () => T,
    iterations: number = 1000,
    maxAverageTime: number = 16.67
  ): Promise<{
    results: T[];
    totalTime: number;
    averageTime: number;
    minTime: number;
    maxTime: number;
    withinBudget: boolean;
  }> {
    const results: T[] = [];
    const times: number[] = [];
    
    const startTime = performance.now();
    
    for (let i = 0; i < iterations; i++) {
      const iterationStart = performance.now();
      results.push(fn());
      times.push(performance.now() - iterationStart);
    }
    
    const totalTime = performance.now() - startTime;
    const averageTime = totalTime / iterations;
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);
    
    return {
      results,
      totalTime,
      averageTime,
      minTime,
      maxTime,
      withinBudget: averageTime <= maxAverageTime
    };
  }
  
  static getMemoryUsage() {
    return {
      used: (performance as any).memory?.usedJSHeapSize || 0,
      total: (performance as any).memory?.totalJSHeapSize || 0,
      limit: (performance as any).memory?.jsHeapSizeLimit || 0
    };
  }
  
  static simulateMemoryPressure(targetMB: number = 50) {
    const bytes = targetMB * 1024 * 1024;
    (performance as any).memory.usedJSHeapSize = bytes;
  }
  
  static simulateLowEndDevice() {
    Object.defineProperty(navigator, 'deviceMemory', { value: 1 });
    Object.defineProperty(navigator, 'hardwareConcurrency', { value: 2 });
    batteryMock.level = 0.15; // Low battery
  }
  
  static simulateHighEndDevice() {
    Object.defineProperty(navigator, 'deviceMemory', { value: 8 });
    Object.defineProperty(navigator, 'hardwareConcurrency', { value: 8 });
    batteryMock.level = 0.9; // High battery
  }
  
  static simulateSlowNetwork() {
    if (navigator.connection) {
      (navigator.connection as any).effectiveType = '3g';
      (navigator.connection as any).downlink = 1.5;
      (navigator.connection as any).rtt = 300;
    }
  }
  
  static async waitForFrames(frameCount: number = 1): Promise<void> {
    for (let i = 0; i < frameCount; i++) {
      await new Promise(resolve => requestAnimationFrame(() => resolve(void 0)));
    }
  }
}

// Export for test use
export { performanceMock, memoryMock, enhancedWebGLMock, batteryMock };