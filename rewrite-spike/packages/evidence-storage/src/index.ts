import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";

import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client
} from "@aws-sdk/client-s3";

import type { SystemCheckEvidence } from "@testcenter-rewrite/domain";

type ConfiguredEvidenceStorageBackend =
  | "filesystem_spike"
  | "postgres_inline_spike"
  | "s3_compatible_spike";

const evidenceStorageRoot = process.env.SYSTEM_CHECK_EVIDENCE_STORAGE_ROOT ??
  path.join(process.cwd(), ".runtime", "system-check-evidence");

const configuredEvidenceStorageBackend: ConfiguredEvidenceStorageBackend =
  process.env.SYSTEM_CHECK_EVIDENCE_STORAGE_BACKEND === "postgres_inline_spike" ||
  process.env.SYSTEM_CHECK_EVIDENCE_STORAGE_BACKEND === "s3_compatible_spike"
    ? process.env.SYSTEM_CHECK_EVIDENCE_STORAGE_BACKEND
    : "filesystem_spike";

const s3CompatibleConfig = {
  endpoint: process.env.SYSTEM_CHECK_EVIDENCE_S3_ENDPOINT ?? "http://127.0.0.1:9000",
  region: process.env.SYSTEM_CHECK_EVIDENCE_S3_REGION ?? "us-east-1",
  bucket: process.env.SYSTEM_CHECK_EVIDENCE_S3_BUCKET ?? "testcenter-rewrite-spike-evidence",
  accessKeyId: process.env.SYSTEM_CHECK_EVIDENCE_S3_ACCESS_KEY_ID ?? "minioadmin",
  secretAccessKey: process.env.SYSTEM_CHECK_EVIDENCE_S3_SECRET_ACCESS_KEY ?? "minioadmin",
  forcePathStyle: process.env.SYSTEM_CHECK_EVIDENCE_S3_FORCE_PATH_STYLE !== "false"
};

let sharedS3Client: S3Client | null = null;
let ensuredS3BucketPromise: Promise<void> | null = null;

export interface PersistedSystemCheckEvidencePayload {
  storageBackend: ConfiguredEvidenceStorageBackend;
  storageLocator: string | null;
  persistedPayloadBase64: string | null;
}

const getS3Client = (): S3Client => {
  if (!sharedS3Client) {
    sharedS3Client = new S3Client({
      endpoint: s3CompatibleConfig.endpoint,
      region: s3CompatibleConfig.region,
      forcePathStyle: s3CompatibleConfig.forcePathStyle,
      credentials: {
        accessKeyId: s3CompatibleConfig.accessKeyId,
        secretAccessKey: s3CompatibleConfig.secretAccessKey
      }
    });
  }

  return sharedS3Client;
};

const ensureS3Bucket = async (): Promise<void> => {
  if (!ensuredS3BucketPromise) {
    ensuredS3BucketPromise = (async () => {
      const client = getS3Client();

      try {
        await client.send(new HeadBucketCommand({
          Bucket: s3CompatibleConfig.bucket
        }));
      } catch {
        await client.send(new CreateBucketCommand({
          Bucket: s3CompatibleConfig.bucket
        }));
      }
    })();
  }

  return ensuredS3BucketPromise;
};

const streamToString = async (body: unknown): Promise<string> => {
  if (!body) {
    return "";
  }

  if (typeof body === "string") {
    return body;
  }

  if (body instanceof Uint8Array) {
    return Buffer.from(body).toString("utf8");
  }

  if (typeof body === "object" && body !== null && "transformToString" in body) {
    return await (body as { transformToString: () => Promise<string> }).transformToString();
  }

  if (body instanceof Readable) {
    const chunks: Buffer[] = [];

    for await (const chunk of body) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }

    return Buffer.concat(chunks).toString("utf8");
  }

  throw new Error("Unsupported object-storage response body.");
};

const persistToFilesystem = async (input: {
  evidenceKey: string;
  payloadBase64: string;
}): Promise<PersistedSystemCheckEvidencePayload> => {
  await mkdir(evidenceStorageRoot, { recursive: true });
  const storageLocator = `${input.evidenceKey}.b64`;
  await writeFile(path.join(evidenceStorageRoot, storageLocator), input.payloadBase64, "utf8");

  return {
    storageBackend: "filesystem_spike",
    storageLocator,
    persistedPayloadBase64: null
  };
};

const persistToS3CompatibleStorage = async (input: {
  evidenceKey: string;
  payloadBase64: string;
}): Promise<PersistedSystemCheckEvidencePayload> => {
  await ensureS3Bucket();
  const client = getS3Client();
  const storageLocator = `system-check-evidence/${input.evidenceKey}.b64`;

  await client.send(new PutObjectCommand({
    Bucket: s3CompatibleConfig.bucket,
    Key: storageLocator,
    Body: input.payloadBase64,
    ContentType: "text/plain; charset=utf-8",
    Metadata: {
      evidencekey: input.evidenceKey
    }
  }));

  return {
    storageBackend: "s3_compatible_spike",
    storageLocator,
    persistedPayloadBase64: null
  };
};

export const persistSystemCheckEvidencePayload = async (input: {
  evidenceKey: string;
  payloadBase64: string;
}): Promise<PersistedSystemCheckEvidencePayload> => {
  if (configuredEvidenceStorageBackend === "postgres_inline_spike") {
    return {
      storageBackend: "postgres_inline_spike",
      storageLocator: null,
      persistedPayloadBase64: input.payloadBase64
    };
  }

  if (configuredEvidenceStorageBackend === "s3_compatible_spike") {
    return persistToS3CompatibleStorage(input);
  }

  return persistToFilesystem(input);
};

export const readSystemCheckEvidenceBlob = async (
  systemCheckEvidence: SystemCheckEvidence
): Promise<string> => {
  if (systemCheckEvidence.purgedAt) {
    throw new Error(`System-check evidence '${systemCheckEvidence.evidenceKey}' payload has been purged.`);
  }

  if (systemCheckEvidence.storageBackend === "filesystem_spike") {
    if (!systemCheckEvidence.storageLocator) {
      throw new Error(`System-check evidence '${systemCheckEvidence.evidenceKey}' is missing a storage locator.`);
    }

    return (
      await readFile(path.join(evidenceStorageRoot, systemCheckEvidence.storageLocator), "utf8")
    ).trim();
  }

  if (systemCheckEvidence.storageBackend === "s3_compatible_spike") {
    if (!systemCheckEvidence.storageLocator) {
      throw new Error(`System-check evidence '${systemCheckEvidence.evidenceKey}' is missing an object-storage locator.`);
    }

    await ensureS3Bucket();
    const client = getS3Client();
    const response = await client.send(new GetObjectCommand({
      Bucket: s3CompatibleConfig.bucket,
      Key: systemCheckEvidence.storageLocator
    }));

    return (await streamToString(response.Body)).trim();
  }

  if (systemCheckEvidence.payloadBase64) {
    return systemCheckEvidence.payloadBase64;
  }

  throw new Error(`System-check evidence '${systemCheckEvidence.evidenceKey}' has no retrievable payload.`);
};

export const purgeSystemCheckEvidencePayload = async (
  systemCheckEvidence: SystemCheckEvidence
): Promise<void> => {
  if (systemCheckEvidence.storageBackend === "filesystem_spike") {
    if (systemCheckEvidence.storageLocator) {
      await rm(path.join(evidenceStorageRoot, systemCheckEvidence.storageLocator), { force: true });
    }

    return;
  }

  if (systemCheckEvidence.storageBackend === "s3_compatible_spike") {
    if (!systemCheckEvidence.storageLocator) {
      return;
    }

    const client = getS3Client();
    await client.send(new DeleteObjectCommand({
      Bucket: s3CompatibleConfig.bucket,
      Key: systemCheckEvidence.storageLocator
    }));
  }
};
