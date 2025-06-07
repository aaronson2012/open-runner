import * as THREE from 'three';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger('PowerupNotificationManager');

class PowerupNotificationManager {
  constructor() {
    this.notifications = [];
    this.camera = null;
    this.container = null;
  }

  init(camera, container) {
    this.camera = camera;
    this.container = container;
  }

  showNotification(text, worldPosition, color = 'white') {
    if (!this.camera || !this.container) {
      logger.warn('PowerupNotificationManager not initialized.');
      return;
    }

    const notificationElement = document.createElement('div');
    notificationElement.className = 'powerup-notification';
    notificationElement.textContent = text;
    notificationElement.style.color = color;
    this.container.appendChild(notificationElement);

    const notification = {
      element: notificationElement,
      worldPosition: worldPosition.clone(),
      startTime: Date.now(),
    };

    this.notifications.push(notification);

    notificationElement.addEventListener('animationend', () => {
      this.container.removeChild(notificationElement);
      this.notifications = this.notifications.filter(n => n !== notification);
    });
  }

  update() {
    if (!this.camera) return;

    this.notifications.forEach(notification => {
      const screenPosition = this.worldToScreen(notification.worldPosition);
      notification.element.style.left = `${screenPosition.x}px`;
      notification.element.style.top = `${screenPosition.y}px`;
    });
  }

  worldToScreen(worldPosition) {
    const vector = worldPosition.clone().project(this.camera);
    const x = (vector.x * 0.5 + 0.5) * this.container.clientWidth;
    const y = (-vector.y * 0.5 + 0.5) * this.container.clientHeight;
    return { x, y };
  }
}

const powerupNotificationManager = new PowerupNotificationManager();
export default powerupNotificationManager;