import { access, readdir, readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { spawn } from "node:child_process";

const reportFatalPreflightError = error => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Runtime preflight failed: ${message}`);
  process.exit(1);
};

process.on("uncaughtException", reportFatalPreflightError);
process.on("unhandledRejection", reportFatalPreflightError);

const supportedStores = new Set(["memory", "file", "sqlite", "postgres"]);

const normalizeStore = value => {
  const normalizedValue = String(value ?? "memory")
    .trim()
    .toLowerCase();
  if (!supportedStores.has(normalizedValue)) {
    throw new Error(
      `Unsupported FIRST_SLICE_STORE '${value}'. Expected one of: ${[
        ...supportedStores
      ].join(", ")}.`
    );
  }
  return normalizedValue;
};

const assertPostgresUrl = value => {
  const normalizedValue = String(value ?? "").trim();
  if (!normalizedValue) {
    throw new Error(
      "FIRST_SLICE_POSTGRES_URL is required when FIRST_SLICE_STORE=postgres."
    );
  }
  if (!/^postgres(?:ql)?:\/\//.test(normalizedValue)) {
    throw new Error(
      "FIRST_SLICE_POSTGRES_URL must be a postgres:// or postgresql:// connection string."
    );
  }
  try {
    new URL(normalizedValue);
  } catch (error) {
    throw new Error(
      `FIRST_SLICE_POSTGRES_URL is not a valid URL: ${error.message}`
    );
  }
};

const store = normalizeStore(process.env.FIRST_SLICE_STORE);

const requiredBuiltFiles = [
  "apps/api/dist/apps/api/src/index.js",
  "packages/domain/dist/packages/domain/src/index.js",
  "packages/contracts/dist/packages/contracts/src/index.js",
  "packages/application/dist/packages/application/src/index.js",
  "packages/memory-store/dist/packages/memory-store/src/index.js",
  "packages/file-store/dist/packages/file-store/src/index.js",
  "packages/sqlite-store/dist/packages/sqlite-store/src/index.js",
  "packages/postgres-store/dist/packages/postgres-store/src/index.js",
  "dist/apps/web/browser/index.html"
];

const frontendBuildDirectory = resolve("dist/apps/web/browser");
const frontendIndexPath = resolve(frontendBuildDirectory, "index.html");

const parseBooleanFlag = (value, defaultValue = false) => {
  const normalizedValue = String(value ?? "")
    .trim()
    .toLowerCase();
  if (normalizedValue === "") {
    return defaultValue;
  }
  if (["1", "true", "yes", "on", "required"].includes(normalizedValue)) {
    return true;
  }
  if (["0", "false", "no", "off", "optional"].includes(normalizedValue)) {
    return false;
  }
  throw new Error(`Unsupported boolean flag '${value}'.`);
};

const redactStorageLocation = input => {
  if (!input || !/^postgres(?:ql)?:\/\//.test(input)) {
    return input ?? null;
  }

  try {
    const url = new URL(input);
    if (url.username) {
      url.username = "REDACTED";
    }
    if (url.password) {
      url.password = "REDACTED";
    }
    return url.toString();
  } catch {
    return input.replace(/\/\/([^:@/]+)(?::[^@/]+)?@/, "//REDACTED:REDACTED@");
  }
};

const ensureFile = async filePath => {
  const absolutePath = resolve(filePath);
  try {
    const fileStat = await stat(absolutePath);
    if (!fileStat.isFile()) {
      throw new Error(`${filePath} exists but is not a file.`);
    }
  } catch (error) {
    if (error?.code === "ENOENT") {
      throw new Error(`Missing built runtime artifact: ${filePath}`);
    }
    throw error;
  }
};

const isFrontendAssetReference = reference => {
  const normalizedReference = reference.trim();
  return (
    normalizedReference !== "" &&
    !normalizedReference.startsWith("#") &&
    !/^(?:[a-z][a-z0-9+.-]*:)?\/\//i.test(normalizedReference) &&
    !/^(?:data|blob|mailto|javascript):/i.test(normalizedReference)
  );
};

const normalizeFrontendAssetReference = reference => {
  const normalizedReference = reference.trim().split(/[?#]/, 1)[0];
  if (normalizedReference.startsWith("/app/")) {
    return normalizedReference.slice("/app/".length);
  }
  if (normalizedReference.startsWith("/")) {
    throw new Error(
      `Frontend index references an asset outside the /app base path: ${reference}`
    );
  }
  return normalizedReference.replace(/^\.\//, "");
};

const extractFrontendAssetReferences = html => {
  const references = [];
  for (const match of html.matchAll(
    /<(?:script|link)\b[^>]*\s(?:src|href)="([^"]+)"[^>]*>/gi
  )) {
    const reference = match[1] ?? "";
    if (isFrontendAssetReference(reference)) {
      references.push(normalizeFrontendAssetReference(reference));
    }
  }
  return [...new Set(references)];
};

const runStorageDoctor = () =>
  new Promise((resolvePromise, reject) => {
    const child = spawn(
      process.execPath,
      ["./scripts/storage-admin.mjs", "doctor"],
      {
        stdio: ["ignore", "pipe", "pipe"],
        env: {
          ...process.env,
          FIRST_SLICE_STORE: store
        }
      }
    );
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", chunk => {
      stdout += chunk;
    });
    child.stderr.on("data", chunk => {
      stderr += chunk;
    });
    child.once("error", reject);
    child.once("exit", code => {
      if (code !== 0) {
        reject(
          new Error(
            `Storage doctor failed with exit code ${code ?? "unknown"}.\n${stderr}${stdout}`
          )
        );
        return;
      }

      try {
        resolvePromise(JSON.parse(stdout));
      } catch (error) {
        reject(
          new Error(
            `Storage doctor returned invalid JSON: ${error.message}\n${stdout}`
          )
        );
      }
    });
  });

if (store === "postgres") {
  assertPostgresUrl(process.env.FIRST_SLICE_POSTGRES_URL);
}

for (const filePath of requiredBuiltFiles) {
  await ensureFile(filePath);
}

const appHtml = await readFile(frontendIndexPath, "utf8");
for (const marker of [
  "<app-root></app-root>",
  '<base href="/app/">',
  "<title>Testcenter Rewrite App</title>"
]) {
  if (!appHtml.includes(marker)) {
    throw new Error(`Frontend index is missing required marker ${marker}.`);
  }
}

const frontendAssetReferences = extractFrontendAssetReferences(appHtml);
if (frontendAssetReferences.length === 0) {
  throw new Error("Frontend index does not reference any built assets.");
}
for (const assetReference of frontendAssetReferences) {
  await ensureFile(resolve(frontendBuildDirectory, assetReference));
}

const frontendFiles = await readdir(frontendBuildDirectory);
const mainBundle = frontendFiles.find(fileName => /^main-.*\.js$/.test(fileName));
const stylesheetBundle = frontendFiles.find(fileName =>
  /^styles-.*\.css$/.test(fileName)
);
if (!mainBundle) {
  throw new Error("Frontend build is missing a hashed main JavaScript bundle.");
}
if (!stylesheetBundle) {
  throw new Error("Frontend build is missing a hashed stylesheet bundle.");
}
if (!frontendAssetReferences.includes(mainBundle)) {
  throw new Error(
    `Frontend index does not reference the hashed main bundle ${mainBundle}.`
  );
}
if (!frontendAssetReferences.includes(stylesheetBundle)) {
  throw new Error(
    `Frontend index does not reference the hashed stylesheet bundle ${stylesheetBundle}.`
  );
}
await access(resolve(frontendBuildDirectory, mainBundle));
await access(resolve(frontendBuildDirectory, stylesheetBundle));

let storageDoctor = null;
if (!parseBooleanFlag(process.env.RUNTIME_PREFLIGHT_SKIP_STORAGE_DOCTOR)) {
  storageDoctor = await runStorageDoctor();
}

if (
  parseBooleanFlag(process.env.RUNTIME_PREFLIGHT_REQUIRE_BUILD_METADATA) &&
  (!process.env.APP_BUILD_SHA ||
    process.env.APP_BUILD_SHA === "unknown" ||
    !process.env.APP_BUILD_TIMESTAMP ||
    process.env.APP_BUILD_TIMESTAMP === "unknown")
) {
  throw new Error(
    "Runtime preflight requires APP_BUILD_SHA and APP_BUILD_TIMESTAMP to be set."
  );
}

process.stdout.write(
  JSON.stringify(
    {
      status: "ready",
      store,
      storage: storageDoctor
        ? {
            ...storageDoctor,
            location: redactStorageLocation(storageDoctor.location)
          }
        : null,
      build: {
        commitSha: process.env.APP_BUILD_SHA ?? null,
        builtAt: process.env.APP_BUILD_TIMESTAMP ?? null
      },
      artifacts: {
        apiEntry: requiredBuiltFiles[0],
        frontendIndex: "dist/apps/web/browser/index.html",
        frontendMainBundle: mainBundle,
        frontendStylesheetBundle: stylesheetBundle,
        referencedAssetCount: frontendAssetReferences.length
      }
    },
    null,
    2
  ) + "\n"
);
