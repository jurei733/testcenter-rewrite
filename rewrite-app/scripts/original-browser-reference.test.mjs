import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, mkdir, writeFile, readFile, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { verifyOriginalBuild, verifyOriginalDirectorySource, originalDirectoryReference, verifyOriginalAdministrationSource, verifyOriginalSettingsSource, verifyOriginalAssetDeletionSource, verifyOriginalSettingsPatchSource, originalBrowserSource, originalReferenceTasks, originalCaptureEnvironment } from "./original-browser-reference.mjs";
const digest = text => createHash("sha256").update(text).digest("hex");
for (const change of ['none', 'revision', 'bytes', 'excerpt', 'missing-excerpt', 'path', 'missing-file']) test(`directory Source provenance rejects substituted tables or DTOs: ${change}`, async t => {
  const root = await mkdtemp(join(tmpdir(), 'original-directory-policy-'));
  t.after(() => rm(root, {recursive: true, force: true}));
  const reference = structuredClone(originalDirectoryReference);
  for (const file of reference.files) {
    const source = file.excerpts.join('\n'); file.sha256 = digest(source);
    await mkdir(join(root, file.path, '..'), {recursive: true}); await writeFile(join(root, file.path), source);
  }
  if (change === 'revision') reference.commit = 'a'.repeat(40);
  if (change === 'bytes') await writeFile(join(root, reference.files[0].path), 'changed DAO');
  if (change === 'excerpt') reference.files[0].excerpts[0] = 'select replacement order by tenant';
  if (change === 'missing-excerpt') reference.files[0].excerpts = [];
  if (change === 'path') reference.files[0].path = '../outside.php';
  if (change === 'missing-file') reference.files.pop();
  if (change === 'none') await verifyOriginalDirectorySource(root, reference);
  else await assert.rejects(verifyOriginalDirectorySource(root, reference));
});
for (const change of ["none", "revision", "path", "bytes", "delete", "scope", "tables", "foreign-key"]) test(`asset deletion Source oracle rejects substituted provenance or SQL: ${change}`, async t => {
  const root = await mkdtemp(join(tmpdir(), "original-asset-policy-")); t.after(() => rm(root, { recursive: true, force: true }));
  const reference = { originalCommit: originalBrowserSource.commit, deleteSql: "delete from assets where id = :id",
    scopeType: "CREATE TYPE assignment_scope AS ENUM ('global', 'group', 'user');",
    tables: ["CREATE TABLE assets (id integer PRIMARY KEY);", "CREATE TABLE asset_assignment (asset_id integer REFERENCES assets(id) ON DELETE CASCADE);"], files: [] };
  const sources = [["backend/src/dao/AssetDAO.class.php", reference.deleteSql], ["backend/src/controller/AssetController.class.php", "owned controller"],
    ["scripts/database/full.sql", [reference.scopeType, ...reference.tables].join("\n")]];
  for (const [path, source] of sources) { await mkdir(join(root, path, ".."), { recursive: true }); await writeFile(join(root, path), source); reference.files.push({ path, sha256: digest(source) }); }
  if (change === "revision") reference.originalCommit = "a".repeat(40);
  if (change === "path") reference.files[0].path = "../outside.php";
  if (change === "bytes") await writeFile(join(root, reference.files[1].path), "changed controller");
  if (change === "delete") reference.deleteSql = "delete from asset_assignment";
  if (change === "scope") reference.scopeType = "CREATE TYPE foreign_scope AS ENUM ('global');";
  if (change === "tables") reference.tables.pop();
  if (change === "foreign-key") reference.tables[1] = reference.tables[1].replace("CASCADE", "RESTRICT");
  if (change === "none") await verifyOriginalAssetDeletionSource(root, reference);
  else await assert.rejects(verifyOriginalAssetDeletionSource(root, reference));
});
for (const change of ["none","file","handler","reloadHandler","mutationHandler","revision","path"]) test(`administration Source oracle validates real file bytes and embedded methods: ${change}`,async t=>{
  const root=await mkdtemp(join(tmpdir(),"original-administration-policy-"));t.after(()=>rm(root,{recursive:true,force:true}));
  const reference={version:1,repository:originalBrowserSource.repository,commit:originalBrowserSource.commit,sources:[]};
  for(const folder of ["users","workspaces"]){
    const path=`frontend/src/app/superadmin/${folder}/${folder}.component.ts`,handler="selectPermissions(row, role) { row.role = role; }";
    const reloadHandler='reload() { this.selection.clear(); }',mutationHandler='change() { this.reload(); }';
    const source=`export class Owned { ${handler} ${reloadHandler} ${mutationHandler} }`;
    await mkdir(join(root,"frontend/src/app/superadmin",folder),{recursive:true});await writeFile(join(root,path),source);
    reference.sources.push({path,sha256:digest(source),handler,reloadHandler,mutationHandler});
  }
  if(change==="file")await writeFile(join(root,reference.sources[0].path),"changed source bytes");
  if(change==="handler")reference.sources[0].handler="selectPermissions() { throw Error('replacement'); }";
  if(change==="reloadHandler" || change==="mutationHandler")reference.sources[0][change]='unrelated() { this.keepSelection(); }';
  if(change==="revision")reference.commit="a".repeat(40);
  if(change==="path")reference.sources[0].path="../outside.ts";
  if(change==="none")await verifyOriginalAdministrationSource(root,reference);
  else await assert.rejects(verifyOriginalAdministrationSource(root,reference));
});
async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), "original-build-policy-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const previous = process.env.GITHUB_SHA;
  process.env.GITHUB_SHA = "a".repeat(40);
  t.after(() => { if (previous === undefined) delete process.env.GITHUB_SHA; else process.env.GITHUB_SHA = previous; });
  await writeFile(join(root, "index.html"), "owned original index");
  await mkdir(join(root, "assets"));
  await writeFile(join(root, "assets/font.woff2"), "owned font bytes");
  await writeFile(join(root, "assets/.browserslistrc"), "owned browser targets");
  const manifest = { version: 1, appCommit: process.env.GITHUB_SHA, source: originalBrowserSource,
    node: 22, platform: process.platform, architecture: process.arch,
    files: { "assets/.browserslistrc": digest("owned browser targets"), "assets/font.woff2": digest("owned font bytes"), "index.html": digest("owned original index") } };
  const save = () => writeFile(join(root, "original-reference-manifest.json"), JSON.stringify(manifest));
  await save(); return { root, manifest, save };
}
test("a same-run Original build verifies actual compiled files and nested assets", async t => {
  const f = await fixture(t); assert.deepEqual(await verifyOriginalBuild(f.root), f.manifest);
});
for (const [field, value] of [["version", 2], ["appCommit", "b".repeat(40)], ["node", 24], ["platform", "foreign"], ["architecture", "foreign"]]) {
  test(`a foreign ${field} cannot supply an Original reference`, async t => {
    const f = await fixture(t); f.manifest[field] = value; await f.save();
    await assert.rejects(verifyOriginalBuild(f.root));
  });
}
for (const field of ["repository", "commit", "frontendLockSha256"]) test(`Original ${field} is pinned independently of the consuming branch`, async t => {
  const f = await fixture(t); f.manifest.source = { ...originalBrowserSource, [field]: "foreign" }; await f.save();
  await assert.rejects(verifyOriginalBuild(f.root));
});
for (const change of ["corrupt", "extra", "missing", "symlink", "directory-link"]) test(`Original reference rejects ${change} filesystem content`, async t => {
  const f = await fixture(t);
  if (change === "corrupt") await writeFile(join(f.root, "assets/font.woff2"), "changed bytes");
  if (change === "extra") await writeFile(join(f.root, "extra.html"), "unexpected");
  if (change === "missing") await rm(join(f.root, "index.html"));
  if (change === "symlink") { await rm(join(f.root, "index.html")); await symlink("assets/font.woff2", join(f.root, "index.html")); }
  if (change === "directory-link") await symlink("assets", join(f.root, "linked-assets"));
  await assert.rejects(verifyOriginalBuild(f.root));
});
test("capture tasks cover each renderer family without duplicates or substituted Source", async () => {
  assert.deepEqual(Object.keys(originalReferenceTasks), ["entry", "dialogs", "starter", "administration", "directory"]);
  const tasks = Object.values(originalReferenceTasks).flat();
  assert.equal(tasks.length, 23); assert.equal(new Set(tasks.map(task => task.name)).size, tasks.length);
  assert.deepEqual(tasks.map(task => task.name).filter(name => !['directory','entry-viewports','starter-viewports','starter-empty-viewports'].includes(name)).sort(), [
    'system-check-welcome', 'login', 'insecure-participant', 'insecure-admin', 'header-login', 'header-admin', 'header-starter',
    'exit', 'completeness', 'legacy-completeness', 'runtime', 'runtime-contract', 'version-missing', 'version-unsupported',
    'starter', 'paused', 'paused-locked', 'advisories', 'settings'
  ].sort(), 'The new directory family cannot replace any of the prior 19 Source tasks');
  assert.deepEqual(originalReferenceTasks.directory, [{name: 'directory', script: 'reference-original-administration-directory.mjs', environment: {}, output: 'directory.json'}]);
  assert.deepEqual(originalReferenceTasks.entry.filter(task=>task.name==='entry-viewports'),
    [{name:'entry-viewports',script:'reference-original-participant-entry-viewports.mjs',environment:{},output:'entry-viewports.json'}]);
  assert.deepEqual(originalReferenceTasks.starter.filter(task=>task.name==='starter-viewports'),
    [{name:'starter-viewports',script:'reference-original-starter-viewports.mjs',environment:{},output:'starter-viewports.json'}]);
  assert.deepEqual(originalReferenceTasks.starter.filter(task=>task.name==='starter-empty-viewports'),
    [{name:'starter-empty-viewports',script:'reference-original-starter-empty-viewports.mjs',environment:{},output:'starter-viewports.json'}]);
  for (const task of tasks) {
    assert.match(task.script, /^reference-original-[\w-]+\.mjs$/);
    await readFile(new URL(task.script, import.meta.url));
  }
});
test("the capture family cannot inherit a single-case selector, unrelated scenario or alternate browser", () => {
  const parent = { ORIGINAL_RUNTIME_CONTRACT: "true", ORIGINAL_PAUSED_LOCK_ONLY: "true", ORIGINAL_RUNTIME_COMMAND_OVERLAP: "pending-pause",
    REFERENCE_SINGLE: "true", REFERENCE_COMPLETENESS: "true", ORIGINAL_LOGIN_REFERENCE_INSECURE: "true", ORIGINAL_PLAYER_VERSION_ERROR: "unsupported", UI_SMOKE_BROWSER_CHANNEL: "foreign",
    UI_SMOKE_HEADFUL: "true", CI: "true" };
  const environment = originalCaptureEnvironment(parent, originalReferenceTasks.entry.find(task => task.name === "login"), "/owned/source", "/owned/evidence");
  for (const key of Object.keys(parent).filter(key => !["UI_SMOKE_HEADFUL", "CI"].includes(key))) assert.equal(environment[key], undefined, key);
  assert.equal(environment.CI, "true"); assert.equal(environment.UI_SMOKE_HEADFUL, "true");
  assert.equal(environment.ORIGINAL_LOGIN_REFERENCE_ROOT, "/owned/source");
  assert.equal(environment.ORIGINAL_REFERENCE_CAPTURE_ONLY, "true");
  const selected = originalCaptureEnvironment(parent, originalReferenceTasks.entry.find(task => task.name === "insecure-admin"), "/owned/source", "/owned/evidence");
  assert.equal(selected.ORIGINAL_LOGIN_REFERENCE_INSECURE, "true"); assert.equal(selected.ORIGINAL_LOGIN_REFERENCE_ENTRY, "admin");
});

for(const changed of [false,true]) test(`settings catalog matches the unchanged Source bytes: changed=${changed}`,async t=>{
 const root=await mkdtemp(join(tmpdir(),"original-settings-source-"));t.after(()=>rm(root,{recursive:true,force:true}));
 const path="definitions/testtaker/custom-texts.json",source=JSON.stringify({login_subtitle:{label:"Owned label",defaultvalue:"Owned default"}});
 await mkdir(join(root,"definitions/testtaker"),{recursive:true});await writeFile(join(root,path),changed?"changed":source);
 const reference={originalCommit:originalBrowserSource.commit,files:[{path,source,sha256:digest(source)}]};
 if(changed)await assert.rejects(verifyOriginalSettingsSource(root,reference));else await verifyOriginalSettingsSource(root,reference);
});

for(const change of ['none','bytes','excerpt','sql','revision','path'])test('settings patch Source oracle rejects substituted handlers, provenance or SQL: '+change,async t=>{
 const root=await mkdtemp(join(tmpdir(),'original-settings-patch-'));t.after(()=>rm(root,{recursive:true,force:true}));
 const reference=JSON.parse(await readFile(new URL('../test-fixtures/original-testcenter/current-settings-patch-reference.json',import.meta.url),'utf8'));
 for(const file of reference.files){const source=file.excerpt;await mkdir(join(root,file.path,'..'),{recursive:true});await writeFile(join(root,file.path),source);file.sha256=digest(source);}
 if(change==='bytes')await writeFile(join(root,reference.files[0].path),'Changed controller');
 if(change==='excerpt')reference.files[2].excerpt='this.backendService.setCustomTexts({entireMap:true})';
 if(change==='sql')reference.sql.update='delete from meta';
 if(change==='revision')reference.originalCommit='a'.repeat(40);
 if(change==='path')reference.files[0].path='../outside.php';
 if(change==='none')await verifyOriginalSettingsPatchSource(root,reference);else await assert.rejects(verifyOriginalSettingsPatchSource(root,reference));
});
