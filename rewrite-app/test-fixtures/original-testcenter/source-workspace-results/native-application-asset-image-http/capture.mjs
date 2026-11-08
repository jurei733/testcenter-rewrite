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
const changed=(source,offset,value)=>{const b=Buffer.from(source);b.writeUInt32BE(value,offset);return b;};
const highBit=(source,offset)=>{const bytes=Buffer.from(source);bytes[offset]|=0x80;return bytes;};
const jpeg=marker=>Buffer.from([0xff,0xd8,0xff,marker,0,17,8,0,2,0,3,3,1,0x11,0,2,0x11,0,3,0x11,0,0xff,0xd9]);
const webp=(type,payload)=>{const bytes=Buffer.alloc(20+payload.length+(payload.length%2));bytes.write('RIFF');bytes.writeUInt32LE(bytes.length-8,4);bytes.write('WEBP',8);bytes.write(type,12);bytes.writeUInt32LE(payload.length,16);payload.copy(bytes,20);return bytes;};
const vp8=webp('VP8 ',Buffer.from([0x30,1,0,0x9d,1,0x2a,3,0,2,0]));
const vp8l=webp('VP8L',Buffer.from([0x2f,2,0x40,0,0]));
const vp8x=webp('VP8X',Buffer.from([0,0,0,0,2,0,0,1,0,0]));
const cases=[
 ['png-complete','png','image/png',png],
 ...[8,12,16,20,24,25,32,33].map(length=>['png-prefix-'+length,'png','image/png',png.subarray(0,length)]),
 ['png-zero-width','png','image/png',changed(png,16,0)],['png-zero-height','png','image/png',changed(png,20,0)],
 ['png-non-ihdr','png','image/png',changed(png,12,0x4a554e4b)],
 ['png-zero-ihdr-length','png','image/png',changed(png,8,0)],
 ['png-huge-ihdr-length','png','image/png',changed(png,8,0xffffffff)],
 ['png-high-bit-ihdr','png','image/png',highBit(png,12)],
 ['png-as-jpg','jpg','image/jpeg',png],['png-wrong-client-mime','png','text/plain',png],
 ['png-bad-extension','txt','image/png',png],['png-upper-extension','PNG','image/png',png],
 ['jpeg-sof0','jpg','image/jpeg',jpeg(0xc0)],['jpeg-sof2','jpeg','image/jpeg',jpeg(0xc2)],
 ['jpeg-sof1','jpg','image/jpeg',jpeg(0xc1)],['jpeg-sof3','jpg','image/jpeg',jpeg(0xc3)],
 ...[3,4,5,6,7,8,11,12].map(length=>['jpeg-prefix-'+length,'jpg','image/jpeg',jpeg(0xc0).subarray(0,length)]),
 ['jpeg-invalid-app-length','jpg','image/jpeg',Buffer.from([0xff,0xd8,0xff,0xe1,0,0,0xff,0xc0,0,17,8,0,2,0,3])],
 ['jpeg-with-app','jpg','image/jpeg',Buffer.concat([jpeg(0xc0).subarray(0,2),Buffer.from([0xff,0xe1,0,6,1,2,3,4]),jpeg(0xc0).subarray(2)])],
 ['webp-vp8','webp','image/webp',vp8],['webp-vp8l','webp','image/webp',vp8l],['webp-vp8x','webp','image/webp',vp8x],
 ...[12,16,20,25,29].map(length=>['webp-prefix-'+length,'webp','image/webp',vp8.subarray(0,length)]),
 ['webp-vp8-bad-start','webp','image/webp',Buffer.from(vp8.map((byte,index)=>index===23?0:byte))],
 ['webp-vp8l-bad-signature','webp','image/webp',Buffer.from(vp8l.map((byte,index)=>index===20?0:byte))],
 ['webp-vp8l-padded','webp','image/webp',Buffer.concat([vp8l,Buffer.alloc(4)])],
 ['webp-bad-riff-length','webp','image/webp',changed(vp8,4,0)],
 ['webp-high-bit-riff','webp','image/webp',highBit(vp8,0)],
 ['webp-high-bit-webp','webp','image/webp',highBit(vp8,8)],
 ['webp-high-bit-vp8','webp','image/webp',highBit(vp8,12)],
 ['webp-vp8x-zero-reserved','webp','image/webp',vp8x],
 ['webp-unknown-chunk','webp','image/webp',webp('JUNK',Buffer.alloc(10))]
].map(([label,extension,declaredMediaType,bytes])=>({label,extension,declaredMediaType,bytes}));
const inputs=cases.map(({bytes,...rest})=>({...rest,bytes:bytes.length,base64:bytes.toString('base64'),sha256:hash(bytes)}));
await writeFile(join(out,'inputs.json'),JSON.stringify(inputs,null,2)+'\n');
const php='$rows=json_decode(stream_get_contents(STDIN),true,512,JSON_THROW_ON_ERROR);$finfo=new finfo(FILEINFO_MIME_TYPE);$out=[];foreach($rows as $row){$b=base64_decode($row["base64"],true);$out[$row["label"]]=["mimeType"=>$finfo->buffer($b),"imageInfo"=>@getimagesizefromstring($b)];}echo json_encode($out,JSON_THROW_ON_ERROR);';
const imageProbes=JSON.parse(execFileSync('docker',['exec','-i',container,'php','-r',php],{encoding:'utf8',input:JSON.stringify(inputs)}));
const tag=Date.now().toString(36),outcomes=[];let created=[];
const expect=(row,status)=>{assert.equal(row.status,status,JSON.stringify(redact({label:row.label,status:row.status,value:row.value})));return row;};
try{
 expect(await request('configuration','GET','/system/config'),200);
 const admin=expect(await request('admin','PUT','/session/admin',{body:{name:'super',password:adminPassword}}),200),token=admin.value.token;
 const baseline=expect(await request('assets-before','GET','/assets',{token}),200);
 for(const test of cases){
  const name='owned-r92-'+tag+'-'+test.label+'.'+test.extension,form=new FormData();form.append('file',new Blob([test.bytes],{type:test.declaredMediaType}),name);
  const response=await request(test.label,'POST','/assets',{token,body:form});
  assert.ok([200,400].includes(response.status),JSON.stringify(redact({label:test.label,status:response.status,value:response.value})));
  const accepted=response.status===200;
  if(accepted){assert.equal(response.value.originalName,name);created.push(response.value.id);expect(await request(test.label+'-delete','DELETE','/assets/'+response.value.id,{token}),200);}
  outcomes.push({label:test.label,status:response.status,accepted,probe:imageProbes[test.label]});
  console.log(JSON.stringify(outcomes.at(-1)));
 }
 const after=expect(await request('assets-after','GET','/assets',{token}),200);assert.deepEqual(after.value,baseline.value);
 verifyImage();assert.equal(git('status','--porcelain','--untracked-files=no'),'');
 const result={verified:true,sourceCommit:git('rev-parse','HEAD'),sourceFilesVerifiedBeforeAndAfter:paths.length,sourceHashes,vendor,backendImage:containerInfo.Image,
   configuration:{xmlSchemaValidation:true,allowTestMode:false,ownedDedicatedStack:true},actualPostgresAndRedis:true,sqlSeedsOrDaoStubs:false,
   mutationsOverActualHttp:true,baselineCatalogRestored:true,inputsSha256:hash(await readFile(join(out,'inputs.json'))),imageProbes,rows:redact(rows),outcomes,
   wholeOriginalParityProven:false};
 await writeFile(join(out,'observations.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({verified:true,cases:cases.length,httpRows:rows.length,accepted:outcomes.filter(row=>row.accepted).length}));
}catch(error){await writeFile(join(out,'failure.json'),JSON.stringify(redact({error:String(error),rows,outcomes,created}),null,2)+'\n');throw error;}
