import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock Three.js Vector3
class MockVector3 {
  constructor(x = 0, y = 0, z = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
  }

  clone() {
    return new MockVector3(this.x, this.y, this.z);
  }

  add(vector) {
    this.x += vector.x;
    this.y += vector.y;
    this.z += vector.z;
    return this;
  }

  multiplyScalar(scalar) {
    this.x *= scalar;
    this.y *= scalar;
    this.z *= scalar;
    return this;
  }

  copy(vector) {
    this.x = vector.x;
    this.y = vector.y;
    this.z = vector.z;
    return this;
  }

  set(x, y, z) {
    this.x = x;
    this.y = y;
    this.z = z;
    return this;
  }

  normalize() {
    const length = Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
    if (length > 0) {
      this.x /= length;
      this.y /= length;
      this.z /= length;
    }
    return this;
  }

  length() {
    return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
  }

  lengthSq() {
    return this.x * this.x + this.y * this.y + this.z * this.z;
  }
}

// Mock logger
const mockLogger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn()
};

// PhysicsComponent implementation for testing
class PhysicsComponent {
  constructor(options = {}) {
    this.name = 'PhysicsComponent';
    this.enabled = options.enabled !== undefined ? options.enabled : true;
    this.gameObject = null;

    const {
      velocity = new MockVector3(),
      acceleration = new MockVector3(),
      mass = 1,
      friction = 0.1,
      restitution = 0.5,
      useGravity = true,
      gravityForce = 9.8,
      isKinematic = false,
      isTrigger = false
    } = options;

    this.velocity = velocity instanceof MockVector3
      ? velocity.clone()
      : new MockVector3(velocity.x || 0, velocity.y || 0, velocity.z || 0);

    this.acceleration = acceleration instanceof MockVector3
      ? acceleration.clone()
      : new MockVector3(acceleration.x || 0, acceleration.y || 0, acceleration.z || 0);

    this.mass = Math.max(0.001, mass);
    this.friction = Math.max(0, Math.min(1, friction));
    this.restitution = Math.max(0, Math.min(1, restitution));
    this.useGravity = useGravity;
    this.gravityForce = gravityForce;
    this.isKinematic = isKinematic;
    this.isTrigger = isTrigger;

    this.forces = [];
    this.lastPosition = new MockVector3();
  }

  addToGameObject(gameObject) {
    this.gameObject = gameObject;
    if (gameObject.model && gameObject.model.position) {
      this.lastPosition.copy(gameObject.model.position);
    }
  }

  removeFromGameObject() {
    this.gameObject = null;
  }

  applyForce(force) {
    if (this.isKinematic || !this.enabled) return;
    
    const adjustedForce = new MockVector3(force.x / this.mass, force.y / this.mass, force.z / this.mass);
    this.forces.push(adjustedForce);
  }

  applyImpulse(impulse) {
    if (this.isKinematic || !this.enabled) return;
    
    this.velocity.add(new MockVector3(impulse.x / this.mass, impulse.y / this.mass, impulse.z / this.mass));
  }

  setVelocity(x, y, z) {
    this.velocity.set(x, y, z);
  }

  getVelocity() {
    return this.velocity.clone();
  }

  update(deltaTime) {
    if (!this.enabled || this.isKinematic || !this.gameObject || !this.gameObject.model) {
      return;
    }

    const position = this.gameObject.model.position;

    // Store last position
    this.lastPosition.copy(position);

    // Apply gravity
    if (this.useGravity) {
      this.acceleration.y -= this.gravityForce * deltaTime;
    }

    // Apply accumulated forces
    for (const force of this.forces) {
      this.acceleration.add(force);
    }
    this.forces.length = 0; // Clear forces

    // Update velocity
    this.velocity.add(new MockVector3(
      this.acceleration.x * deltaTime,
      this.acceleration.y * deltaTime,
      this.acceleration.z * deltaTime
    ));

    // Apply friction
    const frictionMultiplier = Math.pow(1 - this.friction, deltaTime);
    this.velocity.multiplyScalar(frictionMultiplier);

    // Update position
    position.add(new MockVector3(
      this.velocity.x * deltaTime,
      this.velocity.y * deltaTime,
      this.velocity.z * deltaTime
    ));

    // Reset acceleration
    this.acceleration.set(0, 0, 0);
  }

  handleCollision(other, normal, penetration) {
    if (this.isTrigger || !this.enabled) return;

    // Separate objects
    const separation = normal.clone().multiplyScalar(penetration * 0.5);
    this.gameObject.model.position.add(separation);

    // Calculate relative velocity
    const relativeVelocity = this.velocity.clone();
    if (other.velocity) {
      relativeVelocity.x -= other.velocity.x;
      relativeVelocity.y -= other.velocity.y;
      relativeVelocity.z -= other.velocity.z;
    }

    // Calculate collision response
    const velocityAlongNormal = relativeVelocity.x * normal.x + relativeVelocity.y * normal.y + relativeVelocity.z * normal.z;
    
    if (velocityAlongNormal > 0) return; // Objects separating

    const combinedRestitution = Math.min(this.restitution, other.restitution || 0.5);
    const j = -(1 + combinedRestitution) * velocityAlongNormal;
    const impulse = normal.clone().multiplyScalar(j);

    this.velocity.add(impulse);
  }

  reset() {
    this.velocity.set(0, 0, 0);
    this.acceleration.set(0, 0, 0);
    this.forces.length = 0;
  }
}

describe('PhysicsComponent', () => {
  let physicsComponent;
  let mockGameObject;

  beforeEach(() => {
    mockGameObject = {
      model: {
        position: new MockVector3(0, 0, 0)
      }
    };
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with default values', () => {
      physicsComponent = new PhysicsComponent();

      expect(physicsComponent.name).toBe('PhysicsComponent');
      expect(physicsComponent.enabled).toBe(true);
      expect(physicsComponent.mass).toBe(1);
      expect(physicsComponent.friction).toBe(0.1);
      expect(physicsComponent.restitution).toBe(0.5);
      expect(physicsComponent.useGravity).toBe(true);
      expect(physicsComponent.gravityForce).toBe(9.8);
      expect(physicsComponent.isKinematic).toBe(false);
      expect(physicsComponent.isTrigger).toBe(false);
    });

    it('should initialize with custom options', () => {
      const options = {
        velocity: new MockVector3(1, 2, 3),
        acceleration: new MockVector3(0.1, 0.2, 0.3),
        mass: 2,
        friction: 0.5,
        restitution: 0.8,
        useGravity: false,
        gravityForce: 5,
        isKinematic: true,
        isTrigger: true
      };

      physicsComponent = new PhysicsComponent(options);

      expect(physicsComponent.velocity.x).toBe(1);
      expect(physicsComponent.velocity.y).toBe(2);
      expect(physicsComponent.velocity.z).toBe(3);
      expect(physicsComponent.mass).toBe(2);
      expect(physicsComponent.friction).toBe(0.5);
      expect(physicsComponent.restitution).toBe(0.8);
      expect(physicsComponent.useGravity).toBe(false);
      expect(physicsComponent.isKinematic).toBe(true);
      expect(physicsComponent.isTrigger).toBe(true);
    });

    it('should clamp mass to minimum value', () => {
      physicsComponent = new PhysicsComponent({ mass: 0 });
      expect(physicsComponent.mass).toBe(0.001);

      physicsComponent = new PhysicsComponent({ mass: -5 });
      expect(physicsComponent.mass).toBe(0.001);
    });

    it('should clamp friction between 0 and 1', () => {
      physicsComponent = new PhysicsComponent({ friction: -1 });
      expect(physicsComponent.friction).toBe(0);

      physicsComponent = new PhysicsComponent({ friction: 2 });
      expect(physicsComponent.friction).toBe(1);
    });

    it('should clamp restitution between 0 and 1', () => {
      physicsComponent = new PhysicsComponent({ restitution: -1 });
      expect(physicsComponent.restitution).toBe(0);

      physicsComponent = new PhysicsComponent({ restitution: 2 });
      expect(physicsComponent.restitution).toBe(1);
    });
  });

  describe('addToGameObject and removeFromGameObject', () => {
    it('should attach to game object', () => {
      physicsComponent = new PhysicsComponent();
      physicsComponent.addToGameObject(mockGameObject);

      expect(physicsComponent.gameObject).toBe(mockGameObject);
    });

    it('should remove from game object', () => {
      physicsComponent = new PhysicsComponent();
      physicsComponent.addToGameObject(mockGameObject);
      physicsComponent.removeFromGameObject();

      expect(physicsComponent.gameObject).toBeNull();
    });

    it('should copy initial position when attaching', () => {
      mockGameObject.model.position.set(10, 20, 30);
      physicsComponent = new PhysicsComponent();
      physicsComponent.addToGameObject(mockGameObject);

      expect(physicsComponent.lastPosition.x).toBe(10);
      expect(physicsComponent.lastPosition.y).toBe(20);
      expect(physicsComponent.lastPosition.z).toBe(30);
    });
  });

  describe('force and impulse application', () => {
    beforeEach(() => {
      physicsComponent = new PhysicsComponent();
      physicsComponent.addToGameObject(mockGameObject);
    });

    it('should apply force', () => {
      const force = new MockVector3(10, 0, 0);
      physicsComponent.applyForce(force);

      expect(physicsComponent.forces.length).toBe(1);
      expect(physicsComponent.forces[0].x).toBe(10); // force / mass (1)
    });

    it('should scale force by mass', () => {
      physicsComponent.mass = 2;
      const force = new MockVector3(10, 0, 0);
      physicsComponent.applyForce(force);

      expect(physicsComponent.forces[0].x).toBe(5); // 10 / 2
    });

    it('should not apply force when kinematic', () => {
      physicsComponent.isKinematic = true;
      const force = new MockVector3(10, 0, 0);
      physicsComponent.applyForce(force);

      expect(physicsComponent.forces.length).toBe(0);
    });

    it('should not apply force when disabled', () => {
      physicsComponent.enabled = false;
      const force = new MockVector3(10, 0, 0);
      physicsComponent.applyForce(force);

      expect(physicsComponent.forces.length).toBe(0);
    });

    it('should apply impulse to velocity', () => {
      const impulse = new MockVector3(5, 0, 0);
      physicsComponent.applyImpulse(impulse);

      expect(physicsComponent.velocity.x).toBe(5); // impulse / mass (1)
    });

    it('should scale impulse by mass', () => {
      physicsComponent.mass = 2;
      const impulse = new MockVector3(10, 0, 0);
      physicsComponent.applyImpulse(impulse);

      expect(physicsComponent.velocity.x).toBe(5); // 10 / 2
    });
  });

  describe('velocity management', () => {
    beforeEach(() => {
      physicsComponent = new PhysicsComponent();
    });

    it('should set velocity', () => {
      physicsComponent.setVelocity(1, 2, 3);

      expect(physicsComponent.velocity.x).toBe(1);
      expect(physicsComponent.velocity.y).toBe(2);
      expect(physicsComponent.velocity.z).toBe(3);
    });

    it('should get velocity copy', () => {
      physicsComponent.velocity.set(5, 10, 15);
      const velocity = physicsComponent.getVelocity();

      expect(velocity.x).toBe(5);
      expect(velocity.y).toBe(10);
      expect(velocity.z).toBe(15);

      // Should be a copy, not reference
      velocity.x = 100;
      expect(physicsComponent.velocity.x).toBe(5);
    });
  });

  describe('update physics simulation', () => {
    beforeEach(() => {
      physicsComponent = new PhysicsComponent();
      physicsComponent.addToGameObject(mockGameObject);
    });

    it('should not update when disabled', () => {
      physicsComponent.enabled = false;
      const initialPos = mockGameObject.model.position.clone();
      
      physicsComponent.update(0.016);
      
      expect(mockGameObject.model.position.x).toBe(initialPos.x);
      expect(mockGameObject.model.position.y).toBe(initialPos.y);
      expect(mockGameObject.model.position.z).toBe(initialPos.z);
    });

    it('should not update when kinematic', () => {
      physicsComponent.isKinematic = true;
      const initialPos = mockGameObject.model.position.clone();
      
      physicsComponent.update(0.016);
      
      expect(mockGameObject.model.position.x).toBe(initialPos.x);
      expect(mockGameObject.model.position.y).toBe(initialPos.y);
      expect(mockGameObject.model.position.z).toBe(initialPos.z);
    });

    it('should apply gravity', () => {
      physicsComponent.update(0.016);
      
      // Gravity should decrease y velocity
      expect(physicsComponent.velocity.y).toBeLessThan(0);
      // Position should change due to gravity
      expect(mockGameObject.model.position.y).toBeLessThan(0);
    });

    it('should not apply gravity when disabled', () => {
      physicsComponent.useGravity = false;
      physicsComponent.update(0.016);
      
      expect(physicsComponent.velocity.y).toBe(0);
      expect(mockGameObject.model.position.y).toBe(0);
    });

    it('should apply forces and clear them', () => {
      const force = new MockVector3(10, 0, 0);
      physicsComponent.applyForce(force);
      
      physicsComponent.update(0.016);
      
      // Force should affect velocity
      expect(physicsComponent.velocity.x).toBeGreaterThan(0);
      // Forces should be cleared after update
      expect(physicsComponent.forces.length).toBe(0);
      // Acceleration should be reset
      expect(physicsComponent.acceleration.x).toBe(0);
    });

    it('should apply friction', () => {
      physicsComponent.velocity.set(10, 0, 0);
      physicsComponent.friction = 0.5;
      
      physicsComponent.update(0.016);
      
      // Velocity should be reduced by friction
      expect(physicsComponent.velocity.x).toBeLessThan(10);
      expect(physicsComponent.velocity.x).toBeGreaterThan(0);
    });

    it('should update position based on velocity', () => {
      physicsComponent.velocity.set(5, 0, 0);
      physicsComponent.useGravity = false;
      
      physicsComponent.update(0.016);
      
      // Position should change based on velocity * deltaTime
      expect(mockGameObject.model.position.x).toBeGreaterThan(0);
      // Due to friction, the actual value will be slightly less than expected
      expect(mockGameObject.model.position.x).toBeCloseTo(5 * 0.016, 3);
    });
  });

  describe('collision handling', () => {
    beforeEach(() => {
      physicsComponent = new PhysicsComponent();
      physicsComponent.addToGameObject(mockGameObject);
    });

    it('should not handle collision when trigger', () => {
      physicsComponent.isTrigger = true;
      physicsComponent.velocity.set(5, 0, 0);
      
      const other = { velocity: new MockVector3(0, 0, 0), restitution: 0.5 };
      const normal = new MockVector3(1, 0, 0);
      const penetration = 1;
      
      physicsComponent.handleCollision(other, normal, penetration);
      
      // Velocity should remain unchanged
      expect(physicsComponent.velocity.x).toBe(5);
    });

    it('should separate objects on collision', () => {
      const initialPos = mockGameObject.model.position.clone();
      
      const other = { velocity: new MockVector3(0, 0, 0), restitution: 0.5 };
      const normal = new MockVector3(1, 0, 0);
      const penetration = 2;
      
      physicsComponent.handleCollision(other, normal, penetration);
      
      // Position should be moved by half the penetration in normal direction
      expect(mockGameObject.model.position.x).toBe(initialPos.x + 1);
    });

    it('should apply collision response to velocity', () => {
      physicsComponent.velocity.set(-5, 0, 0); // Moving towards collision
      physicsComponent.restitution = 0.8;
      
      const other = { velocity: new MockVector3(0, 0, 0), restitution: 0.6 };
      const normal = new MockVector3(1, 0, 0);
      const penetration = 1;
      
      physicsComponent.handleCollision(other, normal, penetration);
      
      // Velocity should be reversed and reduced by restitution
      expect(physicsComponent.velocity.x).toBeGreaterThan(0);
    });

    it('should not apply collision response when objects are separating', () => {
      physicsComponent.velocity.set(5, 0, 0); // Moving away from collision
      
      const other = { velocity: new MockVector3(0, 0, 0), restitution: 0.5 };
      const normal = new MockVector3(1, 0, 0);
      const penetration = 1;
      
      const initialVelocity = physicsComponent.velocity.clone();
      physicsComponent.handleCollision(other, normal, penetration);
      
      // Velocity should remain the same (objects already separating)
      expect(physicsComponent.velocity.x).toBe(initialVelocity.x);
    });
  });

  describe('reset', () => {
    beforeEach(() => {
      physicsComponent = new PhysicsComponent();
    });

    it('should reset all physics properties', () => {
      physicsComponent.velocity.set(10, 20, 30);
      physicsComponent.acceleration.set(1, 2, 3);
      physicsComponent.applyForce(new MockVector3(5, 0, 0));
      
      physicsComponent.reset();
      
      expect(physicsComponent.velocity.x).toBe(0);
      expect(physicsComponent.velocity.y).toBe(0);
      expect(physicsComponent.velocity.z).toBe(0);
      expect(physicsComponent.acceleration.x).toBe(0);
      expect(physicsComponent.acceleration.y).toBe(0);
      expect(physicsComponent.acceleration.z).toBe(0);
      expect(physicsComponent.forces.length).toBe(0);
    });
  });
});