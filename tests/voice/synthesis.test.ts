import { describe, expect, it, vi } from 'vitest';
import { cancelSpeech, isSpeechSynthesisSupported, speakText } from '../../src/voice/synthesis';

describe('speech synthesis wrapper', () => {
  it('detects availability safely in mock/headless environment', () => {
    // In node environment, window or window.speechSynthesis may be undefined
    const supported = isSpeechSynthesisSupported();
    expect(typeof supported).toBe('boolean');
  });

  it('safely handles cancelSpeech when speechSynthesis is absent', () => {
    expect(() => cancelSpeech()).not.toThrow();
  });

  it('calls onEnd immediately when text is empty or synthesis unsupported', () => {
    let ended = false;
    const handle = speakText('   ', { onEnd: () => { ended = true; } });
    expect(ended).toBe(true);
    expect(typeof handle.cancel).toBe('function');
  });

  it('configures quieter rate and volume when quiet is true', () => {
    const speakMock = vi.fn();
    const cancelMock = vi.fn();

    // Stub window.speechSynthesis
    (globalThis as any).window = {
      speechSynthesis: {
        speak: speakMock,
        cancel: cancelMock,
        // No usable voice list here: the wrapper must still speak.
        getVoices: () => []
      }
    };
    (globalThis as any).SpeechSynthesisUtterance = class {
      text: string;
      lang = '';
      rate = 1.0;
      volume = 1.0;
      pitch = 1.0;
      onend: (() => void) | null = null;
      onerror: ((err: any) => void) | null = null;
      constructor(text: string) {
        this.text = text;
      }
    };

    const handle = speakText('Serious response text.', { quiet: true });
    expect(speakMock).toHaveBeenCalledTimes(1);
    const utterance = speakMock.mock.calls[0][0];
    expect(utterance.text).toBe('Serious response text.');
    expect(utterance.rate).toBeLessThan(1.0);
    expect(utterance.volume).toBeLessThan(1.0);

    handle.cancel();
    expect(cancelMock).toHaveBeenCalled();

    // Cleanup globals
    delete (globalThis as any).window;
    delete (globalThis as any).SpeechSynthesisUtterance;
  });
});
