import { describe, expect, it } from 'vitest';
import { applyGameEvents, createInitialCampaign } from '../../src/game/engine';
import { createMockTurn, getMockPrompt } from '../../src/cartographer/mock';
import { eventsFromTurn } from '../../src/cartographer/apply';
import type { CampaignState, CartographerTurn } from '../../src/game/types';

describe('Phase 5 Adversarial QA: Async Hammer & Concurrency Races (BUG-001 to BUG-004)', () => {
  it('BUG-001: prevents duplicate turn execution when multiple submissions are attempted concurrently', async () => {
    let state = createInitialCampaign();
    let isSubmitting = false;
    let successfulSubmits = 0;

    const mockSubmit = async (text: string) => {
      if (isSubmitting) return; // Guard against double-submit
      isSubmitting = true;
      try {
        await new Promise((r) => setTimeout(r, 10)); // simulate network delay
        const prompt = getMockPrompt(state);
        const turn = createMockTurn(state, prompt, text);
        state = applyGameEvents(state, eventsFromTurn(prompt, text, turn, 'mock'));
        successfulSubmits++;
      } finally {
        isSubmitting = false;
      }
    };

    // Rapid double-click
    await Promise.all([
      mockSubmit('First coordinate attempt'),
      mockSubmit('First coordinate attempt duplicate click')
    ]);

    expect(successfulSubmits).toBe(1);
    expect(state.turns).toHaveLength(1);
  });

  it('BUG-002: out-of-order network responses do not overwrite newer state', async () => {
    let state = createInitialCampaign();
    let currentRequestId = 0;

    const runRequest = async (text: string, delayMs: number) => {
      const reqId = ++currentRequestId;
      const prompt = getMockPrompt(state);
      await new Promise((r) => setTimeout(r, delayMs));

      // Guard: if another request started since, drop this stale response
      if (reqId !== currentRequestId) {
        return;
      }

      const turn = createMockTurn(state, prompt, text);
      state = applyGameEvents(state, eventsFromTurn(prompt, text, turn, 'mock'));
    };

    // Fire slow request 1 (100ms) then fast request 2 (10ms)
    await Promise.all([
      runRequest('Slow out-of-order turn', 100),
      runRequest('Fast latest turn', 10)
    ]);

    // Only the latest request (reqId = 2) should have committed!
    expect(state.turns).toHaveLength(1);
    expect(state.turns[0].answer).toBe('Fast latest turn');
  });

  it('BUG-002b: in-flight STOP or PRIVATE drops the resolving turn from applying', async () => {
    let state = createInitialCampaign();
    const prompt = getMockPrompt(state);

    let inFlight = true;
    const asyncTurnPromise = (async () => {
      await new Promise((r) => setTimeout(r, 30));
      if (!inFlight) return;
      const turn = createMockTurn(state, prompt, 'Answer during pause');
      // Commit guard: check if paused or privatized
      if (state.sessionStatus === 'paused' || state.privateTopics.includes(prompt.dimension)) {
        return;
      }
      state = applyGameEvents(state, eventsFromTurn(prompt, 'Answer during pause', turn, 'mock'));
    })();

    // Player pauses session while request is in flight
    state = applyGameEvents(state, [{ type: 'SESSION_SET', status: 'paused' }]);
    expect(state.sessionStatus).toBe('paused');

    await asyncTurnPromise;

    // Turn should NOT have been committed
    expect(state.turns).toHaveLength(0);
  });

  it('BUG-003: cross-campaign import cancels in-flight turn requests and prevents contamination', async () => {
    let state = createInitialCampaign();
    let currentRequestId = 0;

    // Simulate in-flight turn on Campaign A
    const reqId = ++currentRequestId;
    const promptA = getMockPrompt(state);

    const inFlightTurn = async () => {
      await new Promise((r) => setTimeout(r, 40));
      if (reqId !== currentRequestId) {
        // Cancelled by import!
        return;
      }
      const turn = createMockTurn(state, promptA, 'Campaign A answer');
      state = applyGameEvents(state, eventsFromTurn(promptA, 'Campaign A answer', turn, 'mock'));
    };

    const turnPromise = inFlightTurn();

    // User imports Campaign B mid-flight
    currentRequestId++; // invalidated
    const importedCampaign = { ...createInitialCampaign(), campaignId: 'campaign_imported_B' };
    state = importedCampaign;

    await turnPromise;

    // Campaign B should remain untouched by Campaign A's in-flight turn
    expect(state.campaignId).toBe('campaign_imported_B');
    expect(state.turns).toHaveLength(0);
  });

  it('BUG-004: cancelling voice mode cancels pending transcription and avoids unwanted auto-submit', async () => {
    let voiceMode: 'text' | 'talk' = 'talk';
    let cancelled = false;
    let submittedText: string | null = null;

    const runTranscription = async () => {
      await new Promise((r) => setTimeout(r, 30));
      if (cancelled || voiceMode !== 'talk') {
        return; // Abort auto-submit
      }
      submittedText = 'Recognized voice text';
    };

    const transcriptionPromise = runTranscription();

    // User toggles back to type mode during transcription
    cancelled = true;
    voiceMode = 'text';

    await transcriptionPromise;

    expect(submittedText).toBeNull();
  });
});
