import type { Component, Vector3, EntityId } from '@/types';

export type AIState = 
  | 'idle'
  | 'patrol'
  | 'investigate'
  | 'chase'
  | 'attack'
  | 'return'
  | 'stunned'
  | 'dead';

export type AIDecision = {
  action: string;
  target?: EntityId | Vector3;
  priority: number;
  timestamp: number;
  duration?: number;
  data?: any;
};

export interface AIComponent extends Component {
  type: 'ai';
  
  // State machine
  currentState: AIState;
  previousState: AIState;
  stateTransitions: Record<AIState, AIState[]>;
  stateEnterTime: number;
  stateDuration: number;
  minStateDuration: number; // Prevent rapid state switching
  
  // Decision making
  currentDecision?: AIDecision;
  decisionHistory: AIDecision[];
  maxDecisionHistory: number;
  
  // Behavioral parameters
  aggressiveness: number; // 0-1, affects attack vs flee decisions
  alertness: number; // 0-1, affects detection ability
  intelligence: number; // 0-1, affects pathfinding and decision quality
  persistence: number; // 0-1, how long to pursue/investigate
  
  // Sensory information
  lastKnownPlayerPosition?: Vector3;
  lastPlayerSightTime: number;
  lastPlayerSoundTime: number;
  suspicionLevel: number; // 0-1, accumulates over time
  
  // Memory system
  memory: {
    importantPositions: Array<{
      position: Vector3;
      type: 'player_last_seen' | 'sound_source' | 'patrol_point' | 'danger';
      timestamp: number;
      importance: number;
    }>;
    playerEncounters: number;
    lastPlayerDirection?: Vector3;
  };
  
  // Reaction times and delays
  reactionTime: number; // Delay before reacting to stimuli
  decisionCooldown: number; // Time between major decisions
  lastDecisionTime: number;
  
  // Group behavior (for pack hunters like coyotes)
  groupBehavior: {
    isLeader: boolean;
    leaderId?: EntityId;
    packMembers: EntityId[];
    coordinationRadius: number;
    shouldCoordinate: boolean;
  };
  
  // Learning and adaptation
  learning: {
    playerPredictability: number; // How predictable the player's movements are
    preferredAttackRange: number; // Learned optimal attack distance
    successfulTactics: string[]; // Tactics that worked against the player
    failedTactics: string[]; // Tactics that failed
  };
  
  // Performance optimization
  thinkingEnabled: boolean;
  thinkingFrequency: number; // How often to run AI logic (Hz)
  lastThinkTime: number;
  lodLevel: number; // Level of detail for AI processing
  
  // Debug information
  debugMode: boolean;
  debugLog: string[];
  debugMaxLogEntries: number;
}

export function createAIComponent(
  options: Partial<AIComponent> = {}
): AIComponent {
  return {
    type: 'ai',
    entityId: 0,
    
    // State machine defaults
    currentState: 'idle',
    previousState: 'idle',
    stateTransitions: getDefaultStateTransitions(),
    stateEnterTime: 0,
    stateDuration: 0,
    minStateDuration: 0.5, // 500ms minimum state duration
    
    // Decision making
    currentDecision: undefined,
    decisionHistory: [],
    maxDecisionHistory: 10,
    
    // Behavioral parameters with some randomization
    aggressiveness: options.aggressiveness ?? (0.3 + Math.random() * 0.4),
    alertness: options.alertness ?? (0.4 + Math.random() * 0.4),
    intelligence: options.intelligence ?? (0.3 + Math.random() * 0.5),
    persistence: options.persistence ?? (0.4 + Math.random() * 0.4),
    
    // Sensory information
    lastKnownPlayerPosition: undefined,
    lastPlayerSightTime: 0,
    lastPlayerSoundTime: 0,
    suspicionLevel: 0,
    
    // Memory system
    memory: {
      importantPositions: [],
      playerEncounters: 0,
      lastPlayerDirection: undefined
    },
    
    // Reaction times
    reactionTime: options.reactionTime ?? (0.2 + Math.random() * 0.8), // 200-1000ms
    decisionCooldown: options.decisionCooldown ?? 1.0,
    lastDecisionTime: 0,
    
    // Group behavior
    groupBehavior: {
      isLeader: false,
      leaderId: undefined,
      packMembers: [],
      coordinationRadius: 50.0,
      shouldCoordinate: options.groupBehavior?.shouldCoordinate ?? false
    },
    
    // Learning
    learning: {
      playerPredictability: 0.5,
      preferredAttackRange: 2.0,
      successfulTactics: [],
      failedTactics: []
    },
    
    // Performance
    thinkingEnabled: true,
    thinkingFrequency: options.thinkingFrequency ?? 10, // 10 Hz default
    lastThinkTime: 0,
    lodLevel: 1,
    
    // Debug
    debugMode: false,
    debugLog: [],
    debugMaxLogEntries: 20
  };
}

function getDefaultStateTransitions(): Record<AIState, AIState[]> {
  return {
    idle: ['patrol', 'investigate', 'chase'],
    patrol: ['idle', 'investigate', 'chase', 'return'],
    investigate: ['idle', 'patrol', 'chase', 'return'],
    chase: ['attack', 'return', 'investigate'],
    attack: ['chase', 'return', 'stunned'],
    return: ['idle', 'patrol', 'chase'],
    stunned: ['idle', 'chase'],
    dead: [] // No transitions from dead
  };
}

// Specialized AI component factories for different enemy types
export function createBearAI(): AIComponent {
  return createAIComponent({
    aggressiveness: 0.8,
    alertness: 0.6,
    intelligence: 0.4,
    persistence: 0.9,
    reactionTime: 0.8, // Slower to react
    thinkingFrequency: 8 // Lower frequency for performance
  });
}

export function createSquirrelAI(): AIComponent {
  return createAIComponent({
    aggressiveness: 0.3,
    alertness: 0.9,
    intelligence: 0.7,
    persistence: 0.3,
    reactionTime: 0.1, // Very quick reactions
    thinkingFrequency: 15 // Higher frequency for agile behavior
  });
}

export function createDeerAI(): AIComponent {
  return createAIComponent({
    aggressiveness: 0.2,
    alertness: 0.8,
    intelligence: 0.5,
    persistence: 0.2,
    reactionTime: 0.3,
    thinkingFrequency: 12
  });
}

export function createCoyoteAI(): AIComponent {
  const ai = createAIComponent({
    aggressiveness: 0.7,
    alertness: 0.7,
    intelligence: 0.8,
    persistence: 0.8,
    reactionTime: 0.4,
    thinkingFrequency: 12
  });
  
  // Coyotes are pack hunters
  ai.groupBehavior.shouldCoordinate = true;
  ai.groupBehavior.coordinationRadius = 75.0;
  
  return ai;
}

export function createRattlesnakeAI(): AIComponent {
  return createAIComponent({
    aggressiveness: 0.9,
    alertness: 0.4, // Limited vision
    intelligence: 0.3,
    persistence: 0.6,
    reactionTime: 0.2, // Quick strike when threatened
    thinkingFrequency: 5 // Very low frequency (mostly stationary)
  });
}

export function createScorpionAI(): AIComponent {
  return createAIComponent({
    aggressiveness: 0.6,
    alertness: 0.5,
    intelligence: 0.4,
    persistence: 0.5,
    reactionTime: 0.5,
    thinkingFrequency: 8
  });
}

// AI Factory function that matches enemy types
export function createAIForEnemyType(enemyType: string): AIComponent {
  switch (enemyType) {
    case 'bear': return createBearAI();
    case 'squirrel': return createSquirrelAI();
    case 'deer': return createDeerAI();
    case 'coyote': return createCoyoteAI();
    case 'rattlesnake': return createRattlesnakeAI();
    case 'scorpion': return createScorpionAI();
    default: return createAIComponent();
  }
}

// Utility functions for AI state management
export function canTransitionTo(ai: AIComponent, newState: AIState): boolean {
  return ai.stateTransitions[ai.currentState]?.includes(newState) ?? false;
}

export function addMemoryPosition(
  ai: AIComponent, 
  position: Vector3, 
  type: AIComponent['memory']['importantPositions'][0]['type'],
  importance: number = 1.0
): void {
  const memory = ai.memory;
  
  // Remove old memories of the same type if we're at capacity
  if (memory.importantPositions.length >= 10) {
    const oldestIndex = memory.importantPositions
      .map((pos, index) => ({ index, timestamp: pos.timestamp }))
      .sort((a, b) => a.timestamp - b.timestamp)[0].index;
    memory.importantPositions.splice(oldestIndex, 1);
  }
  
  memory.importantPositions.push({
    position: { ...position },
    type,
    timestamp: Date.now(),
    importance
  });
}

export function makeDecision(
  ai: AIComponent,
  action: string,
  priority: number,
  target?: EntityId | Vector3,
  duration?: number,
  data?: any
): void {
  const decision: AIDecision = {
    action,
    target,
    priority,
    timestamp: Date.now(),
    duration,
    data
  };
  
  ai.currentDecision = decision;
  ai.decisionHistory.push(decision);
  
  // Maintain history size
  if (ai.decisionHistory.length > ai.maxDecisionHistory) {
    ai.decisionHistory.shift();
  }
  
  ai.lastDecisionTime = Date.now() / 1000;
  
  if (ai.debugMode) {
    addDebugLog(ai, `Decision: ${action} (priority: ${priority})`);
  }
}

export function addDebugLog(ai: AIComponent, message: string): void {
  if (!ai.debugMode) return;
  
  const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
  ai.debugLog.push(`[${timestamp}] ${message}`);
  
  if (ai.debugLog.length > ai.debugMaxLogEntries) {
    ai.debugLog.shift();
  }
}

export function shouldThink(ai: AIComponent, currentTime: number): boolean {
  if (!ai.thinkingEnabled) return false;
  
  const timeSinceLastThink = currentTime - ai.lastThinkTime;
  const thinkInterval = 1.0 / ai.thinkingFrequency;
  
  return timeSinceLastThink >= thinkInterval;
}