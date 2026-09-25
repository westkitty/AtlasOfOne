import type { VoiceState } from './voice/types';

export type FamiliarAttention = 'idle' | 'aware' | 'focused' | 'interrupted' | 'urgent';
export type FamiliarReaction =
  | 'neutral'
  | 'curious'
  | 'startled'
  | 'pleased'
  | 'irritated'
  | 'sleepy'
  | 'dizzy'
  | 'celebrate'
  | 'warning'
  | 'error';
export type FamiliarTrigger = 'pointer' | 'touch' | 'audio' | 'system' | 'agent' | 'timer' | 'world';

export type FamiliarSignal = {
  entityId: string;
  source: string;
  attention: FamiliarAttention;
  reaction?: FamiliarReaction;
  intensity: number;
  trigger: FamiliarTrigger;
  priority?: number;
  durationMs?: number;
  timestamp: number;
  sequence: number;
};

export function familiarForVoiceState(state: VoiceState, now = Date.now()): FamiliarSignal {
  const base = {
    entityId: 'atlas-cartographer',
    source: 'atlas.voice',
    trigger: 'audio' as const,
    timestamp: now,
    sequence: now
  };
  switch (state) {
    case 'requesting-permission':
      return { ...base, attention: 'aware', reaction: 'curious', intensity: 0.35, priority: 20 };
    case 'listening':
      return { ...base, attention: 'focused', reaction: 'curious', intensity: 0.6, priority: 35 };
    case 'transcribing':
      return { ...base, attention: 'focused', reaction: 'neutral', intensity: 0.55, priority: 30 };
    case 'thinking':
      return { ...base, attention: 'focused', reaction: 'neutral', intensity: 0.7, priority: 40 };
    case 'speaking':
      return { ...base, attention: 'aware', reaction: 'pleased', intensity: 0.5, priority: 30 };
    case 'error':
      return { ...base, attention: 'interrupted', reaction: 'error', intensity: 0.85, priority: 70 };
    case 'idle':
    default:
      return { ...base, attention: 'idle', reaction: 'neutral', intensity: 0.15, priority: 5 };
  }
}

export function familiarForPrivacy(privateTopicCount: number, now = Date.now()): FamiliarSignal {
  return {
    entityId: 'atlas-vault',
    source: 'atlas.privacy',
    attention: privateTopicCount > 0 ? 'aware' : 'idle',
    reaction: privateTopicCount > 0 ? 'warning' : 'neutral',
    intensity: privateTopicCount > 0 ? Math.min(0.75, 0.35 + privateTopicCount * 0.08) : 0.1,
    trigger: 'system',
    priority: privateTopicCount > 0 ? 45 : 5,
    timestamp: now,
    sequence: now
  };
}
