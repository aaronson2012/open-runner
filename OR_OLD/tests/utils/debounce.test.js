import { describe, it, expect, beforeEach, vi } from 'vitest';
import { debounce } from '../../js/utils/debounce.js';

describe('debounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should delay function execution', () => {
    const mockFn = vi.fn();
    const debouncedFn = debounce(mockFn, 100);

    debouncedFn();
    expect(mockFn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(99);
    expect(mockFn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(mockFn).toHaveBeenCalledOnce();
  });

  it('should reset delay on subsequent calls', () => {
    const mockFn = vi.fn();
    const debouncedFn = debounce(mockFn, 100);

    debouncedFn();
    vi.advanceTimersByTime(50);
    
    debouncedFn(); // Should reset the timer
    vi.advanceTimersByTime(50);
    expect(mockFn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(50);
    expect(mockFn).toHaveBeenCalledOnce();
  });

  it('should pass arguments to the debounced function', () => {
    const mockFn = vi.fn();
    const debouncedFn = debounce(mockFn, 100);

    debouncedFn('arg1', 'arg2', 123);
    vi.advanceTimersByTime(100);

    expect(mockFn).toHaveBeenCalledWith('arg1', 'arg2', 123);
  });

  it('should use latest arguments when called multiple times', () => {
    const mockFn = vi.fn();
    const debouncedFn = debounce(mockFn, 100);

    debouncedFn('first');
    debouncedFn('second');
    debouncedFn('final');
    
    vi.advanceTimersByTime(100);
    
    expect(mockFn).toHaveBeenCalledOnce();
    expect(mockFn).toHaveBeenCalledWith('final');
  });

  it('should handle zero delay', () => {
    const mockFn = vi.fn();
    const debouncedFn = debounce(mockFn, 0);

    debouncedFn();
    expect(mockFn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(0);
    expect(mockFn).toHaveBeenCalledOnce();
  });

  it('should handle multiple independent debounced functions', () => {
    const mockFn1 = vi.fn();
    const mockFn2 = vi.fn();
    const debouncedFn1 = debounce(mockFn1, 100);
    const debouncedFn2 = debounce(mockFn2, 200);

    debouncedFn1();
    debouncedFn2();

    vi.advanceTimersByTime(100);
    expect(mockFn1).toHaveBeenCalledOnce();
    expect(mockFn2).not.toHaveBeenCalled();

    vi.advanceTimersByTime(100);
    expect(mockFn2).toHaveBeenCalledOnce();
  });

  it('should preserve this context', () => {
    const obj = {
      value: 42,
      getValue() {
        return this.value;
      }
    };

    const mockCallback = vi.fn(function() {
      return this.getValue();
    });

    const debouncedMethod = debounce(mockCallback.bind(obj), 100);
    
    debouncedMethod();
    vi.advanceTimersByTime(100);

    expect(mockCallback).toHaveBeenCalledOnce();
  });
});