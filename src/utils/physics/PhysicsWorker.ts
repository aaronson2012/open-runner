/**
 * Web Worker implementation for physics calculations
 * Offloads heavy physics computations to prevent main thread blocking
 */

export interface PhysicsWorkerMessage {
  id: string;
  type: 'init' | 'update' | 'raycast' | 'collision' | 'terminate';
  data: any;
  timestamp: number;
}

export interface PhysicsWorkerResponse {
  id: string;
  type: 'result' | 'error';
  data: any;
  timestamp: number;
  processingTime: number;
}

export class PhysicsWorkerManager {
  private worker: Worker | null = null;
  private pendingMessages = new Map<string, (response: PhysicsWorkerResponse) => void>();
  private messageId = 0;
  private isSupported = false;
  private isInitialized = false;

  constructor() {
    this.isSupported = typeof Worker !== 'undefined';
    if (this.isSupported) {
      this.initializeWorker();
    }
  }

  private initializeWorker(): void {
    try {
      // Create worker from inline code for better compatibility
      const workerCode = this.generateWorkerCode();
      const blob = new Blob([workerCode], { type: 'application/javascript' });
      const workerUrl = URL.createObjectURL(blob);
      
      this.worker = new Worker(workerUrl);
      this.worker.onmessage = this.handleWorkerMessage.bind(this);
      this.worker.onerror = this.handleWorkerError.bind(this);
      
      // Initialize worker
      this.sendMessage('init', {
        gravity: { x: 0, y: -9.81, z: 0 },
        timeStep: 1/60
      }).then(() => {
        this.isInitialized = true;
        console.log('PhysicsWorker initialized successfully');
      }).catch((error) => {
        console.warn('PhysicsWorker initialization failed:', error);
      });
      
    } catch (error) {
      console.warn('PhysicsWorker not supported:', error);
      this.isSupported = false;
    }
  }

  private generateWorkerCode(): string {
    return `
      // Physics Worker Implementation
      let gravity = { x: 0, y: -9.81, z: 0 };
      let timeStep = 1/60;
      
      // Simple physics integration
      function integratePhysics(entities, deltaTime) {
        const results = [];
        
        for (const entity of entities) {
          if (!entity.physics || entity.physics.isKinematic) {
            results.push(entity);
            continue;
          }
          
          const physics = entity.physics;
          const transform = entity.transform;
          
          // Apply gravity
          if (physics.useGravity && !physics.isGrounded) {
            physics.forces.y += gravity.y * physics.mass;
          }
          
          // Calculate acceleration
          const acceleration = {
            x: physics.forces.x / physics.mass,
            y: physics.forces.y / physics.mass,
            z: physics.forces.z / physics.mass
          };
          
          // Update velocity
          physics.velocity.x += acceleration.x * deltaTime;
          physics.velocity.y += acceleration.y * deltaTime;
          physics.velocity.z += acceleration.z * deltaTime;
          
          // Apply drag
          const dragFactor = Math.pow(1 - physics.drag, deltaTime);
          physics.velocity.x *= dragFactor;
          physics.velocity.y *= dragFactor;
          physics.velocity.z *= dragFactor;
          
          // Update position
          transform.position.x += physics.velocity.x * deltaTime;
          transform.position.y += physics.velocity.y * deltaTime;
          transform.position.z += physics.velocity.z * deltaTime;
          
          // Reset forces
          physics.forces.x = 0;
          physics.forces.y = 0;
          physics.forces.z = 0;
          
          results.push({
            id: entity.id,
            transform: transform,
            physics: physics
          });
        }
        
        return results;
      }
      
      // Simple collision detection
      function detectCollisions(entities) {
        const collisions = [];
        
        for (let i = 0; i < entities.length; i++) {
          for (let j = i + 1; j < entities.length; j++) {
            const entityA = entities[i];
            const entityB = entities[j];
            
            if (!entityA.collider || !entityB.collider) continue;
            
            // Simple sphere-sphere collision
            const dx = entityA.transform.position.x - entityB.transform.position.x;
            const dy = entityA.transform.position.y - entityB.transform.position.y;
            const dz = entityA.transform.position.z - entityB.transform.position.z;
            const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
            
            const radiusA = entityA.collider.radius || 0.5;
            const radiusB = entityB.collider.radius || 0.5;
            const totalRadius = radiusA + radiusB;
            
            if (distance < totalRadius) {
              const penetration = totalRadius - distance;
              const normal = distance > 0 ? {
                x: dx / distance,
                y: dy / distance,
                z: dz / distance
              } : { x: 0, y: 1, z: 0 };
              
              collisions.push({
                entityA: entityA.id,
                entityB: entityB.id,
                normal: normal,
                penetration: penetration,
                point: {
                  x: entityA.transform.position.x - normal.x * radiusA,
                  y: entityA.transform.position.y - normal.y * radiusA,
                  z: entityA.transform.position.z - normal.z * radiusA
                }
              });
            }
          }
        }
        
        return collisions;
      }
      
      // Ray-sphere intersection
      function raycast(origin, direction, maxDistance, entities) {
        let closestHit = null;
        let closestDistance = maxDistance;
        
        for (const entity of entities) {
          if (!entity.collider) continue;
          
          const center = entity.transform.position;
          const radius = entity.collider.radius || 0.5;
          
          // Ray-sphere intersection
          const oc = {
            x: origin.x - center.x,
            y: origin.y - center.y,
            z: origin.z - center.z
          };
          
          const a = direction.x * direction.x + direction.y * direction.y + direction.z * direction.z;
          const b = 2 * (oc.x * direction.x + oc.y * direction.y + oc.z * direction.z);
          const c = oc.x * oc.x + oc.y * oc.y + oc.z * oc.z - radius * radius;
          
          const discriminant = b * b - 4 * a * c;
          
          if (discriminant >= 0) {
            const t = (-b - Math.sqrt(discriminant)) / (2 * a);
            
            if (t >= 0 && t < closestDistance) {
              closestDistance = t;
              closestHit = {
                entity: entity.id,
                distance: t,
                point: {
                  x: origin.x + direction.x * t,
                  y: origin.y + direction.y * t,
                  z: origin.z + direction.z * t
                },
                normal: {
                  x: (origin.x + direction.x * t - center.x) / radius,
                  y: (origin.y + direction.y * t - center.y) / radius,
                  z: (origin.z + direction.z * t - center.z) / radius
                }
              };
            }
          }
        }
        
        return closestHit;
      }
      
      // Message handler
      self.onmessage = function(event) {
        const message = event.data;
        const startTime = performance.now();
        let result = null;
        let error = null;
        
        try {
          switch (message.type) {
            case 'init':
              gravity = message.data.gravity || gravity;
              timeStep = message.data.timeStep || timeStep;
              result = { initialized: true };
              break;
              
            case 'update':
              result = integratePhysics(message.data.entities, message.data.deltaTime);
              break;
              
            case 'collision':
              result = detectCollisions(message.data.entities);
              break;
              
            case 'raycast':
              result = raycast(
                message.data.origin,
                message.data.direction,
                message.data.maxDistance,
                message.data.entities
              );
              break;
              
            case 'terminate':
              self.close();
              return;
              
            default:
              throw new Error('Unknown message type: ' + message.type);
          }
        } catch (e) {
          error = e.message;
        }
        
        const processingTime = performance.now() - startTime;
        
        self.postMessage({
          id: message.id,
          type: error ? 'error' : 'result',
          data: error || result,
          timestamp: performance.now(),
          processingTime: processingTime
        });
      };
    `;
  }

  private handleWorkerMessage(event: MessageEvent): void {
    const response: PhysicsWorkerResponse = event.data;
    const callback = this.pendingMessages.get(response.id);
    
    if (callback) {
      callback(response);
      this.pendingMessages.delete(response.id);
    }
  }

  private handleWorkerError(error: ErrorEvent): void {
    console.error('PhysicsWorker error:', error);
    
    // Reject all pending messages
    for (const [id, callback] of this.pendingMessages) {
      callback({
        id,
        type: 'error',
        data: 'Worker error: ' + error.message,
        timestamp: performance.now(),
        processingTime: 0
      });
    }
    
    this.pendingMessages.clear();
  }

  private sendMessage(type: string, data: any): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.isSupported || !this.worker) {
        reject(new Error('PhysicsWorker not supported'));
        return;
      }
      
      const id = `msg_${this.messageId++}`;
      const message: PhysicsWorkerMessage = {
        id,
        type: type as any,
        data,
        timestamp: performance.now()
      };
      
      this.pendingMessages.set(id, (response) => {
        if (response.type === 'error') {
          reject(new Error(response.data));
        } else {
          resolve(response.data);
        }
      });
      
      this.worker.postMessage(message);
      
      // Timeout after 5 seconds
      setTimeout(() => {
        if (this.pendingMessages.has(id)) {
          this.pendingMessages.delete(id);
          reject(new Error('PhysicsWorker timeout'));
        }
      }, 5000);
    });
  }

  // Public API
  isWorkerSupported(): boolean {
    return this.isSupported && this.isInitialized;
  }

  async updatePhysics(entities: any[], deltaTime: number): Promise<any[]> {
    if (!this.isWorkerSupported()) {
      throw new Error('PhysicsWorker not available');
    }
    
    return this.sendMessage('update', { entities, deltaTime });
  }

  async detectCollisions(entities: any[]): Promise<any[]> {
    if (!this.isWorkerSupported()) {
      throw new Error('PhysicsWorker not available');
    }
    
    return this.sendMessage('collision', { entities });
  }

  async raycast(origin: any, direction: any, maxDistance: number, entities: any[]): Promise<any> {
    if (!this.isWorkerSupported()) {
      throw new Error('PhysicsWorker not available');
    }
    
    return this.sendMessage('raycast', { origin, direction, maxDistance, entities });
  }

  destroy(): void {
    if (this.worker) {
      this.sendMessage('terminate', {}).catch(() => {});
      this.worker.terminate();
      this.worker = null;
    }
    
    this.pendingMessages.clear();
    this.isInitialized = false;
  }

  // Performance statistics
  getPendingMessageCount(): number {
    return this.pendingMessages.size;
  }

  getDebugInfo() {
    return {
      isSupported: this.isSupported,
      isInitialized: this.isInitialized,
      pendingMessages: this.pendingMessages.size,
      messageId: this.messageId
    };
  }
}

export default PhysicsWorkerManager;