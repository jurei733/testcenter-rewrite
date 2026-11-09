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
const expected=(row,status)=>{assert.equal(row.status,status,JSON.stringify(redact({label:row.label,status:row.status,value:row.value})));return row;};
const send=async(label,method,path,options,status=200)=>expected(await request(label,method,path,options),status);
const upload=async(label,name,bytes=png,token,field='file')=>{const form=new FormData();form.append(field,new Blob([bytes],{type:'text/plain'}),name);return request(label,'POST','/assets',{token,body:form});};
const fileBytes=storedName=>execFileSync('docker',['exec',container,'php','-r','echo file_get_contents("/var/www/testcenter/data/public/uploaded_assets/".$argv[1]);',storedName]);
let workspace,token;const created=new Set(),checks=[];
try{
 for(let attempt=0;;attempt++){try{await fetch(base+'/system/config',{signal:AbortSignal.timeout(2000)});break;}catch(error){if(attempt===59)throw error;await new Promise(done=>setTimeout(done,500));}}
 const admin=(await send('admin-login','PUT','/session/admin',{body:{name:'super',password:adminPassword}})).value;token=admin.token;
 const before=(await send('catalog-before','GET','/assets',{token})).value;assert.deepEqual(before,[]);
 await send('catalog-no-token','GET','/assets',{},401);await send('catalog-empty-token','GET','/assets',{token:''},401);
 const bad=await request('catalog-invalid-token','GET','/assets',{token:'owned-invalid-token'});assert.ok(bad.status>=400);
 assert.deepEqual((await send('assignments-public-empty','GET','/asset-assignments',{})).value,[]);
 assert.deepEqual((await send('assignments-empty-header','GET','/asset-assignments',{token:''})).value,[]);
 const a=expected(await upload('upload-a-unicode','Owned-R95-Ä Ω.png',png,token),200).value;created.add(a.id);
 const b=expected(await upload('upload-b-spoofed-extension','owned-r95-b.webp',png,token),200).value;created.add(b.id);
 assert.equal(a.id,1);assert.equal(b.id,2);assert.equal(a.originalName,'Owned-R95-Ä Ω.png');assert.match(a.storedName,/^asset_[a-f0-9]{32}\.png$/);assert.equal(a.url,'public/uploaded_assets/'+a.storedName);assert.deepEqual(fileBytes(a.storedName),png);
 const list1=(await send('catalog-populated','GET','/assets',{token})).value;assert.deepEqual(list1.map(x=>x.id),[b.id,a.id]);assert.ok(list1.every(x=>typeof x.createdAt==='string'));
 await send('set-global-and-custom-slot','POST','/asset-assignments',{token,body:{assignments:[{slotName:'logo',assetID:a.id,scope:'user',scopeID:'ignored'},{slotName:'future-slot-Ω',assetID:b.id,scope:'group',scopeID:'ignored'}]}});
 const global=(await send('assignments-public-global','GET','/asset-assignments',{})).value;assert.deepEqual(global.logo,{assetID:a.id,url:a.url});assert.deepEqual(global['future-slot-Ω'],{assetID:b.id,url:b.url});
 const replacement=expected(await upload('upload-a-replacement','Owned-R95-Ä Ω.png',Buffer.concat([png,Buffer.from('replacement')]),token),200).value;assert.equal(replacement.id,a.id);assert.notEqual(replacement.storedName,a.storedName);assert.deepEqual(fileBytes(replacement.storedName),Buffer.concat([png,Buffer.from('replacement')]));
 const oldExists=execFileSync('docker',['exec',container,'php','-r','echo file_exists("/var/www/testcenter/data/public/uploaded_assets/".$argv[1])?"yes":"no";',a.storedName],{encoding:'utf8'});assert.equal(oldExists,'no');
 const list2=(await send('catalog-after-replacement','GET','/assets',{token})).value;assert.deepEqual(list2.map(x=>x.id),[b.id,a.id]);assert.equal(list2.find(x=>x.id===a.id).createdAt,list1.find(x=>x.id===a.id).createdAt);
 assert.equal((await send('assignments-follow-replacement','GET','/asset-assignments',{})).value.logo.url,replacement.url);
 const caseVariant=expected(await upload('upload-a-case-variant','owned-r95-ä ω.PNG',png,token),200).value;created.add(caseVariant.id);checks.push({label:'case-fold-collision',sameId:caseVariant.id===a.id,first:a.originalName,second:caseVariant.originalName});
 const leading=await upload('upload-leading-space','  owned-r95-leading.png',png,token);if(leading.status===200)created.add(leading.value.id);checks.push({label:'leading-space-filename',status:leading.status,storedOriginalName:leading.value?.originalName});
 const padded=await upload('upload-trailing-space','owned-r95-trailing.png  ',png,token);if(padded.status===200)created.add(padded.value.id);checks.push({label:'trailing-space-filename',status:padded.status,storedOriginalName:padded.value?.originalName});
 await request('upload-no-file','POST','/assets',{token,body:{}});
 await upload('upload-wrong-field','owned-r95-wrong.png',png,token,'other');
 const oversized=Buffer.concat([png,Buffer.alloc(2*1024*1024+1-png.length)]);await upload('upload-two-mib-plus-one','owned-r95-big.png',oversized,token);
 const edge=Buffer.concat([png,Buffer.alloc(2*1024*1024-png.length)]);const edgeResponse=expected(await upload('upload-two-mib-exact','owned-r95-edge.png',edge,token),200);created.add(edgeResponse.value.id);
 await send('set-subset-does-not-remove-custom-slot','POST','/asset-assignments',{token,body:{assignments:[{slotName:'logo',assetID:null}]}});
 const unset=(await send('assignment-null-deletes-only-provided-slot','GET','/asset-assignments',{})).value;assert.equal(unset.logo,undefined);assert.equal(unset['future-slot-Ω'].assetID,b.id);
 await send('set-empty-assignment-array','POST','/asset-assignments',{token,body:{assignments:[]}});
 await send('set-missing-assignment-array','POST','/asset-assignments',{token,body:{}});
 const sameBefore=(await send('before-invalid-assignment','GET','/asset-assignments',{})).value;
 const invalid=await request('set-unknown-asset','POST','/asset-assignments',{token,body:{assignments:[{slotName:'logo',assetID:2147483647}]}});assert.equal(invalid.status,500);assert.deepEqual((await send('after-invalid-assignment','GET','/asset-assignments',{})).value,sameBefore);
 // All mutations are actual protected HTTP; the second admin supplies a real
 // current non-superadmin capability for permission checks.
 const uid=Number((await send('create-nonroot','PUT','/user',{token,body:{n:'owned-r95-nonroot',p:'owned-r95-nonroot-secret'}},201)).rawText);
 const normal=(await send('nonroot-login','PUT','/session/admin',{body:{name:'owned-r95-nonroot',password:'owned-r95-nonroot-secret'}})).value;
 for(const method of ['GET','POST','DELETE']){const path=method==='DELETE'?'/assets/'+b.id:'/assets';await send('nonroot-'+method,method,path,{token:normal.token,...method==='POST'?{body:{}}:{}},403);}
 await send('nonroot-set-assignments','POST','/asset-assignments',{token:normal.token,body:{assignments:[]}},403);
 assert.deepEqual((await send('nonroot-get-global','GET','/asset-assignments',{token:normal.token})).value,sameBefore);
 await send('remove-nonroot','DELETE','/users',{token,body:{u:[uid],p:adminPassword}});
 for(const reference of ['missing','2147483647','0','-1','1x'])await request('delete-reference-'+reference,'DELETE','/assets/'+reference,{token});
 // Reference1x can be coerced to id1 by Source. Retain the observed outcome;
 // cleanup accepts only an actual missing404 or successful200 for owned IDs.
 for(const id of created){const row=await request('cleanup-'+id,'DELETE','/assets/'+id,{token});assert.ok([200,404].includes(row.status));}
 assert.deepEqual((await send('catalog-after-cleanup','GET','/assets',{token})).value,[]);assert.deepEqual((await send('assignments-cascade-after-cleanup','GET','/asset-assignments',{})).value,[]);
 const afterDelete=expected(await upload('reupload-after-delete','owned-r95-b.webp',png,token),200).value;assert.ok(afterDelete.id>Math.max(...created));await send('cleanup-reupload','DELETE','/assets/'+afterDelete.id,{token});
 verifyImage();assert.equal(git('status','--porcelain','--untracked-files=no'),'');
 const result={verified:true,sourceCommit:git('rev-parse','HEAD'),sourceFilesVerifiedBeforeAndAfter:paths.length,sourceHashes,vendor,backendImage:containerInfo.Image,configuration:{xmlSchemaValidation:true,allowTestMode:false,ownedDedicatedStack:true},actualPostgresAndRedis:true,sqlSeedsOrDaoStubs:false,mutationsOverActualHttp:true,baselineCatalogRestored:true,rows:redact(rows),checks:redact(checks),storedBytesVerifiedViaContainerRead:true,publicFileServerHttpProven:false,wholeOriginalParityProven:false};
 await writeFile(join(out,'observations.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({verified:true,httpRows:rows.length,checks}));
}catch(error){await writeFile(join(out,'failure.json'),JSON.stringify(redact({error:String(error),rows,checks,created:[...created]}),null,2)+'\n');throw error;}
