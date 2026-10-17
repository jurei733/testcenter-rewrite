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
  const setup = async () => {
    const scope = { tenantKey: "owned", workspaceKey: "owned-" + (++sequence) };
    await services().platform.createWorkspace({ ...scope, displayName: "Owned XML" });
    for (const unitId of ["UNIT.SAMPLE", "UNIT.SAMPLE-2"]) {
      await services().contentIntake.createSourcePackage({ ...scope, fileName: unitId + ".xml", mediaType: "application/xml",
        sourceDocument: `<Unit><Metadata><Id>${unitId}</Id><Label>Unit �</Label></Metadata><Definition player="">Compatibility �</Definition></Unit>` });
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
    await t.test("Original 19 native XSD validation retains authored characters in the real import", async () => {
      const validate = await prepareOriginalXmlSchemaValidator(resolve(process.env.FIRST_SLICE_XML_SCHEMA_CACHE || ".data/original-xml-schemas"), false);
      const strict = createFirstSliceServices({ repository: storage.repository, xmlSchemaProfile: "original-19", originalXmlSchemaValidator: validate });
      const scope = { tenantKey: "owned", workspaceKey: "strict" };
      await strict.platform.createWorkspace({ ...scope, displayName: "Strict XML" });
      const source = await strict.contentIntake.createSourcePackage({ ...scope, fileName: "strict.xml", mediaType: "application/xml",
        sourceDocument: '<SysCheck xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="https://w3id.org/iqb/spec/testcenter-syscheck-xml/18.0"><Metadata><Id>AUTHORED.CHARACTER</Id><Label>Authored � retained</Label></Metadata><Config skipnetwork="true"><Q id="feedback" type="string" prompt="Feedback �"/></Config></SysCheck>' });
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
