/**
 * Voice domain types for Atlas of One.
 *
 * Campaign truth and progression remain strictly deterministic:
 * voice captures audio, transcribes to text, inspects for local agency commands,
 * and either dispatches local agency actions or passes player answers into the
 * identical Cartographer pipeline. Voice never awards XP, unlocks, or evidence directly.
 */

export type VoiceMode = 'type' | 'talk';

/**
 * Explicit voice lifecycle states.
 * Cancel and fallback to typing are available at every state.
 */
export type VoiceState =
  | 'idle'
  | 'requesting-permission'
  | 'listening'
  | 'transcribing'
  | 'thinking'
  | 'speaking'
  | 'error';

/**
 * Deterministic local agency commands that can be spoken.
 * When matched, these execute client-side state actions immediately
 * and NEVER submit text to the model or award XP.
 */
export type VoiceCommandType =
  | 'pass'
  | 'private'
  | 'stop'
  | 'serious'
  | 'help'
  | 'sass-low'
  | 'sass-medium'
  | 'sass-risks';

export interface ParsedVoiceCommand {
  type: VoiceCommandType;
  raw: string;
}

export type TranscriptionResult =
  | { ok: true; text: string; modelId?: string }
  | { ok: false; code: string; message: string; retryable?: boolean };
