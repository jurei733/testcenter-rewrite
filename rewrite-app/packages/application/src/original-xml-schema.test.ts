import assert from "node:assert/strict";
import { before, test } from "node:test";
import { mkdtemp, copyFile, writeFile, rm, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import {
  inspectOriginalXmlSchemaReference, originalXmlSchemaPolicy,
  originalXmlSchemaVersions, prepareOriginalXmlSchemaValidator,
  type OriginalXmlRoot, type OriginalXmlSchemaValidator
} from "./original-xml-schema.js";

const cache = resolve(process.env.FIRST_SLICE_XML_SCHEMA_CACHE || ".data/original-xml-schemas");
let validate: OriginalXmlSchemaValidator;
before(async () => { validate = await prepareOriginalXmlSchemaValidator(cache,
  process.env.FIRST_SLICE_XML_SCHEMA_DOWNLOAD !== "false"); });
const reference = (root: OriginalXmlRoot, version: string) =>
  `https://w3id.org/iqb/spec/${originalXmlSchemaPolicy[root].repo}/${version}`;
const document = (root: OriginalXmlRoot, version: string, body: string) =>
  `<${root} xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="${reference(root, version)}">${body}</${root}>`;
const validBody = (root: OriginalXmlRoot) => root === "Testtakers"
  ? '<Metadata/><Group id="group" label="Group"><Login name="participant"><Booklet>BOOKLET</Booklet></Login></Group>'
  : '<Metadata><Id>VALID.ID</Id><Label>Valid äöü 中文</Label></Metadata>' +
    (root === "Booklet" ? '<Units><Unit id="UNIT.ONE" label="Unit"/></Units>' :
      root === "Unit" ? '<Definition player="fixture-player">{"title":"Valid"}</Definition>' :
        '<Config skipnetwork="true"><Q id="feedback" type="string" required="true">Feedback</Q></Config>');

for (const { root, version } of originalXmlSchemaVersions) {
  test(`Original 19 native XSD accepts ${root} ${version} and rejects a real schema violation`, () => {
    const source = document(root, version, validBody(root));
    assert.equal(validate(root, reference(root, version), source), null);
    const invalid = root === "Testtakers"
      ? source.replace('name="participant"', 'unknown="private-password"')
      : source.replace('<Id>VALID.ID</Id>', '<Id>invalid identifier</Id>');
    const result = validate(root, reference(root, version), invalid);
    assert.equal(result?.code, "testcenter_xml_xsd_invalid");
    assert.doesNotMatch(JSON.stringify(result), /private-password|invalid identifier|\.data|\.xsd/u);
  });
}

test("Original 19 root-specific major ranges reject Booklet 17, Unit 18 and SysCheck 17", () => {
  for (const [root, version] of [["Booklet", "17.4"], ["Unit", "18.0"], ["SysCheck", "17.4"]] as const) {
    const result = inspectOriginalXmlSchemaReference(root, reference(root, version));
    assert.equal("code" in result && result.code, "testcenter_xml_schema_version_unsupported");
  }
  const unavailable = inspectOriginalXmlSchemaReference("Booklet", reference("Booklet", "18.99"));
  assert.equal("code" in unavailable && unavailable.code, "testcenter_xml_schema_version_unavailable");
});

test("Original 19 schema references are exact identifiers, never permissive URL aliases", () => {
  const valid = reference("Booklet", "18.0");
  assert.ok("schema" in inspectOriginalXmlSchemaReference("Booklet", valid.replace("https:", "http:")));
  for (const invalid of ["", "file:///private/secret", "http://127.0.0.1:4311/private",
    valid + "?other=true", valid + "#fragment", valid + ".1", valid + "/",
    valid.replace("w3id.org", "W3ID.ORG"), valid.replace("18.0", "018.0"),
    valid.replace("testcenter-booklet-xml", "unit-xml"),
    "https://raw.githubusercontent.com/iqb-testcenter/testcenter/master/definitions/vo_Booklet.xsd"]) {
    assert.ok("code" in inspectOriginalXmlSchemaReference("Booklet", invalid), invalid);
  }
});

test("Original 19 XSD enforces case, namespace, child ordering, booleans and uniqueness", () => {
  const syscheck = document("SysCheck", "18.0", validBody("SysCheck"));
  for (const source of [syscheck.replaceAll("SysCheck", "syscheck"),
    syscheck.replace("<SysCheck ", '<SysCheck xmlns="urn:foreign" '),
    syscheck.replace('skipnetwork="true"', 'skipnetwork="perhaps"'),
    syscheck.replace("<Label>Valid äöü 中文</Label>", "<Unexpected/>"),
    syscheck.replace('</Config>', '<Q id="feedback" type="string"/></Config>')]) {
    assert.equal(validate("SysCheck", reference("SysCheck", "18.0"), source)?.code, "testcenter_xml_xsd_invalid");
  }
  const source = document("Unit", "17.6", validBody("Unit"));
  assert.equal(validate("Unit", reference("Unit", "17.6"), source.replace(
    '<Id>VALID.ID</Id><Label>Valid äöü 中文</Label>', '<Label>Valid</Label><Id>VALID.ID</Id>'))?.code,
  "testcenter_xml_xsd_invalid");
});

test("Original 19 rejects DOCTYPE before native parsing and never fetches uploaded schema URLs", () => {
  const previousFetch = globalThis.fetch;
  let requests = 0;
  globalThis.fetch = async () => { requests++; throw Error("Unexpected network access"); };
  try {
    const source = document("Booklet", "18.0", validBody("Booklet"));
    assert.equal(validate("Booklet", reference("Booklet", "18.0"),
      '<!DOCTYPE Booklet [<!ENTITY secret SYSTEM "file:///private/secret">]>' + source)?.code,
    "source_document_xml_doctype_unsupported");
    assert.equal(validate("Booklet", "http://127.0.0.1:4311/private", source)?.code,
      "testcenter_xml_schema_reference_invalid");
    assert.equal(validate("Booklet", reference("Booklet", "18.0"), source), null);
    assert.equal(requests, 0);
  } finally { globalThis.fetch = previousFetch; }
});

test("Original 19 repeated native validation does not cross-contaminate documents", () => {
  for (let index = 0; index < 100; index++) {
    const source = document("Booklet", "18.0", validBody("Booklet"));
    assert.equal(validate("Booklet", reference("Booklet", "18.0"), source), null);
    assert.equal(validate("Booklet", reference("Booklet", "18.0"), source.replace("</Booklet>", ""))?.code,
      "testcenter_xml_xsd_invalid");
  }
});

test("Original 19 offline cache verifies every schema and rejects missing, tampered and oversized bytes", async () => {
  const directory = await mkdtemp(join(tmpdir(), "testcenter-original-xsd-cache-"));
  try {
    await assert.rejects(prepareOriginalXmlSchemaValidator(directory, false), /cache is unavailable/u);
    for (const { root, version } of originalXmlSchemaVersions) {
      const file = `${originalXmlSchemaPolicy[root].repo}-${version}.xsd`;
      await copyFile(join(cache, file), join(directory, file));
    }
    assert.equal(typeof await prepareOriginalXmlSchemaValidator(directory, false), "function");
    const firstFile = join(directory, "testcenter-booklet-xml-18.0.xsd");
    await writeFile(firstFile, "tampered");
    await assert.rejects(prepareOriginalXmlSchemaValidator(directory, false), /integrity verification/u);
    await writeFile(firstFile, Buffer.alloc(256 * 1024 + 1));
    await assert.rejects(prepareOriginalXmlSchemaValidator(directory, false), /cache is unavailable/u);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("Original 19 downloader limits bytes and only requests immutable allowlisted specifications", async () => {
  const directory = await mkdtemp(join(tmpdir(), "testcenter-original-xsd-download-"));
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    assert.match(String(url), /^https:\/\/raw\.githubusercontent\.com\/iqb-specifications\/testcenter-booklet-xml\/[a-f0-9]{40}\/testcenter-booklet-xml\.xsd$/u);
    assert.equal(options?.redirect, "error");
    return new Response(Buffer.alloc(256 * 1024 + 1));
  };
  try {
    await assert.rejects(prepareOriginalXmlSchemaValidator(directory), /size limit/u);
    assert.deepEqual(await readdir(directory), []);
    globalThis.fetch = async () => new Response("tampered downloaded specification");
    await assert.rejects(prepareOriginalXmlSchemaValidator(directory), /integrity check/u);
    assert.deepEqual(await readdir(directory), []);
  } finally {
    globalThis.fetch = previousFetch;
    await rm(directory, { recursive: true, force: true });
  }
});
