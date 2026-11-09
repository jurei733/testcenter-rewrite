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
const login=async(label,name)=>{const challenge=(await send(label+'-challenge','POST','/session/challenge',{body:{loginType:'login',name,password:'owned-r95-asset-password'}})).value;return (await send(label,'PUT','/session',{body:solve(challenge)})).value;};
const personLogin=async(label,loginToken)=>{const challenge=(await send(label+'-challenge','POST','/session/person/challenge',{token:loginToken,body:{code:'c1'}})).value;return (await send(label,'PUT','/session',{token:loginToken,body:solve(challenge)})).value;};
const assets=[],workspaces=[];let token,selected=[];
try{
 for(let attempt=0;;attempt++){try{const ready=await fetch(base+'/system/config',{signal:AbortSignal.timeout(2000)});if(ready.ok)break;}catch(error){if(attempt===59)throw error;}if(attempt===59)throw Error('Owned Source API not ready');await new Promise(done=>setTimeout(done,500));}
 const root=(await send('admin','PUT','/session/admin',{body:{name:'super',password:adminPassword}})).value;token=root.token;
 selected=(await send('initial-grants','GET','/user/'+root.id+'/workspaces',{token})).value.filter(row=>row.selected).map(row=>({id:row.id,role:row.role}));
 for(const key of ['global','group','user']){const body=new FormData();body.append('file',new Blob([png],{type:'image/png'}),'owned-r95-scope-'+key+'.png');assets.push((await send('asset-'+key,'POST','/assets',{token,body})).value);}
 await send('global-bindings','POST','/asset-assignments',{token,body:{assignments:[{slotName:'logo',assetID:assets[0].id},{slotName:'loginIllustration',assetID:assets[0].id},{slotName:'future-slot-Ω',assetID:assets[0].id}]}});
 const global=(await send('public-global','GET','/asset-assignments',{})).value;assert.equal(global.logo.assetID,assets[0].id);
 const invalid=await request('public-invalid-token','GET','/asset-assignments',{token:'owned-invalid-asset-token'});assert.equal(invalid.status,403);
 for(const name of ['A','B'])workspaces.push(Number((await send('workspace-'+name,'PUT','/workspace',{token,body:{name:'Owned asset scope R95 '+name}},201)).value));
 await send('grant-owned-workspaces','PATCH','/user/'+root.id+'/workspaces',{token,body:{ws:[...selected,...workspaces.map(id=>({id,role:'RW'}))]}});
 const upload=async(w,name,source)=>{const body=new FormData();body.append('fileforvo[]',new Blob([source],{type:'application/xml'}),name);const row=await request('upload-'+w+'-'+name,'POST','/workspace/'+w+'/file',{token,body});assert.ok([201,207].includes(row.status),JSON.stringify(redact(row)));assert.deepEqual(Object.values(row.value??{}).flatMap(v=>v.error??[]),[]);};
 const xml=(root,version,body)=>'<'+root+' xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="https://w3id.org/iqb/spec/'+({Unit:'unit',Booklet:'testcenter-booklet',Testtakers:'testcenter-testtaker'}[root])+'-xml/'+version+'">'+body+'</'+root+'>';
 for(const[w,index]of workspaces.map((w,i)=>[w,i])){
  await upload(w,'owned-asset-player-1.0.html','<html><script type="application/ld+json">'+JSON.stringify({$schema:'https://raw.githubusercontent.com/verona-interfaces/metadata/master/verona-module-metadata.json',id:'owned-asset-player',version:'1.0.0',specVersion:'6.0',metadataVersion:'2.0',type:'player',name:[{lang:'de',value:'Owned asset Player'}]})+'</script></html>');
  await upload(w,'unit.xml',xml('Unit','17.6','<Metadata><Id>R95.UNIT</Id><Label>Owned</Label></Metadata><Definition player="owned-asset-player-1.0">Owned</Definition>'));
  await upload(w,'booklet.xml',xml('Booklet','18.0','<Metadata><Id>R95.BOOKLET</Id><Label>Owned</Label></Metadata><Units><Unit id="R95.UNIT" label="Owned"/></Units>'));
  const assignment=(slot,asset)=>'<Asset slot="'+slot+'">'+asset.originalName+'</Asset>';
  const group=index===0?'<AssetAssignments>'+assignment('logo',assets[1])+'</AssetAssignments>':'';
  const user=index===0?'<AssetAssignments>'+assignment('logo',assets[2])+assignment('loadingProgress',assets[1])+'</AssetAssignments>':'';
  const login=(name,userAssignments='')=>'<Login name="'+name+'" pw="owned-r95-asset-password" mode="run-hot-return"><Booklet codes="c1">R95.BOOKLET</Booklet>'+userAssignments+'</Login>';
  await upload(w,'people.xml',xml('Testtakers','18.0','<Metadata/><Group id="R95.ASSET.GROUP.'+index+'" label="Owned asset group">'+group+login('owned-r95-asset-'+index,user)+(index===0?login('owned-r95-group-only'):'')+'</Group>'));
 }
 const scoped=await login('login-user-scope','owned-r95-asset-0');
 assert.ok(scoped.flags.includes('codeRequired'));
 const user=(await send('login-token-user-scope','GET','/asset-assignments',{token:scoped.token})).value;assert.equal(user.logo.assetID,assets[2].id);assert.equal(user.loadingProgress.assetID,assets[1].id);assert.equal(user.loginIllustration.assetID,assets[0].id);
 const person=await personLogin('person-user-scope',scoped.token);
 assert.deepEqual((await send('person-token-user-scope','GET','/asset-assignments',{token:person.token})).value,user);
 const group=await login('login-group-scope','owned-r95-group-only');
 const groupAssets=(await send('login-token-group-scope','GET','/asset-assignments',{token:group.token})).value;assert.equal(groupAssets.logo.assetID,assets[1].id);assert.equal(groupAssets.loadingProgress,undefined);
 const foreign=await login('login-other-workspace','owned-r95-asset-1');
 assert.deepEqual((await send('different-group-other-workspace','GET','/asset-assignments',{token:foreign.token})).value,global);
 assert.deepEqual((await send('admin-sees-global-only','GET','/asset-assignments',{token})).value,global);
 await send('delete-user-asset','DELETE','/assets/'+assets[2].id,{token});
 const after=(await send('user-deletion-falls-back-to-group','GET','/asset-assignments',{token:person.token})).value;assert.equal(after.logo.assetID,assets[1].id);
 await send('delete-group-asset','DELETE','/assets/'+assets[1].id,{token});
 const afterGroup=(await send('group-deletion-falls-back-to-global','GET','/asset-assignments',{token:person.token})).value;assert.equal(afterGroup.logo.assetID,assets[0].id);assert.equal(afterGroup.loadingProgress,undefined);
 await send('null-and-upsert-order','POST','/asset-assignments',{token,body:{assignments:[{slotName:'logo',assetID:assets[0].id},{slotName:'logo',assetID:null}]}});
 assert.equal((await send('upsert-wins-even-after-later-null','GET','/asset-assignments',{})).value.logo.assetID,assets[0].id);
 // Source deletes first, then its independent upsert fails a foreign key. Keep
 // this counterexample; an atomic rewrite must not reproduce the partial write.
 const partial=await request('source-partial-invalid-assignment-batch','POST','/asset-assignments',{token,body:{assignments:[{slotName:'logo',assetID:null},{slotName:'other',assetID:2147483647}]}});assert.equal(partial.status,500);
 const partialAfter=(await send('source-partial-assignment-state','GET','/asset-assignments',{})).value;assert.equal(partialAfter.logo,undefined);assert.equal(partialAfter.loginIllustration.assetID,assets[0].id);
 await send('delete-global-asset','DELETE','/assets/'+assets[0].id,{token});assert.deepEqual((await send('public-empty-after-cascade','GET','/asset-assignments',{})).value,[]);
 await send('delete-owned-workspaces','DELETE','/workspaces',{token,body:{ws:workspaces,p:adminPassword}});
 verifyImage();assert.equal(git('status','--porcelain','--untracked-files=no'),'');
 const result={verified:true,sourceCommit:git('rev-parse','HEAD'),sourceFilesVerifiedBeforeAndAfter:paths.length,sourceHashes,vendor,backendImage:containerInfo.Image,actualPostgresAndRedis:true,sqlSeedsOrDaoStubs:false,mutationsOverActualHttp:true,baselineCatalogRestored:true,rows:redact(rows),sourceUnsafePartialAssignmentWriteConfirmed:true,wholeOriginalParityProven:false};await writeFile(join(out,'observations.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({verified:true,httpRows:rows.length}));
}catch(error){await writeFile(join(out,'failure.json'),JSON.stringify(redact({error:String(error),rows,assets,workspaces}),null,2)+'\n');throw error;}
