import { createHash } from "node:crypto";
import { readFile, mkdir, writeFile, rename, unlink, stat } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { ParseOption, XmlDocument, XsdValidator } from "libxml2-wasm";

export type OriginalXmlRoot = "Booklet" | "Unit" | "Testtakers" | "SysCheck";
export type XmlSchemaProfile = "original-19" | "legacy-compatibility";

// IQB Testcenter c35cff81 / definitions/compatibility.json. URLs from uploaded
// XML are identifiers only: they NEVER become fetch targets or filesystem paths.
export const originalXmlSchemaPolicy = {
  Booklet: { repo: "testcenter-booklet-xml", min: 18, max: 18 },
  Unit: { repo: "unit-xml", min: 17, max: 17 },
  Testtakers: { repo: "testcenter-testtaker-xml", min: 17, max: 18 },
  SysCheck: { repo: "testcenter-syscheck-xml", min: 18, max: 18 }
} as const;

// All currently published two-part tags within the supported major ranges,
// checked 2026-10-04. Store specifications in a private installation cache,
// rather than republishing third-party schemas in this repository.
const schemas = [
  { root: "Booklet", version: "18.0", revision: "2fb84560ee0b28bf53e9cd6fa06156c8f64c2e0e", sha256: "45dc2a3e9522a4abc99bcda16508046ae3ca3a8affaa0d835d3b63e90389bbcb" },
  { root: "Unit", version: "17.4", revision: "98f1449dc3ddcee41c1e18b1f4a694abab0661c8", sha256: "534141bc30fcc5384b80852c0c1af05c205f482a75005c25668b30e36f8c7b1c" },
  { root: "Unit", version: "17.6", revision: "120977edcbe0775e872f29040b6da19bc2cecfb3", sha256: "bc164ac442972b287d3a00d107b53465e927ff8930bb32edf5d749cd36fa0a9c" },
  { root: "Testtakers", version: "17.4", revision: "78fb9f14511edc279645d54bd5925c3809e6067d", sha256: "5ec386faab037d27460d943726efde39e2484b0af19d8cb69434fc7e64772929" },
  { root: "Testtakers", version: "18.0", revision: "edc891830b5cf670704f8d4b12ca6b943a18f4dd", sha256: "6cb25e7692f58e08f1bade69e46b185a6d8e37722fdff0d436c0fe4918b984c0" },
  { root: "SysCheck", version: "18.0", revision: "6aa73646f47165fe17337fbf11b0ecb532469af0", sha256: "4821facb295642fc2c9bf039acbde06c81aa75a304211922f354a76ca8b98be7" }
] as const;
export const originalXmlSchemaVersions = schemas.map(({ root, version }) => ({ root, version }));

export type XmlSchemaProblem = { code: string; message: string };
type Schema = typeof schemas[number];
const problem = (code: string, message: string): XmlSchemaProblem => ({ code, message });
export const inspectOriginalXmlSchemaReference = (
  root: OriginalXmlRoot, reference: string
): { schema: Schema } | XmlSchemaProblem => {
  const policy = originalXmlSchemaPolicy[root];
  if (!reference) return problem("testcenter_xml_schema_reference_missing", `Original Testcenter ${root} requires an XSD reference.`);
  const match = /^https?:\/\/w3id\.org\/iqb\/spec\/([a-z-]+-xml)\/([0-9]+)\.([0-9]+)$/u.exec(reference);
  if (!match || match[1] !== policy.repo) {
    return problem("testcenter_xml_schema_reference_invalid", `Original Testcenter ${root} requires http(s)://w3id.org/iqb/spec/${policy.repo}/<major>.<minor>.`);
  }
  const major = Number(match[2]);
  if (major < policy.min || major > policy.max) {
    return problem("testcenter_xml_schema_version_unsupported", `Original Testcenter ${root} supports major versions ${policy.min} to ${policy.max}.`);
  }
  const schema = schemas.find(item => item.root === root && item.version === `${match[2]}.${match[3]}`);
  return schema ? { schema } : problem("testcenter_xml_schema_version_unavailable", `The declared ${root} schema version is not in the pinned published specification set.`);
};

export type OriginalXmlSchemaValidator = (
  root: OriginalXmlRoot, reference: string, source: string
) => XmlSchemaProblem | null;

const digest = (bytes: Uint8Array): string => createHash("sha256").update(bytes).digest("hex");
const MAX_SCHEMA_BYTES = 256 * 1024;
const downloadSchema = async (schema: Schema): Promise<Uint8Array> => {
  const repo = originalXmlSchemaPolicy[schema.root].repo;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(`https://raw.githubusercontent.com/iqb-specifications/${repo}/${schema.revision}/${repo}.xsd`, {
      signal: controller.signal, redirect: "error"
    });
    if (!response.ok || !response.body) throw Error("Pinned specification download failed.");
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = []; let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read(); if (done) break;
        size += value.length;
        if (size > MAX_SCHEMA_BYTES) { await reader.cancel(); throw Error("Specification exceeded its size limit."); }
        chunks.push(value);
      }
    } finally { reader.releaseLock(); }
    const bytes = Buffer.concat(chunks);
    if (digest(bytes) !== schema.sha256) throw Error("Pinned specification integrity check failed.");
    return bytes;
  } finally { clearTimeout(timer); }
};

export const prepareOriginalXmlSchemaValidator = async (
  directory: string, allowDownload = true
): Promise<OriginalXmlSchemaValidator> => {
  if (allowDownload) await mkdir(directory, { recursive: true, mode: 0o700 });
  const cached = new Map<string, Uint8Array>();
  for (const schema of schemas) {
    const file = join(directory, `${originalXmlSchemaPolicy[schema.root].repo}-${schema.version}.xsd`);
    let bytes: Uint8Array;
    try {
      const metadata = await stat(file);
      if (!metadata.isFile() || metadata.size > MAX_SCHEMA_BYTES) {
        throw Error("Specification cache entry exceeded its size limit.");
      }
      bytes = await readFile(file);
    }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT" || !allowDownload) {
        throw Error("The pinned XML schema cache is unavailable; provision specifications before starting in offline mode.");
      }
      bytes = await downloadSchema(schema);
      const temporary = `${file}.${randomUUID()}.tmp`;
      try {
        await writeFile(temporary, bytes, { flag: "wx", mode: 0o600 });
        await rename(temporary, file);
      } finally { await unlink(temporary).catch(() => undefined); }
    }
    if (bytes.length > MAX_SCHEMA_BYTES || digest(bytes) !== schema.sha256) {
      throw Error("The pinned XML schema cache failed integrity verification.");
    }
    cached.set(`${schema.root}/${schema.version}`, bytes);
  }
  return (root, reference, source) => {
    const inspected = inspectOriginalXmlSchemaReference(root, reference);
    if (!("schema" in inspected)) return inspected;
    if (/<!DOCTYPE\b/iu.test(source)) return problem("source_document_xml_doctype_unsupported", "DOCTYPE declarations are not accepted.");
    let schemaDocument: XmlDocument | undefined, document: XmlDocument | undefined, validator: XsdValidator | undefined;
    try {
      const options = { option: ParseOption.XML_PARSE_NONET | ParseOption.XML_PARSE_NO_XXE, encoding: "utf-8" };
      schemaDocument = XmlDocument.fromBuffer(cached.get(`${root}/${inspected.schema.version}`)!, options);
      validator = XsdValidator.fromDoc(schemaDocument);
      document = XmlDocument.fromString(source, options);
      validator.validate(document);
      return null;
    } catch {
      // Native diagnostics can contain roster passwords / authored responses.
      // Never return raw parser text, document lines, cache paths or exceptions.
      return problem("testcenter_xml_xsd_invalid", `Original Testcenter ${root} does not conform to its pinned ${inspected.schema.version} XSD.`);
    } finally {
      document?.dispose(); validator?.dispose(); schemaDocument?.dispose();
    }
  };
};
