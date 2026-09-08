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
  /**
   * Observe live microphone loudness while capture is running.
   *
   * Emits a smoothed 0..1 presentation value derived from the SAME MediaStream
   * the recorder is already using — no second recording is made, nothing is
   * retained, and no sample ever leaves the device. Returns an unsubscribe.
   *
   * If Web Audio analysis is unavailable this never emits; recording still
   * works, and `levelMonitoringAvailable` says so up front so the UI can fall
   * back to a static live indicator instead of pretending to measure.
   */
  subscribeLevel: (listener: (level: number) => void) => () => void;
  /** False when Web Audio analysis could not be established on this device. */
  levelMonitoringAvailable: boolean;
}

/** RMS of one time-domain frame, as a 0..1 figure. */
function frameLevel(frame: Uint8Array): number {
  let sumSquares = 0;
  for (let i = 0; i < frame.length; i += 1) {
    // Byte time-domain data is centred on 128.
    const deviation = (frame[i] - 128) / 128;
    sumSquares += deviation * deviation;
  }
  return Math.sqrt(sumSquares / frame.length);
}

/**
 * Turn raw RMS into something a person reads as "the microphone hears me".
 *
 * Speech RMS sits low in absolute terms, so a linear meter looks dead. The
 * curve lifts ordinary speech into the visible range without making silence
 * look loud, and the result is clamped so a shout cannot overflow the meter.
 */
function presentationLevel(rms: number): number {
  const lifted = Math.pow(Math.min(rms * 4, 1), 0.6);
  return Math.max(0, Math.min(1, lifted));
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

  // --- live level monitoring -------------------------------------------
  // Analysis is best-effort. A device without Web Audio still records; it just
  // does not get an amplitude-reactive meter.
  const AudioContextCtor: typeof AudioContext | undefined =
    typeof window === 'undefined' ? undefined : (window.AudioContext ?? (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext);

  let audioContext: AudioContext | undefined;
  let analyser: AnalyserNode | undefined;
  let source: MediaStreamAudioSourceNode | undefined;
  let frame: Uint8Array | undefined;

  try {
    if (AudioContextCtor) {
      audioContext = new AudioContextCtor();
      analyser = audioContext.createAnalyser();
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0.6;
      source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
      frame = new Uint8Array(analyser.fftSize);
    }
  } catch {
    // Analysis unavailable; recording is unaffected.
    audioContext = undefined;
    analyser = undefined;
  }

  const levelMonitoringAvailable = Boolean(analyser && frame);
  const listeners = new Set<(level: number) => void>();
  let rafId: number | undefined;
  let smoothed = 0;
  let monitoring = false;

  const sample = () => {
    if (!monitoring || !analyser || !frame) return;
    analyser.getByteTimeDomainData(frame);
    const next = presentationLevel(frameLevel(frame));
    // Rise quickly so speech registers, fall gently so the meter reads as one
    // continuous voice rather than a strobe.
    smoothed = next > smoothed ? smoothed + (next - smoothed) * 0.5 : smoothed + (next - smoothed) * 0.18;
    const rounded = Math.round(smoothed * 1000) / 1000;
    listeners.forEach((listener) => listener(rounded));
    rafId = typeof requestAnimationFrame === 'function' ? requestAnimationFrame(sample) : undefined;
  };

  const stopMonitoring = () => {
    monitoring = false;
    if (rafId !== undefined && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(rafId);
    rafId = undefined;
    listeners.clear();
    try {
      source?.disconnect();
      analyser?.disconnect();
    } catch {
      // Ignore
    }
    try {
      void audioContext?.close();
    } catch {
      // Ignore
    }
    audioContext = undefined;
    analyser = undefined;
    source = undefined;
    frame = undefined;
  };

  const subscribeLevel = (listener: (level: number) => void) => {
    if (!levelMonitoringAvailable) return () => undefined;
    listeners.add(listener);
    if (!monitoring) {
      monitoring = true;
      sample();
    }
    return () => {
      listeners.delete(listener);
    };
  };

  const cleanup = () => {
    stopMonitoring();
    try {
      stream.getTracks().forEach((track) => track.stop());
    } catch {
      // Ignore
    }
  };

  return {
    subscribeLevel,
    levelMonitoringAvailable,
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
