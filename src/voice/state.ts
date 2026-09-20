import type { VoiceState } from './types';

/**
 * Deterministic voice state machine for Atlas of One.
 *
 * Rules:
 * 1. Cancel/abort can reset any state back to 'idle'.
 * 2. An error at any stage safely transitions to 'error' (which offers typing fallback).
 * 3. Happy path progresses sequentially:
 *    idle -> requesting-permission -> listening -> transcribing -> idle.
 *
 * This machine describes microphone/transcription lifecycle only. Assistant
 * text-to-speech has been removed (no 'speaking' state), and provider request
 * latency ("thinking") is tracked separately by submission state, not here.
 */

const VALID_TRANSITIONS: Record<VoiceState, readonly VoiceState[]> = {
  idle: ['requesting-permission', 'listening', 'error'],
  'requesting-permission': ['listening', 'idle', 'error'],
  listening: ['transcribing', 'idle', 'error'],
  transcribing: ['idle', 'error'],
  error: ['idle', 'requesting-permission', 'listening']
};

export function canTransition(current: VoiceState, next: VoiceState): boolean {
  if (current === next) return true;
  return VALID_TRANSITIONS[current]?.includes(next) ?? false;
}

export function transitionVoiceState(current: VoiceState, next: VoiceState): VoiceState {
  if (canTransition(current, next)) {
    return next;
  }
  // Safe fallback: if an unexpected transition is attempted, fall back to idle
  return 'idle';
}

export function voiceStateLabel(state: VoiceState): string {
  switch (state) {
    case 'idle':
      return 'Ready';
    case 'requesting-permission':
      return 'Requesting microphone...';
    case 'listening':
      return 'Listening...';
    case 'transcribing':
      return 'Transcribing...';
    case 'error':
      return 'Voice unavailable — type below';
  }
}
