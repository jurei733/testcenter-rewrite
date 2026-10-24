import { spawn } from "node:child_process";

const variants = [
  ["received-monitor-terminate", {UI_SMOKE_RUNTIME_RECEIVED_TERMINATE:"true"}],
  ["received-monitor-terminate-fallback", {UI_SMOKE_RUNTIME_RECEIVED_TERMINATE:"true",UI_SMOKE_RUNTIME_DIALOG_FAILURE:"true"}],
  ["received-monitor-resume", {UI_SMOKE_RUNTIME_RECEIVED_RESUME:"true"}],
  ["received-monitor-resume-fallback", {UI_SMOKE_RUNTIME_RECEIVED_RESUME:"true",UI_SMOKE_RUNTIME_DIALOG_FAILURE:"true"}],
  ["late-save-monitor-pause", {UI_SMOKE_RUNTIME_LATE_SAVE_PAUSE:"true"}],
  ["late-save-monitor-pause-fallback", {UI_SMOKE_RUNTIME_LATE_SAVE_PAUSE:"true",UI_SMOKE_RUNTIME_DIALOG_FAILURE:"true"}],
  ["received-monitor-pause-old-save", {UI_SMOKE_RUNTIME_RECEIVED_PAUSE_OLD_SAVE:"true"}],
  ["received-monitor-pause-old-save-fallback", {UI_SMOKE_RUNTIME_RECEIVED_PAUSE_OLD_SAVE:"true",UI_SMOKE_RUNTIME_DIALOG_FAILURE:"true"}],
  ["native", {}],
  ["lazy-load-fallback", {UI_SMOKE_RUNTIME_DIALOG_FAILURE:"true"}],
  ["pending-save", {UI_SMOKE_RUNTIME_SAVE_FAILURE:"delay"}],
  ["failed-save", {UI_SMOKE_RUNTIME_SAVE_FAILURE:"reject"}],
  ["replacement-old-succeeded", {UI_SMOKE_RUNTIME_REPLACEMENT:"success"}],
  ["replacement-old-rejected", {UI_SMOKE_RUNTIME_REPLACEMENT:"reject"}],
  ["late-monitor-pause", {UI_SMOKE_RUNTIME_LATE_COMMAND:"pause"}],
  ["late-monitor-pause-fallback", {UI_SMOKE_RUNTIME_LATE_COMMAND:"pause",UI_SMOKE_RUNTIME_DIALOG_FAILURE:"true"}],
  ["received-monitor-pause", {UI_SMOKE_RUNTIME_RECEIVED_PAUSE:"true"}],
  ["received-monitor-pause-fallback", {UI_SMOKE_RUNTIME_RECEIVED_PAUSE:"true",UI_SMOKE_RUNTIME_DIALOG_FAILURE:"true"}]
];
for (const [variant, extra] of variants) {
  const code = await new Promise((done, reject) => {
    const child = spawn(process.execPath, ["scripts/smoke-original-runtime-error.mjs"], {
      stdio:"inherit", env:{...process.env, ...(variant === "native" ? {} : {UI_SMOKE_ONLY_CASE:"run-hot-return-Primar-desktop-forbidden-false"}), ...extra}
    });
    child.once("error", reject); child.once("close", done);
  });
  if (code !== 0) process.exit(code || 1);
  console.log(`original_runtime_error_variant=${variant}:passed`);
}
