import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {join} from 'node:path';
const out=process.env.ORIGINAL_TEST_ADMIN_OUTPUT_DIR,original=process.env.ORIGINAL_TEST_ADMIN_SOURCE_ROOT,container=process.env.ORIGINAL_TEST_ADMIN_CONTAINER;
assert.ok(out&&original&&container,'Set the owned output directory, pinned Source root and dedicated backend container');await mkdir(out,{recursive:true});
const port=execFileSync('docker',['port',container,'8080'],{encoding:'utf8'}).trim();assert.match(port,/^127\.0\.0\.1:\d+$/);const base='http://'+port;
const hash=b=>createHash('sha256').update(b).digest('hex'),git=(...a)=>execFileSync('git',['--no-optional-locks','-C',original,...a],{encoding:'utf8'}).trim();
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

const adminPassword='owned-source-super-secret',aliases=new Map([[adminPassword,'[owned-admin-password]']]),rows=[];
const register=v=>{if(v&&typeof v==='object')for(const[k,x]of Object.entries(v)){if(/^(token|groupToken|salt|signature)$/i.test(k)&&typeof x==='string'&&!aliases.has(x))aliases.set(x,'[owned-'+k+'-'+aliases.size+']');else register(x);}};
const redact=v=>{if(typeof v==='string'){for(const[s,a]of [...aliases].sort((a,b)=>b[0].length-a[0].length))v=v.replaceAll(s,a);return v;}if(Array.isArray(v))return v.map(redact);if(v&&typeof v==='object')return Object.fromEntries(Object.entries(v).map(([k,x])=>[k,redact(x)]));return v;};
const request=async(label,method,path,{body,token,rawBody=false}={})=>{
 const r=await fetch(base+path,{method,headers:{Accept:'application/json',...(token===undefined?{}:{AuthToken:token}),...(body!==undefined&&!(body instanceof FormData)?{'Content-Type':'application/json'}:{})},...(body===undefined?{}:{body:body instanceof FormData||rawBody?body:JSON.stringify(body)}),signal:AbortSignal.timeout(20000)});
 const bytes=Buffer.from(await r.arrayBuffer());let value;try{value=JSON.parse(bytes.toString());}catch{value=bytes.toString();}register(value);
 const result={label,method,path,status:r.status,value,bodySha256:hash(bytes),contentType:r.headers.get('content-type'),errorId:r.headers.get('error-id'),testMode:r.headers.get('test-mode'),rawText:bytes.toString(),requestBody:body instanceof FormData?'[actual multipart upload]':body};rows.push(result);return {...result,bytes};
};
const solve=c=>{assert.equal(c.algorithm,'SHA-256');assert.ok(c.maxNumber<=1000000);for(let number=0;number<=c.maxNumber;number++)if(hash(c.salt+number)===c.challenge)return{algorithm:c.algorithm,challenge:c.challenge,salt:c.salt,signature:c.signature,number};assert.fail('Actual Source ALTCHA has no bounded solution');};

const containerInfo=JSON.parse(execFileSync('docker',['inspect',container],{encoding:'utf8'}))[0];
assert.equal(containerInfo.Image,'sha256:d7045f22e834e2907ed39b5f8c99eed3d81f37643c50c3f66746e3f654381328');
assert.ok(containerInfo.Config.Env.includes('XML_SCHEMA_VALIDATION=true'));
assert.ok(containerInfo.Config.Env.includes('ALLOW_TEST_MODE=false'));
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1sAAAAASUVORK5CYII=','base64');
const check=(row,status=200)=>{assert.equal(row.status,status,JSON.stringify(redact({label:row.label,status:row.status,value:row.value})));return row;};
const send=async(label,method,path,options,status=200)=>check(await request(label,method,path,options),status);
const login=async(label,name)=>{const challenge=(await send(label+'-challenge','POST','/session/challenge',{body:{loginType:'login',name,password:'owned-r98-theme-password'}})).value;return (await send(label,'PUT','/session',{body:solve(challenge)})).value;};
const personLogin=async(label,loginToken)=>{const challenge=(await send(label+'-challenge','POST','/session/person/challenge',{token:loginToken,body:{code:'c1'}})).value;return (await send(label,'PUT','/session',{token:loginToken,body:solve(challenge)})).value;};

const xml=(type,body)=>'<'+type+' xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="https://w3id.org/iqb/spec/'+({Testtakers:'testcenter-testtaker-xml/18.0',SysCheck:'testcenter-syscheck-xml/18.0'}[type])+'">'+body+'</'+type+'>';
const root=(await send('admin','PUT','/session/admin',{body:{name:'super',password:adminPassword}})).value,token=root.token;
let workspace,grants=(await send('initial-grants','GET','/user/'+root.id+'/workspaces',{token})).value.filter(r=>r.selected).map(r=>({id:r.id,role:r.role}));
const create=async suffix=>{workspace=Number((await send('workspace-'+suffix,'PUT','/workspace',{token,body:{name:'Owned R103 '+suffix+' '+Date.now()}},201)).value);grants.push({id:workspace,role:'RW'});await send('grant-'+suffix,'PATCH','/user/'+root.id+'/workspaces',{token,body:{ws:grants}});return workspace;};
const upload=async(name,text,invalid=false)=>{const body=new FormData();body.append('fileforvo[]',new Blob([text],{type:'application/xml'}),name);const r=await request('upload-'+name,'POST','/workspace/'+workspace+'/file',{token,body});assert.ok([201,207].includes(r.status));if(!invalid)assert.deepEqual(Object.values(r.value).flatMap(v=>v.error??[]),[],JSON.stringify(redact(r)));return r;};
const snapshots=[];
const observe=async(label,mode)=>{const m=await send(label+'-mode','GET','/sys-check-mode');assert.equal(m.value,mode,label);const list=await request(label+'-list','GET','/sys-checks');assert.ok([200,204].includes(list.status));if(label==='new')assert.equal(list.status,204);const contentTypes=JSON.parse(execFileSync('docker',['exec',container.replace('-backend-','-postgres-'),'psql','-U','source_oracle','-d','source_oracle','-At','-c',"SELECT coalesce(json_agg(row_to_json(w)), '[]'::json) FROM (SELECT id, content_type FROM workspaces ORDER BY id) w"],{encoding:'utf8'}));snapshots.push({label,workspace,mode:m.value,list:list.value,status:list.status,contentTypes});await send(label+'-files','GET','/workspace/'+workspace+'/files',{token},label==='special-workspace-deleted'?404:200);};
const physicalLogin=async(label,status)=>{const name='r103-'+workspace+'-special';const challenge=await send(label+'-challenge','POST','/session/challenge',{body:{loginType:'login',name,password:'owned-password'}});return send(label,'PUT','/session',{body:solve(challenge.value)},status);};
const roster=(id,mode)=>xml('Testtakers','<Metadata/><Group id="R103.'+workspace+'.'+id+'" label="Owned"><Login name="r103-'+workspace+'-'+id+'" pw="owned-password" mode="'+mode+'"/></Group>');
try{
 const first=await create('first');await observe('new',false);
 await upload('check.xml',xml('SysCheck','<Metadata><Id>R103.CHECK</Id><Label>Public check</Label><Description>Public description</Description></Metadata><Config skipnetwork="true" savekey="owned-key"/>'));await observe('check-only',false);
 await upload('ordinary.xml',roster('ordinary','run-hot-return'));await observe('ordinary-only',false);
 await upload('special.xml',roster('special','sys-check-login'));await observe('mixed-logins',true);
 await upload('special.xml',roster('special','run-hot-return'));await observe('valid-replacement-ordinary',false);
 await upload('special.xml',roster('special','sys-check-login'));await observe('valid-replacement-restored',true);
 await physicalLogin('physical-special-login',200);
 await upload('special.xml','<Testtakers><malformed>',true);await observe('invalid-replacement',true);
 await send('delete-invalid-root','DELETE','/workspace/'+workspace+'/files',{token,body:{f:['special.xml']}},207);await observe('invalid-root-deleted',true);
 await send('delete-special','DELETE','/workspace/'+workspace+'/files',{token,body:{f:['Testtakers/special.xml']}},207);await observe('special-deleted-ordinary-remains',false);await physicalLogin('deleted-special-login',400);
 await send('delete-ordinary','DELETE','/workspace/'+workspace+'/files',{token,body:{f:['Testtakers/ordinary.xml']}},207);await observe('all-rosters-deleted',false);
 const second=await create('second');await upload('special.xml',roster('second','sys-check-login'));await observe('second-workspace-special',true);
 workspace=first;await send('delete-check','DELETE','/workspace/'+workspace+'/files',{token,body:{f:['SysCheck/check.xml']}},207);await observe('check-deleted-mode-stays',true);
 workspace=second;await send('delete-second-workspace','DELETE','/workspaces',{token,body:{ws:[workspace],p:adminPassword}},200);await observe('special-workspace-deleted',false);
 verifyImage();assert.equal(git('status','--porcelain','--untracked-files=no'),'');
 await writeFile(join(out,'observations.json'),JSON.stringify(redact({verified:true,sourceCommit:git('rev-parse','HEAD'),sourceHashes,vendor,actualSourceBackend:true,apiMocks:false,sqlSeedsOrDaoStubs:false,xmlSchemaValidation:true,allowTestMode:false,rows,snapshots}),null,2)+'\n');
}catch(error){await writeFile(join(out,'failure.json'),JSON.stringify(redact({error:String(error),rows,snapshots}),null,2)+'\n');throw error;}
