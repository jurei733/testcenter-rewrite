import { spawn } from "node:child_process";

for (const [variant, extra] of [
  ["native", {}],
  ["lazy-load-fallback", {UI_SMOKE_RUNTIME_DIALOG_FAILURE:"true"}]
]) {
  const code = await new Promise((done, reject) => {
    const child = spawn(process.execPath, ["scripts/smoke-original-runtime-error.mjs"], {
      stdio:"inherit", env:{...process.env, UI_SMOKE_RUNTIME_CONTRACT:"true", ...extra}
    });
    child.once("error", reject); child.once("close", done);
  });
  if (code !== 0) process.exit(code || 1);
  console.log(`original_runtime_error_contract_variant=${variant}:passed`);
}
