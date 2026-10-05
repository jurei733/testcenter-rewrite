import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const { outputText } = ts.transpileModule(readFileSync(new URL("../apps/web/src/app/participant-session-links.ts", import.meta.url), "utf8"), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext }
});
const { buildParticipantSessionEntryUrl, buildParticipantEntryUrl, withSelectedParticipantRun } =
  await import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);

test("run-specific re-entry links encode the exact session/run without a credential", () => {
  const url = buildParticipantSessionEntryUrl("owned/session", {
    testRunId: "  owned/run:ä  ", bookletKey: "BOOKLET#level:advanced",
    sessionToken: "must-not-appear", password: "must-not-appear"
  }, { includeOrigin: false });
  const parsed = new URL(url, "https://example.test");
  assert.equal(parsed.pathname, "/participant");
  assert.equal(parsed.searchParams.get("participantSessionId"), "owned/session");
  assert.equal(parsed.searchParams.get("testRunId"), "owned/run:ä");
  assert.equal(parsed.searchParams.get("bookletKey"), "BOOKLET#level:advanced");
  assert.equal(url.includes("must-not-appear"), false);
});

test("historical session-only links remain unchanged and ignore an empty run", () => {
  assert.equal(buildParticipantSessionEntryUrl("owned", { testRunId: " " }, { includeOrigin: false }),
    "/participant?participantSessionId=owned");
});

test("a login link cannot accidentally become a run re-entry link", () => {
  assert.equal(buildParticipantEntryUrl({ loginKey: "login", testRunId: "stale-run" }, { includeOrigin: false }),
    "/participant?loginKey=login");
});

test("current-state and event-stream queries bind their exact selected run", () => {
  for (const path of ["/api/current-state", "/api/events"]) {
    assert.equal(withSelectedParticipantRun(path, " run/ä "), `${path}?testRunId=run%2F%C3%A4`);
  }
});

test("asset preload selection preserves its flags and replaces rather than duplicates the run", () => {
  const path = withSelectedParticipantRun("/api/current-state?includeBookletAssets=true&testRunId=old", "new");
  const query = new URL(path, "https://example.test").searchParams;
  assert.equal(query.get("includeBookletAssets"), "true");
  assert.deepEqual(query.getAll("testRunId"), ["new"]);
});

test("unselected legacy requests do not acquire an implicit run", () => {
  for (const id of [undefined, null, "", " "]) {
    assert.equal(withSelectedParticipantRun("/api/current-state?includeBookletAssets=true", id),
      "/api/current-state?includeBookletAssets=true");
  }
});
