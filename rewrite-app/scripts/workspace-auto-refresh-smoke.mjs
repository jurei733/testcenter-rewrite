import assert from "node:assert/strict";

export const workspaceAutoRefreshMatchesStorage = expected => {
  try {
    const input = document.querySelector("#autoRefreshEnabled");
    const persisted = JSON.parse(
      localStorage.getItem("testcenter-rewrite-app-shell") ?? "{}"
    ).autoRefreshEnabled;
    return typeof persisted === "boolean" &&
      input?.checked === persisted &&
      (expected === null || persisted === expected);
  } catch {
    return false;
  }
};

export const setWorkspaceAutoRefreshEnabled = async (page, enabled) => {
  const checkbox = page.locator("#autoRefreshEnabled");
  // Route completion alone does not establish the newly bound native state.
  // Prepare its real viewport render before check() reads a transient default.
  await checkbox.scrollIntoViewIfNeeded();
  await checkbox.screenshot();
  await page.waitForFunction(workspaceAutoRefreshMatchesStorage, null);
  if (enabled) {
    await checkbox.check();
  } else {
    await checkbox.uncheck();
  }
  await page.waitForFunction(workspaceAutoRefreshMatchesStorage, enabled);
  assert.equal(await checkbox.isChecked(), enabled,
    "The native workspace checkbox must retain the requested refresh setting.");
};
