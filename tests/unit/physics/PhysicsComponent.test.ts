import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PhysicsComponent } from '@/components/PhysicsComponent';
import type { Vector3 } from '@/types';

describe('PhysicsComponent', () => {
  let physics: PhysicsComponent;
  const entityId = 1;

  beforeEach(() => {
    physics = new PhysicsComponent(entityId);
  });

  describe('initialization', () => {
    it('should initialize with default values', () => {
      expect(physics.entityId).toBe(entityId);
      expect(physics.mass).toBe(1.0);
      expect(physics.friction).toBe(0.5);
      expect(physics.restitution).toBe(0.3);
      expect(physics.isKinematic).toBe(false);
      expect(physics.isTrigger).toBe(false);
      expect(physics.useGravity).toBe(true);
      expect(physics.isAsleep).toBe(false);
    });

    it('should initialize with custom config', () => {
      const customPhysics = new PhysicsComponent(entityId, {
        mass: 2.0,
        friction: 0.8,
        restitution: 0.9,
        isKinematic: true
      });

      expect(customPhysics.mass).toBe(2.0);
      expect(customPhysics.friction).toBe(0.8);
      expect(customPhysics.restitution).toBe(0.9);
      expect(customPhysics.isKinematic).toBe(true);
    });

    it('should clamp values to valid ranges', () => {
      const physics = new PhysicsComponent(entityId, {
        mass: -1, // Should be clamped to minimum
        friction: 2, // Should be clamped to [0,1]
        restitution: -0.5 // Should be clamped to [0,1]
      });

      expect(physics.mass).toBe(0.001); // Minimum mass
      expect(physics.friction).toBe(1.0); // Max friction
      expect(physics.restitution).toBe(0.0); // Min restitution
    });
  });

  describe('force application', () => {
    it('should add forces correctly', () => {
      const force: Vector3 = { x: 10, y: 5, z: -3 };
      physics.addForce(force);

      // Integrate to see force effect
      const gravity = { x: 0, y: -9.81, z: 0 };
      physics.integrate(1/60, gravity);

      expect(physics.velocity.x).toBeCloseTo(10 / 60); // F/m * dt
      expect(physics.velocity.z).toBeCloseTo(-3 / 60);
    });

    it('should apply impulses immediately', () => {
      const impulse: Vector3 = { x: 5, y: 0, z: 0 };
      physics.addForce(impulse, 'impulse');

      const gravity = { x: 0, y: -9.81, z: 0 };
      physics.integrate(1/60, gravity);

      expect(physics.velocity.x).toBeCloseTo(5); // Direct velocity change
    });

    it('should not apply forces to kinematic objects', () => {
      physics.isKinematic = true;
      const force: Vector3 = { x: 100, y: 100, z: 100 };
      physics.addForce(force);

      const gravity = { x: 0, y: -9.81, z: 0 };
      physics.integrate(1/60, gravity);

      expect(physics.velocity.x).toBe(0);
      expect(physics.velocity.y).toBe(0);
      expect(physics.velocity.z).toBe(0);
    });
  });

  describe('physics integration', () => {
    it('should apply gravity when enabled', () => {
      const gravity = { x: 0, y: -9.81, z: 0 };
      physics.integrate(1/60, gravity);

      expect(physics.velocity.y).toBeCloseTo(-9.81 / 60);
    });

    it('should not apply gravity when grounded', () => {
      physics.isGrounded = true;
      const gravity = { x: 0, y: -9.81, z: 0 };
      physics.integrate(1/60, gravity);

      expect(physics.velocity.y).toBe(0);
    });

    it('should not apply gravity when disabled', () => {
      physics.useGravity = false;
      const gravity = { x: 0, y: -9.81, z: 0 };
      physics.integrate(1/60, gravity);

      expect(physics.velocity.y).toBe(0);
    });

    it('should apply drag to velocity', () => {
      physics.setVelocity({ x: 10, y: 0, z: 0 });
      physics.drag = 0.1;

      const gravity = { x: 0, y: 0, z: 0 };
      physics.integrate(1, gravity); // 1 second

      expect(physics.velocity.x).toBeLessThan(10);
      expect(physics.velocity.x).toBeGreaterThan(0);
    });

    it('should apply friction when grounded', () => {
      physics.setVelocity({ x: 10, y: 0, z: 5 });
      physics.isGrounded = true;
      physics.friction = 0.2;

      const gravity = { x: 0, y: 0, z: 0 };
      physics.integrate(1, gravity);

      expect(physics.velocity.x).toBeLessThan(10);
      expect(physics.velocity.z).toBeLessThan(5);
    });
  });

  describe('collision state', () => {
    it('should set collision state correctly', () => {
      const contactPoint = { x: 1, y: 2, z: 3 };
      const normal = { x: 0, y: 1, z: 0 };
      const penetration = 0.5;

      physics.setCollisionState(true, contactPoint, normal, penetration);

      expect(physics.isColliding).toBe(true);
      expect(physics.contactPoints).toHaveLength(1);
      expect(physics.contactPoints[0]).toEqual(contactPoint);
      expect(physics.contactNormals[0]).toEqual(normal);
    });

    it('should clear collision state', () => {
      // Set some collision state first
      physics.setCollisionState(true, { x: 0, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }, 0.1);
      physics.addCollider(2);
      physics.addTrigger(3);

      physics.clearCollisionState();

      expect(physics.isColliding).toBe(false);
      expect(physics.contactPoints).toHaveLength(0);
      expect(physics.contactNormals).toHaveLength(0);
      expect(physics.colliderIds.size).toBe(0);
      expect(physics.triggerIds.size).toBe(0);
    });
  });

  describe('sleep/wake system', () => {
    it('should put object to sleep when inactive', () => {
      physics.setVelocity({ x: 0.001, y: 0.001, z: 0.001 });
      physics.setAngularVelocity({ x: 0.001, y: 0.001, z: 0.001 });

      const gravity = { x: 0, y: 0, z: 0 };
      
      // Simulate 2 seconds of inactivity
      for (let i = 0; i < 120; i++) {
        physics.integrate(1/60, gravity);
      }

      expect(physics.isAsleep).toBe(true);
    });

    it('should wake object when force is applied', () => {
      physics.sleep();
      expect(physics.isAsleep).toBe(true);

      physics.addForce({ x: 10, y: 0, z: 0 });
      expect(physics.isAsleep).toBe(false);
    });

    it('should not integrate when asleep', () => {
      physics.sleep();
      const initialVelocity = { ...physics.velocity };

      const gravity = { x: 0, y: -9.81, z: 0 };
      physics.integrate(1/60, gravity);

      expect(physics.velocity).toEqual(initialVelocity);
    });
  });

  describe('material system', () => {
    it('should set material properties', () => {
      const success = physics.setMaterial('rubber');
      
      expect(success).toBe(true);
      expect(physics.friction).toBe(0.8); // Rubber friction
      expect(physics.restitution).toBe(0.9); // Rubber restitution
    });

    it('should return false for unknown material', () => {
      const success = physics.setMaterial('unknown_material');
      expect(success).toBe(false);
    });

    it('should add custom materials', () => {
      PhysicsComponent.addMaterial({
        name: 'custom',
        friction: 0.3,
        restitution: 0.7,
        density: 1.5
      });

      const success = physics.setMaterial('custom');
      expect(success).toBe(true);
      expect(physics.friction).toBe(0.3);
      expect(physics.restitution).toBe(0.7);
    });
  });

  describe('property setters', () => {
    it('should enforce mass minimum', () => {
      physics.mass = -5;
      expect(physics.mass).toBe(0.001);
    });

    it('should clamp friction to [0,1]', () => {
      physics.friction = 2.0;
      expect(physics.friction).toBe(1.0);
      
      physics.friction = -0.5;
      expect(physics.friction).toBe(0.0);
    });

    it('should clamp restitution to [0,1]', () => {
      physics.restitution = 1.5;
      expect(physics.restitution).toBe(1.0);
      
      physics.restitution = -0.2;
      expect(physics.restitution).toBe(0.0);
    });

    it('should clear forces and velocity when set to kinematic', () => {
      physics.addForce({ x: 10, y: 10, z: 10 });
      physics.setVelocity({ x: 5, y: 5, z: 5 });
      
      physics.isKinematic = true;
      
      expect(physics.velocity).toEqual({ x: 0, y: 0, z: 0 });
    });
  });

  describe('debug information', () => {
    it('should provide comprehensive debug info', () => {
      physics.setVelocity({ x: 1, y: 2, z: 3 });
      physics.setCollisionState(true, { x: 0, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }, 0.1);
      
      const debug = physics.getDebugInfo();
      
      expect(debug.entityId).toBe(entityId);
      expect(debug.mass).toBe(1.0);
      expect(debug.velocity).toEqual({ x: 1, y: 2, z: 3 });
      expect(debug.isColliding).toBe(true);
      expect(debug.material).toBe('default');
    });
  });
});