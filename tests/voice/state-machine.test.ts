import { describe, expect, it } from 'vitest';
import { canTransition, transitionVoiceState, voiceStateLabel } from '../../src/voice/state';
import type { VoiceState } from '../../src/voice/types';

describe('voice state machine', () => {
  it('follows the sequential happy-path progression', () => {
    let current: VoiceState = 'idle';

    expect(canTransition(current, 'requesting-permission')).toBe(true);
    current = transitionVoiceState(current, 'requesting-permission');
    expect(current).toBe('requesting-permission');

    expect(canTransition(current, 'listening')).toBe(true);
    current = transitionVoiceState(current, 'listening');
    expect(current).toBe('listening');

    expect(canTransition(current, 'transcribing')).toBe(true);
    current = transitionVoiceState(current, 'transcribing');
    expect(current).toBe('transcribing');

    expect(canTransition(current, 'thinking')).toBe(true);
    current = transitionVoiceState(current, 'thinking');
    expect(current).toBe('thinking');

    expect(canTransition(current, 'speaking')).toBe(true);
    current = transitionVoiceState(current, 'speaking');
    expect(current).toBe('speaking');

    expect(canTransition(current, 'idle')).toBe(true);
    current = transitionVoiceState(current, 'idle');
    expect(current).toBe('idle');
  });

  it('allows direct transition to listening from idle when permission is pre-granted', () => {
    expect(canTransition('idle', 'listening')).toBe(true);
    expect(transitionVoiceState('idle', 'listening')).toBe('listening');
  });

  it('allows cancellation to idle from any active state', () => {
    const activeStates: VoiceState[] = [
      'requesting-permission',
      'listening',
      'transcribing',
      'thinking',
      'speaking',
      'error'
    ];

    for (const state of activeStates) {
      expect(canTransition(state, 'idle'), `transition from ${state} to idle`).toBe(true);
      expect(transitionVoiceState(state, 'idle')).toBe('idle');
    }
  });

  it('allows transitioning to error from any active state on failure', () => {
    const states: VoiceState[] = [
      'idle',
      'requesting-permission',
      'listening',
      'transcribing',
      'thinking',
      'speaking'
    ];

    for (const state of states) {
      expect(canTransition(state, 'error'), `transition from ${state} to error`).toBe(true);
      expect(transitionVoiceState(state, 'error')).toBe('error');
    }
  });

  it('safely resets illegal transitions to idle', () => {
    // Cannot jump from transcribing directly to speaking without thinking
    expect(canTransition('transcribing', 'speaking')).toBe(false);
    expect(transitionVoiceState('transcribing', 'speaking')).toBe('idle');

    // Cannot jump from requesting-permission directly to thinking
    expect(canTransition('requesting-permission', 'thinking')).toBe(false);
    expect(transitionVoiceState('requesting-permission', 'thinking')).toBe('idle');
  });

  it('provides player-facing labels for every state without backend jargon', () => {
    const allStates: VoiceState[] = [
      'idle',
      'requesting-permission',
      'listening',
      'transcribing',
      'thinking',
      'speaking',
      'error'
    ];

    for (const state of allStates) {
      const label = voiceStateLabel(state);
      expect(label.length).toBeGreaterThan(3);
      expect(label).not.toMatch(/api|http|schema|token|binding|worker|json/i);
    }
  });
});
