import type { ParsedVoiceCommand, VoiceCommandType } from './types';

/**
 * Deterministic local agency voice commands.
 *
 * Spoken agency controls are matched strictly and executed locally.
 * They NEVER submit text to the Cartographer, never generate evidence,
 * and never award XP or progression.
 */

function normalizeText(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[.,/#!$%^&*;:{}=\-_`~()?"“”]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const COMMAND_PATTERNS: Array<{ type: VoiceCommandType; matches: (norm: string) => boolean }> = [
  {
    type: 'pass',
    matches: (norm) => norm === 'pass' || norm === 'skip' || norm === 'next question' || norm === 'skip question' || norm === 'pass question'
  },
  {
    type: 'private',
    matches: (norm) => norm === 'private' || norm === 'mark private' || norm === 'keep this private' || norm === 'dont ask about this' || norm === 'never ask about this'
  },
  {
    type: 'stop',
    matches: (norm) => norm === 'stop' || norm === 'pause' || norm === 'pause session' || norm === 'hold on' || norm === 'quiet'
  },
  {
    type: 'serious',
    matches: (norm) => norm === 'serious' || norm === 'serious mode' || norm === 'quiet mode' || norm === 'be serious' || norm === 'no fanfare'
  },
  {
    type: 'help',
    matches: (norm) => norm === 'help' || norm === 'what do i do' || norm === 'how does this work'
  },
  {
    type: 'sass-low',
    matches: (norm) => norm === 'sass low' || norm === 'low sass' || norm === 'gentle sass'
  },
  {
    type: 'sass-medium',
    matches: (norm) => norm === 'sass medium' || norm === 'medium sass'
  },
  {
    type: 'sass-risks',
    matches: (norm) => norm === 'sass risks' || norm === 'risks understood' || norm === 'high sass' || norm === 'maximum sass' || norm === 'i understand the risks' || norm === 'understand the risks'
  }
];

/**
 * Parses spoken text for exact agency commands.
 * Returns ParsedVoiceCommand if matched, or null if the utterance is a regular answer.
 */
export function parseVoiceCommand(text: string): ParsedVoiceCommand | null {
  const normalized = normalizeText(text);
  if (!normalized) return null;

  for (const entry of COMMAND_PATTERNS) {
    if (entry.matches(normalized)) {
      return { type: entry.type, raw: text };
    }
  }

  return null;
}
