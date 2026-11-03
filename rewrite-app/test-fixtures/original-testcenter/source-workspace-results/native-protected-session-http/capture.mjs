import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {join} from 'node:path';
const work=new URL('.',import.meta.url).pathname,out=join(work,'round41-source-protected');await mkdir(out,{recursive:true});
const original='/Users/julian/Documents/Codex/2026-10-20/en/work/testcenter-original',container='source-protected-r41-backend-1';
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
 const result={label,method,path,status:r.status,value,bodySha256:hash(bytes),contentType:r.headers.get('content-type'),errorId:r.headers.get('error-id'),testMode:r.headers.get('test-mode')};rows.push(result);return result;
};
const solve=c=>{assert.equal(c.algorithm,'SHA-256');assert.ok(c.maxNumber<=1000000);for(let number=0;number<=c.maxNumber;number++)if(hash(c.salt+number)===c.challenge)return{algorithm:c.algorithm,challenge:c.challenge,salt:c.salt,signature:c.signature,number};assert.fail('Actual Source ALTCHA has no bounded solution');};
let workspace;
try{
 const config=await request('configuration','GET','/system/config');assert.equal(config.status,200);assert.deepEqual(config.value.bruteForceProtection,['login','person']);
 const admin=await request('admin','PUT','/session/admin',{body:{name:'super',password:adminPassword}});assert.equal(admin.status,200);
 const created=await request('workspace','PUT','/workspace',{token:admin.value.token,body:{name:'Owned complete protected Session oracle v4'}});assert.equal(created.status,201);workspace=Number(created.value);
 assert.equal((await request('workspace-grant','PATCH','/user/'+admin.value.id+'/workspaces',{token:admin.value.token,body:{ws:[{id:workspace,role:'RW'}]}})).status,200);
 const xml=(type,repo,body)=>'<'+type+' xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="https://w3id.org/iqb/spec/'+repo+'/18.0">'+body+'</'+type+'>';
 const upload=async(label,name,document)=>{const form=new FormData();form.append('fileforvo[]',new Blob([document],{type:'application/xml'}),name);const r=await request(label,'POST','/workspace/'+workspace+'/file',{token:admin.value.token,body:form});assert.ok([201,207].includes(r.status),JSON.stringify(redact(r)));assert.deepEqual(Object.values(r.value??{}).flatMap(entry=>entry?.error??[]),[],JSON.stringify(redact(r)));};
 const playerMetadata={id:'owned-protected-player',version:'1.0.0',specVersion:'6.0',metadataVersion:'2.0',type:'player',name:[{lang:'de',value:'Owned protected Player'}],description:[{lang:'de',value:'Owned fixture'}]};
 await upload('player-upload','owned-protected-player-1.0.html','<html><script type="application/ld+json">'+JSON.stringify(playerMetadata)+'</script><main>Owned protected Player</main></html>');
 await upload('unit-upload','owned-protected-unit.xml','<Unit xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="https://w3id.org/iqb/spec/unit-xml/17.6"><Metadata><Id>OWNED.UNIT</Id><Label>Owned protected Unit</Label></Metadata><Definition player="owned-protected-player@1.0.0">Owned protected definition</Definition></Unit>');
 await upload('booklet-upload','owned-protected-booklet.xml',xml('Booklet','testcenter-booklet-xml','<Metadata><Id>OWNED.PROTECTED</Id><Label>Owned protected Booklet</Label></Metadata><Units><Unit id="OWNED.UNIT" label="Owned protected Unit"/></Units>'));
 await upload('roster-upload','owned-protected-people.xml',xml('Testtakers','testcenter-testtaker-xml','<Metadata/><Group id="OWNED.PROTECTED" label="Owned protected group"><Login name="owned-protected-code" pw="'+password+'" mode="run-hot-return"><Booklet codes="Shared">OWNED.PROTECTED</Booklet></Login><Login name="owned-passwordless-code" mode="run-hot-return"><Booklet codes="Shared">OWNED.PROTECTED</Booklet></Login><Login name="owned-passwordless-no-code" mode="run-hot-return"><Booklet>OWNED.PROTECTED</Booklet></Login><Login name="owned-passwordless-monitor" mode="monitor-group"/></Group>'));
 await request('passworded-empty','PUT','/session/login',{body:{name:'owned-protected-code',password:''}});
 await request('passworded-direct-correct','PUT','/session/login',{body:{name:'owned-protected-code',password}});
 await request('passworded-direct-wrong','PUT','/session/login',{body:{name:'owned-protected-code',password:'Owned wrong password'}});
 const noPassword=await request('passwordless-coded-direct-empty','PUT','/session/login',{body:{name:'owned-passwordless-code',password:''}});assert.equal(noPassword.status,200);
 await request('passwordless-coded-omitted-password','PUT','/session/login',{body:{name:'owned-passwordless-code'}});
 await request('passwordless-no-code-direct-empty','PUT','/session/login',{body:{name:'owned-passwordless-no-code',password:''}});
 await request('passwordless-monitor-direct-empty','PUT','/session/login',{body:{name:'owned-passwordless-monitor',password:''}});
 await request('challenge-missing-password','POST','/session/challenge',{body:{loginType:'login',name:'owned-protected-code'}});
 const challenge=await request('login-challenge','POST','/session/challenge',{body:{loginType:'login',name:'owned-protected-code',password}});assert.equal(challenge.status,200);const solution=solve(challenge.value);
 await request('login-proof-tampered','PUT','/session',{body:{...solution,signature:'0'.repeat(64)}});
 const login=await request('login-proof-correct','PUT','/session',{body:solution});assert.equal(login.status,200);const loginToken=login.value.token;
 await request('person-challenge-missing-token','POST','/session/person/challenge',{body:{code:'Shared'}});
 await request('person-challenge-empty-token','POST','/session/person/challenge',{token:'',body:{code:'Shared'}});
 await request('person-challenge-wrong-type','POST','/session/person/challenge',{token:login.value.groupToken,body:{code:'Shared'}});
 await request('person-challenge-missing-code','POST','/session/person/challenge',{token:loginToken,body:{}});
 await request('person-direct-empty-code','PUT','/session/person',{token:loginToken,body:{code:''}});
 await request('person-direct-omitted-code','PUT','/session/person',{token:loginToken,body:{}});
 await request('person-direct-nonempty-code','PUT','/session/person',{token:loginToken,body:{code:'Shared'}});
 const personChallenge=await request('person-challenge-correct','POST','/session/person/challenge',{token:loginToken,body:{code:'Shared'}});assert.equal(personChallenge.status,200);const personSolution=solve(personChallenge.value);
 await request('person-proof-missing-token','PUT','/session',{body:personSolution});
 const person=await request('person-proof-correct','PUT','/session',{token:loginToken,body:personSolution});assert.equal(person.status,200);
 const replay=await request('person-proof-replay','PUT','/session',{token:loginToken,body:personSolution});const currentPersonToken=replay.status===200?replay.value.token:person.value.token;
 await request('person-old-token-after-replay','GET','/session',{token:person.value.token});
 for(const [label,code]of [['wrong','Owned wrong code'],['empty','']]){
  const c=await request('person-challenge-'+label,'POST','/session/person/challenge',{token:loginToken,body:{code}});assert.equal(c.status,200);
  await request('person-proof-'+label,'PUT','/session',{token:loginToken,body:solve(c.value)});
 }
 for(const [label,body]of [['missing-algorithm',{}],['missing-number',{algorithm:'SHA-256',challenge:'a'.repeat(64),salt:'owned',signature:'0'.repeat(64)}]])await request('proof-'+label,'PUT','/session',{body});
 await request('person-read','GET','/session',{token:currentPersonToken});
 await request('person-logout','DELETE','/session',{token:currentPersonToken});
 await request('person-read-after-logout','GET','/session',{token:currentPersonToken});
 await request('login-read-after-person-logout','GET','/session',{token:loginToken});
 verifyImage();assert.equal(git('status','--porcelain','--untracked-files=no'),'');
 const result={verified:true,sourceCommit:git('rev-parse','HEAD'),sourceHashes,sourceFilesVerifiedBeforeAndAfter:paths.length,vendor,backendImage:'sha256:d7045f22e834e2907ed39b5f8c99eed3d81f37643c50c3f66746e3f654381328',configuration:{bruteForceProtection:['login','person'],testMode:false,ownedDedicatedStack:true},workspace,rows:redact(rows),sourceCodeAndVendorUnmodified:true,actualPostgresAndRedis:true,adminWorkspaceRosterAndBookletOverActualHttp:true,sqlSeedsOrDaoStubs:false,actualAltchaSolutions:true,fullOriginalParityProven:false};
 await writeFile(join(out,'observations.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({verified:true,cases:rows.length,statuses:rows.map(({label,status})=>({label,status})),sourceFiles:paths.length}));
}catch(error){await writeFile(join(out,'failure.json'),JSON.stringify({error:String(error),workspace,rows:redact(rows)},null,2)+'\n');throw error;}
