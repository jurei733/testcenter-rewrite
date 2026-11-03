import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {join} from 'node:path';
const out=process.env.ORIGINAL_TEST_ADMIN_OUTPUT_DIR,original=process.env.ORIGINAL_TEST_ADMIN_SOURCE_ROOT,container=process.env.ORIGINAL_TEST_ADMIN_CONTAINER;
assert.ok(out&&original&&container,'Set the owned output directory, pinned Source root and dedicated backend container');await mkdir(out,{recursive:true});
const port=execFileSync('docker',['port',container,'8080'],{encoding:'utf8'}).trim();assert.match(port,/^127\.0\.0\.1:\d+$/);const base='http://'+port;
const hash=b=>createHash('sha256').update(b).digest('hex'),git=(...a)=>execFileSync('git',['-C',original,...a],{encoding:'utf8'}).trim();
assert.equal(git('rev-parse','HEAD'),'eedae41840cbe90e5547c0211da818bdf620f5aa');assert.equal(git('status','--porcelain','--untracked-files=no'),'');
const paths=git('ls-files','backend/src','backend/index.php','backend/routes.php','backend/initialize.php','definitions/testtaker','scripts/database/full.sql').split('\n');
const sourceHashes=Object.fromEntries(await Promise.all(paths.map(async p=>[p,hash(await readFile(join(original,p)))])));
const verifyImage=()=>{
 const php='$paths=json_decode(stream_get_contents(STDIN),true,512,JSON_THROW_ON_ERROR);$out=[];foreach($paths as $p){$f="/var/www/testcenter/".$p;if(!is_file($f))throw new RuntimeException("Missing pinned source: ".$p);$out[$p]=hash_file("sha256",$f);}echo json_encode($out,JSON_THROW_ON_ERROR);';
 const actual=JSON.parse(execFileSync('docker',['exec','-i',container,'php','-r',php],{encoding:'utf8',input:JSON.stringify(paths)}));assert.deepEqual(actual,sourceHashes);return actual;
};
verifyImage();
const composerLock=JSON.parse(await readFile(join(original,'backend/composer.lock'),'utf8'));
const installedBytes=execFileSync('docker',['exec',container,'php','-r','echo file_get_contents("/var/www/testcenter/backend/vendor/composer/installed.json");']);
const installed=JSON.parse(installedBytes),known=new Map([...composerLock.packages,...composerLock['packages-dev']].map(p=>[p.name,p]));
for(const p of installed.packages){assert.ok(known.has(p.name),p.name);assert.equal(p.version,known.get(p.name).version,p.name);assert.equal(p.source?.reference,known.get(p.name).source?.reference,p.name);}
for(const p of composerLock.packages)assert.ok(installed.packages.some(i=>i.name===p.name),'Missing locked production package '+p.name);
const vendor={sourceComposerLockSha256:hash(await readFile(join(original,'backend/composer.lock'))),installedMetadataSha256:hash(installedBytes),installedPackages:installed.packages.length,requiredProductionPackages:composerLock.packages.length,allInstalledVersionsAndSourceReferencesMatchPinnedLock:true};

const password='Owned source protected password',adminPassword='owned-source-super-secret',aliases=new Map([[password,'[owned-password]'],[adminPassword,'[owned-admin-password]']]),rows=[];
const register=v=>{if(v&&typeof v==='object')for(const[k,x]of Object.entries(v)){if(/^(token|groupToken|salt|signature)$/i.test(k)&&typeof x==='string'&&!aliases.has(x))aliases.set(x,'[owned-'+k+'-'+aliases.size+']');else register(x);}};
const redact=v=>{if(typeof v==='string'){for(const[s,a]of [...aliases].sort((a,b)=>b[0].length-a[0].length))v=v.replaceAll(s,a);return v;}if(Array.isArray(v))return v.map(redact);if(v&&typeof v==='object')return Object.fromEntries(Object.entries(v).map(([k,x])=>[k,redact(x)]));return v;};
const request=async(label,method,path,{body,token}={})=>{
 const r=await fetch(base+path,{method,headers:{Accept:'application/json',...(token===undefined?{}:{AuthToken:token}),...(body!==undefined&&!(body instanceof FormData)?{'Content-Type':'application/json'}:{})},...(body===undefined?{}:{body:body instanceof FormData?body:JSON.stringify(body)}),signal:AbortSignal.timeout(20000)});
 const bytes=Buffer.from(await r.arrayBuffer());let value;try{value=JSON.parse(bytes.toString());}catch{value=bytes.toString();}register(value);
 const result={label,method,path,status:r.status,value,bodySha256:hash(bytes),contentType:r.headers.get('content-type'),errorId:r.headers.get('error-id'),testMode:r.headers.get('test-mode'),rawText:bytes.toString(),requestBody:body instanceof FormData?'[actual multipart upload]':body};rows.push(result);return result;
};
const solve=c=>{assert.equal(c.algorithm,'SHA-256');assert.ok(c.maxNumber<=1000000);for(let number=0;number<=c.maxNumber;number++)if(hash(c.salt+number)===c.challenge)return{algorithm:c.algorithm,challenge:c.challenge,salt:c.salt,signature:c.signature,number};assert.fail('Actual Source ALTCHA has no bounded solution');};
let workspace;
try{
 const config=await request('configuration','GET','/system/config');assert.equal(config.status,200);assert.deepEqual(config.value.bruteForceProtection,['login','person']);
 const admin=await request('admin','PUT','/session/admin',{body:{name:'super',password:adminPassword}});assert.equal(admin.status,200);const adminToken=admin.value.token;
 const created=await request('workspace','PUT','/workspace',{token:adminToken,body:{name:'Owned native Test administration R53'}});assert.equal(created.status,201);workspace=Number(created.value);
 const grant=async role=>{const r=await request('workspace-grant-'+role,'PATCH','/user/'+admin.value.id+'/workspaces',{token:adminToken,body:{ws:[{id:workspace,role}]}});assert.equal(r.status,200);};
 await grant('RW');
 const xml=(type,repo,text)=>'<'+type+' xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="https://w3id.org/iqb/spec/'+repo+'/18.0">'+text+'</'+type+'>';
 const upload=async(label,name,document)=>{const form=new FormData();form.append('fileforvo[]',new Blob([document],{type:'application/xml'}),name);const r=await request(label,'POST','/workspace/'+workspace+'/file',{token:adminToken,body:form});assert.ok([201,207].includes(r.status),JSON.stringify(redact(r)));assert.deepEqual(Object.values(r.value??{}).flatMap(entry=>entry?.error??[]),[],JSON.stringify(redact(r)));};
 const path='/workspace/'+workspace+'/responses/detailed',list=async label=>{const r=await request(label,'GET',path,{token:adminToken});assert.equal(r.status,200);return r.value;},flatten=v=>Object.values(v).flat();
 assert.deepEqual(await list('empty-tests'),[]);
 const metadata={id:'owned-tests-r53-player',version:'1.0.0',specVersion:'6.0',metadataVersion:'2.0',type:'player',name:[{lang:'de',value:'Owned Test administration Player'}],description:[{lang:'de',value:'Owned fixture'}]};
 await upload('player-upload','owned-tests-r53-player.html','<html><script type="application/ld+json">'+JSON.stringify(metadata)+'</script><main>Owned Player</main></html>');
 await upload('unit-upload','owned-tests-r53-unit.xml','<Unit xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="https://w3id.org/iqb/spec/unit-xml/17.6"><Metadata><Id>OWNED.ADM.UNIT</Id><Label>Owned administration Unit</Label></Metadata><Definition player="owned-tests-r53-player@1.0.0">Owned definition</Definition></Unit>');
 const booklet=(name,label)=>xml('Booklet','testcenter-booklet-xml','<Metadata><Id>'+name+'</Id><Label>'+label+'</Label></Metadata><Units><Unit id="OWNED.ADM.UNIT" label="Owned administration Unit"/></Units>');
 await upload('booklet-a-upload','owned-tests-r53-a.xml',booklet('OWNED.ADM.A','First captured Booklet A Ω'));
 await upload('booklet-b-upload','owned-tests-r53-b.xml',booklet('OWNED.ADM.B','Retained Booklet B Ä'));
 const loginXml=(name,mode='run-hot-return',coded=false)=>'<Login name="'+name+'" mode="'+mode+'"><Booklet'+(coded?' codes="AbC"':'')+'>OWNED.ADM.A</Booklet><Booklet'+(coded?' codes="AbC"':'')+'>OWNED.ADM.B</Booklet></Login>';
 const peers=Array.from({length:10},(_,i)=>'owned-adm-r53-peer-'+i);
 const roster=xml('Testtakers','testcenter-testtaker-xml','<Metadata/><Group id="OWNED.ADM.ZULU" label="Frozen administration group Ω">'+loginXml('owned-adm-r53-code','run-hot-return',true)+loginXml('owned-adm-r53-restart','run-hot-restart',true)+peers.map(n=>loginXml(n)).join('')+'</Group><Group id="OWNED.ADM.ALPHA" label="Earlier alphabetical group">'+loginXml('owned-adm-r53-alpha')+'</Group>');
 await upload('roster-upload','owned-tests-r53-people.xml',roster);
 const person=async(name,code)=>{const login=await request(name+'-login','PUT','/session/login',{body:{name,password:''}});assert.equal(login.status,200);
  if(code===undefined)return login.value.token;
  const challenge=await request(name+'-person-work','POST','/session/person/challenge',{token:login.value.token,body:{code}});assert.equal(challenge.status,200);
  const created=await request(name+'-person','PUT','/session',{token:login.value.token,body:solve(challenge.value)});assert.equal(created.status,200);return created.value.token;};
 let clock=1793530200000;
 const create=async(label,token,name)=>{const r=await request(label,'PUT','/test',{token,body:{bookletName:name}});assert.equal(r.status,201);assert.ok(Number.isSafeInteger(r.value)&&r.value>0);return r.value;};
 const state=async(label,token,id,content)=>{const r=await request(label,'PATCH','/test/'+id+'/state',{token,body:[{key:'OWNED.STORED',content,timeStamp:++clock}]});assert.equal(r.status,200);};
 let owner=await person('owned-adm-r53-code','aBc');const a=await create('owner-create-a',owner,'OWNED.ADM.A'),b=await create('owner-create-b',owner,'OWNED.ADM.B');
 assert.deepEqual(await list('created-unopened-tests'),[]);
 await state('stateful-unopened-a',owner,a,'Owned Test state');
 const first=await list('stateful-unopened-list'),firstRow=flatten(first)[0];assert.equal(flatten(first).length,1);assert.deepEqual(firstRow,{loginName:'owned-adm-r53-code',groupName:'OWNED.ADM.ZULU',groupLabel:'Frozen administration group Ω',code:'aBc',nameSuffix:'aBc',bookletName:'OWNED.ADM.A',bookletLabel:'First captured Booklet A Ω'});
 const unopenedStats=await request('stateful-unopened-results','GET','/workspace/'+workspace+'/results',{token:adminToken});assert.equal(unopenedStats.status,200);assert.deepEqual(unopenedStats.value,[]);
 const opened=await request('open-b','GET','/test/'+b,{token:owner});assert.equal(opened.status,200);
 assert.deepEqual(await list('opened-empty-b-still-excluded'),first);
 const unit='/test/'+b+'/unit/OWNED.ADM.UNIT';
 assert.equal((await request('b-unit-state','PATCH',unit+'/state',{token:owner,body:{originalUnitId:'OWNED.ORIGINAL.B',newState:[{key:'PRESENTATION_PROGRESS',content:'some',timeStamp:++clock}]}})).status,200);
 assert.equal((await request('b-response','PUT',unit+'/response',{token:owner,body:{timeStamp:++clock,dataParts:{owned:'{"retained":"Owned B answer Ω"}'},responseType:'owned'}})).status,201);
 assert.deepEqual(await list('unit-only-b-still-excluded'),first);
 const retainedBaseline=await request('b-only-answer-baseline','GET','/workspace/'+workspace+'/report/response',{token:adminToken});assert.equal(retainedBaseline.status,200);assert.equal(retainedBaseline.value.length,1);
 const selectedUnit='/test/'+a+'/unit/OWNED.ADM.UNIT';
 assert.equal((await request('a-unit-state','PATCH',selectedUnit+'/state',{token:owner,body:{originalUnitId:'OWNED.ORIGINAL.A',newState:[{key:'PRESENTATION_PROGRESS',content:'some',timeStamp:++clock}]}})).status,200);
 assert.equal((await request('a-response','PUT',selectedUnit+'/response',{token:owner,body:{timeStamp:++clock,dataParts:{owned:'{"selected":"Owned A answer Ω"}'},responseType:'owned'}})).status,201);

 await state('stateful-opened-b',owner,b,'Retained B state');
 const ownerRows=await list('two-owner-tests');assert.equal(flatten(ownerRows).length,2);
 await upload('booklet-a-replace','owned-tests-r53-a.xml',booklet('OWNED.ADM.A','Changed current Booklet A β'));
 const afterLabelChange=await list('captured-test-label-after-file-edit');assert.deepEqual(afterLabelChange,ownerRows);
 const ownerReentry=await person('owned-adm-r53-code','abc');assert.ok(ownerReentry!==owner,'Source rotates the native person token on case-equivalent reentry while retaining the first person/Test identity');owner=ownerReentry;
 assert.deepEqual(await list('first-stored-code-after-case-reentry'),ownerRows);
 const expectedZulu=[...flatten(ownerRows)];
 for(const name of peers){const token=await person(name),id=await create(name+'-test',token,'OWNED.ADM.A');await state(name+'-state',token,id,'Owned peer state');const row=flatten(await list(name+'-snapshot')).find(r=>r.loginName===name);assert.ok(row);expectedZulu.push(row);}
 const generated=[];
 for(let i=0;i<2;i++){const token=await person('owned-adm-r53-restart','AbC'),id=await create('generated-'+i+'-test',token,'OWNED.ADM.A');await state('generated-'+i+'-state',token,id,'Owned generated person state');const current=flatten(await list('generated-'+i+'-snapshot')).filter(r=>r.loginName==='owned-adm-r53-restart');assert.equal(current.length,i+1);const row=current.at(-1);assert.equal(row.code,'AbC');assert.match(row.nameSuffix,/^AbC\/[a-z0-9_-]{8}$/);generated.push(row);expectedZulu.push(row);}
 assert.notEqual(generated[0].nameSuffix,generated[1].nameSuffix);
 const alpha=await person('owned-adm-r53-alpha'),alphaId=await create('alpha-test-created-last',alpha,'OWNED.ADM.A');await state('alpha-test-state',alpha,alphaId,'Owned alpha state');
 const sorted=await list('exact-group-and-numeric-test-order');assert.deepEqual(Object.keys(sorted),['OWNED.ADM.ALPHA','OWNED.ADM.ZULU']);assert.deepEqual(sorted['OWNED.ADM.ZULU'],expectedZulu);
 const reportBefore=await request('retained-response-before-delete','GET','/workspace/'+workspace+'/report/response',{token:adminToken});assert.equal(reportBefore.status,200);assert.equal(reportBefore.value.length,2);assert.deepEqual(new Set(reportBefore.value.map(r=>r.bookletname)),new Set(['OWNED.ADM.A','OWNED.ADM.B']));
 for(const [label,token,expected] of [['anonymous',undefined,401],['participant',owner,403]]){const read=await request(label+'-list-denied','GET',path,{token});assert.equal(read.status,expected);const del=await request(label+'-delete-denied','DELETE',path,{token,body:{personSessions:[{loginName:firstRow.loginName,code:firstRow.code,nameSuffix:firstRow.nameSuffix,bookletName:firstRow.bookletName}]}});assert.equal(del.status,expected);}
 await grant('RO');assert.deepEqual(await list('read-only-list'),sorted);
 const denied=await request('read-only-delete-denied','DELETE',path,{token:adminToken,body:{personSessions:[firstRow]}});assert.equal(denied.status,403);await grant('RW');assert.deepEqual(await list('denied-deletes-preserve-all'),sorted);
 for(const [label,selection] of [['empty',[]],['missing-login',[{bookletName:'OWNED.ADM.A'}]],['missing-booklet',[{loginName:firstRow.loginName}]]]){const r=await request('invalid-'+label+'-selection','DELETE',path,{token:adminToken,body:{personSessions:selection}});assert.equal(r.status,400);}
 const missing=await request('unknown-selected-tuple','DELETE',path,{token:adminToken,body:{personSessions:[{loginName:firstRow.loginName,code:'wrong',nameSuffix:firstRow.nameSuffix,bookletName:firstRow.bookletName}]}});assert.equal(missing.status,200);assert.equal(missing.rawText,'');assert.deepEqual(await list('unknown-tuple-preserves-tests'),sorted);
 const selection={loginName:firstRow.loginName,code:firstRow.code,nameSuffix:firstRow.nameSuffix,bookletName:firstRow.bookletName};
 const deletion=await request('delete-only-owner-a','DELETE',path,{token:adminToken,body:{personSessions:[selection]}});assert.equal(deletion.status,200);assert.equal(deletion.rawText,'');
 const remaining=await list('selected-delete-retains-every-other-test');assert.deepEqual(remaining,{...sorted,'OWNED.ADM.ZULU':expectedZulu.slice(1)});
 const retained=await request('retained-response-after-delete','GET','/workspace/'+workspace+'/report/response',{token:adminToken});assert.equal(retained.rawText,retainedBaseline.rawText);
 const remainingLogs=await request('selected-test-logs-cascade','GET','/workspace/'+workspace+'/report/log',{token:adminToken});assert.equal(remainingLogs.status,200);assert.ok(!remainingLogs.value.some(r=>r.loginname===firstRow.loginName&&r.bookletname===firstRow.bookletName));
 const old=await request('deleted-test-bearer-boundary','GET','/test/'+a,{token:owner});assert.equal(old.status,403);
 const session=await request('same-person-session-after-delete','GET','/session',{token:owner});assert.equal(session.status,200);assert.ok(session.value.token===owner,'selected-Test deletion retains the current person bearer');
 const replacement=await create('recreate-owner-a-same-person',owner,'OWNED.ADM.A');assert.notEqual(replacement,a);assert.deepEqual(await list('new-empty-test-stays-excluded'),remaining);
 await state('replacement-state',owner,replacement,'Owned replacement state');
 const final=await list('replacement-has-new-captured-label-and-id-order');const replacementRow=final['OWNED.ADM.ZULU'].at(-1);assert.deepEqual(replacementRow,{...firstRow,bookletLabel:'Changed current Booklet A β'});assert.deepEqual(final['OWNED.ADM.ZULU'].slice(0,-1),expectedZulu.slice(1));
 verifyImage();assert.equal(git('status','--porcelain','--untracked-files=no'),'');
 const result={verified:true,sourceCommit:git('rev-parse','HEAD'),sourceHashes,sourceFilesVerifiedBeforeAndAfter:paths.length,vendor,backendImage:'sha256:d7045f22e834e2907ed39b5f8c99eed3d81f37643c50c3f66746e3f654381328',configuration:{bruteForceProtection:['login','person'],testMode:false,ownedDedicatedStack:true},workspace,rows:redact(rows),cases:{emptyIsArray:true,statefulUnopenedIncluded:true,openedEmptyExcluded:true,unitOnlyDoesNotCreateTestState:true,firstCodeAndSuffixPreserved:true,capturedBookletLabelPreserved:true,groupThenNumericTestOrder:true,generatedSuffixes:generated.map(r=>r.nameSuffix),exactScopedSelectedDeletion:true,samePersonBearerRetained:true,unrelatedAnswerByteExact:true,recreatedTestUsesNewIdAndLabel:true},sourceCodeAndVendorUnmodified:true,actualPostgresAndRedis:true,adminWorkspaceRosterAndBookletOverActualHttp:true,sqlSeedsOrDaoStubs:false,fullOriginalParityProven:false};
 await writeFile(join(out,'observations.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({verified:true,cases:rows.length,sourceFiles:paths.length,checks:result.cases}));
}catch(error){await writeFile(join(out,'failure.json'),JSON.stringify({error:String(error),workspace,rows:redact(rows)},null,2)+'\n');throw error;}
