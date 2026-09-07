/**
 * Browser speech synthesis wrapper for Atlas of One.
 *
 * Rules:
 * - Cartographer responses in Voice mode are read aloud when synthesis is supported.
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
  utterance.lang = 'en-US';

  if (options.quiet) {
    utterance.rate = 0.9;
    utterance.volume = 0.6;
    utterance.pitch = 0.95;
  } else {
    utterance.rate = 1.0;
    utterance.volume = 1.0;
    utterance.pitch = 1.0;
  }

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
