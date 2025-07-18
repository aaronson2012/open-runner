import { describe, it, expect, beforeEach, vi } from 'vitest';

// Create mock implementations of the device utility functions
const createDeviceUtils = () => {
  let lastMobileDetectionResult;
  
  const isMobileDevice = () => {
    const mobileRegex = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;
    const isMobileByUserAgent = mobileRegex.test(navigator.userAgent);
    
    const hasTouchScreen = (
      ('ontouchstart' in window) ||
      (navigator.maxTouchPoints > 0) ||
      (navigator.msMaxTouchPoints > 0)
    );
    
    const isMobileByScreenSize = window.matchMedia && window.matchMedia('(max-width: 768px)').matches;
    
    const result = isMobileByUserAgent || (isMobileByScreenSize && hasTouchScreen);
    
    if (!lastMobileDetectionResult || lastMobileDetectionResult !== result) {
      lastMobileDetectionResult = result;
    }
    
    return result;
  };

  const setDeviceClass = () => {
    const isMobile = isMobileDevice();
    
    document.body.classList.remove('mobile-device', 'desktop-device');
    
    if (isMobile) {
      document.body.classList.add('mobile-device');
    } else {
      document.body.classList.add('desktop-device');
    }
  };

  const updateMobileControlsVisibility = (forceShow = false, forceHide = false) => {
    setDeviceClass();
    
    if (forceHide) {
      document.body.classList.remove('show-mobile-controls');
      document.body.classList.remove('force-show-mobile-controls');
    } else if (forceShow) {
      document.body.classList.add('show-mobile-controls');
      document.body.classList.add('force-show-mobile-controls');
    } else {
      document.body.classList.remove('force-show-mobile-controls');
      if (isMobileDevice()) {
        document.body.classList.add('show-mobile-controls');
      } else {
        document.body.classList.remove('show-mobile-controls');
      }
    }
    
    const mobileControls = document.getElementById('mobileControls');
    if (!mobileControls) {
      console.warn('Mobile controls element not found in the DOM');
      return;
    }
  };

  return { isMobileDevice, setDeviceClass, updateMobileControlsVisibility };
};

const { isMobileDevice, setDeviceClass, updateMobileControlsVisibility } = createDeviceUtils();

describe('deviceUtils', () => {
  beforeEach(() => {
    // Reset global mocks before each test
    vi.clearAllMocks();
    
    // Reset document body classes using the MockClassList
    document.body.classList = new (class {
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
    })();
    
    // Reset window state
    delete window._lastMobileDetectionResult;
    
    // Create a mock mobile controls element
    const mobileControls = document.createElement('div');
    mobileControls.id = 'mobileControls';
    document.getElementById = vi.fn((id) => {
      if (id === 'mobileControls') return mobileControls;
      return null;
    });
  });

  describe('isMobileDevice', () => {
    it('should detect mobile device by user agent', () => {
      // Mock mobile user agent
      Object.defineProperty(navigator, 'userAgent', {
        writable: true,
        value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7 like Mac OS X) AppleWebKit/605.1.15'
      });

      expect(isMobileDevice()).toBe(true);
    });

    it('should detect Android devices', () => {
      Object.defineProperty(navigator, 'userAgent', {
        writable: true,
        value: 'Mozilla/5.0 (Linux; Android 11; SM-G991B) AppleWebKit/537.36'
      });

      expect(isMobileDevice()).toBe(true);
    });

    it('should detect desktop device by user agent', () => {
      Object.defineProperty(navigator, 'userAgent', {
        writable: true,
        value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      });

      // Mock desktop conditions
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation(query => ({
          matches: false, // Desktop screen size
          media: query,
          onchange: null,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        })),
      });

      expect(isMobileDevice()).toBe(false);
    });

    it('should detect device with touch and small screen as mobile', () => {
      // Desktop user agent but mobile conditions
      Object.defineProperty(navigator, 'userAgent', {
        writable: true,
        value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      });

      // Mock small screen
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation(query => ({
          matches: query.includes('max-width: 768px'), // Small screen
          media: query,
        })),
      });

      // Mock touch capability
      Object.defineProperty(navigator, 'maxTouchPoints', {
        writable: true,
        value: 5
      });

      expect(isMobileDevice()).toBe(true);
    });

    it('should not consider touch-only device as mobile if screen is large', () => {
      Object.defineProperty(navigator, 'userAgent', {
        writable: true,
        value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      });

      // Mock large screen
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation(query => ({
          matches: false, // Large screen
          media: query,
        })),
      });

      // Mock touch capability
      Object.defineProperty(navigator, 'maxTouchPoints', {
        writable: true,
        value: 5
      });

      expect(isMobileDevice()).toBe(false);
    });
  });

  describe('setDeviceClass', () => {
    it('should add mobile-device class for mobile devices', () => {
      // Mock as mobile device
      Object.defineProperty(navigator, 'userAgent', {
        writable: true,
        value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7 like Mac OS X)'
      });

      setDeviceClass();

      expect(document.body.classList.contains('mobile-device')).toBe(true);
      expect(document.body.classList.contains('desktop-device')).toBe(false);
    });

    it('should add desktop-device class for desktop devices', () => {
      // Mock as desktop device
      Object.defineProperty(navigator, 'userAgent', {
        writable: true,
        value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      });

      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation(() => ({ matches: false })),
      });

      setDeviceClass();

      expect(document.body.classList.contains('desktop-device')).toBe(true);
      expect(document.body.classList.contains('mobile-device')).toBe(false);
    });

    it('should remove existing device classes before setting new ones', () => {
      // Start with existing classes
      document.body.classList.add('mobile-device', 'desktop-device');

      Object.defineProperty(navigator, 'userAgent', {
        writable: true,
        value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7 like Mac OS X)'
      });

      setDeviceClass();

      // Should only have mobile-device class
      expect(document.body.classList.contains('mobile-device')).toBe(true);
      expect(document.body.classList.contains('desktop-device')).toBe(false);
    });
  });

  describe('updateMobileControlsVisibility', () => {
    it('should show mobile controls on mobile devices', () => {
      Object.defineProperty(navigator, 'userAgent', {
        writable: true,
        value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7 like Mac OS X)'
      });

      updateMobileControlsVisibility();

      expect(document.body.classList.contains('show-mobile-controls')).toBe(true);
      expect(document.body.classList.contains('mobile-device')).toBe(true);
    });

    it('should hide mobile controls on desktop devices', () => {
      Object.defineProperty(navigator, 'userAgent', {
        writable: true,
        value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      });

      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation(() => ({ matches: false })),
      });

      updateMobileControlsVisibility();

      expect(document.body.classList.contains('show-mobile-controls')).toBe(false);
      expect(document.body.classList.contains('desktop-device')).toBe(true);
    });

    it('should force show mobile controls when forceShow is true', () => {
      Object.defineProperty(navigator, 'userAgent', {
        writable: true,
        value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      });

      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation(() => ({ matches: false })),
      });

      updateMobileControlsVisibility(true); // forceShow

      expect(document.body.classList.contains('show-mobile-controls')).toBe(true);
      expect(document.body.classList.contains('force-show-mobile-controls')).toBe(true);
    });

    it('should force hide mobile controls when forceHide is true', () => {
      Object.defineProperty(navigator, 'userAgent', {
        writable: true,
        value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7 like Mac OS X)'
      });

      updateMobileControlsVisibility(false, true); // forceHide

      expect(document.body.classList.contains('show-mobile-controls')).toBe(false);
      expect(document.body.classList.contains('force-show-mobile-controls')).toBe(false);
    });
  });
});