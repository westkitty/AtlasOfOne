# Atlas v2 Voice Packet Closure — V02 through V08

This packet reconciles the master-plan voice subtasks with the already-merged V01 implementation and current integration evidence.

It changes **no runtime code**.

## Governing v2 voice contract

Voice is input-only:

```text
idle -> requesting-permission -> listening -> transcribing -> idle/error
```

A successful transcription becomes editable text. It does not submit itself. Atlas replies remain visual text. The microphone does not reopen automatically.

## Closure evidence

Primary implementation evidence: `docs/v2/proof/V01.md`.

Original V01 CI: Atlas validation #61:

- 36 unit files / 284 tests passed;
- production/PWA build passed;
- 14 browser files / 130 tests passed;
- STT-only browser file 6/6, including background cancellation;
- source and built client bundle negative scan for TTS runtime/UI markers.

Current integration revalidation: Atlas validation #129 on `b5a6e4b9510330292e3f567a58f36394e6c5d934`:

- 47 unit files / 343 tests passed;
- production/PWA build passed;
- 120 precache entries (592.62 KiB);
- 14 browser files / 130 tests passed;
- `tests/browser/voice-conversation.test.ts`: 6/6 passed.

## Packet mapping

- **V02 — Remove browser speech synthesis:** satisfied by removal of synthesis runtime and current negative source/bundle browser proof.
- **V03 — Remove voice picker/output settings:** satisfied by removal of voice picker, Voice Lab, output voice settings and matching tests.
- **V04 — Remove auto-listen restart dependency:** satisfied; no output-speech lifecycle exists and browser proof confirms no microphone reopen after Atlas text output.
- **V05 — Preserve mic/STT path:** satisfied; capture, visualizer, silence/end controls, transcription and cancellation remain proven.
- **V06 — Editable transcript:** satisfied; transcription is placed into the ordinary text editor, can be edited, and requires explicit submit.
- **V07 — Retire TTS-only tests/docs:** satisfied for canonical/runtime requirements; TTS-only suites were removed and the master plan explicitly records TTS as removed. Historical proof records may still mention TTS as history.
- **V08 — Source/bundle negative proof:** satisfied continuously by `voice-conversation.test.ts` scanning production source and built JavaScript.

## Explicit unknowns

This closure does not invent evidence for:

- physical Android/iPhone microphone behavior;
- Safari/iOS browser engine behavior;
- local MacBook execution.

Those remain separate device/browser QA obligations.

## Verdict

**IMPLEMENTED AND VERIFIED ON INTEGRATION.**

No voice runtime mutation is required to close V02–V08. Re-editing working voice code merely to create separate implementation commits would add risk without adding capability.
