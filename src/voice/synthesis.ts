import { currentVoice } from './voices';

/**
 * Browser speech synthesis wrapper for Atlas of One.
 *
 * Rules:
 * - Cartographer responses in Voice mode are read aloud when synthesis is supported.
 * - The voice is CHOSEN (see `./voices`), never left to the browser default —
 *   which on macOS is the novelty voice "Albert".
 * - Quiet/serious mode enforces subdued rate and volume.
 * - Immediate cancellation on STOP, mode toggle to Type, navigation, or component unmount.
 */

export function isSpeechSynthesisSupported(): boolean {
  return typeof window !== 'undefined' && typeof window.speechSynthesis !== 'undefined';
}

export function cancelSpeech(): void {
  if (!isSpeechSynthesisSupported()) return;
  try {
    window.speechSynthesis.cancel();
  } catch {
    // Ignore
  }
}

export interface SpeechOptions {
  quiet?: boolean;
  /** Override the resolved voice. Used by the development Voice Lab only. */
  voice?: SpeechSynthesisVoice | null;
  rate?: number;
  volume?: number;
  onEnd?: () => void;
  onError?: (err: unknown) => void;
}

export function speakText(text: string, options: SpeechOptions = {}): { cancel: () => void } {
  if (!isSpeechSynthesisSupported() || !text.trim()) {
    options.onEnd?.();
    return { cancel: () => {} };
  }

  cancelSpeech();

  const utterance = new SpeechSynthesisUtterance(text.trim());

  // Speak as a chosen voice. If the device has none we can identify, the
  // browser default still speaks rather than the player getting silence.
  const voice = options.voice ?? currentVoice();
  if (voice) {
    utterance.voice = voice;
    utterance.lang = voice.lang;
  } else {
    utterance.lang = 'en-US';
  }

  /*
   * Delivery is carried by pace, not by pitch: bending pitch to manufacture a
   * personality is what makes synthetic speech sound like a toy. Quiet mode is
   * slower and softer — the difference between saying something gently and
   * saying it sleepily is small, so the reduction is small too.
   */
  utterance.pitch = 1.0;
  utterance.rate = options.rate ?? (options.quiet ? 0.92 : 1.0);
  utterance.volume = options.volume ?? (options.quiet ? 0.72 : 1.0);

  utterance.onend = () => {
    options.onEnd?.();
  };

  utterance.onerror = (event) => {
    // 'canceled' / 'interrupted' is expected when stopping speech deliberately
    if (event.error === 'canceled' || event.error === 'interrupted') {
      options.onEnd?.();
    } else {
      options.onError?.(event);
    }
  };

  try {
    window.speechSynthesis.speak(utterance);
  } catch (error) {
    options.onError?.(error);
  }

  return {
    cancel: cancelSpeech
  };
}
