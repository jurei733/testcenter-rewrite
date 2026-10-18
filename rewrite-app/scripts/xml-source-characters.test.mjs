import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import iconv from "iconv-lite";
import { Pool } from "pg";
import { createFirstSliceServices, prepareOriginalXmlSchemaValidator } from "@testcenter-rewrite-app/application";
import { createInMemoryFirstSliceRepository } from "@testcenter-rewrite-app/memory-store";
import { createFileFirstSliceStorage } from "@testcenter-rewrite-app/file-store";
import { createSqliteFirstSliceStorage } from "@testcenter-rewrite-app/sqlite-store";
import { createPostgresFirstSliceStorage } from "@testcenter-rewrite-app/postgres-store";

const fixtureRoot = new URL("../test-fixtures/original-testcenter/", import.meta.url);
const corpus = JSON.parse(await readFile(new URL("corpus.json", fixtureRoot), "utf8"));
const bookletXml = await readFile(new URL(corpus.booklets[0].fixture, fixtureRoot), "utf8");
const encodeUtf7Xml = xml => {
  const declarationEnd = xml.indexOf("?>") + 2;
  assert.ok(declarationEnd > 1);
  return Buffer.concat([Buffer.from(xml.slice(0, declarationEnd), "ascii"),
    iconv.encode(xml.slice(declarationEnd), "utf7")]);
};
const undefinedBytes = [
  ["IBM857", [0xd5, 0xe7, 0xf2]],
  ["IBM864", [0x9b, 0x9c, 0x9f, 0xa6, 0xa7, 0xff]],
  ["IBM869", [0x80, 0x81, 0x82, 0x83, 0x84, 0x85, 0x87, 0x93, 0x94]]
];
const kinds = ["memory", "file", "sqlite"];
if (process.env.FIRST_SLICE_STORE === "postgres") {
  assert.ok(process.env.FIRST_SLICE_POSTGRES_URL);
  kinds.push("postgres");
}

for (const kind of kinds) test(`${kind}: XML distinguishes authored U+FFFD from undefined encoded bytes`, async t => {
  const directory = await mkdtemp(join(tmpdir(), "testcenter-xml-characters-"));
  const schema = "owned_xml_characters_" + randomUUID().replaceAll("-", "");
  const postgresUrl = kind === "postgres" ? new URL(process.env.FIRST_SLICE_POSTGRES_URL) : null;
  postgresUrl?.searchParams.set("options", `-c search_path=${schema}`);
  const root = postgresUrl ? new Pool({ connectionString: process.env.FIRST_SLICE_POSTGRES_URL }) : null;
  let storage, schemaCreated = false, sequence = 0;
  const retained = [], retainedChecks = [];
  const open = async () => {
    storage = kind === "memory" ? storage ?? { repository: createInMemoryFirstSliceRepository(), shutdown: async () => {} }
      : kind === "file" ? await createFileFirstSliceStorage(join(directory, "owned.json"))
      : kind === "sqlite" ? await createSqliteFirstSliceStorage(join(directory, "owned.sqlite"))
      : await createPostgresFirstSliceStorage(postgresUrl.toString());
  };
  const services = () => createFirstSliceServices({ repository: storage.repository, xmlSchemaProfile: "legacy-compatibility" });
  const setup = async (utf7Units = false) => {
    const scope = { tenantKey: "owned", workspaceKey: "owned-" + (++sequence) };
    await services().platform.createWorkspace({ ...scope, displayName: "Owned XML" });
    for (const unitId of ["UNIT.SAMPLE", "UNIT.SAMPLE-2"]) {
      const xml = `<Unit><Metadata><Id>${unitId}</Id><Label>Unit �</Label></Metadata><Definition player="">Compatibility �</Definition></Unit>`;
      await services().contentIntake.createSourcePackage({ ...scope, fileName: unitId + ".xml", mediaType: "application/xml",
        sourceDocument: utf7Units ? "data:application/xml;base64," + encodeUtf7Xml('<?xml version="1.0" encoding="UTF-7"?>' + xml).toString("base64") : xml });
    }
    return scope;
  };
  const importBytes = async (scope, bytes) => {
    const source = await services().contentIntake.createSourcePackage({ ...scope, fileName: "owned.xml", mediaType: "application/xml",
      sourceDocument: "data:application/xml;base64," + bytes.toString("base64") });
    return { source, result: await services().contentIntake.createImportJob({ ...scope, sourcePackageId: source.sourcePackageId }) };
  };
  const releases = source => storage.repository.listContentReleasesByWorkspace(source.tenantId, source.workspaceId);
  try {
    if (root) { await root.query(`CREATE SCHEMA "${schema}"`); schemaCreated = true; }
    await open();
    await services().platform.createTenant({ tenantKey: "owned", displayName: "Owned XML" });
    for (const encoding of ["utf-8", "utf-16le", "utf-16be"]) await t.test(`${encoding}: authored character survives Booklet and Unit projection`, async () => {
      const xml = bookletXml.replace(/encoding=["']utf-8["']/i, `encoding="${encoding}"`)
        .replace("<Label>Sample booklet</Label>", "<Label>Authored � retained</Label>");
      const { source, result } = await importBytes(await setup(), iconv.encode(xml, encoding));
      assert.equal(result.status, "completed", JSON.stringify(result.diagnostics));
      assert.deepEqual(result.diagnostics, []);
      const saved = await releases(source);
      assert.equal(saved.length, 1);
      assert.equal(saved[0].runtimeSnapshot.bookletEntries[0].displayLabel, "Authored � retained");
      assert.deepEqual(saved[0].runtimeSnapshot.bookletEntries[0].unitEntries.map(unit => unit.unitKey), corpus.booklets[0].unitKeys);
      assert.ok(saved[0].runtimeSnapshot.bookletEntries[0].unitEntries.every(unit => unit.unitDefinition.includes("Compatibility �")));
      retained.push({ source, saved });
    });
    for (const [encoding, bytes] of undefinedBytes) for (const byte of bytes) await t.test(`${encoding}: undefined byte 0x${byte.toString(16)} fails before release`, async () => {
      const xml = bookletXml.replace(/encoding=["']utf-8["']/i, `encoding="${encoding}"`);
      const offset = xml.indexOf("Sample booklet");
      assert.ok(offset >= 0);
      const raw = Buffer.concat([iconv.encode(xml.slice(0, offset), encoding), Buffer.from([byte]),
        iconv.encode(xml.slice(offset + "Sample booklet".length), encoding)]);
      const { source, result } = await importBytes(await setup(), raw);
      assert.equal(result.status, "failed");
      assert.ok(result.diagnostics.some(diagnostic => diagnostic.code === "source_document_xml_encoding_invalid_bytes"), JSON.stringify(result.diagnostics));
      assert.deepEqual(await releases(source), []);
    });
    for (const encoding of ["UTF-7", "UTF7", "UTF_7", "unicode-1-1-utf-7"]) await t.test(`${encoding}: declared XML retains authored Unicode and replacement characters`, async () => {
      const xml = bookletXml.replace(/encoding=["']utf-8["']/i, `encoding="${encoding}"`)
        .replace("<Label>Sample booklet</Label>", "<Label>Ä + 日本 😀 �</Label>");
      const { source, result } = await importBytes(await setup(true), encodeUtf7Xml(xml));
      assert.equal(result.status, "completed", JSON.stringify(result.diagnostics));
      assert.deepEqual(result.diagnostics, []);
      const saved = await releases(source);
      assert.equal(saved.length, 1);
      assert.equal(saved[0].runtimeSnapshot.bookletEntries[0].displayLabel, "Ä + 日本 😀 �");
      assert.ok(saved[0].runtimeSnapshot.bookletEntries[0].unitEntries.every(unit => unit.unitDefinition.includes("Compatibility �")));
      retained.push({ source, saved });
    });
    for (const invalid of ["+A-", "+AGEA-", "+AOQ/-", "+2AA-", "+3AA-", "+2AA-+3AA-", "+////-", "~", "\\", "\xff"]) await t.test(`UTF-7 rejects corrupt XML bytes ${JSON.stringify(invalid)} without publishing`, async () => {
      const xml = bookletXml.replace(/encoding=["']utf-8["']/i, 'encoding="UTF-7"')
        .replace("<Label>Sample booklet</Label>", `<Label>${invalid}</Label>`);
      const { source, result } = await importBytes(await setup(), Buffer.from(xml, "latin1"));
      assert.equal(result.status, "failed");
      assert.ok(result.diagnostics.some(diagnostic => diagnostic.code === "source_document_xml_encoding_invalid_bytes"), JSON.stringify(result.diagnostics));
      assert.deepEqual(await releases(source), []);
    });
    await t.test("UTF-7 decoding retains XML DOCTYPE rejection", async () => {
      const xml = bookletXml.replace(/encoding=["']utf-8["']/i, 'encoding="UTF-7"')
        .replace("?>", '?><!DOCTYPE Booklet [<!ENTITY owned "owned">]>');
      const { source, result } = await importBytes(await setup(), encodeUtf7Xml(xml));
      assert.equal(result.status, "failed");
      assert.ok(result.diagnostics.some(diagnostic => diagnostic.code === "source_document_xml_doctype_unsupported"), JSON.stringify(result.diagnostics));
      assert.deepEqual(await releases(source), []);
    });
    await t.test("UTF-7 MIME charset cannot decode JSON transport text", async () => {
      const scope = await setup();
      const title = "<?xml encoding='UTF-7'?> +AMQ-";
      const json = JSON.stringify({ manifest: { booklets: [{ bookletKey: "owned-json", title, unitRefs: "owned-unit" }] } });
      const source = await services().contentIntake.createSourcePackage({ ...scope, fileName: "owned.json", mediaType: "application/json",
        sourceDocument: "data:application/json;charset=UTF-7;base64," + Buffer.from(json).toString("base64") });
      const result = await services().contentIntake.createImportJob({ ...scope, sourcePackageId: source.sourcePackageId });
      assert.equal(result.status, "completed", JSON.stringify(result.diagnostics));
      const saved = await releases(source);
      assert.equal(saved[0].runtimeSnapshot.bookletEntries[0].displayLabel, title);
      retained.push({ source, saved });
    });
    await t.test("UTF-7 requires an XML declaration rather than a MIME-only charset", async () => {
      const scope = await setup();
      const xml = bookletXml.replace(/^<\?xml[^>]*>\s*/i, "")
        .replace("<Label>Sample booklet</Label>", "<Label><![CDATA[<?xml encoding='UTF-7'?> +AMQ-]]></Label>");
      const source = await services().contentIntake.createSourcePackage({ ...scope, fileName: "charset.xml", mediaType: "application/xml",
        sourceDocument: "data:application/xml;charset=UTF-7;base64," + Buffer.from(xml).toString("base64") });
      const result = await services().contentIntake.createImportJob({ ...scope, sourcePackageId: source.sourcePackageId });
      assert.equal(result.status, "failed");
      assert.ok(result.diagnostics.some(diagnostic => diagnostic.code === "source_document_xml_encoding_unsupported"), JSON.stringify(result.diagnostics));
      assert.deepEqual(await releases(source), []);
    });
    await t.test("UTF-8 BOM cannot claim UTF-7 encoding", async () => {
      const xml = bookletXml.replace(/encoding=["']utf-8["']/i, 'encoding="UTF-7"');
      const { source, result } = await importBytes(await setup(), Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(xml)]));
      assert.equal(result.status, "failed");
      assert.ok(result.diagnostics.some(diagnostic => diagnostic.code === "source_document_xml_encoding_mismatch"), JSON.stringify(result.diagnostics));
      assert.deepEqual(await releases(source), []);
    });
    for (const encoding of ["UTF-8", "UTF-7"]) await t.test(`Original 19 native XSD validation retains authored characters in ${encoding}`, async () => {
      const validate = await prepareOriginalXmlSchemaValidator(resolve(process.env.FIRST_SLICE_XML_SCHEMA_CACHE || ".data/original-xml-schemas"), false);
      const strict = createFirstSliceServices({ repository: storage.repository, xmlSchemaProfile: "original-19", originalXmlSchemaValidator: validate });
      const scope = { tenantKey: "owned", workspaceKey: "strict-" + encoding.toLowerCase() };
      await strict.platform.createWorkspace({ ...scope, displayName: "Strict XML" });
      const xml = `<?xml version="1.0" encoding="${encoding}"?><SysCheck xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="https://w3id.org/iqb/spec/testcenter-syscheck-xml/18.0"><Metadata><Id>AUTHORED.CHARACTER</Id><Label>Authored � retained</Label></Metadata><Config skipnetwork="true"><Q id="feedback" type="string" prompt="Feedback �"/></Config></SysCheck>`;
      const source = await strict.contentIntake.createSourcePackage({ ...scope, fileName: "strict.xml", mediaType: "application/xml",
        sourceDocument: "data:application/xml;base64," + (encoding === "UTF-7" ? encodeUtf7Xml(xml) : Buffer.from(xml)).toString("base64") });
      const result = await strict.contentIntake.createImportJob({ ...scope, sourcePackageId: source.sourcePackageId });
      assert.equal(result.status, "completed", JSON.stringify(result.diagnostics));
      assert.deepEqual(result.diagnostics, []);
      const saved = await strict.systemCheck.listSystemChecks(scope);
      assert.equal(saved.length, 1);
      assert.equal(saved[0].displayLabel, "Authored � retained");
      assert.equal(saved[0].questions[0].prompt, "Feedback �");
      retainedChecks.push({ scope, saved });
    });
    await t.test("durable reopen retains exact authored characters and all release data", async () => {
      await storage.shutdown();
      await open();
      for (const { source, saved } of retained) assert.deepEqual(await releases(source), saved);
      for (const { scope, saved } of retainedChecks) assert.deepEqual(await services().systemCheck.listSystemChecks(scope), saved);
    });
  } finally {
    await storage?.shutdown();
    if (schemaCreated) await root.query(`DROP SCHEMA "${schema}" CASCADE`);
    await root?.end();
    await rm(directory, { recursive: true, force: true });
  }
});
