import { initializeOpenRunner } from '@/examples/SceneSystemExample';
import type { GameConfig } from '@/types';

// Initialize the modern scene and UI system
async function initGame() {
  const loadingProgress = document.getElementById('loading-progress');
  
  try {
    // Update loading progress
    if (loadingProgress) loadingProgress.textContent = 'Loading modern scene system...';
    
    // Initialize the complete scene system
    const sceneSystem = initializeOpenRunner();
    
    // Setup global reference for debugging
    if (process.env.NODE_ENV === 'development') {
      (window as any).sceneSystem = sceneSystem;
      (window as any).sceneManager = sceneSystem.getSceneManager();
      console.log('🔧 Debug mode: Access scene system via window.sceneSystem');
    }
    
  } catch (error) {
    console.error('Failed to initialize scene system:', error);
    if (loadingProgress) {
      loadingProgress.textContent = 'Failed to initialize game. Please refresh and try again.';
      loadingProgress.style.color = '#ef4444';
    }
  }
}

function setupEventHandlers(game: Game) {
  // Handle page visibility for performance
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      game.pause();
    } else {
      game.resume();
    }
  });
  
  // Handle window focus/blur
  window.addEventListener('blur', () => game.pause());
  window.addEventListener('focus', () => game.resume());
  
  // Handle page unload
  window.addEventListener('beforeunload', () => {
    game.destroy();
  });
  
  // Handle errors
  window.addEventListener('error', (event) => {
    console.error('Runtime error:', event.error);
  });
  
  window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
  });
}

// Service Worker registration for PWA
async function registerServiceWorker() {
  if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      console.log('Service Worker registered:', registration);
      
      // Handle updates
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New content available, show update prompt
              console.log('New content available! Please refresh.');
            }
          });
        }
      });
    } catch (error) {
      console.error('Service Worker registration failed:', error);
    }
  }
}

// Entry point
async function main() {
  console.log('Open Runner v2.0.0 - Starting...');
  
  // Register service worker first
  await registerServiceWorker();
  
  // Initialize game
  await initGame();
}

// Start when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', main);
} else {
  main();
}