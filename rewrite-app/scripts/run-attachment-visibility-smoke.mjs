import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Separate native visibility gate: default Playwright pages can remain visible
// even after an OS minimize. This prerequisite failure must remain observable,
// not be presented as successful camera pause/resume acceptance.
const owned = await mkdtemp(join(tmpdir(), "testcenter-attachment-visibility-"));
console.log(`owned_attachment_visibility=${owned}`);
Object.assign(process.env, {
  FIRST_SLICE_STORE: "sqlite",
  FIRST_SLICE_SQLITE_FILE: join(owned, "owned.sqlite"),
  FIRST_SLICE_OPERATOR_AUTH_REQUIRED: "true",
  UI_SMOKE_ARTIFACT_DIR: process.env.UI_SMOKE_ARTIFACT_DIR?.trim() || owned,
  UI_SMOKE_HEADFUL: "true",
  UI_SMOKE_STOP_AFTER_STEP: "attachment-manager",
  UI_SMOKE_VERIFY_ATTACHMENT_VISIBILITY: "true"
});
delete process.env.UI_SMOKE_ATTACHMENT_QR_CAMERA_FILE;
await import("./smoke-ui.mjs");
