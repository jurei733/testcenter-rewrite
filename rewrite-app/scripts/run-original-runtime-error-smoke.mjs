import { spawn } from "node:child_process";

const variants = [
  ["native", {}],
  ["lazy-load-fallback", {UI_SMOKE_RUNTIME_DIALOG_FAILURE:"true"}],
  ["pending-save", {UI_SMOKE_RUNTIME_SAVE_FAILURE:"delay"}],
  ["failed-save", {UI_SMOKE_RUNTIME_SAVE_FAILURE:"reject"}],
  ["replacement-old-succeeded", {UI_SMOKE_RUNTIME_REPLACEMENT:"success"}],
  ["replacement-old-rejected", {UI_SMOKE_RUNTIME_REPLACEMENT:"reject"}]
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
