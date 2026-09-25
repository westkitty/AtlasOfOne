import { describe, expect, it } from 'vitest';
import { canTransition, transitionVoiceState, voiceStateLabel } from '../../src/voice/state';
import type { VoiceState } from '../../src/voice/types';

describe('speech-to-text state machine', () => {
  it('follows the dictation happy path', () => {
    let current: VoiceState = 'idle';
    for (const next of ['requesting-permission', 'listening', 'transcribing', 'idle'] as VoiceState[]) {
      expect(canTransition(current, next)).toBe(true);
      current = transitionVoiceState(current, next);
    }
    expect(current).toBe('idle');
  });

  it('allows direct listening when microphone permission is already granted', () => {
    expect(transitionVoiceState('idle', 'listening')).toBe('listening');
  });

  it('allows cancellation to idle from every active state', () => {
    for (const state of ['requesting-permission', 'listening', 'transcribing', 'error'] as VoiceState[]) {
      expect(transitionVoiceState(state, 'idle')).toBe('idle');
    }
  });

  it('allows errors at every microphone stage', () => {
    for (const state of ['idle', 'requesting-permission', 'listening', 'transcribing'] as VoiceState[]) {
      expect(transitionVoiceState(state, 'error')).toBe('error');
    }
  });

  it('does not contain output-speech lifecycle states', () => {
    const states: VoiceState[] = ['idle', 'requesting-permission', 'listening', 'transcribing', 'error'];
    expect(states).not.toContain('speaking');
    expect(states).not.toContain('thinking');
  });

  it('falls back safely on illegal transitions', () => {
    expect(canTransition('requesting-permission', 'transcribing')).toBe(false);
    expect(transitionVoiceState('requesting-permission', 'transcribing')).toBe('idle');
  });

  it('provides player-facing labels without backend jargon', () => {
    for (const state of ['idle', 'requesting-permission', 'listening', 'transcribing', 'error'] as VoiceState[]) {
      const label = voiceStateLabel(state);
      expect(label.length).toBeGreaterThan(3);
      expect(label).not.toMatch(/api|http|schema|token|binding|worker|json/i);
    }
  });
});
