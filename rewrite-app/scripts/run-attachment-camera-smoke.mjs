import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const owned = await mkdtemp(join(tmpdir(), "testcenter-attachment-live-camera-"));
const artifactDirectory = process.env.UI_SMOKE_ARTIFACT_DIR?.trim() || owned;
console.log(`owned_attachment_live_camera=${owned}`);
Object.assign(process.env, {
  FIRST_SLICE_STORE: "sqlite",
  FIRST_SLICE_SQLITE_FILE: join(owned, "owned.sqlite"),
  FIRST_SLICE_OPERATOR_AUTH_REQUIRED: "true",
  UI_SMOKE_ARTIFACT_DIR: artifactDirectory,
  UI_SMOKE_STOP_AFTER_STEP: "attachment-manager",
  UI_SMOKE_ATTACHMENT_QR_CAMERA_FILE: join(owned, "owned-camera.y4m")
});
await import("./smoke-ui.mjs");
