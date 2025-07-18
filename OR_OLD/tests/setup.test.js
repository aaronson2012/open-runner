import { describe, it, expect, beforeEach } from 'vitest';

describe('Test Environment Setup', () => {
  it('should have DOM APIs available', () => {
    expect(document).toBeDefined();
    expect(document.getElementById).toBeDefined();
    expect(window).toBeDefined();
  });

  it('should mock canvas element', () => {
    const canvas = document.getElementById('gameCanvas');
    expect(canvas).toBeDefined();
    expect(canvas.getContext).toBeDefined();
    expect(canvas.width).toBe(800);
    expect(canvas.height).toBe(600);
  });

  it('should mock WebGL context', () => {
    const canvas = document.getElementById('gameCanvas');
    const gl = canvas.getContext('webgl');
    expect(gl).toBeDefined();
    expect(gl.drawingBufferWidth).toBe(800);
    expect(gl.drawingBufferHeight).toBe(600);
  });

  it('should mock localStorage', () => {
    localStorage.setItem('test', 'value');
    expect(localStorage.getItem('test')).toBe('value');
    localStorage.removeItem('test');
    expect(localStorage.getItem('test')).toBeNull();
  });

  it('should mock performance.now', () => {
    expect(performance.now).toBeDefined();
    expect(typeof performance.now()).toBe('number');
  });
});