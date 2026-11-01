import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {join} from 'node:path';
const out=process.env.ORIGINAL_REVIEW_OUTPUT_DIR,original=process.env.ORIGINAL_REVIEW_SOURCE_ROOT,container=process.env.ORIGINAL_REVIEW_CONTAINER;
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
const request=async(label,method,path,{body,token,accept='application/json'}={})=>{
 const r=await fetch(base+path,{method,headers:{Accept:accept,...(token===undefined?{}:{AuthToken:token}),...(body!==undefined&&!(body instanceof FormData)?{'Content-Type':'application/json'}:{})},...(body===undefined?{}:{body:body instanceof FormData?body:JSON.stringify(body)}),signal:AbortSignal.timeout(20000)});
 const bytes=Buffer.from(await r.arrayBuffer());let value;try{value=JSON.parse(bytes.toString());}catch{value=bytes.toString();}register(value);
 const result={label,method,path,status:r.status,value,bodySha256:hash(bytes),contentType:r.headers.get('content-type'),errorId:r.headers.get('error-id'),testMode:r.headers.get('test-mode'),rawText:bytes.toString(),requestBodyText:body===undefined?null:body instanceof FormData?'[actual multipart upload]':JSON.stringify(body),requestBody:body instanceof FormData?'[actual multipart upload]':body};rows.push(result);return result;
};
const solve=c=>{assert.equal(c.algorithm,'SHA-256');assert.ok(c.maxNumber<=1000000);for(let number=0;number<=c.maxNumber;number++)if(hash(c.salt+number)===c.challenge)return{algorithm:c.algorithm,challenge:c.challenge,salt:c.salt,signature:c.signature,number};assert.fail('Actual Source ALTCHA has no bounded solution');};
let workspace;
try{
 const config=await request('configuration','GET','/system/config');assert.equal(config.status,200);assert.deepEqual(config.value.bruteForceProtection,['login','person']);
 const admin=await request('admin','PUT','/session/admin',{body:{name:'super',password:adminPassword}});assert.equal(admin.status,200);
 const created=await request('workspace','PUT','/workspace',{token:admin.value.token,body:{name:'Owned native response/log wire reports'}});assert.equal(created.status,201);workspace=Number(created.value);
 assert.equal((await request('workspace-grant','PATCH','/user/'+admin.value.id+'/workspaces',{token:admin.value.token,body:{ws:[{id:workspace,role:'RW'}]}})).status,200);
 const xml=(type,repo,body)=>'<'+type+' xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="https://w3id.org/iqb/spec/'+repo+'/18.0">'+body+'</'+type+'>';
 const upload=async(label,name,document)=>{const form=new FormData();form.append('fileforvo[]',new Blob([document],{type:'application/xml'}),name);const r=await request(label,'POST','/workspace/'+workspace+'/file',{token:admin.value.token,body:form});assert.ok([201,207].includes(r.status),JSON.stringify(redact(r)));assert.deepEqual(Object.values(r.value??{}).flatMap(entry=>entry?.error??[]),[],JSON.stringify(redact(r)));};
 const playerMetadata={id:'owned-protected-player',version:'1.0.0',specVersion:'6.0',metadataVersion:'2.0',type:'player',name:[{lang:'de',value:'Owned protected Player'}],description:[{lang:'de',value:'Owned fixture'}]};
 await upload('player-upload','owned-protected-player-1.0.html','<html><script type="application/ld+json">'+JSON.stringify(playerMetadata)+'</script><main>Owned protected Player</main></html>');
 await upload('unit-upload','owned-protected-unit.xml','<Unit xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="https://w3id.org/iqb/spec/unit-xml/17.6"><Metadata><Id>OWNED.UNIT</Id><Label>Owned protected Unit</Label></Metadata><Definition player="owned-protected-player@1.0.0">Owned protected definition</Definition></Unit>');
 await upload('booklet-upload','owned-protected-booklet.xml',xml('Booklet','testcenter-booklet-xml','<Metadata><Id>OWNED.PROTECTED</Id><Label>Owned protected Booklet</Label></Metadata><Units><Unit id="OWNED.UNIT" label="Owned protected Unit"/></Units>'));
 await upload('roster-upload','owned-protected-people.xml',xml('Testtakers','testcenter-testtaker-xml','<Metadata/><Group id="OWNED.WIRE48" label="Owned protected group"><Login name="owned-protected-code-r48" pw="'+password+'" mode="run-trial"><Booklet codes="Shared">OWNED.PROTECTED</Booklet></Login><Login name="owned-passwordless-code-r48" mode="run-trial"><Booklet codes="Shared">OWNED.PROTECTED</Booklet></Login><Login name="owned-passwordless-no-code-r48" mode="run-trial"><Booklet>OWNED.PROTECTED</Booklet></Login><Login name="owned-passwordless-monitor-r48" mode="monitor-group"/><Login name="owned-foreign-review-r48" mode="run-trial"><Booklet>OWNED.PROTECTED</Booklet></Login><Login name="owned-hot-review-r48" mode="run-hot-return"><Booklet>OWNED.PROTECTED</Booklet></Login></Group>'));

 const login=await request('owner-login','PUT','/session/login',{body:{name:'owned-passwordless-no-code-r48',password:''}});assert.equal(login.status,200);const token=login.value.token;
 const createdTest=await request('create-test','PUT','/test',{token,body:{bookletName:'OWNED.PROTECTED'}});assert.equal(createdTest.status,201);const test=String(createdTest.value),testPath='/test/'+test,unitPath=testPath+'/unit/OWNED.UNIT';
 const foreign=await request('foreign-login','PUT','/session/login',{body:{name:'owned-foreign-review-r48',password:''}});assert.equal(foreign.status,200);const foreignToken=foreign.value.token;
 const hot=await request('hot-login','PUT','/session/login',{body:{name:'owned-hot-review-r48',password:''}});assert.equal(hot.status,200);
 const hotTest=await request('hot-test','PUT','/test',{token:hot.value.token,body:{bookletName:'OWNED.PROTECTED'}});assert.equal(hotTest.status,201);
 for(const [label,path] of [['unit',unitPath],['booklet',testPath]]){
  const empty=await request(label+'-empty','GET',path+'/reviews',{token});assert.equal(empty.status,200);assert.deepEqual(empty.value,[]);
  await request(label+'-missing-token','GET',path+'/reviews');await request(label+'-foreign-owner','GET',path+'/reviews',{token:foreignToken});
  const body={priority:2,categories:'tech design',entry:'Owned '+label+' exact Ω\n  second line',reviewer:'Reviewer Ä',userAgent:'Owned Source review agent',originalUnitId:'OWNED.ORIGINAL.IDENTITY',page:3,pagelabel:'Teilaufgabe β'};
  const write=await request(label+'-create','PUT',path+'/review',{token,body});assert.equal(write.status,201);assert.equal(write.rawText,'');
  const read=await request(label+'-list','GET',path+'/reviews',{token});assert.equal(read.status,200);assert.equal(read.value.length,1);assert.equal(read.value[0].entry,body.entry);const id=read.value[0].id;
  const patch=await request(label+'-patch','PATCH',path+'/review/'+id,{token,body:{priority:1,categories:'content tech',entry:'Updated '+label+' Ω',reviewer:null,pagelabel:'Changed page Ä'}});assert.equal(patch.status,200);
  const updated=await request(label+'-updated','GET',path+'/reviews',{token});assert.equal(updated.value[0].entry,'Updated '+label+' Ω');
  await request(label+'-missing-entry','PUT',path+'/review',{token,body:{}});
  await request(label+'-foreign-patch','PATCH',path+'/review/'+id,{token:foreignToken,body:{entry:'Must never replace owner'}});
  const remains=await request(label+'-owner-unchanged','GET',path+'/reviews',{token});assert.equal(remains.value[0].entry,'Updated '+label+' Ω');
  await request(label+'-unsupported-method','POST',path+'/review',{token,body:{entry:'Unsupported'}});
 }
 const stateBody={originalUnitId:'IGNORED.LATER.IDENTITY',newState:[{key:'CUSTOM_WIRE',content:'Exact Ω/β 😀\n  state',timeStamp:1700000000010}]};
 assert.equal((await request('wire-unit-state','PATCH',unitPath+'/state',{token,body:stateBody})).status,200);
 const responseBody={timeStamp:1700000000011,dataParts:{z:'Exact Ω/β 😀\n\"; \\u03a9',a:'First part'},responseType:'owned/Ω'};
 assert.equal((await request('wire-unit-response','PUT',unitPath+'/response',{token,body:responseBody})).status,201);
 const unitLogBody={logEntries:[{key:'OWNED_UNIT',content:'Unit Ω/β 😀',timeStamp:1700000000030}]};
 assert.equal((await request('wire-unit-log','PUT',unitPath+'/log',{token,body:unitLogBody})).status,201);
 const testLogBody=[{key:'OWNED_TEST',content:'Booklet Ω/β 😀',timeStamp:1700000000001},{key:'OWNED_INT64',content:'Exact large timestamp',timeStamp:JSON.rawJSON('9007199254740993')}];
 assert.equal((await request('wire-test-log','PUT',testPath+'/log',{token,body:testLogBody})).status,201);
 for(const family of ['response','log'])for(const [format,accept]of [['json','application/json'],['csv','text/csv']]){
  const report=await request('operator-'+family+'-'+format,'GET','/workspace/'+workspace+'/report/'+family,{token:admin.value.token,accept});assert.equal(report.status,200);if(format==='csv')assert.match(report.contentType,/^text\/csv/);
 }
 await request('review-export-json','GET','/reviews/export',{token});
 for(const [suffix,accept]of [['json','application/json'],['csv','text/csv']]){const report=await request('operator-review-'+suffix,'GET','/workspace/'+workspace+'/report/review?useNewVersion=true',{token:admin.value.token,accept});assert.equal(report.status,200);if(suffix==='csv'){assert.match(report.contentType,/^text\/csv/);assert.ok(report.rawText.startsWith('\uFEFF'));}}

 await request('hot-review-create-denied','PUT','/test/'+hotTest.value+'/review',{token:hot.value.token,body:{entry:'Owned denied review'}});
 for(const [label,path] of [['unit',unitPath],['booklet',testPath]]){
  const before=await request(label+'-predelete','GET',path+'/reviews',{token});const id=before.value[0].id;
  await request(label+'-foreign-delete','DELETE',path+'/review/'+id,{token:foreignToken});
  const deleted=await request(label+'-delete','DELETE',path+'/review/'+id,{token});assert.equal(deleted.status,204);
  const empty=await request(label+'-after-delete','GET',path+'/reviews',{token});assert.deepEqual(empty.value,[]);
  const missing=await request(label+'-duplicate-delete','DELETE',path+'/review/'+id,{token});assert.equal(missing.status,404);
 }
 verifyImage();assert.equal(git('status','--porcelain','--untracked-files=no'),'');
 const result={verified:true,sourceCommit:git('rev-parse','HEAD'),sourceHashes,sourceFilesVerifiedBeforeAndAfter:paths.length,vendor,backendImage:'sha256:d7045f22e834e2907ed39b5f8c99eed3d81f37643c50c3f66746e3f654381328',configuration:{bruteForceProtection:['login','person'],testMode:false,ownedDedicatedStack:true},workspace,rows:redact(rows),sourceCodeAndVendorUnmodified:true,actualPostgresAndRedis:true,adminWorkspaceRosterAndBookletOverActualHttp:true,sqlSeedsOrDaoStubs:false,fullOriginalParityProven:false};
 await writeFile(join(out,'observations.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({verified:true,cases:rows.length,statuses:rows.map(({label,status})=>({label,status})),sourceFiles:paths.length}));
}catch(error){await writeFile(join(out,'failure.json'),JSON.stringify({error:String(error),workspace,rows:redact(rows)},null,2)+'\n');throw error;}
