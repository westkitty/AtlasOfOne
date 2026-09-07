/**
 * MediaRecorder audio capture for Atlas of One.
 *
 * Mobile-first invariants:
 * - Requires explicit player action (tap to record).
 * - Never records in the background or autoplays.
 * - Local audio blob is discarded immediately after transcription or abort.
 */

export function isAudioCaptureSupported(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  return Boolean(
    navigator.mediaDevices &&
    typeof navigator.mediaDevices.getUserMedia === 'function' &&
    typeof window.MediaRecorder === 'function'
  );
}

function getPreferredMimeType(): string | undefined {
  if (typeof window === 'undefined' || typeof window.MediaRecorder === 'undefined') return undefined;
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/mp4',
    'audio/wav'
  ];
  for (const candidate of candidates) {
    if (window.MediaRecorder.isTypeSupported(candidate)) {
      return candidate;
    }
  }
  return undefined;
}

export interface ActiveAudioCapture {
  stop: () => Promise<Blob>;
  abort: () => void;
}

export async function startAudioCapture(): Promise<ActiveAudioCapture> {
  if (!isAudioCaptureSupported()) {
    throw new Error('Microphone audio capture is not supported on this device.');
  }

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      channelCount: 1,
      echoCancellation: true,
      noiseSuppression: true
    }
  });

  const mimeType = getPreferredMimeType();
  const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
  const chunks: Blob[] = [];

  recorder.ondataavailable = (event) => {
    if (event.data && event.data.size > 0) {
      chunks.push(event.data);
    }
  };

  recorder.start();

  const cleanup = () => {
    try {
      stream.getTracks().forEach((track) => track.stop());
    } catch {
      // Ignore
    }
  };

  return {
    stop: () =>
      new Promise<Blob>((resolve, reject) => {
        recorder.onstop = () => {
          cleanup();
          const finalType = recorder.mimeType || mimeType || 'audio/webm';
          const blob = new Blob(chunks, { type: finalType });
          chunks.length = 0; // Discard raw chunks from memory
          resolve(blob);
        };
        recorder.onerror = (err) => {
          cleanup();
          chunks.length = 0;
          reject(err);
        };
        try {
          recorder.stop();
        } catch (e) {
          cleanup();
          chunks.length = 0;
          reject(e);
        }
      }),
    abort: () => {
      try {
        if (recorder.state !== 'inactive') recorder.stop();
      } catch {
        // Ignore
      }
      cleanup();
      chunks.length = 0;
    }
  };
}
