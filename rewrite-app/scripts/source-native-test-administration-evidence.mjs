import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
const root=new URL('../test-fixtures/original-testcenter/source-workspace-results/native-test-administration-http/',import.meta.url);
const read=async n=>readFile(new URL(n,root)),hash=b=>createHash('sha256').update(b).digest('hex');
const manifest=JSON.parse(await read('manifest.json')),source=JSON.parse(await read('observations.json')),rows=source.rows;
const row=label=>{const selected=rows.filter(r=>r.label===label);assert.equal(selected.length,1,label);return selected[0];};
const flat=value=>Object.values(value).flat();
test('actual unchanged Source116 Test administration reference retains production transport and every captured input',async()=>{
 assert.equal(manifest.sourceCommit,'eedae41840cbe90e5547c0211da818bdf620f5aa');assert.equal(source.sourceCommit,manifest.sourceCommit);
 assert.equal(source.verified,true);assert.equal(source.sqlSeedsOrDaoStubs,false);assert.equal(source.sourceCodeAndVendorUnmodified,true);
 assert.equal(source.actualPostgresAndRedis,true);assert.equal(source.adminWorkspaceRosterAndBookletOverActualHttp,true);
 assert.equal(source.fullOriginalParityProven,false);assert.equal(manifest.httpObservations,116);assert.equal(rows.length,116);
 assert.equal(manifest.backendImage,'sha256:d7045f22e834e2907ed39b5f8c99eed3d81f37643c50c3f66746e3f654381328');
 assert.deepEqual(manifest.configuration,{XML_SCHEMA_VALIDATION:'true',ALLOW_TEST_MODE:'false',bruteForceProtection:['login','person']});
 assert.equal(source.configuration.testMode,false);assert.equal(Object.keys(source.sourceHashes).length,137);assert.equal(source.sourceFilesVerifiedBeforeAndAfter,137);
 assert.equal(source.vendor.installedPackages,19);assert.equal(source.vendor.requiredProductionPackages,19);assert.equal(source.vendor.allInstalledVersionsAndSourceReferencesMatchPinnedLock,true);
 for(const [name,sha]of Object.entries(manifest.files)){assert.match(name,/^[a-z0-9][a-z0-9.-]*$/);assert.equal(hash(await read(name)),sha,name);}
 for(const r of rows)assert.match(r.bodySha256,/^[a-f0-9]{64}$/);
});
test('Source Test deletion listing includes stateful unopened Tests and excludes opened empty or Unit-only Tests',()=>{
 for(const label of ['empty-tests','created-unopened-tests'])assert.deepEqual(row(label).value,[]);
 const one=row('stateful-unopened-list').value;assert.equal(flat(one).length,1);assert.deepEqual(row('stateful-unopened-results').value,[]);
 for(const label of ['opened-empty-b-still-excluded','unit-only-b-still-excluded'])assert.deepEqual(row(label).value,one);
 assert.equal(row('b-response').status,201);assert.equal(flat(row('two-owner-tests').value).length,2);
 assert.deepEqual(flat(one)[0],{loginName:'owned-adm-r53-code',groupName:'OWNED.ADM.ZULU',groupLabel:'Frozen administration group Ω',code:'aBc',nameSuffix:'aBc',bookletName:'OWNED.ADM.A',bookletLabel:'First captured Booklet A Ω'});
});
test('Source preserves captured Test label and first stored code while actual person reentry rotates its capability',()=>{
 assert.deepEqual(row('captured-test-label-after-file-edit').value,row('two-owner-tests').value);
 assert.deepEqual(row('first-stored-code-after-case-reentry').value,row('two-owner-tests').value);
 const people=rows.filter(r=>r.label==='owned-adm-r53-code-person');assert.equal(people.length,2);
 assert.notEqual(people[0].value.token,people[1].value.token);
 assert.equal(people[0].value.claims.test.find(r=>r.id==='OWNED.ADM.A').flags.running,false);
 assert.equal(people[1].value.claims.test.find(r=>r.id==='OWNED.ADM.B').flags.running,true);
 assert.equal(flat(row('first-stored-code-after-case-reentry').value)[0].code,'aBc');
});
test('Source orders actual native Test IDs numerically within alphabetically ordered snapshot groups',()=>{
 const result=row('exact-group-and-numeric-test-order').value;assert.deepEqual(Object.keys(result),['OWNED.ADM.ALPHA','OWNED.ADM.ZULU']);
 const created=rows.filter(r=>r.method==='PUT'&&r.path==='/test'&&r.label!=='recreate-owner-a-same-person').map(r=>({id:r.value,label:r.label}));
 assert.ok(created.some(r=>r.id>=10));assert.deepEqual(created.map(r=>r.id),[...created.map(r=>r.id)].sort((a,b)=>a-b));
 const zulu=result['OWNED.ADM.ZULU'];assert.equal(zulu.length,14);
 assert.deepEqual(zulu.map(r=>r.loginName),['owned-adm-r53-code','owned-adm-r53-code',...Array.from({length:10},(_,i)=>'owned-adm-r53-peer-'+i),'owned-adm-r53-restart','owned-adm-r53-restart']);
 const generated=zulu.filter(r=>r.loginName==='owned-adm-r53-restart');assert.notEqual(generated[0].nameSuffix,generated[1].nameSuffix);
 for(const r of generated){assert.equal(r.code,'AbC');assert.match(r.nameSuffix,/^AbC\/[a-z0-9_-]{8}$/);}
});
test('Source denies anonymous participant and RO deletion, and malformed or unknown tuple selection cannot change Tests',()=>{
 for(const [name,status]of [['anonymous',401],['participant',403]])for(const action of ['list-denied','delete-denied'])assert.equal(row(name+'-'+action).status,status);
 assert.equal(row('read-only-delete-denied').status,403);
 for(const name of ['empty','missing-login','missing-booklet'])assert.equal(row('invalid-'+name+'-selection').status,400);
 const before=row('exact-group-and-numeric-test-order').value;
 for(const name of ['read-only-list','denied-deletes-preserve-all','unknown-tuple-preserves-tests'])assert.deepEqual(row(name).value,before);
 assert.equal(row('unknown-selected-tuple').status,200);assert.equal(row('unknown-selected-tuple').rawText,'');
});
test('Source selected-Test cascade retains unrelated answer bytes person capability and every other Test',()=>{
 const before=row('exact-group-and-numeric-test-order').value,after=row('selected-delete-retains-every-other-test').value;
 const deletion=row('delete-only-owner-a');assert.equal(deletion.status,200);assert.equal(deletion.rawText,'');assert.equal(deletion.bodySha256,hash(''));
 assert.deepEqual(after,{'OWNED.ADM.ALPHA':before['OWNED.ADM.ALPHA'],'OWNED.ADM.ZULU':before['OWNED.ADM.ZULU'].slice(1)});
 assert.equal(row('retained-response-before-delete').value.length,2);assert.equal(row('retained-response-after-delete').value.length,1);
 assert.equal(row('retained-response-after-delete').rawText,row('b-only-answer-baseline').rawText);
 assert.equal(row('retained-response-after-delete').bodySha256,row('b-only-answer-baseline').bodySha256);
 assert.ok(!row('selected-test-logs-cascade').value.some(r=>r.loginname==='owned-adm-r53-code'&&r.bookletname==='OWNED.ADM.A'));
 assert.equal(row('deleted-test-bearer-boundary').status,403);assert.equal(row('same-person-session-after-delete').status,200);
 assert.notEqual(row('recreate-owner-a-same-person').value,row('owner-create-a').value);
 assert.deepEqual(row('new-empty-test-stays-excluded').value,after);
 const replacement=row('replacement-has-new-captured-label-and-id-order').value['OWNED.ADM.ZULU'];
 assert.deepEqual(replacement.slice(0,-1),after['OWNED.ADM.ZULU']);assert.equal(replacement.at(-1).bookletLabel,'Changed current Booklet A β');
});
test('public Source116 fixture redacts native capabilities and credentials before publication',()=>{
 const walk=v=>{if(!v||typeof v!=='object')return;for(const[k,x]of Object.entries(v)){if(/^(token|groupToken|salt|signature)$/i.test(k)&&x!==null){assert.equal(typeof x,'string');assert.match(x,/^\[owned-[a-zA-Z]+-\d+\]$/);}else walk(x);}};
 walk(rows);
 const text=JSON.stringify(source);for(const secret of ['owned-source-super-secret','Owned source protected password'])assert.ok(!text.includes(secret));
 for(const r of rows)assert.ok(!('headers'in r));
});

