import assert from "node:assert/strict";
import test from "node:test";
import { matchesParticipantRunRequest } from "./participant-run-request-match.mjs";

const scope = { baseUrl: "http://127.0.0.1:4312", participantSessionId: "session:1", testRunId: "run:1" };
const path = `${scope.baseUrl}/api/v1/participant/sessions/session%3A1`;
const preload = { ...scope, endpoint: "current-state", includeBookletAssets: true };
const stream = { ...scope, endpoint: "events" };

test("run-bound preload matches either query order and harmless extra parameters", () => {
  for (const query of ["includeBookletAssets=true&testRunId=run%3A1", "testRunId=run%3A1&includeBookletAssets=true", "testRunId=run%3A1&other=1&includeBookletAssets=true"])
    assert.equal(matchesParticipantRunRequest(`${path}/current-state?${query}`, preload), true);
});
test("preload does not accept ordinary reads, missing or ambiguous run/asset flags", () => {
  for (const query of ["", "includeBookletAssets=true", "testRunId=run%3A1", "testRunId=run%3A1&includeBookletAssets=false", "testRunId=&includeBookletAssets=true", "testRunId=%20&includeBookletAssets=true", "testRunId=run%3A1&testRunId=run%3A1&includeBookletAssets=true", "testRunId=run%3A1&includeBookletAssets=true&includeBookletAssets=false"])
    assert.equal(matchesParticipantRunRequest(`${path}/current-state?${query}`, preload), false);
});
test("stream matching remains scoped to the actual origin, session, run and endpoint", () => {
  assert.equal(matchesParticipantRunRequest(new URL(`${path}/events?testRunId=run%3A1`), stream), true);
  for (const url of [`${path}/events`, `${path}/events?testRunId=other`, `${path}/events/acknowledgements?testRunId=run%3A1`, `${path}/current-state?testRunId=run%3A1`, `${scope.baseUrl}/api/v1/participant/sessions/other/events?testRunId=run%3A1`, `https://example.org/api/v1/participant/sessions/session%3A1/events?testRunId=run%3A1`, `${path}/events?testRunId=run%3A1&testRunId=other`])
    assert.equal(matchesParticipantRunRequest(url, stream), false);
});
test("new-session discovery still requires an owned run-bound endpoint", () => {
  const discovery = { baseUrl: scope.baseUrl, endpoint: "current-state", includeBookletAssets: true };
  assert.equal(matchesParticipantRunRequest(`${path}/current-state?testRunId=run%3A1&includeBookletAssets=true`, discovery), true);
  for (const url of ["not a URL", `${path}/current-state?includeBookletAssets=true`, `${path}/events?testRunId=run%3A1&includeBookletAssets=true`, `${scope.baseUrl}/other/current-state?testRunId=run%3A1&includeBookletAssets=true`])
    assert.equal(matchesParticipantRunRequest(url, discovery), false);
});
