/**
 * Button Component Unit Tests
 * Comprehensive test suite for the modern button component
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Button } from '@/components/ui/base/Button';

describe('Button Component', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  describe('Basic Functionality', () => {
    it('should create a button with text', () => {
      const button = new Button({
        text: 'Test Button',
        parent: container
      });

      const element = button.getElement();
      expect(element.tagName).toBe('BUTTON');
      expect(element.textContent).toContain('Test Button');
      expect(element.parentElement).toBe(container);
    });

    it('should handle click events', () => {
      const clickHandler = vi.fn();
      const button = new Button({
        text: 'Click Me',
        onClick: clickHandler,
        parent: container
      });

      button.getElement().click();
      expect(clickHandler).toHaveBeenCalledOnce();
    });

    it('should have proper accessibility attributes', () => {
      const button = new Button({
        text: 'Accessible Button',
        accessibility: {
          label: 'Custom label'
        },
        parent: container
      });

      const element = button.getElement();
      expect(element.getAttribute('role')).toBe('button');
      expect(element.getAttribute('aria-label')).toBe('Custom label');
      expect(element.tabIndex).toBe(0);
    });
  });

  describe('Variants and Sizes', () => {
    it('should apply variant classes correctly', () => {
      const primaryButton = new Button({
        text: 'Primary',
        variant: 'primary',
        parent: container
      });

      const secondaryButton = new Button({
        text: 'Secondary',
        variant: 'secondary',
        parent: container
      });

      expect(primaryButton.getElement().className).toContain('btn-primary');
      expect(secondaryButton.getElement().className).toContain('btn-secondary');
    });

    it('should apply size classes correctly', () => {
      const smallButton = new Button({
        text: 'Small',
        size: 'sm',
        parent: container
      });

      const largeButton = new Button({
        text: 'Large',
        size: 'lg',
        parent: container
      });

      expect(smallButton.getElement().className).toContain('btn-sm');
      expect(largeButton.getElement().className).toContain('btn-lg');
    });

    it('should handle full width option', () => {
      const fullWidthButton = new Button({
        text: 'Full Width',
        fullWidth: true,
        parent: container
      });

      expect(fullWidthButton.getElement().className).toContain('btn-full');
    });
  });

  describe('State Management', () => {
    let button: Button;

    beforeEach(() => {
      button = new Button({
        text: 'State Button',
        onClick: vi.fn(),
        parent: container
      });
    });

    afterEach(() => {
      button.destroy();
    });

    it('should handle disabled state', () => {
      button.setDisabled(true);

      const element = button.getElement();
      expect(element.hasAttribute('disabled')).toBe(true);
      expect(element.getAttribute('aria-disabled')).toBe('true');
      expect(element.getAttribute('tabindex')).toBe('-1');

      // Click should not trigger when disabled
      element.click();
      expect(vi.mocked(button.getState().disabled)).toBe(true);
    });

    it('should handle loading state', () => {
      button.setLoading(true);

      const element = button.getElement();
      expect(element.className).toContain('btn-loading');
      expect(element.getAttribute('aria-busy')).toBe('true');
      expect(element.textContent).toContain('spinner');
    });

    it('should update text dynamically', () => {
      button.setText('Updated Text');
      expect(button.getElement().textContent).toContain('Updated Text');
    });

    it('should update variant dynamically', () => {
      button.setVariant('danger');
      expect(button.getElement().className).toContain('btn-danger');
      expect(button.getElement().className).not.toContain('btn-primary');
    });

    it('should update size dynamically', () => {
      button.setSize('xl');
      expect(button.getElement().className).toContain('btn-xl');
    });
  });

  describe('Icons and Content', () => {
    it('should display icon with text', () => {
      const button = new Button({
        text: 'Icon Button',
        icon: 'star',
        parent: container
      });

      const element = button.getElement();
      expect(element.innerHTML).toContain('icon star');
      expect(element.textContent).toContain('Icon Button');
    });

    it('should create icon-only button', () => {
      const button = new Button({
        icon: 'close',
        size: 'icon',
        parent: container
      });

      const element = button.getElement();
      expect(element.innerHTML).toContain('icon close');
      expect(element.className).toContain('btn-icon');
    });

    it('should update icon dynamically', () => {
      const button = new Button({
        text: 'Button',
        icon: 'star',
        parent: container
      });

      button.setIcon('heart');
      expect(button.getElement().innerHTML).toContain('icon heart');
    });
  });

  describe('Event Handling', () => {
    it('should handle focus and blur events', () => {
      const focusHandler = vi.fn();
      const blurHandler = vi.fn();

      const button = new Button({
        text: 'Focus Button',
        onFocus: focusHandler,
        onBlur: blurHandler,
        parent: container
      });

      const element = button.getElement();
      element.dispatchEvent(new FocusEvent('focus'));
      element.dispatchEvent(new FocusEvent('blur'));

      expect(focusHandler).toHaveBeenCalledOnce();
      expect(blurHandler).toHaveBeenCalledOnce();
    });

    it('should handle keyboard accessibility', () => {
      const clickHandler = vi.fn();
      const button = new Button({
        text: 'Keyboard Button',
        onClick: clickHandler,
        parent: container
      });

      const element = button.getElement();

      // Test Enter key
      const enterEvent = new KeyboardEvent('keydown', { key: 'Enter' });
      element.dispatchEvent(enterEvent);
      expect(clickHandler).toHaveBeenCalledOnce();

      // Test Space key
      const spaceEvent = new KeyboardEvent('keydown', { key: ' ' });
      element.dispatchEvent(spaceEvent);
      expect(clickHandler).toHaveBeenCalledTimes(2);
    });

    it('should not trigger events when disabled', () => {
      const clickHandler = vi.fn();
      const button = new Button({
        text: 'Disabled Button',
        onClick: clickHandler,
        disabled: true,
        parent: container
      });

      button.getElement().click();
      expect(clickHandler).not.toHaveBeenCalled();
    });

    it('should not trigger events when loading', () => {
      const clickHandler = vi.fn();
      const button = new Button({
        text: 'Loading Button',
        onClick: clickHandler,
        loading: true,
        parent: container
      });

      button.getElement().click();
      expect(clickHandler).not.toHaveBeenCalled();
    });
  });

  describe('Touch and Mouse Feedback', () => {
    let button: Button;

    beforeEach(() => {
      button = new Button({
        text: 'Touch Button',
        parent: container
      });
    });

    afterEach(() => {
      button.destroy();
    });

    it('should add active class on touch start', () => {
      const element = button.getElement();
      
      element.dispatchEvent(new TouchEvent('touchstart'));
      expect(element.className).toContain('btn-active');
      
      element.dispatchEvent(new TouchEvent('touchend'));
      expect(element.className).not.toContain('btn-active');
    });

    it('should add active class on mouse down', () => {
      const element = button.getElement();
      
      element.dispatchEvent(new MouseEvent('mousedown'));
      expect(element.className).toContain('btn-active');
      
      element.dispatchEvent(new MouseEvent('mouseup'));
      expect(element.className).not.toContain('btn-active');
    });

    it('should remove active class on mouse leave', () => {
      const element = button.getElement();
      
      element.dispatchEvent(new MouseEvent('mousedown'));
      expect(element.className).toContain('btn-active');
      
      element.dispatchEvent(new MouseEvent('mouseleave'));
      expect(element.className).not.toContain('btn-active');
    });
  });

  describe('Static Factory Methods', () => {
    afterEach(() => {
      // Clean up any buttons created by factory methods
      const buttons = container.querySelectorAll('button');
      buttons.forEach(btn => btn.remove());
    });

    it('should create primary button', () => {
      const clickHandler = vi.fn();
      const button = Button.primary('Primary', clickHandler, { parent: container });
      
      expect(button.getElement().className).toContain('btn-primary');
      expect(button.getElement().textContent).toContain('Primary');
      
      button.getElement().click();
      expect(clickHandler).toHaveBeenCalledOnce();
    });

    it('should create secondary button', () => {
      const clickHandler = vi.fn();
      const button = Button.secondary('Secondary', clickHandler, { parent: container });
      
      expect(button.getElement().className).toContain('btn-secondary');
      expect(button.getElement().textContent).toContain('Secondary');
    });

    it('should create outline button', () => {
      const clickHandler = vi.fn();
      const button = Button.outline('Outline', clickHandler, { parent: container });
      
      expect(button.getElement().className).toContain('btn-outline');
    });

    it('should create icon button', () => {
      const clickHandler = vi.fn();
      const button = Button.icon('star', clickHandler, { parent: container });
      
      expect(button.getElement().className).toContain('btn-icon');
      expect(button.getElement().innerHTML).toContain('icon star');
    });

    it('should create danger button', () => {
      const clickHandler = vi.fn();
      const button = Button.danger('Delete', clickHandler, { parent: container });
      
      expect(button.getElement().className).toContain('btn-danger');
    });

    it('should create success button', () => {
      const clickHandler = vi.fn();
      const button = Button.success('Save', clickHandler, { parent: container });
      
      expect(button.getElement().className).toContain('btn-success');
    });
  });

  describe('Programmatic Interaction', () => {
    let button: Button;
    let clickHandler: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      clickHandler = vi.fn();
      button = new Button({
        text: 'Programmatic Button',
        onClick: clickHandler,
        parent: container
      });
    });

    afterEach(() => {
      button.destroy();
    });

    it('should trigger click programmatically', () => {
      button.click();
      expect(clickHandler).toHaveBeenCalledOnce();
    });

    it('should not trigger click when disabled', () => {
      button.setDisabled(true);
      button.click();
      expect(clickHandler).not.toHaveBeenCalled();
    });

    it('should focus and blur programmatically', () => {
      button.focus();
      expect(document.activeElement).toBe(button.getElement());
      
      button.blur();
      expect(document.activeElement).not.toBe(button.getElement());
    });
  });

  describe('State Inspection', () => {
    let button: Button;

    beforeEach(() => {
      button = new Button({
        text: 'State Button',
        variant: 'primary',
        size: 'lg',
        parent: container
      });
    });

    afterEach(() => {
      button.destroy();
    });

    it('should return current state', () => {
      const state = button.getState();
      
      expect(state.text).toBe('State Button');
      expect(state.variant).toBe('primary');
      expect(state.size).toBe('lg');
      expect(state.disabled).toBe(false);
      expect(state.loading).toBe(false);
    });

    it('should reflect state changes', () => {
      button.setDisabled(true);
      button.setLoading(true);
      
      const state = button.getState();
      expect(state.disabled).toBe(true);
      expect(state.loading).toBe(true);
    });
  });

  describe('Cleanup and Destruction', () => {
    it('should cleanup properly on destroy', () => {
      const button = new Button({
        text: 'Destroy Button',
        parent: container
      });

      const element = button.getElement();
      expect(element.parentElement).toBe(container);

      button.destroy();
      expect(element.parentElement).toBeNull();
      expect(button.isComponentDestroyed()).toBe(true);
    });

    it('should remove event listeners on destroy', () => {
      const clickHandler = vi.fn();
      const button = new Button({
        text: 'Event Button',
        onClick: clickHandler,
        parent: container
      });

      const element = button.getElement();
      button.destroy();

      // Try to trigger events after destruction
      element.click();
      element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));

      expect(clickHandler).not.toHaveBeenCalled();
    });
  });
});