import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { access, constants, mkdir } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";

import {
  checkFileFirstSliceReadiness
} from "../packages/file-store/dist/packages/file-store/src/index.js";
import {
  inspectPostgresFirstSliceStorage,
  migratePostgresFirstSliceStorage,
  checkPostgresFirstSliceReadiness
} from "../packages/postgres-store/dist/packages/postgres-store/src/index.js";
import {
  inspectSqliteFirstSliceStorage,
  migrateSqliteFirstSliceStorage,
  checkSqliteFirstSliceReadiness
} from "../packages/sqlite-store/dist/packages/sqlite-store/src/index.js";

const command = process.argv[2] ?? "doctor";
const store = process.env.FIRST_SLICE_STORE ?? "memory";

const resolveWorkspacePath = relativePath =>
  resolve(fileURLToPath(new URL("..", import.meta.url)), relativePath);

const redactStorageLocation = input => {
  if (!input) {
    return input;
  }

  if (!/^postgres(?:ql)?:\/\//.test(input)) {
    return input;
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

const resolveStorageConfig = () => {
  if (store === "file") {
    return {
      kind: "file",
      location:
        process.env.FIRST_SLICE_FILE ??
        resolveWorkspacePath("./.data/first-slice.json")
    };
  }

  if (store === "sqlite") {
    return {
      kind: "sqlite",
      location:
        process.env.FIRST_SLICE_SQLITE_FILE ??
        resolveWorkspacePath("./.data/first-slice.sqlite")
    };
  }

  if (store === "postgres") {
    const connectionString = process.env.FIRST_SLICE_POSTGRES_URL;
    if (!connectionString) {
      throw new Error(
        "FIRST_SLICE_POSTGRES_URL is required when FIRST_SLICE_STORE=postgres."
      );
    }
    return {
      kind: "postgres",
      location: connectionString
    };
  }

  return {
    kind: "memory",
    location: null
  };
};

const checkFileExists = async filePath => {
  try {
    await access(filePath, constants.F_OK);
    return true;
  } catch {
    return false;
  }
};

const withRetries = async (operation, input) => {
  const attempts = input?.attempts ?? 15;
  const delayMs = input?.delayMs ?? 1_000;
  let lastError = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt === attempts) {
        break;
      }
      await delay(delayMs);
    }
  }

  throw lastError ?? new Error("Retry operation failed.");
};

const runDoctor = async () => {
  const config = resolveStorageConfig();

  if (config.kind === "memory") {
    process.stdout.write(
      JSON.stringify(
        {
          store: "memory",
          readiness: "ready",
          note: "In-memory store has no durable backing service."
        },
        null,
        2
      ) + "\n"
    );
    return;
  }

  if (config.kind === "file") {
    await mkdir(resolveWorkspacePath("./.data"), { recursive: true });
    await checkFileFirstSliceReadiness(config.location);
    process.stdout.write(
      JSON.stringify(
        {
          store: "file",
          readiness: "ready",
          location: redactStorageLocation(config.location),
          fileExists: await checkFileExists(config.location)
        },
        null,
        2
      ) + "\n"
    );
    return;
  }

  if (config.kind === "sqlite") {
    await checkSqliteFirstSliceReadiness(config.location);
    const diagnostics = await inspectSqliteFirstSliceStorage(config.location);
    process.stdout.write(
      JSON.stringify(
        {
          store: "sqlite",
          readiness: "ready",
          location: redactStorageLocation(config.location),
          ...diagnostics
        },
        null,
        2
      ) + "\n"
    );
    return;
  }

  await withRetries(() => checkPostgresFirstSliceReadiness(config.location));
  const diagnostics = await withRetries(() =>
    inspectPostgresFirstSliceStorage(config.location)
  );
  process.stdout.write(
    JSON.stringify(
      {
        store: "postgres",
        readiness: "ready",
        location: redactStorageLocation(config.location),
        ...diagnostics
      },
      null,
      2
    ) + "\n"
  );
};

const runMigrate = async () => {
  const config = resolveStorageConfig();

  if (config.kind === "memory") {
    process.stdout.write(
      JSON.stringify(
        {
          store: "memory",
          migrated: false,
          note: "In-memory store has no schema migrations."
        },
        null,
        2
      ) + "\n"
    );
    return;
  }

  if (config.kind === "file") {
    await mkdir(resolveWorkspacePath("./.data"), { recursive: true });
    await checkFileFirstSliceReadiness(config.location);
    process.stdout.write(
      JSON.stringify(
        {
          store: "file",
          migrated: false,
          note: "JSON file store has no schema migrations.",
          location: redactStorageLocation(config.location)
        },
        null,
        2
      ) + "\n"
    );
    return;
  }

  if (config.kind === "sqlite") {
    const diagnostics = await migrateSqliteFirstSliceStorage(config.location);
    process.stdout.write(
      JSON.stringify(
        {
          store: "sqlite",
          migrated: true,
          location: redactStorageLocation(config.location),
          ...diagnostics
        },
        null,
        2
      ) + "\n"
    );
    return;
  }

  const diagnostics = await withRetries(() =>
    migratePostgresFirstSliceStorage(config.location)
  );
  process.stdout.write(
    JSON.stringify(
      {
        store: "postgres",
        migrated: true,
        location: redactStorageLocation(config.location),
        ...diagnostics
      },
      null,
      2
    ) + "\n"
  );
};

if (command === "doctor") {
  await runDoctor();
} else if (command === "migrate") {
  await runMigrate();
} else {
  process.stderr.write(
    `Unknown storage-admin command '${command}'. Use 'doctor' or 'migrate'.\n`
  );
  process.exit(1);
}
