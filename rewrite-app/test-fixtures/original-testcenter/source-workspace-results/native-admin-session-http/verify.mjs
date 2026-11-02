import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
const out=process.env.ORIGINAL_ADMIN_OUTPUT_DIR,original=process.env.ORIGINAL_ADMIN_SOURCE_ROOT;assert.ok(out&&original);
const hash=v=>createHash('sha256').update(v).digest('hex'),data=JSON.parse(await readFile(join(out,'observations.json'),'utf8'));
assert.equal(data.verified,true);assert.equal(data.rows.length,107);assert.equal(new Set(data.rows.map(r=>r.label)).size,107);assert.equal(data.sourceFilesVerifiedBeforeAndAfter,137);
for(const [path,digest]of Object.entries(data.sourceHashes))assert.equal(hash(await readFile(join(original,path))),digest,path);
const row=label=>{const found=data.rows.find(r=>r.label===label);assert.ok(found,label);return found;};
for(const r of data.rows){assert.equal(hash(r.rawText),r.redactedBodySha256,r.label);assert.ok([200,201,205,207,400,401,403,404,405,429,500].includes(r.status),r.label);if(r.status>=400){assert.equal(r.testMode,'NO',r.label);assert.ok(r.errorId,r.label);}}
for(const vendor of data.vendors){assert.equal(vendor.installedPackages,19);assert.equal(vendor.requiredProductionPackages,19);}
assert.equal(row('root-first').value.id,1);assert.deepEqual(row('root-first').value.claims,{workspaceAdmin:[],superAdmin:[]});
assert.deepEqual(row('user-no-workspaces').value.claims,{workspaceAdmin:[]});assert.equal(row('user-no-workspaces').status,200);
assert.equal(row('admin-case-folded-name').value.loginName,'OwnedÄdmin');assert.equal(row('admin-leading-space-name').status,400);assert.equal(row('admin-trailing-space-name').status,400);
assert.notEqual(row('admin-no-grants').value.token,row('admin-case-folded-name').value.token);assert.equal(row('old-admin-token-rotated').status,403);
assert.deepEqual(row('session-live-explicit-grants').value.claims.workspaceAdmin.map(w=>[w.id,w.flags.mode]),[['1','RO'],['2','RW']]);assert.equal(row('session-live-renamed-label').value.claims.workspaceAdmin[0].label,'Changed current workspace β');
assert.deepEqual(row('session-live-all-grants-revoked').value.claims,{workspaceAdmin:[]});assert.equal(row('revoked-workspace-hidden').status,404);
assert.ok(Object.hasOwn(row('session-live-promoted').value.claims,'superAdmin'));assert.ok(!Object.hasOwn(row('session-live-demoted').value.claims,'superAdmin'));
assert.equal(row('session-after-self-password-change').value.pwSetByAdmin,false);assert.equal(row('session-after-root-password-reset').value.pwSetByAdmin,true);
assert.equal(row('protected-admin-proof-replay').status,200);assert.equal(row('rate-correct-still-denied').status,429);assert.equal(row('case-variant-rate-bucket').status,200);
assert.equal(row('same-name-participant-solution').value.id,null);assert.equal(row('same-name-participant-solution').value.groupLabel,'Owned');assert.equal(row('same-name-admin-refresh').value.id,2);assert.equal(row('same-name-admin-refresh').value.groupLabel,null);
assert.ok(data.sqlReadsOnly.every(r=>/^(SELECT|SHOW) /.test(r.query)));assert.ok(BigInt(data.sqlReadsOnly.find(r=>r.label==='admin-expiry-after-refresh').rawText)>BigInt(data.sqlReadsOnly.find(r=>r.label==='admin-expiry-before-refresh').rawText));
const runtime={};
for(const [role,container]of Object.entries({open:'source-native-admin-session-r58-backend-1',protected:'source-native-admin-session-r58-backend-protected-1'})){
 const php=`define('ROOT_DIR','/var/www/testcenter');require ROOT_DIR.'/backend/vendor/autoload.php';SystemConfig::readEnvironment();echo json_encode(['version'=>SystemConfig::$system_version,'xmlSchemaValidation'=>SystemConfig::$xmlSchema_validation,'allowTestMode'=>SystemConfig::$debug_allowTestMode,'staticTime'=>SystemConfig::$debug_useStaticTime,'staticTokens'=>SystemConfig::$debug_useStaticTokens,'insecurePasswords'=>SystemConfig::$debug_useInsecurePasswords,'protection'=>SystemConfig::$bruteForceProtection_sessions]);`;
 const bytes=execFileSync('docker',['exec',container,'php','-r',php]),r=JSON.parse(bytes);assert.equal(r.version,'19.0.0');assert.equal(r.xmlSchemaValidation,true);assert.equal(r.allowTestMode,false);assert.equal(r.staticTokens,false);assert.equal(r.insecurePasswords,false);assert.equal(r.staticTime,'now');assert.deepEqual(r.protection,role==='open'?['login','person']:['admin','login','person']);runtime[role]=r;
 for(const path of ['package.json','definitions/compatibility.json'])assert.equal(execFileSync('docker',['exec',container,'php','-r','echo hash_file("sha256",$argv[1]);','/var/www/testcenter/'+path],{encoding:'utf8'}),hash(await readFile(join(original,path))));
}
const php=`define('ROOT_DIR','/var/www/testcenter');require ROOT_DIR.'/backend/vendor/autoload.php';echo json_encode(AccessSet::createFromAdminToken(new Admin(9007199254740993,'Owned Native Ω','',true,'owned-method-only',true),new WorkspaceData(9007199254740995,'Owned Workspace β','RO')));`;
const methodText=execFileSync('docker',['exec','source-native-admin-session-r58-backend-1','php','-r',php],{encoding:'utf8'});assert.ok(methodText.includes('"id":9007199254740993'));assert.ok(methodText.includes('"id":"9007199254740995"'));assert.equal(JSON.parse(methodText).claims.workspaceAdmin[0].flags.mode,'RO');
await writeFile(join(out,'php-access-set.json'),JSON.stringify({actualUnchangedSourceMethod:'AccessSet::createFromAdminToken',actualPhpInvocation:php,rawText:methodText,sha256:hash(methodText),noSqlOrHttpRequest:true,scope:'Pure Source serializer witness for unsafe int64 User ID and decimal-string Workspace claim ID; not real high-ID database history.'},null,2)+'\n');
const files={};for(const name of ['capture.mjs','compose.yml','observations.json','php-access-set.json'])files[name]=hash(await readFile(join(out,name)));
const receipt={verified:true,actualSourceHttpRequests:107,sourceCommit:data.sourceCommit,sourceFilesBeforeAndAfter:137,additionalSourceFilesVerifiedAfterCapture:2,composerPackagesPerBackend:19,backendCount:2,runtime,actualUnchangedPhpSerializerWitnesses:1,mutationsOverHttp:true,sqlReadOnlyQueries:data.sqlReadsOnly.length,noSqlSeedsOrDaoStubs:true,sourceOriginalReadOnly:true,files};
await writeFile(join(out,'independent-verification.json'),JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify(receipt));
