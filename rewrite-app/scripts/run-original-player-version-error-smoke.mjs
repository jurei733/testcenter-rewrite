import { spawn } from "node:child_process";

const variants = [
  ["native", {}],
  ["lazy-load-fallback", {UI_SMOKE_RUNTIME_DIALOG_FAILURE:"true"}],
  ["pending-save", {UI_SMOKE_RUNTIME_SAVE_FAILURE:"delay"}],
  ["failed-save", {UI_SMOKE_RUNTIME_SAVE_FAILURE:"reject"}],
  ["pending-log-after-answer-save", {UI_SMOKE_VERSION_LOG_FAILURE:"delay"}],
  ["failed-log-after-answer-save", {UI_SMOKE_VERSION_LOG_FAILURE:"reject"}]
];
for (const [variant, extra] of variants) {
  const cases = variant === "native" ? [undefined] : ["missing", "unsupported"].map(
    readyError => `${readyError}-run-hot-return-Primar-desktop-forbidden-false`
  );
  for (const key of cases) {
    const code = await new Promise((done, reject) => {
      const child = spawn(process.execPath, ["scripts/smoke-original-player-version-error.mjs"], {
        stdio:"inherit", env:{...process.env, ...(key ? {UI_SMOKE_ONLY_CASE:key} : {}), ...extra}
      });
      child.once("error", reject); child.once("close", done);
    });
    if (code !== 0) process.exit(code || 1);
    console.log(`original_player_version_error_variant=${variant}:${key ?? "all"}:passed`);
  }
}
