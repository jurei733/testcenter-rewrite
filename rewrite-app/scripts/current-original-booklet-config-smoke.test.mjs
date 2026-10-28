import assert from "node:assert/strict";
import test from "node:test";
import { runCurrentOriginalBookletConfigSmoke } from "./current-original-booklet-config-smoke.mjs";

test("current Original corpus explicitly reads release detail through the main smoke's default-POST adapter", async () => {
  const readReached = new Error("owned release detail read reached");
  const methods = [];
  const sendJson = async (url, options = {}) => {
    const method = options.method ?? "POST";
    methods.push([new URL(url).pathname, method]);
    if (url.endsWith("/source-packages")) return { json: async () => ({ sourcePackage: { sourcePackageId: "owned-source" } }) };
    if (url.endsWith("/import-jobs")) return { json: async () => ({ importJob: { status: "completed", diagnostics: [] }, stagedContentRelease: { contentReleaseId: "owned-release" } }) };
    if (url.endsWith("/content-releases/owned-release")) {
      assert.equal(method, "GET", "Release detail is a GET-only API route, regardless of the caller's default method");
      throw readReached;
    }
    return {};
  };
  await assert.rejects(runCurrentOriginalBookletConfigSmoke({
    browser: { newContext() { throw Error("No browser may open before the release read"); } },
    baseUrl: "http://127.0.0.1:9999", tenantKey: "owned", workspaceKey: "owned",
    sendJson, createZip: () => Buffer.from("owned archive stand-in")
  }), error => error === readReached);
  assert.equal(methods.at(-1)[1], "GET");
});
