import type { ParticipantSaveOutboxEntry } from "./participant-save-outbox";

const PARTICIPANT_SAVE_UPSERT_MESSAGE =
  "testcenter-participant-save-outbox-upsert-v1";
const PARTICIPANT_SAVE_DELETE_MESSAGE =
  "testcenter-participant-save-outbox-delete-v1";
const PARTICIPANT_SAVE_CLEAR_RUN_MESSAGE =
  "testcenter-participant-save-outbox-clear-run-v1";

export function queueParticipantSaveForBackgroundDelivery(
  entry: ParticipantSaveOutboxEntry
): void {
  postParticipantSaveWorkerMessage({
    type: PARTICIPANT_SAVE_UPSERT_MESSAGE,
    entry
  });
}

export function removeParticipantSaveFromBackgroundDelivery(
  testRunId: string,
  deliveryId: string
): void {
  postParticipantSaveWorkerMessage({
    type: PARTICIPANT_SAVE_DELETE_MESSAGE,
    testRunId,
    deliveryId
  });
}

export function discardParticipantBackgroundSavesForRun(
  testRunId: string
): void {
  postParticipantSaveWorkerMessage({
    type: PARTICIPANT_SAVE_CLEAR_RUN_MESSAGE,
    testRunId
  });
}

function postParticipantSaveWorkerMessage(message: unknown): void {
  const serviceWorker = globalThis.navigator?.serviceWorker;
  if (!serviceWorker) {
    return;
  }

  void serviceWorker.ready
    .then(registration => {
      const worker = registration.active ?? serviceWorker.controller;
      worker?.postMessage(message);
    })
    .catch(() => {
      // The local outbox remains authoritative when background delivery is
      // unavailable, so registration failures stay best-effort here.
    });
}
