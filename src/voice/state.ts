import type { VoiceState } from './types';

/**
 * Deterministic speech-to-text lifecycle.
 *
 * Atlas never owns a spoken-output state. Dictation ends after transcription;
 * provider request state belongs to the ordinary text submission path.
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
  return canTransition(current, next) ? next : 'idle';
}

export function voiceStateLabel(state: VoiceState): string {
  switch (state) {
    case 'idle': return 'Ready to dictate';
    case 'requesting-permission': return 'Requesting microphone...';
    case 'listening': return 'Listening...';
    case 'transcribing': return 'Transcribing...';
    case 'error': return 'Microphone unavailable — type instead';
  }
}
