import assert from 'node:assert/strict';
import {createHash, randomUUID} from 'node:crypto';
import {mkdtemp, readFile, rm, rename, mkdir, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import test from 'node:test';
import {DatabaseSync} from 'node:sqlite';
import {Pool} from 'pg';
import {createFirstSliceServices, prepareOriginalTestLock, parseOriginalTestName, prepareOriginalTestNumber,prepareOriginalWorkspaceNumber,parseOriginalTestStatePatch,applyOriginalTestStatePatch,formatOriginalTestReadJson,formatOriginalUnitReadJson,formatOriginalTestLogEntry,decodeOriginalTestLogJson,parseOriginalTestLogEntries} from '@testcenter-rewrite-app/application';
import {createInMemoryFirstSliceRepository} from '@testcenter-rewrite-app/memory-store';
import {createFileFirstSliceStorage} from '@testcenter-rewrite-app/file-store';
import {createSqliteFirstSliceStorage, SQLITE_FIRST_SLICE_SCHEMA_VERSION} from '@testcenter-rewrite-app/sqlite-store';
import {createPostgresFirstSliceStorage, POSTGRES_FIRST_SLICE_SCHEMA_VERSION} from '@testcenter-rewrite-app/postgres-store';
import {prepareOriginalXmlSchemaValidator} from '../packages/application/dist/packages/application/src/original-xml-schema.js';
import {formatOriginalLogReport} from '../packages/application/dist/packages/application/src/original-workspace-report-wire.js';
import {createProductionApiServer} from '../apps/api/dist/apps/api/src/index.js';

const evidence = new URL('../test-fixtures/original-testcenter/source-workspace-results/native-test-creation/', import.meta.url);
const manifest = JSON.parse(await readFile(new URL('manifest.json', evidence), 'utf8'));
const receipt = JSON.parse(await readFile(new URL('receipt.json', evidence), 'utf8'));
const checks = new Map(receipt.checks.map(row => [row.name, row]));
const native = checks.get('native Test PUT accepts a real workspace Booklet outside current assignments, returns raw decimal201 and leaves it unopened');
const names = checks.get('native Test PUT reuses case-equivalent and whitespace-normalized names while canonicalizing duplicate preset keys in first-key order');
const labels = checks.get('native Test PUT retains the first raw physical Booklet label and rejects a locked unopened Test before opening');
const removed = checks.get('native Test PUT resolves an already owned raw name before physical-file lookup but a normalization miss and new person require the current file');
const validator = await prepareOriginalXmlSchemaValidator(resolve(process.env.FIRST_SLICE_XML_SCHEMA_CACHE || '.data/original-xml-schemas'), process.env.FIRST_SLICE_XML_SCHEMA_DOWNLOAD !== 'false');
const readEvidence=new URL('../test-fixtures/original-testcenter/source-workspace-results/native-test-read/',import.meta.url);
const readManifest=JSON.parse(await readFile(new URL('manifest.json',readEvidence),'utf8'));
const readReceipt=JSON.parse(await readFile(new URL('receipt.json',readEvidence),'utf8'));
const typedSource=readReceipt.checks.find(row=>row.name.startsWith('native Test state preserves'));
const batchSource=readReceipt.checks.find(row=>row.name.startsWith('native Test state clocks'));
const unitEvidence=new URL('../test-fixtures/original-testcenter/source-workspace-results/native-unit-transport/',import.meta.url);
const unitManifest=JSON.parse(await readFile(new URL('manifest.json',unitEvidence),'utf8'));
const unitReceipt=JSON.parse(await readFile(new URL('receipt.json',unitEvidence),'utf8'));
const logEvidence=new URL('../test-fixtures/original-testcenter/source-workspace-results/native-test-log/',import.meta.url);
const logManifest=JSON.parse(await readFile(new URL('manifest.json',logEvidence),'utf8')),logReceipt=JSON.parse(await readFile(new URL('receipt.json',logEvidence),'utf8'));
const nativeLogRows=JSON.parse(await readFile(new URL('testlog-append.json',logEvidence),'utf8'));
const nativeLogDefaults=logReceipt.checks.find(row=>row.name.startsWith('native Testlog defaults'));
const nativeLogTyped=logReceipt.checks.find(row=>row.name.startsWith('native Testlog preserves typed'));
const nativeLogDuplicates=logReceipt.checks.find(row=>row.name.startsWith('native Testlog appends repeated'));
const codecEvidence=new URL('../test-fixtures/original-testcenter/source-workspace-results/native-test-log-codec/',import.meta.url);
const codecManifest=JSON.parse(await readFile(new URL('manifest.json',codecEvidence),'utf8')),codecReceipt=JSON.parse(await readFile(new URL('receipt.json',codecEvidence),'utf8'));
const codecRows=JSON.parse(await readFile(new URL('testlog-codec.json',codecEvidence),'utf8'));
const codecEscaped=codecReceipt.checks[48],codecStrict=codecReceipt.checks[49],codecNumbers=codecReceipt.checks[50];
const boundaryEvidence=new URL('../test-fixtures/original-testcenter/source-workspace-results/native-test-log-boundaries/',import.meta.url);
const boundaryReceipt=JSON.parse(await readFile(new URL('receipt.json',boundaryEvidence),'utf8')),boundaryManifest=JSON.parse(await readFile(new URL('manifest.json',boundaryEvidence),'utf8'));
const boundaryCases=boundaryReceipt.checks[51].boundaries;
const floatEvidence=new URL('../test-fixtures/original-testcenter/source-workspace-results/native-test-log-floats/',import.meta.url);
const floatReceipt=JSON.parse(await readFile(new URL('receipt.json',floatEvidence),'utf8')),floatManifest=JSON.parse(await readFile(new URL('manifest.json',floatEvidence),'utf8'));
const floatCases=floatReceipt.checks[52].values,floatReportRows=JSON.parse(await readFile(new URL('testlog-codec-floats.json',floatEvidence),'utf8'));

const lockEvidence=new URL('../test-fixtures/original-testcenter/source-workspace-results/native-test-lock/',import.meta.url);
const lockReceipt=JSON.parse(await readFile(new URL('receipt.json',lockEvidence),'utf8')),lockManifest=JSON.parse(await readFile(new URL('manifest.json',lockEvidence),'utf8'));
const lockCases=lockReceipt.checks[54].outcomes,lockReportRows=JSON.parse(await readFile(new URL('test-lock.json',lockEvidence),'utf8'));

const stamp = '2026-10-26T00:00:00.000Z', password = 'Owned-native-create-secret';
const schemas = {Unit:'unit-xml/17.6',Booklet:'testcenter-booklet-xml/18.0',Testtakers:'testcenter-testtaker-xml/18.0'};
const xml = (type, body) => `<${type} xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="https://w3id.org/iqb/spec/${schemas[type]}">${body}</${type}>`;
const booklet = (id, label, timed = false) => xml('Booklet', `<Metadata><Id>${id}</Id><Label>${label}</Label></Metadata><Units>${timed?'<Testlet id="timed" label="Timed"><Restrictions><TimeMax minutes="1"/></Restrictions>':''}<Unit id="OWNED.NATIVE.UNIT" label="Owned Unit"/>${timed?'</Testlet>':''}</Units>`);
const denied = (status, code) => error => {assert.equal(error.statusCode, status); if(code) assert.equal(error.errorCode, code); return true;};

test('unchanged production Source33 qualifies the native creation boundary and retains every prior control', async () => {
  assert.equal(manifest.sourceCommit, 'eedae41840cbe90e5547c0211da818bdf620f5aa');
  assert.equal(manifest.probeCommit, '9009dcb83d05c356e26cb5816ed0e25b396ea8bc'); assert.equal(manifest.runId,40241983022);
  assert.equal(manifest.artifactSha256,'06ec057af193651d014f690f59bf1538882fce947dea18125790fe07c519c658');
  assert.equal(manifest.sourceProbeSha256,'30380b98c37dfad0f9dbb80961c12feaa08e5cd92cf029f2f50c8492ce742de0');
  assert.equal(receipt.success,true);assert.equal(receipt.testMode,false);assert.equal(receipt.checks.length,33);assert.equal(Object.keys(receipt.sourceFiles).length,26);
  assert.equal(manifest.preservedPriorGroups,28);assert.equal(manifest.preservedPriorAssertionLines,53);
  for(const [name,digest]of Object.entries(manifest.files)){assert.match(name,/^[a-z0-9][a-z0-9.-]*$/);assert.equal(createHash('sha256').update(await readFile(new URL(name,evidence))).digest('hex'),digest,name);}
  const probe=await readFile(new URL('source-probe.mjs',evidence),'utf8'),old=await readFile(new URL('../native-unit-reports/probe.mjs',evidence),'utf8');
  const previous=old.split('\n').filter(line=>line.trim().startsWith('assert.')),current=probe.split('\n').filter(line=>line.trim().startsWith('assert.'));
  let cursor=0;for(const line of previous){cursor=current.indexOf(line,cursor);assert.ok(cursor>=0,'Prior Source assertion removed');cursor++;}assert.equal(previous.length,53);
  const http=JSON.parse(await readFile(new URL('http-observations.json',evidence),'utf8'));assert.equal(http.length,188);
  assert.equal(native.body,String(native.testId));assert.equal(native.contentType,'text/html; charset=UTF-8');assert.equal(native.loginDenied,403);assert.equal(native.adminDenied,403);
  assert.equal(removed.retainedStatus,201);assert.equal(removed.whitespaceStatus,404);assert.equal(removed.newPersonStatus,404);
});

test('actual production Source48 pins Testlog append and every previous Source41 control without exposing native capabilities',async()=>{
 assert.equal(logManifest.sourceCommit,'eedae41840cbe90e5547c0211da818bdf620f5aa');assert.equal(logManifest.probeCommit,'9926bbfa9d6f626898dfcb481614c2b03becbb9d');
 assert.equal(logManifest.probeTree,'6794f5571da6f25411a2d67063042f90ed044df4');assert.equal(logManifest.runId,40604121346);assert.equal(logManifest.jobId,122539254933);
 assert.equal(logManifest.artifactId,12780616116);assert.equal(logManifest.artifactSha256,'3deec3bb689d89f1c337529cabb7318b409864aac52b0b9d3db690039c4665a6');
 assert.equal(logManifest.sourceProbeSha256,'66dd8e7f6e65c46abc6fdf5ca70b36ec4d2fd6af5c52e35d3555f82199a9fcb3');
 assert.equal(logReceipt.success,true);assert.equal(logReceipt.testMode,false);assert.equal(logReceipt.checks.length,48);assert.equal(Object.keys(logReceipt.sourceFiles).length,36);
 assert.deepEqual(logReceipt.checks.slice(0,41).map(row=>row.name),unitReceipt.checks.map(row=>row.name));
 for(const[name,sha]of Object.entries(logManifest.files)){assert.match(name,/^[a-z0-9][a-z0-9.-]*$/);assert.equal(createHash('sha256').update(await readFile(new URL(name,logEvidence))).digest('hex'),sha);}
 const old=(await readFile(new URL('source-probe.mjs',unitEvidence),'utf8')).split('\n').filter(line=>line.trim().startsWith('assert.'));
 const current=(await readFile(new URL('source-probe.mjs',logEvidence),'utf8')).split('\n').filter(line=>line.trim().startsWith('assert.'));let cursor=0;
 for(const line of old){cursor=current.indexOf(line,cursor);assert.ok(cursor>=0);cursor++;}assert.equal(old.length,80);assert.equal(logManifest.preservedPriorAssertionLines,80);
 const http=JSON.parse(await readFile(new URL('http-observations.json',logEvidence),'utf8'));assert.equal(http.length,284);
 const malformed=http.find(row=>row.method==='PUT'&&row.path.endsWith('/log')&&row.status===500);assert.ok(malformed);
 assert.equal(malformed.contentType,logManifest.knownMalformedJsonResponse.contentType);assert.equal(malformed.wireSha256,createHash('sha256').update('Internal error.').digest('hex'));
 assert.deepEqual(nativeLogDefaults.entries.map(row=>row.logentry),['missing : \"\"','null : \"\"','empty : \"\"']);
 assert.equal(nativeLogDefaults.firstStart,true);assert.deepEqual(nativeLogDefaults.laststate,[]);assert.equal(nativeLogTyped.entries.length,8);assert.equal(nativeLogRows.length,15);
});
test('production Source51 pins raw PHP JSON numeric tokens NUL content and strict field failures without losing any Source48 group',async()=>{
 assert.equal(codecManifest.probeCommit,'e675495310b606d7eb9996a513afb883985b4d95');assert.equal(codecManifest.runId,40618525961);assert.equal(codecManifest.jobId,122586598442);
 assert.equal(codecManifest.artifactId,12785833669);assert.equal(codecManifest.artifactSha256,'4241fb86af0b06aba5201968414238505268497890612425cb69c0a5c8a37f4a');
 assert.equal(codecManifest.sourceProbeSha256,'952689df4d61277b739da990726f4e32cefd58748e64669047b59ad0c82ef716');
 assert.equal(codecReceipt.success,true);assert.equal(codecReceipt.testMode,false);assert.equal(codecReceipt.checks.length,51);assert.equal(codecManifest.preservedPriorAssertions,145);
 assert.deepEqual(codecReceipt.checks.slice(0,48).map(x=>x.name),logReceipt.checks.map(x=>x.name));assert.deepEqual(codecReceipt.sourceFiles,logReceipt.sourceFiles);
 for(const[name,sha]of Object.entries(codecManifest.files))assert.equal(createHash('sha256').update(await readFile(new URL(name,codecEvidence))).digest('hex'),sha);
 assert.equal(JSON.parse(await readFile(new URL('http-observations.json',codecEvidence),'utf8')).length,359);
 assert.equal(codecEscaped.input[0].content.charCodeAt(1),0);assert.ok(Object.keys(codecEscaped.input[1].content)[0].includes('\0'));
 assert.deepEqual(codecStrict.cases.map(x=>x.status),[500,500,500,500,500,500,500,400,400,400]);assert.equal(codecRows.length,14);
});

test('production Source52 retains Source51 and pins NUL-key PDO truncation int64 client clocks and exact depth limits',async()=>{
 assert.equal(boundaryManifest.probeCommit,'75093ce061d36b11e7411e463d581ba3efcc4e3e');assert.equal(boundaryManifest.runId,40620574561);assert.equal(boundaryManifest.artifactId,12787546117);
 assert.equal(boundaryManifest.artifactSha256,'75103da43efe5964d44823ef4dd71cfae693b8aaf57299868352c4f7c3f3e15d');assert.equal(boundaryReceipt.success,true);assert.equal(boundaryReceipt.testMode,false);assert.equal(boundaryReceipt.checks.length,52);
 assert.deepEqual(boundaryReceipt.checks.slice(0,51).map(x=>x.name),codecReceipt.checks.map(x=>x.name));assert.deepEqual(boundaryReceipt.sourceFiles,codecReceipt.sourceFiles);
 for(const[name,sha]of Object.entries(boundaryManifest.files))assert.equal(createHash('sha256').update(await readFile(new URL(name,boundaryEvidence))).digest('hex'),sha);
 assert.equal(boundaryCases[0].status,201);assert.deepEqual(boundaryCases[0].entries,[{logentry:'owned'}]);assert.equal(boundaryCases.length,14);
 assert.deepEqual(boundaryCases.slice(-5).map(x=>x.status),[201,201,500,500,500]);
});

test('production Source53 pins177 independent PHP float encodings including signed zero subnormals and exponent cutoffs',async()=>{
 assert.equal(floatManifest.probeCommit,'0d1c0e4556a5b8b83736bc25eb0ddfc6d23385ba');assert.equal(floatManifest.runId,40624110311);assert.equal(floatManifest.artifactId,12789120697);assert.equal(floatManifest.artifactSha256,'bd4148ca1d3027d5fb2c81719d16dfed131338dad96228a4035bcb3632a55c00');
 assert.equal(floatReceipt.success,true);assert.equal(floatReceipt.testMode,false);assert.equal(floatReceipt.checks.length,53);assert.equal(floatCases.length,177);
 assert.deepEqual(floatReceipt.checks.slice(0,52).map(x=>x.name),boundaryReceipt.checks.map(x=>x.name));assert.deepEqual(floatReceipt.sourceFiles,boundaryReceipt.sourceFiles);
 for(const[name,sha]of Object.entries(floatManifest.files))assert.equal(createHash('sha256').update(await readFile(new URL(name,floatEvidence))).digest('hex'),sha);
});

test('production Source57 retains all Source53 controls and independently correlates21 native lock outcomes with exact raw reports',async()=>{
 assert.equal(lockManifest.sourceCommit,'eedae41840cbe90e5547c0211da818bdf620f5aa');assert.equal(lockManifest.probeCommit,'463f704c4fd4fd86ad92d27a07250332bcad60ac');
 assert.equal(lockManifest.probeTree,'0477dbace9a5dcfef9f6ee5c7eb1a8f214435918');assert.equal(lockManifest.runId,40626328250);assert.equal(lockManifest.jobId,122611999994);
 assert.equal(lockManifest.artifactId,12790055538);assert.equal(lockManifest.artifactSha256,'12798546eeced668acd3e28a69599d08c1a58a11218936b8dc68c90ce597aeff');
 assert.equal(lockManifest.sourceProbeSha256,'4a6c8ac1e5d180ffaebd259b99c6e778f65c8ecd1e317617557dfb12e369be77');
 assert.equal(lockReceipt.success,true);assert.equal(lockReceipt.testMode,false);assert.equal(lockReceipt.checks.length,57);assert.equal(lockCases.length,21);assert.equal(Object.keys(lockReceipt.sourceFiles).length,36);
 assert.deepEqual(lockReceipt.checks.slice(0,53).map(x=>x.name),floatReceipt.checks.map(x=>x.name));assert.deepEqual(lockReceipt.sourceFiles,floatReceipt.sourceFiles);
 for(const[name,digest]of Object.entries(lockManifest.files)){assert.match(name,/^[a-z0-9][a-z0-9.-]*$/);assert.equal(createHash('sha256').update(await readFile(new URL(name,lockEvidence))).digest('hex'),digest,name);}
 const current=await readFile(new URL('source-probe.mjs',lockEvidence),'utf8'),old=await readFile(new URL('source-probe.mjs',floatEvidence),'utf8');
 assert.equal(current.split('  // Independent native lock observations;')[0],old.split('  receipt.success = true;')[0]);
 assert.equal(JSON.parse(await readFile(new URL('http-observations.json',lockEvidence),'utf8')).length,545);assert.equal(lockReportRows.length,11);
 for(const entry of lockCases){const selected=lockReportRows.filter(row=>row.bookletname==='ORACLE.POW.BOOK#lock:'+entry.label);assert.equal(selected.length,entry.appendCount);assert.deepEqual(entry.entries.map(row=>row.bookletname),selected.map(row=>row.bookletname));assert.deepEqual(entry.entries.map(row=>row.logentry),selected.map(row=>row.logentry));}
 const raw=await readFile(new URL('test-lock.json',lockEvidence),'utf8');assert.ok(raw.includes('9223372036854775807'));assert.ok(raw.includes('-9223372036854775808'));
});

test('native lock validates related server evidence without inventing malformed historical dates',()=>{
 const before={bookletName:'KNOWN',bookletLabel:'Known',lastOpenedAt:null,lastTestStateAt:null,lastTestModifiedAt:'2026-10-26T00:00:00.000Z',hasTestState:false};
 assert.deepEqual(prepareOriginalTestLock('2026-10-28T00:00:00.000Z',before),{locked:true,updatedAt:'2026-10-28T00:00:00.000Z',originalResultState:{...before,lastTestModifiedAt:'2026-10-28T00:00:00.000Z'}});
 for(const key of['lastOpenedAt','lastTestStateAt','lastTestModifiedAt'])for(const value of[0,false,{},[], 'not a date'])assert.throws(()=>prepareOriginalTestLock('2026-10-28T00:00:00.000Z',{...before,[key]:value}));
 assert.throws(()=>prepareOriginalTestLock('not a date',before));assert.throws(()=>prepareOriginalTestLock('2026-10-28T00:00:00.000Z',undefined));assert.equal(before.lastTestModifiedAt,'2026-10-26T00:00:00.000Z');
});

test('native TestName keeps Source whitespace, duplicate-key and first-key-order semantics without prototype assignment', () => {
  assert.equal(parseOriginalTestName(' \t'+names.presetInput+'\n ').name,names.presetCanonical);
  const parsed=parseOriginalTestName(' BOOK #2:first;1:other;2:last;__proto__:safe;x:a:b');
  assert.equal(parsed.name,'BOOK#2:last;1:other;__proto__:safe;x:a:b');assert.ok(Object.hasOwn(parsed.states,'__proto__'));assert.equal(parsed.states.__proto__,'safe');
  assert.deepEqual(parseOriginalTestName(' BOOK #0 '),{name:'BOOK',fileId:'BOOK',states:{}});
  assert.equal(parseOriginalTestName('BOOK#00').name,'BOOK#00:');
  assert.equal(parseOriginalTestName('BOOK#').name,'BOOK');assert.equal(parseOriginalTestName('BOOK\u00a0').fileId,'BOOK\u00a0');
});

test('native Test numbers retain int64 precision, scope and sequence attempts', () => {
  const scope={testRunId:'r',participantSessionId:'p',tenantId:'t',workspaceId:'w',contentReleaseId:'c'};
  const run={...scope,originalResultState:{bookletName:'BOOK',bookletLabel:''}},person={...scope,originalLoginKey:'login',originalNameSuffix:''};
  const first=prepareOriginalTestNumber(scope,run,person,undefined,'9007199254740991');assert.equal(first.record.testNumber,'9007199254740992');
  const repeated=prepareOriginalTestNumber(scope,run,person,first.record,first.counter);assert.equal(repeated.changed,false);
  const attempted=prepareOriginalTestNumber({...scope,consumeSequence:true},run,person,first.record,first.counter);assert.equal(attempted.record.testNumber,first.record.testNumber);assert.equal(attempted.counter,'9007199254740993');
  for(const key of ['testRunId','participantSessionId','tenantId','workspaceId','contentReleaseId'])assert.throws(()=>prepareOriginalTestNumber({...scope,[key]:'foreign'},run,person,undefined,'0'),denied(409));
  assert.throws(()=>prepareOriginalTestNumber(scope,run,person,undefined,'9223372036854775807'),/exhausted/);
  assert.throws(()=>prepareOriginalTestNumber(scope,run,{...person,originalLoginKey:undefined},undefined,'0'),denied(409));
});

test('Source37 preserves every prior production control and qualifies native resource and Test state semantics',async()=>{
  assert.equal(readManifest.sourceCommit,manifest.sourceCommit);assert.equal(readManifest.probeCommit,'3eb8c918dce070f4ff5cf240605255524812a0cb');assert.equal(readManifest.runId,40249046818);
  assert.equal(readManifest.artifactSha256,'159d8b3c67585747557e1b6fef30dc681f122e4d2cef39a9631ef7f273195605');assert.equal(readManifest.sourceProbeSha256,'36e444c9d1aeca5e49c613d45ea0d96ab5a4ab21a0c030da1e5db9908a574516');
  assert.equal(readReceipt.success,true);assert.equal(readReceipt.testMode,false);assert.equal(readReceipt.checks.length,37);assert.equal(Object.keys(readReceipt.sourceFiles).length,31);
  for(const[name,digest]of Object.entries(readManifest.files))assert.equal(createHash('sha256').update(await readFile(new URL(name,readEvidence))).digest('hex'),digest,name);
  const old=(await readFile(new URL('source-probe.mjs',evidence),'utf8')).split('\n').filter(line=>line.trim().startsWith('assert.'));
  const current=(await readFile(new URL('source-probe.mjs',readEvidence),'utf8')).split('\n').filter(line=>line.trim().startsWith('assert.'));let cursor=0;for(const line of old){cursor=current.indexOf(line,cursor);assert.ok(cursor>=0);cursor++;}assert.equal(old.length,65);
  const http=JSON.parse(await readFile(new URL('http-observations.json',readEvidence),'utf8'));assert.equal(http.length,207);
  const resource=readReceipt.checks.find(row=>row.name.startsWith('native Test GET resolves'));
  assert.deepEqual(resource.resources,{'ORACLE.POW.UNIT':{usesPlayer:['Resource/player.html']}});assert.equal(resource.contentType,'text/html;charset=UTF-8');assert.equal(resource.cacheControl,'private');assert.equal(resource.sourceHeader,'backend');
  assert.equal(typedSource.mode,'run-review');assert.equal(typedSource.nullStatus,400);assert.equal(batchSource.equalBatch,'first equal in next batch');
});
test('native Test state matches Source37 typed values, packet-local clocks and PHP object encoding',()=>{
 const entries=[{key:'ownedChoice',content:'first',timeStamp:5},{key:'ownedChoice',content:'newest in batch',timeStamp:9},{key:'ownedChoice',content:'older ignored',timeStamp:5},{key:'ownedZero',content:'ignored',timeStamp:0},
  ...['ownedNumber','ownedFalse','ownedEmpty','ownedArray'].map(key=>({key,content:typedSource.state[key],timeStamp:1})),{key:'ownedObject',content:{b:'\u03a9/x',a:1},timeStamp:1}];
 const patch=parseOriginalTestStatePatch(entries),initial=applyOriginalTestStatePatch({},patch);assert.deepEqual(initial,typedSource.state);
 const lower=applyOriginalTestStatePatch(initial,parseOriginalTestStatePatch([{key:'ownedChoice',content:batchSource.laterLowerClock,timeStamp:1}]));assert.equal(lower.ownedChoice,batchSource.laterLowerClock);
 const equal=applyOriginalTestStatePatch(lower,parseOriginalTestStatePatch([{key:'ownedChoice',content:batchSource.equalBatch,timeStamp:1},{key:'ownedChoice',content:'ignored',timeStamp:1}]));assert.deepEqual(equal,batchSource.finalState);assert.equal(initial.ownedChoice,'newest in batch');
 assert.throws(()=>parseOriginalTestStatePatch([{key:'ownedNull',content:null,timeStamp:1}]),denied(400));assert.throws(()=>parseOriginalTestStatePatch([{key:'bad',content:'\u0000',timeStamp:1}]),denied(400));
 const own=applyOriginalTestStatePatch({},parseOriginalTestStatePatch([{key:'__proto__',content:'safe',timeStamp:1}]));assert.equal(own.__proto__,'safe');assert.equal(Object.getPrototypeOf(own),Object.prototype);
});
test('native workspace numbers and read JSON remain lossless beyond JS safe integers',()=>{
 const workspace={tenantId:'t',workspaceId:'w'},number=prepareOriginalWorkspaceNumber(workspace,workspace,undefined,'9007199254740991');assert.equal(number.record.workspaceNumber,'9007199254740992');
 assert.throws(()=>prepareOriginalWorkspaceNumber({...workspace,tenantId:'foreign'},workspace,undefined,'0'),denied(409));
 const json=formatOriginalTestReadJson({mode:'run-review',xml:'<Booklet>\u03a9/x</Booklet>',resources:{},laststate:{},firstStart:true,workspaceId:number.record.workspaceNumber,presetBookletStates:new Map([['2','last'],['1','first']])});
 assert.ok(json.includes('"workspaceId":9007199254740992'));assert.ok(json.includes('"presetBookletStates":{"2":"last","1":"first"}'));assert.deepEqual(JSON.parse(json).resources,[]);assert.deepEqual(JSON.parse(json).laststate,[]);
});

test('Source41 retains all Source37 controls and qualifies native Unit reads and durable independent field clocks',async()=>{
 assert.equal(unitManifest.sourceCommit,manifest.sourceCommit);assert.equal(unitManifest.runId,40256816222);assert.equal(unitManifest.probeCommit,'363e8575fd5925d4d286fc7afafcff1f3a18f028');
 assert.equal(unitManifest.artifactSha256,'dc66250945cbdc0f6fd9cf257d93adf2eab8f40c4f0f014b8b28a28cd5b06baa');assert.equal(unitManifest.sourceProbeSha256,'15e5d96a78e84aa47b20051765b525f3a5face7dad2af2ff16c533d927bdc11d');
 assert.equal(unitReceipt.success,true);assert.equal(unitReceipt.testMode,false);assert.equal(unitReceipt.checks.length,41);assert.equal(Object.keys(unitReceipt.sourceFiles).length,34);
 for(const[name,digest]of Object.entries(unitManifest.files))assert.equal(createHash('sha256').update(await readFile(new URL(name,unitEvidence))).digest('hex'),digest,name);
 const old=(await readFile(new URL('source-probe.mjs',readEvidence),'utf8')).split('\n').filter(line=>line.trim().startsWith('assert.'));
 const current=(await readFile(new URL('source-probe.mjs',unitEvidence),'utf8')).split('\n').filter(line=>line.trim().startsWith('assert.'));let cursor=0;for(const line of old){cursor=current.indexOf(line,cursor);assert.ok(cursor>=0);cursor++;}assert.equal(old.length,74);assert.equal(unitManifest.preservedPriorGroups,37);
 assert.equal(JSON.parse(await readFile(new URL('http-observations.json',unitEvidence),'utf8')).length,231);
 assert.deepEqual(unitReceipt.checks.at(-4).empty,{state:{},dataParts:{},unitResponseType:'',definition:'Owned definition',definitionType:'owned-pow-player-6.0'});
 assert.deepEqual(unitReceipt.checks.at(-3).state,{choice:'newest',second:'legacy array'});assert.equal(unitReceipt.checks.at(-1).lockedGet,200);
});
const kinds=['memory','file','sqlite'];if(process.env.FIRST_SLICE_STORE==='postgres'){assert.ok(process.env.FIRST_SLICE_POSTGRES_URL);kinds.push('postgres');}
for(const kind of kinds)test(`${kind}: real native Test creation is durable, scoped and separate from controller entry`,async t=>{
  const directory=await mkdtemp(join(tmpdir(),'owned-native-create-')),file=join(directory,kind==='file'?'state.json':'state.sqlite');
  const schema='owned_native_create_'+randomUUID().replaceAll('-',''),url=kind==='postgres'?new URL(process.env.FIRST_SLICE_POSTGRES_URL):null;
  url?.searchParams.set('options','-c search_path='+schema);url?.searchParams.set('application_name',schema);
  let storage,repository,services,admin,control,created=false;
  const open=async()=>{storage=kind==='memory'?storage??{repository:createInMemoryFirstSliceRepository(),shutdown:async()=>{}}:kind==='file'?await createFileFirstSliceStorage(file):kind==='sqlite'?createSqliteFirstSliceStorage(file):await createPostgresFirstSliceStorage(url.toString());repository=storage.repository;services=createFirstSliceServices({repository,originalXmlSchemaValidator:validator,xmlSchemaProfile:'original-19'});};
  const close=async()=>{if(kind!=='memory'){const own=storage;storage=undefined;await own?.shutdown();}};
  const reopen=async()=>{await close();await open();};
  try{
    if(url){admin=new Pool({connectionString:process.env.FIRST_SLICE_POSTGRES_URL});await admin.query(`CREATE SCHEMA "${schema}"`);created=true;}
    await open();
    const tenant=await services.platform.createTenant({tenantKey:'owned-'+randomUUID(),displayName:'Owned native create'});
    const workspace=await services.platform.createWorkspace({tenantKey:tenant.tenantKey,workspaceKey:'owned',displayName:'Owned native create'});
    const scope={tenantKey:tenant.tenantKey,workspaceKey:workspace.workspaceKey},ids={tenantId:tenant.tenantId,workspaceId:workspace.workspaceId};
    const upload=(fileName,sourceDocument,mediaType='application/xml')=>services.contentIntake.uploadWorkspaceFile({...scope,fileName,sourceDocument,mediaType});
    await upload('player.html','<html><script type="application/ld+json">'+JSON.stringify({id:'owned-native-player',version:'1.2.3',specVersion:'6.0',metadataVersion:'2.0',type:'player',name:[{lang:'en',value:'Owned Player'}]})+'</script><main>Owned</main></html>','text/html');
    await upload('unit.xml',xml('Unit','<Metadata><Id>OWNED.NATIVE.UNIT</Id><Label>Owned Unit</Label></Metadata><Definition player="owned-native-player@1.2.3">Owned definition</Definition>'));
    await upload('assigned.xml',booklet('OWNED.ASSIGNED','Assigned',true));await upload('unassigned.xml',booklet(native.bookletName,labels.firstLabel));
    const namesOwned=['owned-create','owned-other','owned-entry','owned-atomic','owned-review','owned-after-delete','owned-legacy','owned-cross-writer','owned-unit-native','owned-unit-peer'];
    await services.workspaceAdminRead.importParticipantRoster({...scope,rosterText:xml('Testtakers','<Metadata/><Group id="Owned.Create" label="Owned create">'+namesOwned.map(name=>`<Login name="${name}" pw="${password}" mode="${name==='owned-review'?'run-review':'run-hot-return'}"><Booklet codes="Owned">OWNED.ASSIGNED</Booklet></Login>`).join('')+'</Group>')});
    const auth=async name=>{const login=await services.originalAuthentication.login({name,password});return{login,person:await services.originalAuthentication.person({loginToken:login.token,code:'Owned'})};};
    const main=await auth('owned-create'),other=await auth('owned-other');let number,run,nativeWorkspaceNumber;
    const owned=person=>repository.listTestRunsByParticipantSessionId(person.participantSession.participantSessionId);
    const request=(session,bookletName)=>services.originalTest.create({token:session.person.token,bookletName});
    if(kind==='file')await t.test('an actual legacy File without native-number fields reopens without changing existing people',async()=>{
      const before=await repository.getParticipantSessionById(main.person.participantSession.participantSessionId);await close();
      const legacy=JSON.parse(await readFile(file,'utf8'));delete legacy.originalTestNumbers;delete legacy.originalTestNumberCounter;delete legacy.originalNativeUnits;
      await writeFile(file,JSON.stringify(legacy));await open();
      assert.deepEqual(await repository.getParticipantSessionById(before.participantSessionId),before);assert.deepEqual(await owned(main.person),[]);
    });
    if(kind==='sqlite'||kind==='postgres')await t.test('migration from the real previous schema is atomic, preserves people and never invents old native IDs',async()=>{
      const version=kind==='sqlite'?73:67;
      const before=await repository.getParticipantSessionById(main.person.participantSession.participantSessionId);await close();
      const connection=kind==='sqlite'?new DatabaseSync(file):new Pool({connectionString:url.toString()});
      const exec=sql=>kind==='sqlite'?connection.exec(sql):connection.query(sql),rows=async sql=>kind==='sqlite'?connection.prepare(sql).all():(await connection.query(sql)).rows;
      try{
        await exec(`DROP TABLE IF EXISTS original_person_numbers; DROP TABLE IF EXISTS original_person_number_counter; DROP INDEX IF EXISTS original_person_number_parent_scope; DROP TABLE IF EXISTS original_native_commands; DROP TABLE IF EXISTS original_native_command_counter; ALTER TABLE participant_sessions DROP COLUMN original_operational_mode; ALTER TABLE operational_login_migration_candidates DROP COLUMN native_logins_json; DROP TABLE IF EXISTS original_native_units; DROP TABLE original_workspace_numbers; DROP TABLE original_workspace_number_counter; ALTER TABLE test_runs DROP COLUMN original_test_state_json; DROP TABLE original_test_numbers; DROP TABLE original_test_number_counter; DELETE FROM schema_migrations WHERE version>=${version}`);
        await exec(kind==='sqlite'?`CREATE TRIGGER owned_number_migration_failure BEFORE INSERT ON schema_migrations WHEN NEW.version=${version} BEGIN SELECT RAISE(ABORT,'owned number migration failure'); END`:
          `CREATE FUNCTION owned_number_migration_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'owned number migration failure'; END $$; CREATE TRIGGER owned_number_migration_failure BEFORE INSERT ON schema_migrations FOR EACH ROW WHEN (NEW.version=${version}) EXECUTE FUNCTION owned_number_migration_failure()`);
        try{
          await assert.rejects(async()=>open(),/owned number migration failure/);
          assert.equal(Number((await rows('SELECT MAX(version) AS version FROM schema_migrations'))[0].version),version-1);
          const tableQuery=kind==='sqlite'?"SELECT count(*) AS count FROM sqlite_master WHERE type='table' AND name IN ('original_test_numbers','original_test_number_counter')":
            "SELECT count(*) AS count FROM information_schema.tables WHERE table_schema=current_schema() AND table_name IN ('original_test_numbers','original_test_number_counter')";
          assert.equal(Number((await rows(tableQuery))[0].count),0);
        }finally{await exec(kind==='sqlite'?'DROP TRIGGER owned_number_migration_failure':'DROP TRIGGER owned_number_migration_failure ON schema_migrations; DROP FUNCTION owned_number_migration_failure()');}
        await open();assert.deepEqual(await repository.getParticipantSessionById(before.participantSessionId),before);
        assert.equal(Number((await rows('SELECT count(*) AS count FROM original_test_numbers'))[0].count),0);
        assert.equal((await rows('SELECT last_number FROM original_test_number_counter WHERE singleton=1'))[0].last_number,'0');
      }finally{if(kind==='sqlite')connection.close();else await connection.end();}
    });
    if(kind==='sqlite'||kind==='postgres')await t.test('native-read migration failure rolls back its column and number tables without inventing old state',async()=>{
      const version=kind==='sqlite'?74:68,before=await repository.getParticipantSessionById(main.person.participantSession.participantSessionId);await close();
      const connection=kind==='sqlite'?new DatabaseSync(file):new Pool({connectionString:url.toString()});
      const exec=sql=>kind==='sqlite'?connection.exec(sql):connection.query(sql),rows=async sql=>kind==='sqlite'?connection.prepare(sql).all():(await connection.query(sql)).rows;
      try{
        await exec(`DROP TABLE IF EXISTS original_person_numbers; DROP TABLE IF EXISTS original_person_number_counter; DROP INDEX IF EXISTS original_person_number_parent_scope; DROP TABLE IF EXISTS original_native_commands; DROP TABLE IF EXISTS original_native_command_counter; ALTER TABLE participant_sessions DROP COLUMN original_operational_mode; ALTER TABLE operational_login_migration_candidates DROP COLUMN native_logins_json; DROP TABLE IF EXISTS original_native_units; DROP TABLE original_workspace_numbers; DROP TABLE original_workspace_number_counter; ALTER TABLE test_runs DROP COLUMN original_test_state_json; DELETE FROM schema_migrations WHERE version>=${version}`);
        await exec(kind==='sqlite'?`CREATE TRIGGER owned_read_migration_failure BEFORE INSERT ON schema_migrations WHEN NEW.version=${version} BEGIN SELECT RAISE(ABORT,'owned read migration failure'); END`:
          `CREATE FUNCTION owned_read_migration_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'owned read migration failure'; END $$; CREATE TRIGGER owned_read_migration_failure BEFORE INSERT ON schema_migrations FOR EACH ROW WHEN (NEW.version=${version}) EXECUTE FUNCTION owned_read_migration_failure()`);
        try{
          await assert.rejects(async()=>open(),/owned read migration failure/);
          assert.equal(Number((await rows('SELECT MAX(version) AS version FROM schema_migrations'))[0].version),version-1);
          const columns=kind==='sqlite'?await rows('PRAGMA table_info(test_runs)'):await rows("SELECT column_name AS name FROM information_schema.columns WHERE table_schema=current_schema() AND table_name='test_runs'");
          assert.equal(columns.some(row=>row.name==='original_test_state_json'),false);
          const tables=kind==='sqlite'?await rows("SELECT name FROM sqlite_master WHERE type='table'"):await rows('SELECT table_name AS name FROM information_schema.tables WHERE table_schema=current_schema()');
          assert.equal(tables.some(row=>['original_workspace_numbers','original_workspace_number_counter'].includes(row.name)),false);
        }finally{await exec(kind==='sqlite'?'DROP TRIGGER owned_read_migration_failure':'DROP TRIGGER owned_read_migration_failure ON schema_migrations; DROP FUNCTION owned_read_migration_failure()');}
        await open();assert.deepEqual(await repository.getParticipantSessionById(before.participantSessionId),before);
        assert.equal(Number((await rows('SELECT count(*) AS count FROM original_workspace_numbers'))[0].count),0);
        assert.equal((await rows('SELECT last_number FROM original_workspace_number_counter WHERE singleton=1'))[0].last_number,'0');
      }finally{if(kind==='sqlite')connection.close();else await connection.end();}
    });
    if(kind==='sqlite'||kind==='postgres')await t.test('native Unit migration rolls back its table atomically and never backfills guessed Unit clocks',async()=>{
      const version=kind==='sqlite'?75:69,before=await repository.getParticipantSessionById(main.person.participantSession.participantSessionId);await close();
      const connection=kind==='sqlite'?new DatabaseSync(file):new Pool({connectionString:url.toString()}),exec=sql=>kind==='sqlite'?connection.exec(sql):connection.query(sql),rows=async sql=>kind==='sqlite'?connection.prepare(sql).all():(await connection.query(sql)).rows;
      try{
        await exec(`DROP TABLE IF EXISTS original_person_numbers; DROP TABLE IF EXISTS original_person_number_counter; DROP INDEX IF EXISTS original_person_number_parent_scope; DROP TABLE IF EXISTS original_native_commands; DROP TABLE IF EXISTS original_native_command_counter; ALTER TABLE participant_sessions DROP COLUMN original_operational_mode; ALTER TABLE operational_login_migration_candidates DROP COLUMN native_logins_json; DROP TABLE original_native_units; DELETE FROM schema_migrations WHERE version>=${version}`);
        await exec(kind==='sqlite'?`CREATE TRIGGER owned_unit_migration_failure BEFORE INSERT ON schema_migrations WHEN NEW.version=${version} BEGIN SELECT RAISE(ABORT,'owned native Unit migration failure'); END`:
          `CREATE FUNCTION owned_unit_migration_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'owned native Unit migration failure'; END $$; CREATE TRIGGER owned_unit_migration_failure BEFORE INSERT ON schema_migrations FOR EACH ROW WHEN (NEW.version=${version}) EXECUTE FUNCTION owned_unit_migration_failure()`);
        try{
          await assert.rejects(async()=>open(),/owned native Unit migration failure/);assert.equal(Number((await rows('SELECT MAX(version) AS version FROM schema_migrations'))[0].version),version-1);
          const tables=kind==='sqlite'?await rows("SELECT name FROM sqlite_master WHERE type='table' AND name='original_native_units'"):await rows("SELECT table_name AS name FROM information_schema.tables WHERE table_schema=current_schema() AND table_name='original_native_units'");assert.deepEqual(tables,[]);
        }finally{await exec(kind==='sqlite'?'DROP TRIGGER owned_unit_migration_failure':'DROP TRIGGER owned_unit_migration_failure ON schema_migrations; DROP FUNCTION owned_unit_migration_failure()');}
        await open();assert.deepEqual(await repository.getParticipantSessionById(before.participantSessionId),before);assert.equal(Number((await rows('SELECT count(*) AS count FROM original_native_units'))[0].count),0);
      }finally{if(kind==='sqlite')connection.close();else await connection.end();}
    });
    if(kind==='sqlite'||kind==='postgres')await t.test('workspace creation rolls back its row and native-number counter after a late allocation failure',async()=>{
      const connection=kind==='sqlite'?new DatabaseSync(file):new Pool({connectionString:url.toString()});
      const exec=sql=>kind==='sqlite'?connection.exec(sql):connection.query(sql),rows=async sql=>kind==='sqlite'?connection.prepare(sql).all():(await connection.query(sql)).rows;
      const readCounter=async()=>(await rows('SELECT last_number FROM original_workspace_number_counter WHERE singleton=1'))[0].last_number;
      const before=await repository.listWorkspacesByTenantId(ids.tenantId),counter=await readCounter(),input={tenantKey:tenant.tenantKey,workspaceKey:'owned-allocation-rollback',displayName:'Owned allocation rollback'};
      try{
        await exec(kind==='sqlite'?"CREATE TRIGGER owned_workspace_allocation_failure BEFORE INSERT ON original_workspace_numbers BEGIN SELECT RAISE(ABORT,'owned workspace allocation failure'); END":
          "CREATE FUNCTION owned_workspace_allocation_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'owned workspace allocation failure'; END $$; CREATE TRIGGER owned_workspace_allocation_failure BEFORE INSERT ON original_workspace_numbers FOR EACH ROW EXECUTE FUNCTION owned_workspace_allocation_failure()");
        try{await assert.rejects(services.platform.createWorkspace(input),/owned workspace allocation failure/);assert.deepEqual(await repository.listWorkspacesByTenantId(ids.tenantId),before);assert.equal(await readCounter(),counter);}
        finally{await exec(kind==='sqlite'?'DROP TRIGGER owned_workspace_allocation_failure':'DROP TRIGGER owned_workspace_allocation_failure ON original_workspace_numbers; DROP FUNCTION owned_workspace_allocation_failure()');}
        const created=await services.platform.createWorkspace(input);assert.equal(await repository.matchesOriginalWorkspaceNumber({tenantId:ids.tenantId,workspaceId:created.workspaceId,workspaceNumber:String(BigInt(counter)+1n)}),true);
      }finally{if(kind==='sqlite')connection.close();else await connection.end();}
    });
    await t.test('an unassigned physical Booklet creates one unopened Test with first metadata and no state, logs, timer or result row',async()=>{
      number=await request(main,native.bookletName);assert.match(number,/^[1-9][0-9]*$/);
      [run]=await owned(main.person);assert.equal(run.status,'created');assert.equal(run.originalResultState.bookletName,native.bookletName);assert.equal(run.originalResultState.bookletLabel,labels.firstLabel);
      assert.equal(run.originalResultState.lastOpenedAt,null);assert.equal(run.originalResultState.hasTestState,false);assert.equal(run.controllerEntry,undefined);assert.deepEqual(run.testletTimers??{},{});assert.deepEqual(run.unitResponses,{});assert.equal(run.currentUnitKey,null);
      assert.equal((await repository.getParticipantSessionById(run.participantSessionId)).status,'signed_in');
      assert.deepEqual(await services.originalGroupResults.list(scope),[]);assert.deepEqual(await repository.listParticipantTestLogsByWorkspace(ids.tenantId,ids.workspaceId),[]);
      assert.ok(!(await services.originalSession.read({token:main.person.token})).claims.test.some(row=>row.id===native.bookletName));
      await assert.rejects(services.originalTest.create({token:main.login.token,bookletName:native.bookletName}),denied(403));
    });
    await t.test('repeated, case-equivalent and normalized attempts reuse the same number and preserve first metadata after restart',async()=>{
      for(const key of [native.bookletName,native.bookletName.toLowerCase(),' \t'+native.bookletName+' \n',native.bookletName+'#0'])assert.equal(await request(main,key),number);
      const preset=await request(main,names.presetInput);assert.ok(BigInt(preset)>BigInt(number));assert.equal(await request(main,names.presetCanonical),preset);
      const before=await owned(main.person);await reopen();assert.equal(await request(main,native.bookletName),number);assert.deepEqual(await owned(main.person),before);
    });
    await t.test('different people get different numbers and stale/cross-scope number requests cannot mutate the owner',async()=>{
      const foreign=await request(other,native.bookletName);assert.notEqual(foreign,number);const before=await owned(main.person);
      for(const key of ['participantSessionId','tenantId','workspaceId','contentReleaseId'])await assert.rejects(repository.getOrCreateOriginalTestNumber({...run,[key]:'foreign'}));
      assert.deepEqual(await owned(main.person),before);
    });
    if(kind!=='memory')await t.test('failed native opening leaves no opened time, state or logs after restart',async()=>{
      const before=await repository.getTestRunById(run.testRunId),logs=await repository.listParticipantTestLogsByWorkspace(ids.tenantId,ids.workspaceId);
      if(kind==='file'){
        const backup=file+'.native-open-backup',mutate=repository.mutateParticipantRun;let projected=false;
        repository.mutateParticipantRun=(input,transform)=>mutate(input,context=>{const effect=transform(context);if(effect?.originalResultOpenedAt)projected=true;return effect;});
        await rename(file,backup);await mkdir(file);
        try{await assert.rejects(services.originalTest.read({token:main.person.token,testNumber:number}));assert.equal(projected,true);}
        finally{repository.mutateParticipantRun=mutate;await rm(file,{recursive:true});await rename(backup,file);}
      }else{
        const connection=kind==='sqlite'?new DatabaseSync(file):new Pool({connectionString:url.toString()}),exec=sql=>kind==='sqlite'?connection.exec(sql):connection.query(sql);
        await exec(kind==='sqlite'?"CREATE TRIGGER owned_native_open_failure BEFORE UPDATE ON test_runs BEGIN SELECT RAISE(ABORT,'owned native open failure'); END":
          "CREATE FUNCTION owned_native_open_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'owned native open failure'; END $$; CREATE TRIGGER owned_native_open_failure BEFORE UPDATE ON test_runs FOR EACH ROW EXECUTE FUNCTION owned_native_open_failure()");
        try{await assert.rejects(services.originalTest.read({token:main.person.token,testNumber:number}),/owned native open failure/);}
        finally{await exec(kind==='sqlite'?'DROP TRIGGER owned_native_open_failure':'DROP TRIGGER owned_native_open_failure ON test_runs; DROP FUNCTION owned_native_open_failure()');if(kind==='sqlite')connection.close();else await connection.end();}
      }
      assert.deepEqual(await repository.getTestRunById(run.testRunId),before);assert.deepEqual(await repository.listParticipantTestLogsByWorkspace(ids.tenantId,ids.workspaceId),logs);
      await reopen();assert.deepEqual(await repository.getTestRunById(run.testRunId),before);assert.deepEqual(await repository.listParticipantTestLogsByWorkspace(ids.tenantId,ids.workspaceId),logs);
    });
    await t.test('native GET opens an unassigned Test exactly once without controller, Unit, timer, log or saved state',async()=>{
      const before=await repository.getTestRunById(run.testRunId),logs=await repository.listParticipantTestLogsByWorkspace(ids.tenantId,ids.workspaceId);
      const reads=await Promise.all(Array.from({length:8},()=>services.originalTest.read({token:main.person.token,testNumber:number})));
      assert.equal(reads.filter(row=>row.firstStart).length,1);assert.equal(new Set(reads.map(row=>row.workspaceId)).size,1);nativeWorkspaceNumber=reads[0].workspaceId;
      assert.match(nativeWorkspaceNumber,/^[1-9][0-9]*$/);assert.notEqual(nativeWorkspaceNumber,ids.workspaceId);assert.equal(await repository.matchesOriginalWorkspaceNumber({...ids,workspaceNumber:nativeWorkspaceNumber}),true);
      const value=JSON.parse(formatOriginalTestReadJson(reads[0]));assert.deepEqual(Object.keys(value),['mode','laststate','xml','resources','firstStart','workspaceId','presetBookletStates']);assert.deepEqual(value.laststate,[]);assert.deepEqual(value.presetBookletStates,[]);
      assert.equal(value.xml,booklet(native.bookletName,labels.firstLabel));assert.deepEqual(value.resources,{'OWNED.NATIVE.UNIT':{usesPlayer:['Resource/player.html']}});
      const after=await repository.getTestRunById(run.testRunId);assert.equal(after.status,'created');assert.equal(after.currentUnitKey,null);assert.equal(after.controllerEntry,undefined);assert.deepEqual(after.unitResponses,{});assert.deepEqual(after.testletTimers??{},{});assert.ok(after.originalResultState.lastOpenedAt);assert.equal(after.originalResultState.hasTestState,false);assert.equal(after.originalResultState.lastTestStateAt,before.originalResultState.lastTestStateAt);
      assert.equal((await repository.getParticipantSessionById(run.participantSessionId)).status,'signed_in');assert.deepEqual(await repository.listParticipantTestLogsByWorkspace(ids.tenantId,ids.workspaceId),logs);
      assert.equal((await services.originalGroupResults.list(scope))[0].numUnitsTotal,0);
      await assert.rejects(services.originalTest.read({token:other.person.token,testNumber:number}),denied(403));await assert.rejects(services.originalTest.read({token:main.person.token,testNumber:'9223372036854775807'}),denied(403));await assert.rejects(services.originalTest.read({token:main.person.token,testNumber:'0'}),denied(400));
      assert.equal((await services.originalTest.read({token:main.person.token,testNumber:'000'+number})).firstStart,false);await reopen();assert.equal((await services.originalTest.read({token:main.person.token,testNumber:number})).workspaceId,nativeWorkspaceNumber);
    });
    if(kind==='file')await t.test('a legacy File with native numbers rebuilds its missing reverse index once on reopen',async()=>{
      await close();const legacy=JSON.parse(await readFile(file,'utf8'));delete legacy.originalTestRunsByNumber;await writeFile(file,JSON.stringify(legacy));await open();
      const owner=await repository.findOriginalTestNumber({...run,testNumber:number});assert.equal(owner.testRunId,run.testRunId);assert.equal((await services.originalTest.read({token:main.person.token,testNumber:number})).firstStart,false);
    });
    await t.test('native Unit reads and writes match Source41 without entering a controller or changing Test-level evidence',async()=>{
      const session=await auth('owned-unit-native'),id=await request(session,native.bookletName),[testRun]=await owned(session.person),before=await repository.getTestRunById(testRun.testRunId);
      const base={token:session.person.token,testNumber:id},unitName='OWNED.FREE.ALIAS',target={...base,unitName},read=()=>services.originalUnit.read({...base,unitName:'OWNED.NATIVE.UNIT',alias:unitName});
      const first=JSON.parse(formatOriginalUnitReadJson(await read()));assert.deepEqual(Object.keys(first),['state','dataParts','unitResponseType','definition','definitionType']);assert.deepEqual(first,{state:{},dataParts:{},unitResponseType:'',definition:'Owned definition',definitionType:'owned-native-player-1.2'});
      assert.equal(await repository.getOriginalUnit({...testRun,unitName}),null);assert.deepEqual(await repository.getTestRunById(testRun.testRunId),before);
      await assert.rejects(services.originalUnit.read({...base,token:other.person.token,unitName:'OWNED.NATIVE.UNIT'}),denied(403));await assert.rejects(services.originalUnit.read({...base,unitName:'OWNED.MISSING'}),denied(404));
      await assert.rejects(services.originalUnit.putResponse({...target,body:{timeStamp:9,dataParts:{a:'before state'}}}),denied(404));
      await services.originalUnit.patchState({...target,body:{originalUnitId:'FIRST.NATIVE.ID',newState:[{key:'choice',content:'newer',timeStamp:9},{key:'zero',content:'ignored',timeStamp:0}]}});
      await services.originalUnit.patchState({...target,unitName:unitName.toLowerCase(),body:[{key:'choice',content:'stale across packets',timeStamp:1},{key:'second',content:'legacy array',timeStamp:2}]});
      await services.originalUnit.patchState({...target,body:{originalUnitId:'IGNORED.ID',newState:[{key:'choice',content:'equal rejected',timeStamp:9},{key:'choice',content:'newest',timeStamp:10},{key:'choice',content:'second equal rejected',timeStamp:10}]}});
      assert.deepEqual((await read()).state,unitReceipt.checks.at(-3).state);
      for(const body of [{timeStamp:5,dataParts:{a:'Exact Ω/x',z:'old z'},responseType:'type/first'},{timeStamp:6,dataParts:{z:'new z'},responseType:'type/second'},{timeStamp:5,dataParts:{a:'equal rejected',z:'stale rejected',c:'new c'},responseType:'type/third'},{timeStamp:0,dataParts:{zero:'zero first insert'}}])await services.originalUnit.putResponse({...target,body});
      const saved=await repository.getOriginalUnit({...testRun,unitName});assert.equal(saved.originalUnitId,'FIRST.NATIVE.ID');assert.equal(saved.unitName,unitName);assert.equal(saved.stateClocks.zero,0);assert.equal(saved.stateClocks.choice,10);
      const parts=JSON.parse(formatOriginalUnitReadJson(await read()));assert.deepEqual(parts.dataParts,unitReceipt.checks.at(-2).dataParts);assert.equal(parts.unitResponseType,'unknown');assert.deepEqual(parts.state,unitReceipt.checks.at(-2).state);
      assert.deepEqual(saved.parts,[{id:'a',content:'Exact Ω/x',ts:5,responseType:'type/first'},{id:'z',content:'new z',ts:6,responseType:'type/second'},{id:'c',content:'new c',ts:5,responseType:'type/third'},{id:'zero',content:'zero first insert',ts:0,responseType:'unknown'}]);
      assert.deepEqual(await repository.getTestRunById(testRun.testRunId),before);await reopen();assert.deepEqual(JSON.parse(formatOriginalUnitReadJson(await read())),parts);
      assert.equal((await services.originalTest.read(base)).firstStart,true);assert.equal((await services.originalGroupResults.list(scope))[0].numUnitsTotal,1);
      const opened=await repository.getTestRunById(testRun.testRunId);await repository.mutateParticipantRun(testRun,context=>({testRun:{...context.testRun,locked:true},testLogs:[],activityEvents:[]}));
      await services.originalUnit.patchState({...target,body:{newState:[{key:'lockedWrite',content:'accepted while Test locked',timeStamp:1}]}});await services.originalUnit.putResponse({...target,body:{timeStamp:7,dataParts:{late:'accepted while Test locked'},responseType:'locked/type'}});
      assert.equal((await read()).state.lockedWrite,'accepted while Test locked');assert.equal(JSON.parse(formatOriginalUnitReadJson(await read())).dataParts.late,'accepted while Test locked');
      assert.deepEqual((await repository.getTestRunById(testRun.testRunId)).originalResultState.lastTestStateAt,opened.originalResultState.lastTestStateAt);
      const zero=JSON.parse(formatOriginalUnitReadJson(await services.originalUnit.read({...base,unitName:'OWNED.NATIVE.UNIT',alias:'0'})));assert.deepEqual(zero.state,{});assert.deepEqual(zero.dataParts,{});
      const count=(await services.originalGroupResults.list(scope))[0].numUnitsTotal;
      await services.originalUnit.putLog({...base,unitName:'OWNED.LOG.ONLY',body:{logEntries:[{key:'raw',content:{b:'Ω/x',a:1},timeStamp:0}]}});
      assert.equal(await repository.getOriginalUnit({...testRun,unitName:'OWNED.LOG.ONLY'}),null);assert.equal((await services.originalGroupResults.list(scope))[0].numUnitsTotal,count);
      const logs=await repository.listParticipantTestLogsByWorkspace(ids.tenantId,ids.workspaceId),ownLogs=logs.filter(row=>row.testRunId===testRun.testRunId);assert.equal(ownLogs.filter(row=>row.logKey==='choice').length,5);assert.ok(ownLogs.some(row=>row.logKey==='choice'&&row.logContent==='stale across packets'));assert.ok(ownLogs.some(row=>row.logKey==='raw'&&row.logContent==='{"b":"\\u03a9\\/x","a":1}'));
    });
    await t.test('late native Unit state failure rolls back the row and logs, including durable reopening',async()=>{
      const session=await auth('owned-unit-peer'),id=await request(session,native.bookletName),[testRun]=await owned(session.person),unitName='OWNED.ATOMIC.ALIAS',target={token:session.person.token,testNumber:id,unitName};
      await services.originalUnit.patchState({...target,body:{originalUnitId:'ATOMIC.FIRST',newState:[{key:'accepted',content:'before',timeStamp:1}]}});
      const before=await repository.getOriginalUnit({...testRun,unitName}),logs=await repository.listParticipantTestLogsByWorkspace(ids.tenantId,ids.workspaceId),body={newState:[{key:'ownedLateUnitState',content:'must roll back',timeStamp:2}]};
      if(kind==='memory'){
        const failing=createFirstSliceServices({repository,originalXmlSchemaValidator:validator,xmlSchemaProfile:'original-19',idGenerator:()=>logs.find(row=>row.testRunId===testRun.testRunId&&row.logKey==='accepted').participantTestLogId.replace(/^original-unit-log:/,'')});
        await assert.rejects(failing.originalUnit.patchState({...target,body}),/collision|identity/i);
      }else if(kind==='file'){
        const backup=file+'.native-unit-backup',mutate=repository.mutateOriginalUnit;let projected=false;
        repository.mutateOriginalUnit=(input,transform)=>mutate(input,previous=>{const effect=transform(previous);if(effect.unit?.state.ownedLateUnitState)projected=true;return effect;});
        await rename(file,backup);await mkdir(file);
        try{await assert.rejects(services.originalUnit.patchState({...target,body}));assert.equal(projected,true);
          await assert.rejects(repository.saveTestRun({...testRun,unitResponses:{...testRun.unitResponses,[unitName]:'uncommitted canonical response'}}));assert.deepEqual(await repository.getOriginalUnit({...testRun,unitName}),before);}
        finally{repository.mutateOriginalUnit=mutate;await rm(file,{recursive:true});await rename(backup,file);}
      }else{
        const connection=kind==='sqlite'?new DatabaseSync(file):new Pool({connectionString:url.toString()}),exec=sql=>kind==='sqlite'?connection.exec(sql):connection.query(sql);
        await exec(kind==='sqlite'?"CREATE TRIGGER owned_unit_log_failure BEFORE INSERT ON participant_test_logs WHEN NEW.log_key='ownedLateUnitState' BEGIN SELECT RAISE(ABORT,'owned native Unit log failure'); END":
          "CREATE FUNCTION owned_unit_log_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'owned native Unit log failure'; END $$; CREATE TRIGGER owned_unit_log_failure BEFORE INSERT ON participant_test_logs FOR EACH ROW WHEN (NEW.log_key='ownedLateUnitState') EXECUTE FUNCTION owned_unit_log_failure()");
        try{await assert.rejects(services.originalUnit.patchState({...target,body}),/owned native Unit log failure/);
          await exec(kind==='sqlite'?"CREATE TRIGGER owned_unit_canonical_failure BEFORE UPDATE ON test_runs BEGIN SELECT RAISE(ABORT,'owned native Unit canonical failure'); END":
            "CREATE FUNCTION owned_unit_canonical_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'owned native Unit canonical failure'; END $$; CREATE TRIGGER owned_unit_canonical_failure BEFORE UPDATE ON test_runs FOR EACH ROW EXECUTE FUNCTION owned_unit_canonical_failure()");
          try{await assert.rejects(repository.saveTestRun({...testRun,unitResponses:{...testRun.unitResponses,[unitName]:'uncommitted canonical response'}}),/owned native Unit canonical failure/);assert.deepEqual(await repository.getOriginalUnit({...testRun,unitName}),before);}
          finally{await exec(kind==='sqlite'?'DROP TRIGGER owned_unit_canonical_failure':'DROP TRIGGER owned_unit_canonical_failure ON test_runs; DROP FUNCTION owned_unit_canonical_failure()');}
        }
        finally{await exec(kind==='sqlite'?'DROP TRIGGER owned_unit_log_failure':'DROP TRIGGER owned_unit_log_failure ON participant_test_logs; DROP FUNCTION owned_unit_log_failure()');if(kind==='sqlite')connection.close();else await connection.end();}
      }
      assert.deepEqual(await repository.getOriginalUnit({...testRun,unitName}),before);assert.deepEqual(await repository.listParticipantTestLogsByWorkspace(ids.tenantId,ids.workspaceId),logs);
      await reopen();assert.deepEqual(await repository.getOriginalUnit({...testRun,unitName}),before);assert.deepEqual(await repository.listParticipantTestLogsByWorkspace(ids.tenantId,ids.workspaceId),logs);
      await assert.rejects(services.originalUnit.putResponse({...target,body:{timeStamp:2,dataParts:{safe:'must roll back',invalid:42}}}),denied(400));assert.deepEqual(await repository.getOriginalUnit({...testRun,unitName}),before);
    });
    await t.test('canonical history without native clock provenance fails explicitly and cannot overwrite the first native identity',async()=>{
      const session=await auth('owned-unit-peer'),id=await request(session,native.bookletName),[testRun]=await owned(session.person),unitName='OWNED.UNKNOWN.HISTORY',target={token:session.person.token,testNumber:id,unitName};
      const changed={...testRun,unitResponses:{...testRun.unitResponses,[unitName]:'Owned canonical legacy response'}};await repository.saveTestRun(changed);
      const read={...target,unitName:'OWNED.NATIVE.UNIT',alias:unitName};await assert.rejects(services.originalUnit.read(read),denied(409,'original_unit_history_unknown'));
      await assert.rejects(services.originalUnit.patchState({...target,body:{newState:[{key:'mustNotInvent',content:'unknown',timeStamp:1}]}}),denied(409));
      const known='OWNED.NATIVE.THEN.CANONICAL';await services.originalUnit.patchState({...target,unitName:known,body:{originalUnitId:'FIRST.PRESERVED',newState:[{key:'native',content:'accepted',timeStamp:9}]}});
      const latest=await repository.getTestRunById(testRun.testRunId);await repository.saveTestRun({...latest,unitResponses:{...latest.unitResponses,[known]:'A later canonical response without native clocks'}});
      const raw=await repository.getOriginalUnit({...testRun,unitName:known});assert.equal(raw.unknownHistory,true);assert.equal(raw.originalUnitId,'FIRST.PRESERVED');assert.equal(raw.state.native,'accepted');
      await assert.rejects(services.originalUnit.read({...read,alias:known}),denied(409));await assert.rejects(services.originalUnit.putResponse({...target,unitName:known,body:{timeStamp:10,dataParts:{new:'cannot fabricate'}}}),denied(409));
      await reopen();assert.equal((await repository.getOriginalUnit({...testRun,unitName:known})).unknownHistory,true);
    });
    if(kind==='sqlite'||kind==='postgres')await t.test('native Unit reads reject foreign numbers before private Unit JSON decoding and result inventory stays metadata-only',async()=>{
      const session=await auth('owned-unit-native'),[testRun]=await owned(session.person),id=await repository.getOrCreateOriginalTestNumber(testRun),unitName='OWNED.FREE.ALIAS',marker='owned-native-unit-private-'+randomUUID();
      await services.originalUnit.patchState({token:session.person.token,testNumber:id,unitName,body:{newState:[{key:'privateFence',content:marker,timeStamp:1}]}});
      const parse=JSON.parse;JSON.parse=function(text,...rest){if(typeof text==='string'&&text.includes(marker))throw Error('Owned native Unit decoder fence');return parse(text,...rest);};
      try{
        await assert.rejects(services.originalUnit.read({token:session.person.token,testNumber:id,unitName:'OWNED.NATIVE.UNIT',alias:unitName}),/Owned native Unit decoder fence/);
        await assert.rejects(services.originalUnit.read({token:main.person.token,testNumber:id,unitName:'OWNED.NATIVE.UNIT',alias:unitName}),denied(403));
        const inventory=await repository.getOriginalGroupResultInventory(ids.tenantId,ids.workspaceId);assert.ok(inventory.runs.find(row=>row.testRunId===testRun.testRunId).savedUnitKeys.includes(unitName));
      }finally{JSON.parse=parse;}
      assert.equal((await services.originalUnit.read({token:session.person.token,testNumber:id,unitName:'OWNED.NATIVE.UNIT',alias:unitName})).state.privateFence,marker);
    });
    if(kind==='sqlite'||kind==='postgres')await t.test('native Unit access avoids decoding unrelated canonical responses even for the actual owner',async()=>{
      const session=await auth('owned-unit-native'),[testRun]=await owned(session.person),id=await repository.getOrCreateOriginalTestNumber(testRun),marker='owned-unrelated-canonical-unit-'+randomUUID(),unitName='OWNED.FREE.ALIAS';
      await repository.saveTestRun({...testRun,unitResponses:{...testRun.unitResponses,'unrelated-canonical-unit':marker}});
      const parse=JSON.parse;JSON.parse=function(text,...rest){if(typeof text==='string'&&text.includes(marker))throw Error('Owned unrelated canonical decoder fence');return parse(text,...rest);};
      try{
        await assert.rejects(repository.getTestRunById(testRun.testRunId),/Owned unrelated canonical decoder fence/);
        const output=await services.originalUnit.read({token:session.person.token,testNumber:id,unitName:'OWNED.NATIVE.UNIT',alias:unitName});assert.equal(output.state.choice,'newest');
        await services.originalUnit.putResponse({token:session.person.token,testNumber:id,unitName,body:{timeStamp:10,dataParts:{metadataOnlyControl:'owned without canonical decoding'}}});
      }finally{JSON.parse=parse;}
      assert.equal((await repository.getOriginalUnit({...testRun,unitName})).parts.find(row=>row.id==='metadataOnlyControl').content,'owned without canonical decoding');
    });
    await t.test('native Test state writes preserve exact typed Source semantics, including lower clocks in later packets',async()=>{
      const call=patch=>services.originalTest.patchState({token:main.person.token,testNumber:number,patch});
      await call([{key:'ownedZero',content:'ignored',timeStamp:0}]);assert.deepEqual((await services.originalTest.read({token:main.person.token,testNumber:number})).laststate,{});
      const fields=['ownedNumber','ownedFalse','ownedEmpty','ownedArray'];await call([{key:'ownedChoice',content:'newest in batch',timeStamp:9},...fields.map(key=>({key,content:typedSource.state[key],timeStamp:1})),{key:'ownedObject',content:{b:'\u03a9/x',a:1},timeStamp:1}]);
      assert.deepEqual((await services.originalTest.read({token:main.person.token,testNumber:number})).laststate,typedSource.state);
      await call([{key:'ownedChoice',content:batchSource.laterLowerClock,timeStamp:1}]);await call([{key:'ownedChoice',content:batchSource.equalBatch,timeStamp:1},{key:'ownedChoice',content:'ignored equal',timeStamp:1}]);
      assert.deepEqual((await services.originalTest.read({token:main.person.token,testNumber:number})).laststate,batchSource.finalState);
      const saved=await repository.getTestRunById(run.testRunId),logs=await repository.listParticipantTestLogsByWorkspace(ids.tenantId,ids.workspaceId);
      await assert.rejects(call([{key:'invalid',content:null,timeStamp:1}]),denied(400));assert.deepEqual(await repository.getTestRunById(run.testRunId),saved);assert.deepEqual(await repository.listParticipantTestLogsByWorkspace(ids.tenantId,ids.workspaceId),logs);
      assert.equal(saved.status,'created');assert.equal(saved.controllerEntry,undefined);assert.equal(saved.currentUnitKey,null);assert.deepEqual(saved.unitResponses,{});assert.equal(saved.originalResultState.hasTestState,true);
      const ownLogs=logs.filter(row=>row.testRunId===run.testRunId);assert.equal(ownLogs.length,10);assert.ok(ownLogs.some(row=>row.logKey==='ownedZero'&&row.timestamp===0&&row.logContent==='"ignored"'));assert.ok(ownLogs.some(row=>row.logKey==='ownedChoice'&&row.logContent==='"ignored equal"'));
      await reopen();assert.deepEqual((await services.originalTest.read({token:main.person.token,testNumber:number})).laststate,batchSource.finalState);
      const latest=await repository.getTestRunById(run.testRunId);await repository.saveTestRun({...run,originalTestState:{forged:'must not replace history'}});assert.deepEqual((await repository.getTestRunById(run.testRunId)).originalTestState,latest.originalTestState);assert.deepEqual((await repository.getTestRunById(run.testRunId)).originalResultState,latest.originalResultState);
      const monitor=(await services.monitorRead.listOpenRuns({...scope,testRunId:run.testRunId}))[0];
      assert.equal(monitor.testState.ownedChoice,batchSource.equalBatch);assert.equal(monitor.testState.ownedFalse,'false');assert.equal(monitor.testState.ownedObject,typedSource.state.ownedObject);assert.equal(monitor.testState.status,'running');
    });
    await t.test('legacy unknown saved state fails explicitly without manufacturing a history or opening the Test',async()=>{
      const legacy={...run,testRunId:randomUUID(),bookletAssignmentKey:native.bookletName+'#legacy:unknown',originalTestState:undefined,originalResultState:{...run.originalResultState,bookletName:native.bookletName+'#legacy:unknown',hasTestState:true}};
      await repository.saveTestRun(legacy);const id=await repository.getOrCreateOriginalTestNumber(legacy),before=await repository.getTestRunById(legacy.testRunId),logs=await repository.listParticipantTestLogsByWorkspace(ids.tenantId,ids.workspaceId);
      await assert.rejects(services.originalTest.read({token:main.person.token,testNumber:id}),denied(409,'original_test_state_unknown'));
      await assert.rejects(services.originalTest.patchState({token:main.person.token,testNumber:id,patch:[{key:'attempt',content:'must not fabricate',timeStamp:1}]}),denied(409,'original_test_state_unknown'));
      assert.deepEqual(await repository.getTestRunById(legacy.testRunId),before);assert.deepEqual(await repository.listParticipantTestLogsByWorkspace(ids.tenantId,ids.workspaceId),logs);
    });
    await t.test('native state cannot overwrite an existing log identity or publish duplicate new identities',async()=>{
      const before=await repository.getTestRunById(run.testRunId),logs=await repository.listParticipantTestLogsByWorkspace(ids.tenantId,ids.workspaceId);
      for(const id of [logs.find(row=>row.testRunId===run.testRunId).participantTestLogId,randomUUID()]){
        const failing=createFirstSliceServices({repository,originalXmlSchemaValidator:validator,xmlSchemaProfile:'original-19',idGenerator:()=>id});
        await assert.rejects(failing.originalTest.patchState({token:main.person.token,testNumber:number,patch:[{key:'collisionA',content:'uncommitted',timeStamp:1},{key:'collisionB',content:'uncommitted',timeStamp:1}]}),/identity|already|collision|UNIQUE|duplicate key/i);
        assert.deepEqual(await repository.getTestRunById(run.testRunId),before);assert.deepEqual(await repository.listParticipantTestLogsByWorkspace(ids.tenantId,ids.workspaceId),logs);
      }
    });
    if(kind==='sqlite'||kind==='postgres')await t.test('foreign numeric lookup rejects before decoding private saved Test state, with a real owned decoder control',async()=>{
      const foreign=await request(other,native.bookletName),marker='owned-private-native-state-'+randomUUID();
      await services.originalTest.patchState({token:other.person.token,testNumber:foreign,patch:[{key:'privateFence',content:marker,timeStamp:1}]});
      const parse=JSON.parse;JSON.parse=function(text,...rest){if(typeof text==='string'&&text.includes(marker))throw Error('Owned native state decoder fence');return parse(text,...rest);};
      try{
        await assert.rejects(services.originalTest.read({token:other.person.token,testNumber:foreign}),/Owned native state decoder fence/);
        await assert.rejects(services.originalTest.read({token:main.person.token,testNumber:foreign}),denied(403));
        await assert.rejects(services.originalTest.patchState({token:main.person.token,testNumber:foreign,patch:[{key:'forbidden',content:'uncommitted',timeStamp:1}]}),denied(403));
        assert.equal(await repository.findOriginalTestNumber({...main.person.participantSession,testNumber:foreign}),null);
      }finally{JSON.parse=parse;}
      assert.equal((await services.originalTest.read({token:other.person.token,testNumber:foreign})).laststate.privateFence,marker);
    });
    await t.test('late native state failures preserve the previous state, clocks, logs and caches',async()=>{
      const before=await repository.getTestRunById(run.testRunId),logs=await repository.listParticipantTestLogsByWorkspace(ids.tenantId,ids.workspaceId),patch=[{key:'ownedLateNativeState',content:'must roll back',timeStamp:1}];
      if(kind==='memory'){
        const prefix='original-test-state:',collision=logs.find(row=>row.testRunId===run.testRunId&&row.participantTestLogId.startsWith(prefix));assert.ok(collision);
        const failing=createFirstSliceServices({repository,originalXmlSchemaValidator:validator,xmlSchemaProfile:'original-19',idGenerator:()=>collision.participantTestLogId.slice(prefix.length)});
        await assert.rejects(failing.originalTest.patchState({token:main.person.token,testNumber:number,patch}),/identity|already|collision/i);
      }else if(kind==='file'){
        const backup=file+'.native-state-backup',mutate=repository.mutateParticipantRun;let projected=false;
        repository.mutateParticipantRun=(input,transform)=>mutate(input,context=>{const effect=transform(context);if(effect?.originalTestState&&Object.hasOwn(effect.originalTestState,'ownedLateNativeState'))projected=true;return effect;});
        await rename(file,backup);await mkdir(file);
        try{await assert.rejects(services.originalTest.patchState({token:main.person.token,testNumber:number,patch}));assert.equal(projected,true);assert.deepEqual(await repository.getTestRunById(run.testRunId),before);}
        finally{repository.mutateParticipantRun=mutate;await rm(file,{recursive:true});await rename(backup,file);}
      }else{
        const connection=kind==='sqlite'?new DatabaseSync(file):new Pool({connectionString:url.toString()}),exec=sql=>kind==='sqlite'?connection.exec(sql):connection.query(sql);
        await exec(kind==='sqlite'?"CREATE TRIGGER owned_native_state_failure BEFORE INSERT ON participant_test_logs WHEN NEW.log_key='ownedLateNativeState' BEGIN SELECT RAISE(ABORT,'owned native state log failure'); END":"CREATE FUNCTION owned_native_state_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'owned native state log failure'; END $$; CREATE TRIGGER owned_native_state_failure BEFORE INSERT ON participant_test_logs FOR EACH ROW WHEN (NEW.log_key='ownedLateNativeState') EXECUTE FUNCTION owned_native_state_failure()");
        try{await assert.rejects(services.originalTest.patchState({token:main.person.token,testNumber:number,patch}),/owned native state log failure/);}
        finally{await exec(kind==='sqlite'?'DROP TRIGGER owned_native_state_failure':'DROP TRIGGER owned_native_state_failure ON participant_test_logs; DROP FUNCTION owned_native_state_failure()');if(kind==='sqlite')connection.close();else await connection.end();}
      }
      assert.deepEqual(await repository.getTestRunById(run.testRunId),before);assert.deepEqual(await repository.listParticipantTestLogsByWorkspace(ids.tenantId,ids.workspaceId),logs);await reopen();assert.deepEqual(await repository.getTestRunById(run.testRunId),before);assert.deepEqual(await repository.listParticipantTestLogsByWorkspace(ids.tenantId,ids.workspaceId),logs);
    });
    await t.test('group resources preserve current physical bytes and reject foreign scopes and non-Resource paths',async()=>{
      const input={groupToken:main.person.groupToken,workspaceNumber:nativeWorkspaceNumber,path:'Resource/player.html'},reply=await services.originalTest.resource(input);
      const source=(await repository.listSourcePackagesByWorkspace(ids.tenantId,ids.workspaceId)).find(row=>row.fileName==='Resource/player.html');assert.deepEqual(Buffer.from(reply.bytes),Buffer.from(source.sourceDocument));assert.equal(reply.contentType,'text/html;charset=UTF-8');
      for(const groupToken of [main.person.token,main.login.token])await assert.rejects(services.originalTest.resource({...input,groupToken}),denied(403));
      await repository.saveWorkspace({...scope,workspace:{...workspace,status:'archived'}});await assert.rejects(services.originalTest.resource(input),denied(403));await repository.saveWorkspace({...scope,workspace});
      await repository.saveTenant({...tenant,status:'suspended'});await assert.rejects(services.originalTest.resource(input),denied(403));await repository.saveTenant(tenant);assert.deepEqual((await services.originalTest.resource(input)).bytes,reply.bytes);
      await assert.rejects(services.originalTest.resource({...input,workspaceNumber:'9223372036854775807'}),denied(403));await assert.rejects(services.originalTest.resource({...input,path:'Unit/unit.xml'}),denied(403));await assert.rejects(services.originalTest.resource({...input,path:'Resource/../Testtakers/participant-roster.xml'}),denied(404));
    });
    await t.test('current file replacement never rewrites first Test label and locked native creation returns 423',async()=>{
      await upload('unassigned.xml',booklet(native.bookletName,labels.replacementLabel));const preset=await request(main,names.presetCanonical);assert.equal((await services.originalTest.read({token:main.person.token,testNumber:preset})).xml,booklet(native.bookletName,labels.replacementLabel));
      await repository.mutateParticipantRun(run,context=>({testRun:{...context.testRun,locked:true},testLogs:[],activityEvents:[]}));
      await assert.rejects(request(main,native.bookletName),error=>{assert.equal(error.statusCode,423);assert.ok(error.message.includes(labels.firstLabel));return true;});
      assert.equal((await repository.getTestRunById(run.testRunId)).originalResultState.bookletLabel,labels.firstLabel);
      const monitor=(await services.monitorRead.listOpenRuns({...scope,testRunId:run.testRunId}))[0];assert.equal(monitor.testState.status,'locked');assert.equal(monitor.testState.ownedChoice,batchSource.equalBatch);
      await assert.rejects(services.originalTest.read({token:main.person.token,testNumber:number}),error=>{assert.equal(error.statusCode,423);assert.ok(error.message.includes(labels.firstLabel));assert.equal(error.message.includes(labels.replacementLabel),false);return true;});
    });
    await t.test('resource delivery follows replacement bytes and preserves binary data without text decoding',async()=>{
      const input={groupToken:main.person.groupToken,workspaceNumber:nativeWorkspaceNumber,path:'Resource/player.html'},old=await services.originalTest.resource(input);
      const source=Buffer.from(old.bytes).toString('utf8').replace('<main>Owned</main>','<main>Replacement Ω</main>');assert.notEqual(source,Buffer.from(old.bytes).toString('utf8'));
      await upload('player.html',source,'text/html');assert.deepEqual(Buffer.from((await services.originalTest.resource(input)).bytes),Buffer.from(source));
      const bytes=Buffer.from([0,255,254,128,47,0,195,40]);await upload('owned.bin','data:application/octet-stream;base64,'+bytes.toString('base64'),'application/octet-stream');
      const binary=await services.originalTest.resource({...input,path:'Resource/owned.bin'});assert.deepEqual(Buffer.from(binary.bytes),bytes);assert.equal(binary.contentType,'application/octet-stream');
      await reopen();assert.deepEqual(Buffer.from((await services.originalTest.resource({...input,path:'Resource/owned.bin'})).bytes),bytes);
    });
    await t.test('raw existing-name lookup precedes physical-file lookup, while normalization misses require the current file',async()=>{
      const result=await upload('gone.xml',booklet(removed.removedBooklet,'Gone'));
      const gone=await request(main,removed.removedBooklet);
      await services.contentIntake.deleteSourcePackage({...scope,sourcePackageId:result.sourcePackage.sourcePackageId,confirmation:'Booklet/gone.xml'});
      assert.equal(await request(main,removed.removedBooklet.toLowerCase()),gone);
      await assert.rejects(services.originalTest.read({token:main.person.token,testNumber:gone}),denied(404));
      await assert.rejects(request(main,' '+removed.removedBooklet+' '),denied(404));await assert.rejects(request(other,removed.removedBooklet),denied(404));
    });
    await t.test('native creation in review mode still exists, without manufacturing opened or saved state',async()=>{
      const review=await auth('owned-review'),id=await request(review,native.bookletName);assert.match(id,/^[1-9][0-9]*$/);
      const [saved]=await owned(review.person);assert.equal(saved.executionMode,'run-review');assert.equal(saved.originalResultState.lastOpenedAt,null);assert.equal(saved.originalResultState.hasTestState,false);
      await services.originalTest.patchState({token:review.person.token,testNumber:id,patch:[{key:'reviewState',content:42,timeStamp:1}]});const nativeRead=await services.originalTest.read({token:review.person.token,testNumber:id});assert.equal(nativeRead.mode,'run-review');assert.deepEqual(nativeRead.laststate,{reviewState:42});assert.equal((await repository.getTestRunById(saved.testRunId)).controllerEntry,undefined);
      const beforeUnits=await repository.getTestRunById(saved.testRunId),unitName='OWNED.REVIEW.UNIT';await services.originalUnit.patchState({token:review.person.token,testNumber:id,unitName,body:{newState:[{key:'review',content:'native write is allowed',timeStamp:1}]}});
      await services.originalUnit.putResponse({token:review.person.token,testNumber:id,unitName,body:{timeStamp:1,dataParts:{answer:'retained in native review mode'},responseType:'review/type'}});
      const result=await services.originalUnit.read({token:review.person.token,testNumber:id,unitName:'OWNED.NATIVE.UNIT',alias:unitName});assert.equal(result.state.review,'native write is allowed');assert.equal(result.dataParts[0][1],'retained in native review mode');assert.deepEqual(await repository.getTestRunById(saved.testRunId),beforeUnits);
    });
    await t.test('a created native Test remains available and starts its real controller and timer only on canonical entry',async()=>{
      const entry=await auth('owned-entry');const id=await request(entry,'owned.assigned');const [before]=await owned(entry.person);
      assert.equal((await services.participantRuntime.getRuntimeState({participantSessionId:before.participantSessionId})).booklets[0].status,'available');
      assert.equal((await services.originalSession.read({token:entry.person.token})).claims.test[0].flags.running,false);
      const entries=await Promise.all(Array.from({length:8},()=>services.participantRuntime.launch({participantSessionId:before.participantSessionId,bookletKey:'OWNED.ASSIGNED'})));
      assert.equal(new Set(entries.map(row=>row.testRunId)).size,1);const opened=entries[0];
      assert.equal(opened.testRunId,before.testRunId);assert.equal(opened.status,'running');assert.equal(opened.currentUnitKey,'OWNED.NATIVE.UNIT');assert.equal(opened.controllerEntry.active,true);
      const logs=(await repository.listParticipantTestLogsByWorkspace(ids.tenantId,ids.workspaceId)).filter(row=>row.testRunId===opened.testRunId);
      for(const key of ['CONTROLLER','CURRENT_UNIT_ID','TESTLETS_TIMELEFT'])assert.equal(logs.filter(row=>row.logKey===key).length,1);
      const events=(await repository.listWorkspaceActivityEventsByWorkspace(ids.tenantId,ids.workspaceId)).filter(row=>row.subjectId===opened.testRunId);
      for(const type of ['testlet_timer_started','participant_session_resumed'])assert.equal(events.filter(row=>row.eventType===type).length,1);
      assert.equal(opened.testletTimers.timed.status,'running');assert.ok(opened.originalResultState.lastOpenedAt);assert.equal(opened.originalResultState.bookletName,'owned.assigned');
      assert.equal((await services.originalSession.read({token:entry.person.token})).claims.test[0].flags.running,true);assert.equal(await request(entry,'OWNED.ASSIGNED'),id);
    });
    await t.test('concurrent same-name requests reserve one Test and one stable number',async()=>{
      const simultaneous=await auth('owned-atomic');const values=await Promise.all(Array.from({length:12},(_,index)=>request(simultaneous,index%2?native.bookletName:native.bookletName.toLowerCase())));
      assert.equal(new Set(values).size,1);assert.equal((await owned(simultaneous.person)).length,1);
    });
    if(kind==='postgres')await t.test('independent real PostgreSQL writers agree on one unopened Test and numeric identity',async()=>{
      const session=await auth('owned-cross-writer'),second=await createPostgresFirstSliceStorage(url.toString());
      try{
        const secondary=createFirstSliceServices({repository:second.repository,originalXmlSchemaValidator:validator,xmlSchemaProfile:'original-19'});
        const values=await Promise.all(Array.from({length:16},(_,index)=>(index%2?services:secondary).originalTest.create({token:session.person.token,bookletName:index%3?native.bookletName:native.bookletName.toLowerCase()})));
        assert.equal(new Set(values).size,1);const runs=await owned(session.person);assert.equal(runs.length,1);assert.equal(runs[0].status,'created');
        assert.equal(await second.repository.getOrCreateOriginalTestNumber(runs[0]),values[0]);
        const reads=await Promise.all(Array.from({length:16},(_,index)=>(index%2?services:secondary).originalTest.read({token:session.person.token,testNumber:values[0]})));
        assert.equal(reads.filter(row=>row.firstStart).length,1);assert.equal(new Set(reads.map(row=>row.workspaceId)).size,1);
        await Promise.all(Array.from({length:16},(_,index)=>(index%2?services:secondary).originalTest.patchState({token:session.person.token,testNumber:values[0],patch:[{key:'writer-'+index,content:index,timeStamp:1}]})));
        const expected=Object.fromEntries(Array.from({length:16},(_,index)=>['writer-'+index,index]));assert.deepEqual((await secondary.originalTest.read({token:session.person.token,testNumber:values[0]})).laststate,expected);
        assert.equal((await second.repository.listParticipantTestLogsByWorkspace(ids.tenantId,ids.workspaceId)).filter(row=>row.testRunId===runs[0].testRunId).length,16);
        const unitName='OWNED.PG.NATIVE.ALIAS',before=(await repository.getTestRunById(runs[0].testRunId)).originalResultState;
        await Promise.all(Array.from({length:12},(_,index)=>(index%2?services:secondary).originalUnit.patchState({token:session.person.token,testNumber:values[0],unitName:index%2?unitName:unitName.toLowerCase(),body:{originalUnitId:'FIRST.WRITER.'+index,newState:[{key:'unitWriter-'+index,content:String(index),timeStamp:index+1}]}})));
        await Promise.all(Array.from({length:12},(_,index)=>(index%2?services:secondary).originalUnit.putResponse({token:session.person.token,testNumber:values[0],unitName,body:{timeStamp:index+1,dataParts:{['part-'+index]:'answer '+index},responseType:'type/'+index}})));
        const unit=await second.repository.getOriginalUnit({...runs[0],unitName});assert.equal(Object.keys(unit.state).length,12);assert.equal(unit.parts.length,12);assert.match(unit.originalUnitId,/^FIRST.WRITER.\d+$/);
        for(let index=0;index<12;index++){assert.equal(unit.state['unitWriter-'+index],String(index));assert.deepEqual(unit.parts.find(part=>part.id==='part-'+index),{id:'part-'+index,content:'answer '+index,ts:index+1,responseType:'type/'+index});}
        assert.deepEqual((await repository.getTestRunById(runs[0].testRunId)).originalResultState,before);
      }finally{await second.shutdown();}
    });
    await t.test('native Test log storage appends atomically under metadata ownership without changing or decoding its Run',async t=>{
      const testNumber=await request(main,'OWNED.ASSIGNED#log:storage');
      const input=await repository.findOriginalTestNumber({...ids,participantSessionId:main.person.participantSession.participantSessionId,testNumber});assert.ok(input);
      const before=await repository.getTestRunById(input.testRunId),person=await repository.getParticipantSessionById(input.participantSessionId);
      const make=(fields={})=>({participantTestLogId:randomUUID(),...ids,participantSessionId:input.participantSessionId,testRunId:input.testRunId,unitKey:null,originalUnitId:null,logKey:'owned-append',logContent:'"Owned Ω/x"',timestamp:0,recordedAt:stamp,...fields});
      const logs=async()=>(await repository.listParticipantTestLogsByWorkspace(ids.tenantId,ids.workspaceId)).filter(row=>row.testRunId===input.testRunId).sort((a,b)=>a.participantTestLogId.localeCompare(b.participantTestLogId));
      const unchanged=async()=>{assert.deepEqual(await repository.getTestRunById(input.testRunId),before);assert.deepEqual(await repository.getParticipantSessionById(input.participantSessionId),person);};
      await t.test('append and repeated packets persist exact independent rows while empty batches retain every Run field',async()=>{
        const batch=[make(),make({timestamp:42,logContent:'false'})];await repository.appendOriginalTestLogs(input,batch);
        const duplicate=batch.map(row=>({...row,participantTestLogId:randomUUID()}));await repository.appendOriginalTestLogs(input,duplicate);
        const expected=[...batch,...duplicate].sort((a,b)=>a.participantTestLogId.localeCompare(b.participantTestLogId));assert.deepEqual(await logs(),expected);await unchanged();
        await repository.appendOriginalTestLogs(input,[]);assert.deepEqual(await logs(),expected);await unchanged();
        assert.equal(await repository.getOriginalUnit({...input,unitName:'OWNED.NATIVE.UNIT'}),null);
        await reopen();assert.deepEqual(await logs(),expected);await unchanged();
      });
      await t.test('an artifact ID named __proto__ remains an own durable log entry across every store',async()=>{
        const row=make({participantTestLogId:'__proto__'});await repository.appendOriginalTestLogs(input,[row]);
        assert.deepEqual((await logs()).find(value=>value.participantTestLogId===row.participantTestLogId),row);await unchanged();
        await reopen();assert.deepEqual((await logs()).find(value=>value.participantTestLogId===row.participantTestLogId),row);await unchanged();
      });
      await t.test('current native mapping and every parent column authorize before examining private append rows',async()=>{
        const saved=await logs();
        for(const key of ['testRunId','participantSessionId','tenantId','workspaceId','contentReleaseId']){
          await assert.rejects(repository.appendOriginalTestLogs({...input,[key]:'foreign'},[null]),denied(409,'result_parent_scope_changed'));
        }
        await assert.rejects(repository.appendOriginalTestLogs({...input,testNumber:'9223372036854775807'},[null]),denied(409,'result_parent_scope_changed'));
        assert.deepEqual(await logs(),saved);await unchanged();
      });
      await t.test('late existing-ID collisions, duplicate batch IDs and foreign or Unit rows roll back the entire append',async()=>{
        const saved=await logs(),existing=saved[0];
        await assert.rejects(repository.appendOriginalTestLogs(input,[make(),{...existing}]),/collision|constraint|duplicate|unique/i);
        const same=make();await assert.rejects(repository.appendOriginalTestLogs(input,[same,same]),/collision/i);
        for(const row of [make({unitKey:'OWNED.NATIVE.UNIT'}),make({originalUnitId:'native-unit'}),make({testRunId:'foreign'}),make({timestamp:NaN}),make({originalTimestamp:0,timestamp:42})])await assert.rejects(repository.appendOriginalTestLogs(input,[make(),row]));
        assert.deepEqual(await logs(),saved);await unchanged();await reopen();assert.deepEqual(await logs(),saved);await unchanged();
      });
      if(kind==='sqlite'||kind==='postgres')await t.test('the actual owner can append without decoding malformed unrelated canonical response data',async()=>{
        const connection=kind==='sqlite'?new DatabaseSync(file):new Pool({connectionString:url.toString()});
        const query=async(sql,args=[])=>kind==='sqlite'?connection.prepare(sql).all(...args):(await connection.query(sql,args)).rows;
        const update=async value=>kind==='sqlite'?connection.prepare('UPDATE test_runs SET unit_responses_json=? WHERE test_run_id=?').run(value,input.testRunId):connection.query('UPDATE test_runs SET unit_responses_json=$1 WHERE test_run_id=$2',[value,input.testRunId]);
        const saved=(await query(kind==='sqlite'?'SELECT unit_responses_json FROM test_runs WHERE test_run_id=?':'SELECT unit_responses_json FROM test_runs WHERE test_run_id=$1',[input.testRunId]))[0].unit_responses_json;
        const marker='{"owned_private_response_that_must_not_be_decoded":';
        try{
          await update(marker);await assert.rejects(repository.getTestRunById(input.testRunId));
          const row=make({logKey:'metadata-only'});await repository.appendOriginalTestLogs(input,[row]);assert.ok((await logs()).some(value=>value.participantTestLogId===row.participantTestLogId));
          assert.equal((await query(kind==='sqlite'?'SELECT unit_responses_json FROM test_runs WHERE test_run_id=?':'SELECT unit_responses_json FROM test_runs WHERE test_run_id=$1',[input.testRunId]))[0].unit_responses_json,marker);
        }finally{await update(saved);if(kind==='sqlite')connection.close();else await connection.end();}
        await unchanged();
      });
      if(kind==='sqlite'||kind==='postgres')await t.test('a real late log INSERT failure rolls back earlier rows without changing the parent',async()=>{
        const connection=kind==='sqlite'?new DatabaseSync(file):new Pool({connectionString:url.toString()}),exec=sql=>kind==='sqlite'?connection.exec(sql):connection.query(sql),saved=await logs();
        try{
          await exec(kind==='sqlite'?"CREATE TRIGGER owned_testlog_append_failure BEFORE INSERT ON participant_test_logs WHEN NEW.log_key='owned-append-fail' BEGIN SELECT RAISE(ABORT,'owned native Testlog append failure'); END":
            "CREATE FUNCTION owned_testlog_append_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'owned native Testlog append failure'; END $$; CREATE TRIGGER owned_testlog_append_failure BEFORE INSERT ON participant_test_logs FOR EACH ROW WHEN (NEW.log_key='owned-append-fail') EXECUTE FUNCTION owned_testlog_append_failure()");
          await assert.rejects(repository.appendOriginalTestLogs(input,[make(),make({logKey:'owned-append-fail'})]),/owned native Testlog append failure/);
          assert.deepEqual(await logs(),saved);await unchanged();
        }finally{await exec(kind==='sqlite'?'DROP TRIGGER owned_testlog_append_failure':'DROP TRIGGER owned_testlog_append_failure ON participant_test_logs; DROP FUNCTION owned_testlog_append_failure()');if(kind==='sqlite')connection.close();else await connection.end();}
      });
      if(kind==='file')await t.test('late File publication failure retains the durable log set and the in-process cache',async()=>{
        const saved=await logs(),backup=file+'.testlog-append-backup';await rename(file,backup);await mkdir(file);
        try{await assert.rejects(repository.appendOriginalTestLogs(input,[make()]));assert.deepEqual(await logs(),saved);await unchanged();}
        finally{await rm(file,{recursive:true});await rename(backup,file);}
        await reopen();assert.deepEqual(await logs(),saved);await unchanged();
      });
      await t.test('a retired mapping cannot be reused by a stale writer or recreate orphan logs',async()=>{
        const saved=await logs();assert.equal(await repository.deleteTestRunsByIds([input.testRunId]),1);
        const after=await logs();await assert.rejects(repository.appendOriginalTestLogs(input,[make()]),denied(409,'result_parent_scope_changed'));assert.deepEqual(await logs(),after);
        // Parent UUID reuse is an owned countercase, not a migration policy.
        await repository.saveTestRun(before);await assert.rejects(repository.appendOriginalTestLogs(input,[make()]),denied(409,'result_parent_scope_changed'));
        assert.deepEqual(await logs(),after);assert.ok(saved.length>=4);
      });
    });
    await t.test('native Testlog append pairs the real stored effect and JSON/CSV formatter with production Source48',async t=>{
      const wireWorkspace=await services.platform.createWorkspace({tenantKey:tenant.tenantKey,workspaceKey:'native-log-wire',displayName:'Owned native Testlog'});
      const wireScope={tenantKey:tenant.tenantKey,workspaceKey:wireWorkspace.workspaceKey};
      const uploadWire=(fileName,sourceDocument,mediaType='application/xml')=>services.contentIntake.uploadWorkspaceFile({...wireScope,fileName,sourceDocument,mediaType});
      const metadata={id:'owned-pow-player',version:'6.0.4',specVersion:'6.0',metadataVersion:'2.0',type:'player',name:[{lang:'de',value:'Owned proof player'}]};
      await uploadWire('player.html','<!doctype html><html><script type="application/ld+json">'+JSON.stringify(metadata)+'</script><main>Owned fixture</main></html>','text/html');
      await uploadWire('unit.xml',xml('Unit','<Metadata><Id>ORACLE.POW.UNIT</Id><Label>Owned unit</Label></Metadata><Definition player="owned-pow-player@6.0.4">Owned definition</Definition>'));
      await uploadWire('booklet.xml',xml('Booklet','<Metadata><Id>ORACLE.POW.BOOK</Id><Label>Owned proof booklet</Label></Metadata><Units><Unit id="ORACLE.POW.UNIT" label="Owned unit"/></Units>'));
      await uploadWire('people.xml',xml('Testtakers','<Metadata/><Group id="ORACLE.TESTLOG" label="Owned native Testlog"><Login name="owned-native-testlog" pw="'+password+'" mode="run-review"><Booklet codes="Shared">ORACLE.POW.BOOK</Booklet></Login></Group>'));
      const login=await services.originalAuthentication.login({name:'owned-native-testlog',password});
      const person=await services.originalAuthentication.person({loginToken:login.token,code:'Shared'});
      const testNumber=await services.originalTest.create({token:person.token,bookletName:nativeLogRows[0].bookletname});
      const input=await repository.findOriginalTestNumber({tenantId:tenant.tenantId,workspaceId:wireWorkspace.workspaceId,participantSessionId:person.participantSession.participantSessionId,testNumber});assert.ok(input);
      const logs=async()=>(await repository.listParticipantTestLogsByWorkspace(input.tenantId,input.workspaceId)).filter(row=>row.testRunId===input.testRunId);
      const ordered=[];
      const append=async body=>{
        const prior=new Set((await logs()).map(row=>row.participantTestLogId));await services.originalTest.putLog({token:person.token,testNumber,body});
        const added=(await logs()).filter(row=>!prior.has(row.participantTestLogId)).sort((a,b)=>a.timestamp-b.timestamp);ordered.push(...added);return added;
      };
      await t.test('optional empty/null content and zero timestamps append without opening or modifying the Test',async()=>{
        const before=await repository.getTestRunById(input.testRunId),parent=await repository.getParticipantSessionById(input.participantSessionId);
        const defaults=await append([{key:'missing',timeStamp:0},{key:'null',content:null,timeStamp:1},{key:'empty',content:'',timeStamp:2}]);
        assert.deepEqual(defaults.map(formatOriginalTestLogEntry),nativeLogDefaults.entries.map(row=>row.logentry));assert.deepEqual(defaults.map(row=>row.timestamp),[0,1,2]);
        assert.deepEqual(await repository.getTestRunById(input.testRunId),before);assert.deepEqual(await repository.getParticipantSessionById(input.participantSessionId),parent);
        const read=JSON.parse(formatOriginalTestReadJson(await services.originalTest.read({token:person.token,testNumber})));assert.equal(read.firstStart,true);assert.deepEqual(read.laststate,[]);
      });
      await t.test('actual typed Source packets preserve every PHP JSON byte and no saved state or clock changes',async()=>{
        const before=await repository.getTestRunById(input.testRunId),parent=await repository.getParticipantSessionById(input.participantSessionId);
        const added=await append(nativeLogTyped.input);assert.deepEqual(added.map(formatOriginalTestLogEntry),nativeLogTyped.entries.map(row=>row.logentry));
        assert.deepEqual(added.map(row=>row.timestamp),nativeLogTyped.input.map(row=>row.timeStamp));assert.deepEqual(await repository.getTestRunById(input.testRunId),before);
        assert.deepEqual(await repository.getParticipantSessionById(input.participantSessionId),parent);
      });
      await t.test('foreign ownership and a bad later row reject before publishing any packet prefix',async()=>{
        const before=await repository.getTestRunById(input.testRunId),saved=await logs();
        await assert.rejects(services.originalTest.putLog({token:main.person.token,testNumber,body:[null]}),denied(403));
        for(const body of [{},null,[{content:'no key',timeStamp:20}],[{key:'no timestamp',content:'x'}],[{key:'first must roll back',content:'x',timeStamp:21},{key:'invalid second'}]])await assert.rejects(services.originalTest.putLog({token:person.token,testNumber,body}),denied(400));
        assert.deepEqual(await logs(),saved);assert.deepEqual(await repository.getTestRunById(input.testRunId),before);
      });
      await t.test('repeated native packets remain duplicate rows and an empty array remains a no-op',async()=>{
        const body=[{key:'duplicate',content:'same packet Ω',timeStamp:99}],before=await repository.getTestRunById(input.testRunId);
        await append(body);await append(body);const actual=(await logs()).filter(row=>row.logKey==='duplicate');
        assert.equal(actual.length,2);assert.deepEqual(actual.map(formatOriginalTestLogEntry),nativeLogDuplicates.duplicateEntries.map(row=>row.logentry));
        const saved=await logs();await append([]);assert.deepEqual(await logs(),saved);assert.deepEqual(await repository.getTestRunById(input.testRunId),before);
      });
      await t.test('a separately established lock does not authorize a Run mutation when appending its following log',async()=>{
        // Source PATCH /lock is a distinct unimplemented boundary. Reproduce its
        // known parent/lock-log fixture through real storage, without claiming
        // that route or substituting the Testlog effect being qualified.
        const current=await repository.getTestRunById(input.testRunId);await repository.saveTestRun({...current,locked:true});
        const lock={participantTestLogId:randomUUID(),tenantId:input.tenantId,workspaceId:input.workspaceId,participantSessionId:input.participantSessionId,testRunId:input.testRunId,unitKey:null,originalUnitId:null,logKey:'Owned Testlog lock',logContent:'',timestamp:1792929600100,recordedAt:stamp};
        await repository.appendOriginalTestLogs(input,[lock]);ordered.push(lock);
        const before=await repository.getTestRunById(input.testRunId);await append([{key:'locked',content:'accepted',timeStamp:100}]);assert.deepEqual(await repository.getTestRunById(input.testRunId),before);
      });
      await t.test('the actual native rows in observed packet order reproduce complete Source JSON and CSV bytes after reopening',async()=>{
        await reopen();const persisted=await logs();assert.equal(persisted.length,15);
        const byId=new Map(persisted.map(row=>[row.participantTestLogId,row]));const parent=await repository.getParticipantSessionById(input.participantSessionId),run=await repository.getTestRunById(input.testRunId);
        const projected=ordered.map(row=>{const saved=byId.get(row.participantTestLogId);assert.deepEqual(saved,row);return{groupname:parent.groupKey,loginname:parent.originalLoginKey,code:parent.originalNameSuffix,bookletname:run.originalResultState.bookletName,unitname:'',originalUnitId:'',timestamp:saved.timestamp,logentry:formatOriginalTestLogEntry(saved)};});
        assert.deepEqual(projected,nativeLogRows);
        for(const format of['json','csv'])assert.equal(formatOriginalLogReport(projected,format),await readFile(new URL('testlog-append.'+format,logEvidence),'utf8'));
        assert.equal(await repository.getOriginalUnit({...input,unitName:'ORACLE.POW.UNIT'}),null);
      });
    });
    await t.test('Source51 Testlog codec retains actual raw numbers escaped NULs and complete report bytes in this real store',async t=>{
      const scope={tenantKey:tenant.tenantKey,workspaceKey:'native-log-wire'};
      await services.contentIntake.uploadWorkspaceFile({...scope,fileName:'people.xml',mediaType:'application/xml',sourceDocument:xml('Testtakers','<Metadata/><Group id="ORACLE.TESTLOG.CODEC" label="Owned native Testlog codec"><Login name="owned-native-testlog-codec" pw="'+password+'" mode="run-review"><Booklet codes="Shared">ORACLE.POW.BOOK</Booklet></Login></Group>')});
      const workspace=await repository.getWorkspaceByScope(scope.tenantKey,scope.workspaceKey);assert.ok(workspace);const login=await services.originalAuthentication.login({name:'owned-native-testlog-codec',password});
      const person=await services.originalAuthentication.person({loginToken:login.token,code:'Shared'}),testNumber=await services.originalTest.create({token:person.token,bookletName:codecRows[0].bookletname});
      const input=await repository.findOriginalTestNumber({tenantId:tenant.tenantId,workspaceId:workspace.workspaceId,participantSessionId:person.participantSession.participantSessionId,testNumber});assert.ok(input);
      const logs=async()=>(await repository.listParticipantTestLogsByWorkspace(input.tenantId,input.workspaceId)).filter(row=>row.testRunId===input.testRunId);
      const before=await repository.getTestRunById(input.testRunId),ordered=[];
      const append=async body=>{const prior=new Set((await logs()).map(x=>x.participantTestLogId));await services.originalTest.putLog({token:person.token,testNumber,body});const next=(await logs()).filter(x=>!prior.has(x.participantTestLogId)).sort((a,b)=>a.timestamp-b.timestamp);ordered.push(...next);return next;};
      await t.test('escaped NULs and line separators are accepted without rewriting the Test',async()=>{
        const added=await append(codecEscaped.input);assert.deepEqual(added.map(formatOriginalTestLogEntry),codecEscaped.entries.map(x=>x.logentry));assert.deepEqual(await repository.getTestRunById(input.testRunId),before);
      });
      await t.test('every strict field error matches actual Source and leaves the whole log collection unchanged',async()=>{
        const saved=await logs();for(const entry of codecStrict.cases)await assert.rejects(append(decodeOriginalTestLogJson(entry.literal)),denied(entry.status));assert.deepEqual(await logs(),saved);
        await assert.rejects(append(decodeOriginalTestLogJson('[{"key":"valid prefix","content":1e-7,"timeStamp":1},{"key":"bad later","timeStamp":1.0}]')),denied(500));assert.deepEqual(await logs(),saved);
      });
      await t.test('raw negative zero exponents and int64 values match their genuine PHP encodings',async()=>{
        for(const[index,entry]of codecNumbers.numbers.entries()){
          const key='raw-number-'+index,row=codecRows.find(x=>x.logentry===key||x.logentry.startsWith(key+' : '));assert.ok(row);
          const raw='[{"key":'+JSON.stringify(key)+',"content":'+entry.literal+',"timeStamp":'+row.timestamp+'}]';
          const added=await append(decodeOriginalTestLogJson(raw));assert.equal(added.length,1);assert.equal(formatOriginalTestLogEntry(added[0]),entry.entry);
        }
      });
      await t.test('all14 durable rows reproduce complete Source51 JSON and CSV without report endpoint substitution',async()=>{
        const parent=await repository.getParticipantSessionById(input.participantSessionId),run=await repository.getTestRunById(input.testRunId),byId=new Map((await logs()).map(x=>[x.participantTestLogId,x]));
        const rows=ordered.map(row=>{const saved=byId.get(row.participantTestLogId);assert.deepEqual(saved,row);return{groupname:parent.groupKey,loginname:parent.originalLoginKey,code:parent.originalNameSuffix,bookletname:run.originalResultState.bookletName,unitname:'',originalUnitId:'',timestamp:saved.timestamp,logentry:formatOriginalTestLogEntry(saved)};});
        assert.deepEqual(rows,codecRows);for(const format of['json','csv'])assert.equal(formatOriginalLogReport(rows,format),await readFile(new URL('testlog-codec.'+format,codecEvidence),'utf8'));
        assert.deepEqual(run,before);assert.equal(await repository.getOriginalUnit({...input,unitName:'ORACLE.POW.UNIT'}),null);
      });
      await t.test('actual Source52 boundaries preserve complete int64 timestamps NUL keys property order and depth outcomes',async()=>{
        for(const scenario of boundaryCases){
          const saved=await logs();
          if(scenario.status===201){
            const added=await append(decodeOriginalTestLogJson(scenario.literal));assert.equal(added.length,scenario.addedRows,scenario.label);
            if(scenario.entries.length)assert.deepEqual(added.map(row=>({logentry:formatOriginalTestLogEntry(row)})),scenario.entries,scenario.label);
            if(scenario.label.startsWith('exact client timestamp '))assert.equal(added[0].originalClientTimestamp??String(added[0].timestamp),scenario.label.slice('exact client timestamp '.length));
          }else{
            await assert.rejects(async()=>append(decodeOriginalTestLogJson(scenario.literal)),error=>error instanceof SyntaxError||denied(scenario.status)(error));assert.deepEqual(await logs(),saved);
          }
        }
        assert.deepEqual(await repository.getTestRunById(input.testRunId),before);
      });
      await t.test('all Source52 log bytes and exact clocks survive real durable reopening',async()=>{
        const saved=await logs();
        const wide=saved.find(row=>row.originalClientTimestamp==='9223372036854775807');assert.ok(wide);
        await assert.rejects(repository.appendOriginalTestLogs(input,[{...wide,participantTestLogId:randomUUID(),timestamp:0}]),TypeError);assert.deepEqual(await logs(),saved);
        await assert.rejects(repository.appendOriginalTestLogs(input,[{...wide,participantTestLogId:randomUUID(),originalClientTimestamp:undefined}]),TypeError);assert.deepEqual(await logs(),saved);
        // Generic persistence/backups must retain the raw clock too, rather
        // than writing the already rounded JS projection back into SQL.
        await repository.saveParticipantTestLogs(saved);
        await reopen();assert.deepEqual(await repository.getTestRunById(input.testRunId),before);
        const parent=await repository.getParticipantSessionById(input.participantSessionId),run=await repository.getTestRunById(input.testRunId),byId=new Map((await logs()).map(x=>[x.participantTestLogId,x]));
        assert.equal(byId.size,saved.length);
        const projected=ordered.map(row=>{const current=byId.get(row.participantTestLogId);assert.deepEqual(current,row);return{groupname:parent.groupKey,loginname:parent.originalLoginKey,code:parent.originalNameSuffix,bookletname:run.originalResultState.bookletName,unitname:'',originalUnitId:'',timestamp:current.timestamp,...(current.originalClientTimestamp===undefined?{}:{originalClientTimestamp:current.originalClientTimestamp}),logentry:formatOriginalTestLogEntry(current)};});
        for(const format of['json','csv'])assert.equal(formatOriginalLogReport(projected,format),await readFile(new URL('testlog-codec-boundaries.'+format,boundaryEvidence),'utf8'));
      });
      await t.test('177 actual PHP float encodings and complete Source53 JSON/CSV survive this store',async()=>{
        const packet='['+floatCases.map((entry,index)=>{const key='float-corpus-'+index,row=floatReportRows.find(x=>x.logentry===key||x.logentry.startsWith(key+' : '));assert.ok(row);return'{"key":'+JSON.stringify(key)+',"content":'+entry.literal+',"timeStamp":'+row.timestamp+'}';}).join(',')+']';
        const added=await append(decodeOriginalTestLogJson(packet));assert.deepEqual(added.map(formatOriginalTestLogEntry),floatCases.map(x=>x.entry));await reopen();
        const parent=await repository.getParticipantSessionById(input.participantSessionId),run=await repository.getTestRunById(input.testRunId),byId=new Map((await logs()).map(x=>[x.participantTestLogId,x]));
        const projected=ordered.map(row=>{const saved=byId.get(row.participantTestLogId);assert.deepEqual(saved,row);return{groupname:parent.groupKey,loginname:parent.originalLoginKey,code:parent.originalNameSuffix,bookletname:run.originalResultState.bookletName,unitname:'',originalUnitId:'',timestamp:saved.timestamp,...(saved.originalClientTimestamp===undefined?{}:{originalClientTimestamp:saved.originalClientTimestamp}),logentry:formatOriginalTestLogEntry(saved)};});
        for(const format of['json','csv'])assert.equal(formatOriginalLogReport(projected,format),await readFile(new URL('testlog-codec-floats.'+format,floatEvidence),'utf8'));
        assert.deepEqual(run,before);
      });
      await t.test('native CONNECTION logs cannot become a controller state or advance presence clocks',async()=>{
        await append(decodeOriginalTestLogJson('[{"key":"CONNECTION","content":"arbitrary log only","timeStamp":9223372036854775807}]'));
        assert.deepEqual(await repository.listLatestParticipantTestStateLogsByWorkspace(input.tenantId,input.workspaceId,['CONNECTION']),[]);
        const presence=await repository.updateParticipantPresence({testRunId:input.testRunId,participantSessionId:input.participantSessionId,action:'poll',timestamp:Date.parse(stamp)});
        assert.equal(presence.accepted,false);assert.equal(presence.testLog,null);
        assert.deepEqual(await repository.getTestRunById(input.testRunId),before);
      });
    });
    await t.test('Source57 native lock matches all21 actual outcomes and preserves unrelated Test data',async t=>{
      const wireScope={tenantKey:tenant.tenantKey,workspaceKey:'native-log-wire'};
      await services.contentIntake.uploadWorkspaceFile({...wireScope,fileName:'people.xml',mediaType:'application/xml',sourceDocument:xml('Testtakers','<Metadata/><Group id="ORACLE.TEST.LOCK" label="Owned native Test lock"><Login name="owned-native-test-lock" pw="'+password+'" mode="run-review"><Booklet codes="Shared">ORACLE.POW.BOOK</Booklet></Login></Group>')});
      const workspace=await repository.getWorkspaceByScope(wireScope.tenantKey,wireScope.workspaceKey);assert.ok(workspace);
      const login=await services.originalAuthentication.login({name:'owned-native-test-lock',password}),person=await services.originalAuthentication.person({loginToken:login.token,code:'Shared'});
      const byBooklet=new Map();
      const create=async label=>{
        const bookletName='ORACLE.POW.BOOK#lock:'+label,testNumber=await services.originalTest.create({token:person.token,bookletName});
        const scope=await repository.findOriginalTestNumber({tenantId:tenant.tenantId,workspaceId:workspace.workspaceId,participantSessionId:person.participantSession.participantSessionId,testNumber});assert.ok(scope);
        const value={bookletName,testNumber,scope};byBooklet.set(bookletName,value);return value;
      };
      const logs=async scope=>(await repository.listParticipantTestLogsByWorkspace(scope.tenantId,scope.workspaceId)).filter(row=>row.testRunId===scope.testRunId);
      const unchangedExceptLock=(before,after)=>assert.deepEqual(after,{...before,locked:true,updatedAt:after.updatedAt,originalResultState:{...before.originalResultState,lastTestModifiedAt:after.updatedAt}});
      await t.test('foreign and wrong-kind capabilities cannot lock before required-field validation',async()=>{
        const value=await create('authorization'),before=await repository.getTestRunById(value.scope.testRunId);
        for(const token of[login.token,person.groupToken,other.person.token])await assert.rejects(services.originalTest.patchLock({token,testNumber:value.testNumber,body:{}}),denied(403));
        assert.deepEqual(await repository.getTestRunById(value.scope.testRunId),before);assert.deepEqual(await logs(value.scope),[]);
      });
      for(const scenario of lockCases)await t.test(scenario.label+': actual Source'+scenario.status+' with durable locked='+scenario.locked,async()=>{
        const value=await create(scenario.label),before=await repository.getTestRunById(value.scope.testRunId),beforePerson=await repository.getParticipantSessionById(value.scope.participantSessionId);
        const invoke=async()=>services.originalTest.patchLock({token:person.token,testNumber:value.testNumber,body:scenario.body===''?undefined:decodeOriginalTestLogJson(scenario.body)});
        if(scenario.status===200)await invoke();else await assert.rejects(invoke,error=>scenario.label==='malformed'?(assert.ok(error instanceof SyntaxError),true):denied(scenario.status)(error));
        await reopen();const after=await repository.getTestRunById(value.scope.testRunId);assert.equal(after.locked,scenario.locked);
        if(scenario.locked){unchangedExceptLock(before,after);await assert.rejects(services.originalTest.create({token:person.token,bookletName:value.bookletName}),denied(423));await assert.rejects(services.originalTest.read({token:person.token,testNumber:value.testNumber}),denied(423));}
        else assert.deepEqual(after,before);
        assert.deepEqual(await repository.getParticipantSessionById(value.scope.participantSessionId),beforePerson);
        const actual=await logs(value.scope);assert.equal(actual.length,scenario.appendCount);assert.deepEqual(actual.map(formatOriginalTestLogEntry),scenario.entries.map(x=>x.logentry));
        if(actual.length){assert.equal(actual[0].originalTimestamp,undefined);assert.equal(actual[0].unitKey,null);assert.equal(actual[0].originalUnitId,null);assert.equal(actual[0].logContent,'');}
        if(scenario.label==='int64-max')assert.equal(actual[0].originalClientTimestamp,'9223372036854775807');
        if(scenario.label==='int64-min')assert.equal(actual[0].originalClientTimestamp,'-9223372036854775808');
      });
      await t.test('repeated locks append distinct raw-key rows and retain every state timer and response',async()=>{
        const value=await create('repeat'),before=await repository.getTestRunById(value.scope.testRunId);
        const body=decodeOriginalTestLogJson('{"timeStamp":42,"message":"repeated raw key"}');
        await services.originalTest.patchLock({token:person.token,testNumber:'000'+value.testNumber,body});
        await services.originalTest.patchLock({token:person.token,testNumber:value.testNumber,body});await reopen();
        const actual=await logs(value.scope);assert.equal(actual.length,2);assert.equal(new Set(actual.map(x=>x.participantTestLogId)).size,2);assert.deepEqual(actual.map(formatOriginalTestLogEntry),lockReceipt.checks[55].repeatEntries.map(x=>x.logentry));
        unchangedExceptLock(before,await repository.getTestRunById(value.scope.testRunId));
        const opened=await create('opened');assert.equal((await services.originalTest.read({token:person.token,testNumber:opened.testNumber})).firstStart,true);
        await services.originalTest.patchState({token:person.token,testNumber:opened.testNumber,patch:[{key:'ownedLockState',content:'preserved',timeStamp:1}]});
        const beforeLock=await repository.getTestRunById(opened.scope.testRunId);
        const latest=(await repository.listLatestParticipantTestStateLogsByWorkspace(opened.scope.tenantId,opened.scope.workspaceId,['ownedLockState'])).filter(row=>row.testRunId===opened.scope.testRunId);assert.equal(latest.length,1);assert.equal(latest[0].logContent,'"preserved"');
        await services.originalTest.patchLock({token:person.token,testNumber:opened.testNumber,body:{timeStamp:99,message:'opened lock'}});await reopen();
        const after=await repository.getTestRunById(opened.scope.testRunId);unchangedExceptLock(beforeLock,after);assert.deepEqual(after.originalTestState,{ownedLockState:'preserved'});
        await assert.rejects(services.originalTest.read({token:person.token,testNumber:opened.testNumber}),denied(423));
      });
      await t.test('complete protected Source57 JSON and CSV bytes match real reopened logs using the production entry formatter',async()=>{
        const {formatOriginalParticipantLogEntry}=await import('../packages/application/dist/packages/application/src/original-report-csv.js');
        await reopen();const parent=await repository.getParticipantSessionById(person.participantSession.participantSessionId);
        const pool=[];for(const value of byBooklet.values())for(const log of await logs(value.scope))pool.push({bookletname:value.bookletName,log});
        const projected=lockReportRows.map(source=>{
          const index=pool.findIndex(x=>x.bookletname===source.bookletname&&x.log.timestamp===source.timestamp);assert.ok(index>=0);const {bookletname,log}=pool.splice(index,1)[0];
          return{groupname:parent.groupKey,loginname:parent.originalLoginKey,code:parent.originalNameSuffix,bookletname,unitname:'',originalUnitId:'',timestamp:log.timestamp,...(log.originalClientTimestamp===undefined?{}:{originalClientTimestamp:log.originalClientTimestamp}),logentry:formatOriginalParticipantLogEntry(log)};
        });assert.equal(pool.length,0);
        // Source DAO does not promise append order. This is exact collection /
        // formatter proof in its observed order, not literal report transport.
        for(const format of['json','csv'])assert.equal(formatOriginalLogReport(projected,format),await readFile(new URL('test-lock.'+format,lockEvidence),'utf8'));
      });
      await t.test('the lock store rechecks every immutable scope before timestamp validation',async()=>{
        const value=await create('store-scope'),before=await repository.getTestRunById(value.scope.testRunId);
        for(const key of['testNumber','testRunId','participantSessionId','tenantId','workspaceId','contentReleaseId']){
          await assert.rejects(repository.lockOriginalTest({...value.scope,[key]:key==='testNumber'?'9223372036854775807':'foreign-owned-scope'},'not a timestamp'));
          assert.deepEqual(await repository.getTestRunById(value.scope.testRunId),before);
        }
        await assert.rejects(repository.lockOriginalTest(value.scope,'not a timestamp'),TypeError);assert.deepEqual(await repository.getTestRunById(value.scope.testRunId),before);
      });
      await t.test('retired native mappings cannot lock a privately restored Run through the old number',async()=>{
        const value=await create('retired'),before=await repository.getTestRunById(value.scope.testRunId);
        await repository.deleteTestRunsByIds([value.scope.testRunId]);await repository.saveTestRun(before);
        await assert.rejects(repository.lockOriginalTest(value.scope,stamp));
        await assert.rejects(services.originalTest.patchLock({token:person.token,testNumber:value.testNumber,body:{timeStamp:1}}),denied(403));
        assert.deepEqual(await repository.getTestRunById(value.scope.testRunId),before);assert.deepEqual(await logs(value.scope),[]);
      });
      if(kind==='sqlite'||kind==='postgres')await t.test('metadata-owned lock and its later log do not decode unrelated corrupt response JSON',async()=>{
        const value=await create('unrelated-json'),before=await repository.getTestRunById(value.scope.testRunId);
        const connection=kind==='sqlite'?new DatabaseSync(file):new Pool({connectionString:url.toString()});
        const update=async content=>kind==='sqlite'?connection.prepare('UPDATE test_runs SET unit_responses_json=? WHERE test_run_id=?').run(content,value.scope.testRunId):connection.query('UPDATE test_runs SET unit_responses_json=$1 WHERE test_run_id=$2',[content,value.scope.testRunId]);
        try{await update('{owned corrupt response');await services.originalTest.patchLock({token:person.token,testNumber:value.testNumber,body:{timeStamp:1,message:'metadata lock'}});}
        finally{await update(JSON.stringify(before.unitResponses));if(kind==='sqlite')connection.close();else await connection.end();}
        await reopen();unchangedExceptLock(before,await repository.getTestRunById(value.scope.testRunId));assert.equal((await logs(value.scope)).length,1);
      });
      if(kind==='sqlite'||kind==='postgres')await t.test('actual log INSERT failure leaves the prior lock durable and no partial log',async()=>{
        const value=await create('insert-failure'),before=await repository.getTestRunById(value.scope.testRunId);
        const connection=kind==='sqlite'?new DatabaseSync(file):new Pool({connectionString:url.toString()}),exec=sql=>kind==='sqlite'?connection.exec(sql):connection.query(sql);
        await exec(kind==='sqlite'?"CREATE TRIGGER owned_lock_log_failure BEFORE INSERT ON participant_test_logs BEGIN SELECT RAISE(ABORT,'owned lock log failure'); END":"CREATE FUNCTION owned_lock_log_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'owned lock log failure'; END $$; CREATE TRIGGER owned_lock_log_failure BEFORE INSERT ON participant_test_logs FOR EACH ROW EXECUTE FUNCTION owned_lock_log_failure()");
        try{await assert.rejects(services.originalTest.patchLock({token:person.token,testNumber:value.testNumber,body:{timeStamp:5,message:'lock survives actual INSERT failure'}}),/owned lock log failure/);}
        finally{await exec(kind==='sqlite'?'DROP TRIGGER owned_lock_log_failure':'DROP TRIGGER owned_lock_log_failure ON participant_test_logs; DROP FUNCTION owned_lock_log_failure()');if(kind==='sqlite')connection.close();else await connection.end();}
        await reopen();unchangedExceptLock(before,await repository.getTestRunById(value.scope.testRunId));assert.deepEqual(await logs(value.scope),[]);
      });
      if(kind==='file')await t.test('actual File log publication failure retains the separately committed lock after reopening',async()=>{
        const value=await create('publication-failure'),before=await repository.getTestRunById(value.scope.testRunId),backup=file+'.owned-lock-backup';
        const failing=createFirstSliceServices({repository:{...repository,async appendOriginalTestLogs(scope,entries){await rename(file,backup);await mkdir(file);try{await repository.appendOriginalTestLogs(scope,entries);}finally{await rm(file,{recursive:true});await rename(backup,file);}}},originalXmlSchemaValidator:validator,xmlSchemaProfile:'original-19'});
        await assert.rejects(failing.originalTest.patchLock({token:person.token,testNumber:value.testNumber,body:{timeStamp:5,message:'durable lock before File failure'}}));
        await reopen();unchangedExceptLock(before,await repository.getTestRunById(value.scope.testRunId));assert.deepEqual(await logs(value.scope),[]);
      });
    });
    await t.test('generic Test deletion retires its number mapping without reusing the number for the same private UUID',async()=>{
      const session=await auth('owned-after-delete'),old=await request(session,native.bookletName),[saved]=await owned(session.person);
      const unitName='OWNED.DELETED.UNIT';await services.originalUnit.patchState({token:session.person.token,testNumber:old,unitName,body:{originalUnitId:'NEVER.REVIVE',newState:[{key:'private',content:'must be retired',timeStamp:1}]}});assert.ok(await repository.getOriginalUnit({...saved,unitName}));
      await repository.deleteTestRunsByIds([saved.testRunId]);assert.equal(await repository.findOriginalTestNumber({...saved,testNumber:old}),null);await repository.saveTestRun({...saved,originalResultState:{...saved.originalResultState,bookletName:'Recreated'}});
      assert.equal(await repository.getOriginalUnit({...saved,unitName}),null);
      const fresh=await repository.getOrCreateOriginalTestNumber(saved);assert.ok(BigInt(fresh)>BigInt(old));
    });
    if(kind==='sqlite'||kind==='postgres')await t.test('real protected native HTTP returns raw decimal HTML and rejects wrong roles before parsing the body',async()=>{
      const environment={FIRST_SLICE_STORE:kind,FIRST_SLICE_SQLITE_FILE:file,FIRST_SLICE_BOOTSTRAP_DEMO:'false',FIRST_SLICE_OPERATOR_AUTH_REQUIRED:'true',
        FIRST_SLICE_XML_SCHEMA_PROFILE:'original-19',FIRST_SLICE_PROOF_OF_WORK_SCOPES:'',...(url?{FIRST_SLICE_POSTGRES_URL:url.toString()}:{})};
      const previous=new Map(Object.keys(environment).map(key=>[key,process.env[key]]));let server;
      try{
        try{Object.assign(process.env,environment);server=await createProductionApiServer();}
        finally{for(const[key,value]of previous){if(value===undefined)delete process.env[key];else process.env[key]=value;}}
        await new Promise(done=>server.listen(0,'127.0.0.1',done));const base='http://127.0.0.1:'+server.address().port;
        const call=async(method,token,body,status)=>{
          const response=await fetch(base+'/test',{method,headers:{...(token?{AuthToken:token}:{}),'content-type':'application/json'},...(body===undefined?{}:{body}),signal:AbortSignal.timeout(15000)});
          const text=await response.text();assert.equal(response.status,status,method+' /test: '+response.status);assert.equal(response.headers.get('cache-control'),'private, no-store');return{text,headers:response.headers};
        };
        const httpPerson=await auth('owned-atomic'),before=await owned(httpPerson.person);
        const initialized=await services.adminAuth.bootstrapAdminUser({username:'owned-native-admin',password});
        const adminToken=(await services.adminAuth.signIn({username:'owned-native-admin',password})).adminSession.token;
        await call('PUT',undefined,'{',401);await call('PUT',httpPerson.login.token,'{',403);
        await call('PUT',httpPerson.person.groupToken,'{',403);await call('PUT',adminToken,'{',403);
        await call('PUT','invalid-owned-token','{',401);await call('PUT',httpPerson.person.token,'{',400);
        for(const body of ['null','[]','{}','{"bookletName":1}'])await call('PUT',httpPerson.person.token,body,400);
        assert.deepEqual(await owned(httpPerson.person),before);
        const key=native.bookletName,expected=await request(httpPerson,key);
        const result=await call('PUT',httpPerson.person.token,JSON.stringify({bookletName:key,ignored:'owned'}),201);
        assert.equal(result.text,expected);assert.match(result.text,/^[1-9][0-9]*$/);assert.equal(result.headers.get('content-type'),'text/html; charset=UTF-8');
        assert.equal((await call('PUT',httpPerson.person.token,JSON.stringify({bookletName:key.toLowerCase()}),201)).text,expected);
        assert.equal((await call('PUT',httpPerson.person.token,JSON.stringify({bookletName:key+'#0'}),201)).text,expected);
        const nativeRequest=async(method,path,token,body,status=200)=>{
          const response=await fetch(base+path,{method,headers:{...(token?{AuthToken:token}:{}),...(body===undefined?{}:{'content-type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(15000)});
          const bytes=Buffer.from(await response.arrayBuffer());assert.equal(response.status,status,method+' native endpoint status');return{bytes,text:bytes.toString('utf8'),headers:response.headers};
        };
        await nativeRequest('GET','/test/'+expected,httpPerson.login.token,undefined,403);await nativeRequest('GET','/test/'+expected,other.person.token,undefined,403);
        const opened=await nativeRequest('GET','/test/'+expected,httpPerson.person.token),nativeValue=JSON.parse(opened.text);
        assert.equal(opened.headers.get('content-type'),'application/json');assert.equal(opened.headers.get('cache-control'),'private, no-store');assert.equal(nativeValue.firstStart,true);assert.deepEqual(nativeValue.laststate,[]);assert.equal(nativeValue.resources['OWNED.NATIVE.UNIT'].usesPlayer[0],'Resource/player.html');
        const stateReply=await nativeRequest('PATCH','/test/'+expected+'/state',httpPerson.person.token,[{key:'httpState',content:{b:'\u03a9/x',a:1},timeStamp:1}]);assert.equal(stateReply.bytes.length,0);
        const reread=JSON.parse((await nativeRequest('GET','/test/'+expected,httpPerson.person.token)).text);assert.equal(reread.firstStart,false);assert.equal(reread.laststate.httpState,typedSource.state.ownedObject);
        const unitPath='/test/'+expected+'/unit/OWNED.HTTP.ALIAS',unitRead='/test/'+expected+'/unit/OWNED.NATIVE.UNIT/alias/OWNED.HTTP.ALIAS';
        const emptyUnit=await nativeRequest('GET',unitRead,httpPerson.person.token);assert.equal(emptyUnit.headers.get('content-type'),'application/json');assert.deepEqual(JSON.parse(emptyUnit.text),{state:{},dataParts:{},unitResponseType:'',definition:'Owned definition',definitionType:'owned-native-player-1.2'});
        const malformed=await fetch(base+unitPath+'/state',{method:'PATCH',headers:{AuthToken:httpPerson.login.token,'content-type':'application/json'},body:'{',signal:AbortSignal.timeout(15000)});assert.equal(malformed.status,403);await malformed.arrayBuffer();
        await nativeRequest('GET',unitRead,other.person.token,undefined,403);await nativeRequest('PUT',unitPath+'/response',httpPerson.person.token,{timeStamp:5,dataParts:{a:'too early'}},404);
        const unitState=await nativeRequest('PATCH',unitPath+'/state',httpPerson.person.token,{originalUnitId:'FIRST.HTTP.ID',newState:[{key:'choice',content:'newest',timeStamp:9}]});assert.equal(unitState.bytes.length,0);
        await nativeRequest('PATCH',unitPath+'/state',httpPerson.person.token,[{key:'choice',content:'older ignored',timeStamp:1}]);
        const unitResponse=await nativeRequest('PUT',unitPath+'/response',httpPerson.person.token,{timeStamp:5,dataParts:{a:'Exact HTTP Ω/x'},responseType:'owned/http'},201);assert.equal(unitResponse.bytes.length,0);assert.equal(unitResponse.headers.get('content-type'),'text/html; charset=UTF-8');
        await nativeRequest('PUT',unitPath+'/response',httpPerson.person.token,{timeStamp:5,dataParts:{a:'equal rejected',b:'new default type'}},201);
        const restoredUnit=JSON.parse((await nativeRequest('GET',unitRead,httpPerson.person.token)).text);assert.deepEqual(restoredUnit.state,{choice:'newest'});assert.deepEqual(restoredUnit.dataParts,{a:'Exact HTTP Ω/x',b:'new default type'});assert.equal(restoredUnit.unitResponseType,'unknown');
        const logged=await nativeRequest('PUT',unitPath+'/log',httpPerson.person.token,{logEntries:[{key:'httpNativeUnitLog',content:{owned:true},timeStamp:0}]},201);assert.equal(logged.bytes.length,0);
        const nativeUnitLog=(await repository.listParticipantTestLogsByWorkspace(workspace.tenantId,workspace.workspaceId)).find(row=>row.logKey==='httpNativeUnitLog');
        assert.ok(nativeUnitLog);assert.match(nativeUnitLog.participantTestLogId,/^original-unit-log:/);
        const {formatOriginalParticipantLogEntry:formatNativeUnitLog}=await import('../packages/application/dist/packages/application/src/original-report-csv.js');
        assert.equal(formatNativeUnitLog(nativeUnitLog),'httpNativeUnitLog = {"owned":true}');
        assert.deepEqual(JSON.parse((await nativeRequest('GET','/test/'+expected,httpPerson.person.token)).text).laststate,reread.laststate);
        const logPath='/test/'+expected+'/log';
        const logMapping=await repository.findOriginalTestNumber({...ids,participantSessionId:httpPerson.person.participantSession.participantSessionId,testNumber:expected});assert.ok(logMapping);
        const logRun=await repository.getTestRunById(logMapping.testRunId);assert.ok(logRun);assert.equal(logMapping.testNumber,expected);
        const readHttpLogs=async()=>(await repository.listParticipantTestLogsByWorkspace(ids.tenantId,ids.workspaceId)).filter(row=>row.testRunId===logRun.testRunId&&row.unitKey===null);
        const beforeLog=await repository.getTestRunById(logRun.testRunId),beforeUnit=await services.originalUnit.read({token:httpPerson.person.token,testNumber:expected,unitName:'OWNED.NATIVE.UNIT',alias:'OWNED.HTTP.ALIAS'});
        const rawLog=async(path,token,body,status,method='PUT')=>{
          const response=await fetch(base+path,{method,headers:{...(token?{AuthToken:token}:{}),'content-type':'application/json'},...(body===undefined?{}:{body}),signal:AbortSignal.timeout(15000)});
          const bytes=Buffer.from(await response.arrayBuffer());assert.equal(response.status,status,'native Testlog HTTP status');assert.equal(response.headers.get('cache-control'),'private, no-store');return{bytes,text:bytes.toString('utf8'),headers:response.headers};
        };
        const logOutput=[],logWrite=process.stdout.write;process.stdout.write=function(chunk,encoding,callback){logOutput.push(String(chunk));if(typeof encoding==='function')encoding();else if(typeof callback==='function')callback();return true;};
        try{
          const missing=await rawLog(logPath,undefined,'{',401);assert.equal(missing.text,'Auth Header not sufficient: missing');assert.equal(missing.headers.get('content-type'),'text/html;charset=UTF-8');assert.equal(missing.headers.get('test-mode'),'NO');assert.match(missing.headers.get('error-id'),/^error-/);
          for(const token of[httpPerson.login.token,httpPerson.person.groupToken,adminToken]){const denied=await rawLog(logPath,token,'{',403);assert.equal(denied.text.includes(token),false,'A denial must not reflect its supplied bearer');}
          const foreign=await rawLog(logPath,other.person.token,'{',403);assert.equal(foreign.text,'Access to test '+expected+' is not provided.');
          const malformed=await rawLog(logPath,httpPerson.person.token,'{"owned_private_response_must_not_echo":',500);
          assert.equal(malformed.text,'Internal error.');assert.equal(createHash('sha256').update(malformed.bytes).digest('hex'),logManifest.knownMalformedJsonResponse.sha256);assert.equal(malformed.headers.get('content-type'),logManifest.knownMalformedJsonResponse.contentType);
          assert.equal((await rawLog(logPath,httpPerson.person.token,undefined,400)).text,'body has to be an array');
          assert.equal((await rawLog(logPath,httpPerson.person.token,' ',500)).text,'Internal error.');
          const invalidUtf8=Buffer.from([0xff]);
          await rawLog(logPath,other.person.token,invalidUtf8,403);
          assert.equal((await rawLog(logPath,httpPerson.person.token,invalidUtf8,500)).text,'Internal error.');
          const saved=await readHttpLogs();
          const packet=[{key:'httpTestlogMissing',timeStamp:0},{key:'httpTestlogNull',content:null,timeStamp:1},{key:'httpTestlogZero',content:0,timeStamp:2}];
          const reply=await nativeRequest('PUT',logPath,httpPerson.person.token,packet,201);assert.equal(reply.bytes.length,0);assert.equal(reply.headers.get('content-type'),'text/html; charset=UTF-8');
          const after=await readHttpLogs(),added=after.filter(row=>!saved.some(old=>old.participantTestLogId===row.participantTestLogId)).sort((a,b)=>a.timestamp-b.timestamp);
          assert.deepEqual(added.map(row=>[row.logKey,row.logContent,row.timestamp]),[['httpTestlogMissing','""',0],['httpTestlogNull','""',1],['httpTestlogZero','0',2]]);
          await nativeRequest('PUT',logPath,httpPerson.person.token,packet,201);assert.equal((await readHttpLogs()).length,after.length+packet.length);
          const accepted=await readHttpLogs();
          const rejected=await nativeRequest('PUT',logPath,httpPerson.person.token,[{key:'must-roll-back',content:'first',timeStamp:3},{key:'missing-later-timestamp'}],400);
          assert.equal(rejected.text,'Required body-parameter is missing: `timeStamp`');assert.deepEqual(await readHttpLogs(),accepted);
          await nativeRequest('PUT','/test/000'+expected+'/log',httpPerson.person.token,[],201);assert.deepEqual(await readHttpLogs(),accepted);
          const wrongMethod=await rawLog(logPath,httpPerson.person.token,undefined,405,'GET');assert.equal(wrongMethod.text,'Method not allowed. Must be one of: PUT');assert.equal(wrongMethod.headers.get('allow'),'PUT');
          await nativeRequest('PUT','/test/0/log',httpPerson.person.token,[],400);await nativeRequest('PUT','/test/9223372036854775807/log',httpPerson.person.token,[],403);
          const escaped=await rawLog('/test/%3Cscript%3E/log',httpPerson.person.token,'[]',400);assert.equal(escaped.text,'No valid test-Id: &lt;script&gt;');assert.equal(escaped.text.includes('<script>'),false);
          for(const entry of codecStrict.cases){const before=await readHttpLogs();const denied=await rawLog(logPath,httpPerson.person.token,entry.literal,entry.status);if(entry.status===500)assert.equal(denied.text,'Internal error.');assert.deepEqual(await readHttpLogs(),before);}
          const codecBefore=await readHttpLogs();await nativeRequest('PUT',logPath,httpPerson.person.token,codecEscaped.input,201);
          const codecAdded=(await readHttpLogs()).filter(row=>!codecBefore.some(old=>old.participantTestLogId===row.participantTestLogId)).sort((a,b)=>a.timestamp-b.timestamp);assert.deepEqual(codecAdded.map(formatOriginalTestLogEntry),codecEscaped.entries.map(row=>row.logentry));
          for(const[index,entry]of codecNumbers.numbers.entries()){
            const key='raw-number-'+index,row=codecRows.find(x=>x.logentry===key||x.logentry.startsWith(key+' : '));assert.ok(row);const before=new Set((await readHttpLogs()).map(x=>x.participantTestLogId));
            await rawLog(logPath,httpPerson.person.token,'[{"key":'+JSON.stringify(key)+',"content":'+entry.literal+',"timeStamp":'+row.timestamp+'}]',201);
            const added=(await readHttpLogs()).filter(x=>!before.has(x.participantTestLogId));assert.equal(added.length,1);assert.equal(formatOriginalTestLogEntry(added[0]),entry.entry);
          }
          for(const scenario of boundaryCases){
            const prior=new Set((await readHttpLogs()).map(x=>x.participantTestLogId));
            await rawLog(logPath,httpPerson.person.token,scenario.literal,scenario.status);
            const added=(await readHttpLogs()).filter(x=>!prior.has(x.participantTestLogId));assert.equal(added.length,scenario.addedRows,scenario.label);
            if(scenario.entries.length)assert.deepEqual(added.map(x=>({logentry:formatOriginalTestLogEntry(x)})),scenario.entries,scenario.label);
            if(scenario.status===201&&scenario.label.startsWith('exact client timestamp '))assert.equal(added[0].originalClientTimestamp??String(added[0].timestamp),scenario.label.slice('exact client timestamp '.length));
          }
          const floatPacket='['+floatCases.map((entry,index)=>{const key='float-corpus-'+index,row=floatReportRows.find(x=>x.logentry===key||x.logentry.startsWith(key+' : '));assert.ok(row);return'{"key":'+JSON.stringify(key)+',"content":'+entry.literal+',"timeStamp":'+row.timestamp+'}';}).join(',')+']';
          const priorFloat=new Set((await readHttpLogs()).map(x=>x.participantTestLogId));await rawLog(logPath,httpPerson.person.token,floatPacket,201);
          const actualFloat=(await readHttpLogs()).filter(x=>!priorFloat.has(x.participantTestLogId)).sort((a,b)=>a.timestamp-b.timestamp);assert.deepEqual(actualFloat.map(formatOriginalTestLogEntry),floatCases.map(x=>x.entry));



          assert.deepEqual(await repository.getTestRunById(logRun.testRunId),beforeLog);assert.deepEqual(await services.originalUnit.read({token:httpPerson.person.token,testNumber:expected,unitName:'OWNED.NATIVE.UNIT',alias:'OWNED.HTTP.ALIAS'}),beforeUnit);
          const connection=kind==='sqlite'?new DatabaseSync(environment.FIRST_SLICE_SQLITE_FILE):new Pool({connectionString:url.toString()});
          const select=async()=>kind==='sqlite'?connection.prepare('SELECT unit_responses_json FROM test_runs WHERE test_run_id=?').get(logRun.testRunId).unit_responses_json:(await connection.query('SELECT unit_responses_json FROM test_runs WHERE test_run_id=$1',[logRun.testRunId])).rows[0].unit_responses_json;
          const update=async value=>kind==='sqlite'?connection.prepare('UPDATE test_runs SET unit_responses_json=? WHERE test_run_id=?').run(value,logRun.testRunId):connection.query('UPDATE test_runs SET unit_responses_json=$1 WHERE test_run_id=$2',[value,logRun.testRunId]);
          const original=await select(),marker='{"owned_native_http_log_must_not_decode_private_responses":';
          try{await update(marker);await nativeRequest('PUT',logPath,httpPerson.person.token,[{key:'httpMetadataOnly',content:true,timeStamp:4}],201);assert.equal(await select(),marker);}
          finally{await update(original);if(kind==='sqlite')connection.close();else await connection.end();}
          assert.deepEqual(await repository.getTestRunById(logRun.testRunId),beforeLog);
        }finally{process.stdout.write=logWrite;}
        assert.ok(logOutput.some(line=>line.includes('"path":"/test/:testId/log"')),'Native Testlog logging must use its redacted route label');
        assert.equal(logOutput.some(line=>[httpPerson.person.token,httpPerson.login.token,httpPerson.person.groupToken,adminToken].some(token=>line.includes(token))),false,'Native Testlog logs leaked a bearer');
        const groupToken=httpPerson.person.groupToken,file='/file/'+groupToken+'/ws_'+nativeValue.workspaceId+'/Resource/player.html';
        const output=[],write=process.stdout.write;process.stdout.write=function(chunk,encoding,callback){output.push(String(chunk));if(typeof encoding==='function')encoding();else if(typeof callback==='function')callback();return true;};
        try{
          const resource=await nativeRequest('GET',file);assert.equal(resource.headers.get('cache-control'),'private');assert.equal(resource.headers.get('x-source'),'backend');assert.equal(resource.headers.get('content-type'),'text/html;charset=UTF-8');assert.equal(Number(resource.headers.get('content-length')),resource.bytes.length);assert.equal(resource.headers.get('access-control-allow-origin'),'*');assert.equal(resource.headers.get('access-control-allow-credentials'),null);assert.equal(resource.headers.get('x-frame-options'),null);assert.equal(resource.headers.get('x-content-type-options'),'nosniff');assert.equal(resource.headers.get('referrer-policy'),'no-referrer');
          const source=await services.originalTest.resource({groupToken,workspaceNumber:String(nativeValue.workspaceId),path:'Resource/player.html'});assert.deepEqual(resource.bytes,Buffer.from(source.bytes));
          const binary=await nativeRequest('GET',file.replace('player.html','owned.bin'));assert.deepEqual(binary.bytes,Buffer.from([0,255,254,128,47,0,195,40]));assert.equal(binary.headers.get('content-type'),'application/octet-stream');assert.equal(binary.headers.get('content-length'),'8');
          const encoded=await nativeRequest('GET',file.replace('/file/','/%66ile/'));assert.deepEqual(encoded.bytes,resource.bytes);
          const deniedResource=await nativeRequest('GET',file.replace(groupToken,httpPerson.person.token),undefined,undefined,403);assert.equal(deniedResource.headers.get('access-control-allow-origin'),null);assert.equal(deniedResource.headers.get('x-frame-options'),'SAMEORIGIN');
          const deniedTraversal=await nativeRequest('GET',file.replace('Resource/player.html','Resource/%2e%2e%2fTesttakers/participant-roster.xml'),undefined,undefined,404);assert.equal(deniedTraversal.headers.get('access-control-allow-origin'),null);assert.equal(deniedTraversal.headers.get('x-frame-options'),'SAMEORIGIN');
          await fetch(base+file.replace('/file/','/%2566ile/'),{signal:AbortSignal.timeout(15000)}).then(r=>r.arrayBuffer());
          for(const prefix of ['/%25252525252566ile/','/%25%36%36ile/','/%66ile/'])await fetch(base+file.replace('/file/',prefix).replace('player.html','%ZZ'),{signal:AbortSignal.timeout(15000)}).then(r=>r.arrayBuffer());
        }finally{process.stdout.write=write;}
        assert.ok(output.some(line=>line.includes('"path":"/file/:groupToken/ws_:workspace/:resourcePath"')),'Actual native resource logging was not captured');
        assert.equal(output.some(line=>line.includes(groupToken)||line.includes(httpPerson.person.token)),false,'Native resource logs leaked a capability');
        const wrong=await call('POST',httpPerson.person.token,'{}',405);assert.equal(wrong.headers.get('allow'),'PUT');
        await call('GET',httpPerson.person.token,undefined,405);await call('DELETE',adminToken,undefined,405);
        await call('PUT',httpPerson.person.token,JSON.stringify({bookletName:'OWNED.MISSING'}),404);
        assert.equal((await owned(httpPerson.person)).length,before.length);assert.equal(initialized.adminUser.username,'owned-native-admin');
        const lockOutput=[],lockWrite=process.stdout.write;process.stdout.write=function(chunk,encoding,callback){lockOutput.push(String(chunk));if(typeof encoding==='function')encoding();else if(typeof callback==='function')callback();return true;};
        try{
          const createHttpLock=async label=>{
            const bookletName='OWNED.ASSIGNED#http-lock:'+label,created=await nativeRequest('PUT','/test',httpPerson.person.token,{bookletName},201),testNumber=created.text;
            const scope=await repository.findOriginalTestNumber({...ids,participantSessionId:httpPerson.person.participantSession.participantSessionId,testNumber});assert.ok(scope);return{bookletName,testNumber,scope,path:'/test/'+testNumber+'/lock'};
          };
          const authLock=await createHttpLock('authorization'),beforeAuth=await repository.getTestRunById(authLock.scope.testRunId);
          const missing=await rawLog(authLock.path,undefined,'{',401,'PATCH');assert.equal(missing.text,'Auth Header not sufficient: missing');
          for(const token of[httpPerson.login.token,httpPerson.person.groupToken,adminToken,other.person.token]){const denied=await rawLog(authLock.path,token,'{',403,'PATCH');assert.equal(denied.text.includes(token),false);}
          assert.deepEqual(await repository.getTestRunById(authLock.scope.testRunId),beforeAuth);
          for(const scenario of lockCases){
            const value=await createHttpLock(scenario.label),before=await repository.getTestRunById(value.scope.testRunId);
            const response=await rawLog(value.path,httpPerson.person.token,scenario.body,scenario.status,'PATCH');assert.equal(response.headers.get('content-type'),scenario.contentType);
            if(scenario.status===200)assert.equal(response.bytes.length,0);else{assert.equal(response.headers.get('test-mode'),'NO');assert.match(response.headers.get('error-id'),/^error-/);if(scenario.status===500)assert.equal(response.text,'Internal error.');}
            const after=await repository.getTestRunById(value.scope.testRunId);assert.equal(after.locked,scenario.locked);
            if(scenario.locked)assert.deepEqual(after,{...before,locked:true,updatedAt:after.updatedAt,originalResultState:{...before.originalResultState,lastTestModifiedAt:after.updatedAt}});else assert.deepEqual(after,before);
            const actual=(await repository.listParticipantTestLogsByWorkspace(ids.tenantId,ids.workspaceId)).filter(x=>x.testRunId===value.scope.testRunId);assert.equal(actual.length,scenario.appendCount);assert.deepEqual(actual.map(formatOriginalTestLogEntry),scenario.entries.map(x=>x.logentry));
            if(scenario.label==='int64-max')assert.equal(actual[0].originalClientTimestamp,'9223372036854775807');if(scenario.label==='int64-min')assert.equal(actual[0].originalClientTimestamp,'-9223372036854775808');
            await nativeRequest('PUT','/test',httpPerson.person.token,{bookletName:value.bookletName},scenario.locked?423:201);
          }
          const padded=await createHttpLock('padded'),ok=await rawLog('/test/000'+padded.testNumber+'/lock',httpPerson.person.token,'{"timeStamp":0}',200,'PATCH');assert.equal(ok.bytes.length,0);
          const wrong=await rawLog(padded.path,httpPerson.person.token,undefined,405,'PUT');assert.equal(wrong.headers.get('allow'),'PATCH');assert.equal(wrong.text,'Method not allowed. Must be one of: PATCH');
          const escaped=await rawLog('/test/%3Cscript%3E/lock',httpPerson.person.token,'{}',400,'PATCH');assert.equal(escaped.text,'No valid test-Id: &lt;script&gt;');
          await rawLog('/test/0/lock',httpPerson.person.token,'{',400,'PATCH');await rawLog('/test/9223372036854775807/lock',httpPerson.person.token,'{',403,'PATCH');
          const invalidUtf8=await createHttpLock('invalid-utf8'),beforeUtf8=await repository.getTestRunById(invalidUtf8.scope.testRunId);
          await rawLog(invalidUtf8.path,other.person.token,Buffer.from([0xff]),403,'PATCH');await rawLog(invalidUtf8.path,httpPerson.person.token,Buffer.from([0xff]),500,'PATCH');assert.deepEqual(await repository.getTestRunById(invalidUtf8.scope.testRunId),beforeUtf8);
        }finally{process.stdout.write=lockWrite;}
        assert.ok(lockOutput.some(line=>line.includes('"path":"/test/:testId/lock"')),'Native lock logging must use its redacted route label');
        assert.equal(lockOutput.some(line=>[httpPerson.person.token,httpPerson.login.token,httpPerson.person.groupToken,adminToken,other.person.token].some(token=>line.includes(token))),false,'Native lock logs leaked a bearer');

      }finally{if(server)await new Promise((done,reject)=>server.close(error=>error&&error.code!=='ERR_SERVER_NOT_RUNNING'?reject(error):done()));}
    });
    if(kind==='file')await t.test('late File publication failure rolls back the new Test, number, first content binding and cache',async()=>{
      const session=await auth('owned-legacy'),before=await repository.getParticipantSessionById(session.person.participantSession.participantSessionId),backup=file+'.owned-backup';
      await rename(file,backup);await mkdir(file);
      try{await assert.rejects(request(session,native.bookletName));assert.deepEqual(await owned(session.person),[]);assert.deepEqual(await repository.getParticipantSessionById(before.participantSessionId),before);}
      finally{await rm(file,{recursive:true});await rename(backup,file);}
      await reopen();assert.deepEqual(await owned(session.person),[]);assert.match(await request(session,native.bookletName),/^[1-9][0-9]*$/);
    });
    if(kind==='sqlite'||kind==='postgres')await t.test('late number insertion failure rolls back the entire Test reservation, counter and parent content binding',async()=>{
      control=kind==='sqlite'?new DatabaseSync(file):new Pool({connectionString:url.toString()});const exec=sql=>kind==='sqlite'?control.exec(sql):control.query(sql);
      const session=await auth('owned-legacy'),before=await repository.getParticipantSessionById(session.person.participantSession.participantSessionId);
      await exec(kind==='sqlite'?"CREATE TRIGGER owned_number_failure BEFORE INSERT ON original_test_numbers BEGIN SELECT RAISE(ABORT,'owned native number failure'); END":"CREATE FUNCTION owned_number_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'owned native number failure'; END $$; CREATE TRIGGER owned_number_failure BEFORE INSERT ON original_test_numbers FOR EACH ROW EXECUTE FUNCTION owned_number_failure()");
      try{await assert.rejects(request(session,native.bookletName),/owned native number failure/);assert.deepEqual(await owned(session.person),[]);assert.deepEqual(await repository.getParticipantSessionById(before.participantSessionId),before);}
      finally{await exec(kind==='sqlite'?'DROP TRIGGER owned_number_failure':'DROP TRIGGER owned_number_failure ON original_test_numbers; DROP FUNCTION owned_number_failure()');}
      assert.match(await request(session,native.bookletName),/^[1-9][0-9]*$/);
    });
    await t.test('native group deletion retires number mappings while keeping the global number monotonic',async()=>{
      const before=await repository.getParticipantSessionById(run.participantSessionId),saved=await repository.getTestRunById(run.testRunId);
      await repository.deleteOriginalGroupResults({...ids,groups:['Owned.Create']});
      await assert.rejects(services.originalTest.resource({groupToken:main.person.groupToken,workspaceNumber:nativeWorkspaceNumber,path:'Resource/player.html'}),denied(403));
      assert.equal(await repository.getTestRunById(run.testRunId),null);assert.equal(await repository.getParticipantSessionById(run.participantSessionId),null);
      await services.originalAuthentication.login({name:'owned-create',password});
      await repository.saveParticipantSession(before);await repository.saveTestRun(saved);
      const fresh=await repository.getOrCreateOriginalTestNumber(saved);assert.ok(BigInt(fresh)>BigInt(number));
    });
    await t.test('workspace deletion retires only its native-number mappings and never reuses them after private parent restoration',async()=>{
      const sources=await repository.listSourcePackagesByWorkspace(ids.tenantId,ids.workspaceId);
      const jobs=await repository.listImportJobsByWorkspace(ids.tenantId,ids.workspaceId);
      const releases=await repository.listContentReleasesByWorkspace(ids.tenantId,ids.workspaceId);
      const parent=await repository.getParticipantSessionById(run.participantSessionId),saved=await repository.getTestRunById(run.testRunId);
      const former=await repository.getOrCreateOriginalTestNumber(saved);const formerWorkspace=await repository.getOrCreateOriginalWorkspaceNumber(ids);
      const foreignWorkspace=await services.platform.createWorkspace({tenantKey:tenant.tenantKey,workspaceKey:'foreign-number',displayName:'Owned foreign number'});
      const foreignScope={tenantKey:tenant.tenantKey,workspaceKey:foreignWorkspace.workspaceKey};
      const files=['Resource/player.html','Unit/unit.xml','Booklet/assigned.xml'].map(name=>sources.find(source=>source.fileName===name));assert.ok(files.every(Boolean));
      for(const source of files)await services.contentIntake.uploadWorkspaceFile({...foreignScope,fileName:source.fileName.split('/').at(-1),sourceDocument:source.sourceDocument,mediaType:source.mediaType});
      await services.workspaceAdminRead.importParticipantRoster({...foreignScope,rosterText:xml('Testtakers',`<Metadata/><Group id="Owned.Foreign" label="Foreign"><Login name="owned-foreign-cascade" pw="${password}" mode="run-hot-return"><Booklet codes="Owned">OWNED.ASSIGNED</Booklet></Login></Group>`)});
      const foreign=await auth('owned-foreign-cascade'),foreignNumber=await request(foreign,'OWNED.ASSIGNED'),foreignRuns=await owned(foreign.person);
      const unitName='OWNED.WORKSPACE.UNIT',owner=await auth('owned-create');assert.equal(owner.person.participantSession.participantSessionId,parent.participantSessionId);
      await services.originalUnit.patchState({token:owner.person.token,testNumber:former,unitName,body:{originalUnitId:'WORKSPACE.FIRST',newState:[{key:'owned',content:'must retire',timeStamp:1}]}});
      await services.originalUnit.patchState({token:foreign.person.token,testNumber:foreignNumber,unitName,body:{originalUnitId:'FOREIGN.PRESERVED',newState:[{key:'foreign',content:'must survive',timeStamp:1}]}});
      const ownedUnit=await repository.getOriginalUnit({...saved,unitName}),foreignUnit=await repository.getOriginalUnit({...foreignRuns[0],unitName});assert.ok(ownedUnit);assert.ok(foreignUnit);
      const deletion={...scope,...ids,auditEvent:{adminAuditEventId:randomUUID(),eventType:'workspace_deleted',actorAdminUserId:null,subjectAdminUserId:null,occurredAt:stamp,summary:'Owned native number deletion',details:{}}};
      if(kind==='file'){
        const backup=file+'.workspace-backup';await rename(file,backup);await mkdir(file);
        try{
          await assert.rejects(repository.deleteWorkspaceAggregate(deletion));
          assert.deepEqual(await repository.getWorkspaceByScope(scope.tenantKey,scope.workspaceKey),workspace);
          assert.deepEqual(await repository.getTestRunById(saved.testRunId),saved);assert.deepEqual(await repository.getParticipantSessionById(parent.participantSessionId),parent);
          assert.equal(await repository.getOrCreateOriginalTestNumber(saved),former);assert.equal(await repository.getOrCreateOriginalTestNumber(foreignRuns[0]),foreignNumber);
          assert.deepEqual(await repository.getOriginalUnit({...saved,unitName}),ownedUnit);assert.deepEqual(await repository.getOriginalUnit({...foreignRuns[0],unitName}),foreignUnit);
        }finally{await rm(file,{recursive:true});await rename(backup,file);}
        await reopen();assert.deepEqual(await repository.getTestRunById(saved.testRunId),saved);
        assert.equal(await repository.getOrCreateOriginalTestNumber(saved),former);assert.equal(await request(foreign,'OWNED.ASSIGNED'),foreignNumber);
      }
      const result=await repository.deleteWorkspaceAggregate(deletion);
      assert.equal(result.deletedWorkspaceCount,1);assert.equal(await repository.getWorkspaceByScope(scope.tenantKey,scope.workspaceKey),null);
      assert.equal(await repository.matchesOriginalWorkspaceNumber({...ids,workspaceNumber:formerWorkspace}),false);
      assert.equal(await repository.getTestRunById(saved.testRunId),null);await assert.rejects(repository.getOrCreateOriginalTestNumber(saved));
      assert.deepEqual(await owned(foreign.person),foreignRuns);assert.equal(await request(foreign,'OWNED.ASSIGNED'),foreignNumber);
      assert.deepEqual(await repository.getOriginalUnit({...foreignRuns[0],unitName}),foreignUnit);
      await close();await open();assert.equal(await request(foreign,'OWNED.ASSIGNED'),foreignNumber);
      // Reuse private fixture UUIDs only to expose otherwise invisible orphan
      // mappings. A recreated parent must receive a fresh globally monotonic ID.
      await repository.saveWorkspace({...scope,workspace});assert.ok(BigInt(await repository.getOrCreateOriginalWorkspaceNumber(ids))>BigInt(formerWorkspace));
      for(const source of sources)await repository.saveSourcePackage(source);
      for(const job of jobs)await repository.saveImportJob(job);
      for(const release of releases)await repository.saveContentRelease(release);
      await services.workspaceAdminRead.importParticipantRoster({...scope,rosterText:xml('Testtakers',`<Metadata/><Group id="Owned.Create" label="Owned create"><Login name="owned-create" pw="${password}" mode="run-hot-return"><Booklet codes="Owned">OWNED.ASSIGNED</Booklet></Login></Group>`)});
      await services.originalAuthentication.login({name:'owned-create',password});await repository.saveParticipantSession(parent);await repository.saveTestRun(saved);
      assert.equal(await repository.getOriginalUnit({...saved,unitName}),null);assert.deepEqual(await repository.getOriginalUnit({...foreignRuns[0],unitName}),foreignUnit);
      const fresh=await repository.getOrCreateOriginalTestNumber(saved);assert.ok(BigInt(fresh)>BigInt(former));assert.ok(BigInt(fresh)>BigInt(foreignNumber));
      assert.equal(await request(foreign,'OWNED.ASSIGNED'),foreignNumber);
    });
  }finally{await close();if(kind==='sqlite')control?.close();else await control?.end();if(admin){if(created)await admin.query(`DROP SCHEMA "${schema}" CASCADE`);await admin.end();}await rm(directory,{recursive:true,force:true});}
});
