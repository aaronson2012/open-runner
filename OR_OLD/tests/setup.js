// Test setup file for mocking browser APIs and Three.js dependencies
import { vi } from 'vitest';

// Mock HTMLCanvasElement and WebGL context
class MockWebGLRenderingContext {
  constructor() {
    this.drawingBufferWidth = 800;
    this.drawingBufferHeight = 600;
  }
  
  getExtension() { return null; }
  getParameter() { return 'mock'; }
  createShader() { return {}; }
  shaderSource() {}
  compileShader() {}
  createProgram() { return {}; }
  attachShader() {}
  linkProgram() {}
  useProgram() {}
  createBuffer() { return {}; }
  bindBuffer() {}
  bufferData() {}
  getAttribLocation() { return 0; }
  getUniformLocation() { return {}; }
  enableVertexAttribArray() {}
  vertexAttribPointer() {}
  uniform1i() {}
  uniform1f() {}
  uniform3f() {}
  uniformMatrix4fv() {}
  clear() {}
  clearColor() {}
  clearDepth() {}
  enable() {}
  disable() {}
  depthFunc() {}
  viewport() {}
  drawElements() {}
  drawArrays() {}
}

class MockHTMLCanvasElement {
  constructor() {
    this.width = 800;
    this.height = 600;
    this.style = {};
  }
  
  getContext(type) {
    if (type === 'webgl' || type === 'webgl2' || type === 'experimental-webgl') {
      return new MockWebGLRenderingContext();
    }
    return null;
  }
  
  addEventListener() {}
  removeEventListener() {}
  getBoundingClientRect() {
    return { top: 0, left: 0, width: 800, height: 600 };
  }
}

// Mock classList for DOM elements
class MockClassList {
  constructor() {
    this.classes = new Set();
  }
  
  add(...classes) {
    classes.forEach(cls => this.classes.add(cls));
  }
  
  remove(...classes) {
    classes.forEach(cls => this.classes.delete(cls));
  }
  
  contains(className) {
    return this.classes.has(className);
  }
  
  toggle(className) {
    if (this.classes.has(className)) {
      this.classes.delete(className);
      return false;
    } else {
      this.classes.add(className);
      return true;
    }
  }
  
  get length() {
    return this.classes.size;
  }
}

// Mock document.getElementById to return mock canvas
global.document = {
  ...global.document,
  getElementById: vi.fn((id) => {
    if (id === 'gameCanvas') {
      return new MockHTMLCanvasElement();
    }
    return { style: {}, addEventListener: vi.fn(), removeEventListener: vi.fn() };
  }),
  addEventListener: vi.fn(),
  body: { 
    appendChild: vi.fn(),
    classList: new MockClassList(),
    className: ''
  },
  createElement: vi.fn(() => new MockHTMLCanvasElement())
};

// Mock window.requestAnimationFrame
global.requestAnimationFrame = vi.fn((cb) => setTimeout(cb, 16));
global.cancelAnimationFrame = vi.fn();

// Mock window.performance
global.performance = {
  now: vi.fn(() => Date.now())
};

// Mock navigator for device detection
global.navigator = {
  ...global.navigator,
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  platform: 'Win32'
};

// Mock localStorage
const mockStorage = {
  data: {},
  getItem: vi.fn((key) => mockStorage.data[key] || null),
  setItem: vi.fn((key, value) => { mockStorage.data[key] = value; }),
  removeItem: vi.fn((key) => { delete mockStorage.data[key]; }),
  clear: vi.fn(() => { mockStorage.data = {}; })
};

global.localStorage = mockStorage;

// Mock console methods for cleaner test output
console.log = vi.fn();
console.warn = vi.fn();
console.error = vi.fn();

// Mock audio context for any sound-related features
global.AudioContext = vi.fn(() => ({
  createOscillator: vi.fn(),
  createGain: vi.fn(),
  destination: {}
}));

// Mock web APIs that might be used
global.fetch = vi.fn();
global.URL = {
  createObjectURL: vi.fn(),
  revokeObjectURL: vi.fn()
};