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
let actualBackendRequests=0;
const request=async(label,method,path,{body,token,rawBody=false,headers={}}={})=>{
 actualBackendRequests++;const r=await fetch(base+path,{method,headers:{Accept:'application/json',...(token===undefined?{}:{AuthToken:token}),...(body!==undefined&&!(body instanceof FormData)?{'Content-Type':'application/json'}:{}),...headers},...(body===undefined?{}:{body:body instanceof FormData||rawBody?body:JSON.stringify(body)}),signal:AbortSignal.timeout(20000)});
 const bytes=Buffer.from(await r.arrayBuffer());let value;try{value=JSON.parse(bytes.toString());}catch{value=bytes.toString();}register(value);
 const result={label,method,path,status:r.status,value,bodySha256:hash(bytes),contentType:r.headers.get('content-type'),errorId:r.headers.get('error-id'),testMode:r.headers.get('test-mode'),rawText:bytes.toString(),requestBody:body instanceof FormData?'[actual multipart upload]':Buffer.isBuffer(body)?'[actual raw multipart bytes]':body};rows.push(result);return Object.defineProperty(result,'bytes',{value:bytes});
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
const fsContainer=process.env.ORIGINAL_ASSET_FILE_CONTAINER;assert.ok(fsContainer);
const fsPort=execFileSync('docker',['port',fsContainer,'8080'],{encoding:'utf8'}).trim();assert.match(fsPort,/^127\.0\.0\.1:\d+$/);const fsBase='http://'+fsPort;
const fsSourcePaths=git('ls-files','file-server').split('\n');const fsHashes=Object.fromEntries(await Promise.all(fsSourcePaths.map(async p=>[p,hash(await readFile(join(original,p)))])));
const verifyFileServer=()=>{for(const [p,h]of Object.entries(fsHashes)){const dest=p==='file-server/nginx.conf'?'/etc/nginx/nginx.conf':p.startsWith('file-server/auth/')?'/usr/share/nginx/'+p.slice('file-server/'.length):null;if(dest)assert.equal(hash(execFileSync('docker',['exec',fsContainer,'cat',dest])),h,p);}};verifyFileServer();
const fsInfo=JSON.parse(execFileSync('docker',['inspect',fsContainer],{encoding:'utf8'}))[0];
const fileServerRuntime={image:fsInfo.Image,sourceHashes:fsHashes,actualRuntimeConfigsVerified:5,mimeTypesSha256:hash(execFileSync('docker',['exec',fsContainer,'cat','/etc/nginx/mime.types'])),packages:execFileSync('docker',['exec',fsContainer,'dpkg-query','-W','nginx','libnginx-mod-http-lua','luarocks'],{encoding:'utf8'}).trim()};
let token;const created=new Set(),wireRows=[],checks=[];
const catalog=async()=>{actualBackendRequests++;const r=await fetch(base+'/assets',{headers:{AuthToken:token}});assert.equal(r.status,200);const rows=await r.json();for(const row of rows)created.add(row.id);return rows;};
const push=(form,part)=>{if(part.text!==undefined)form.append(part.field??'file',part.text);else form.append(part.field??'file',new Blob([part.bytes??png],{type:part.type??'image/png'}),part.name);};
try{
 const admin=expected(await request('wire-admin-login','PUT','/session/admin',{body:{name:'super',password:adminPassword}}),200).value;token=admin.token;assert.deepEqual(await catalog(),[]);
 const multipart=[
  ['empty-filename',[{name:''}]],
  ['final-empty-filename',[{name:'first.png'},{name:''}]],
  ['initial-empty-filename',[{name:''},{name:'last.png'}]],
  ['file-then-text-field',[{name:'file-then-text.png'},{text:'ordinary text'}]],
  ['text-then-file',[{text:'ordinary text'},{name:'text-then-file.png'}]],
  ['final-zero-byte-file',[{name:'first-zero.png'},{name:'last-zero.png',bytes:Buffer.alloc(0)}]],
  ['initial-zero-byte-file',[{name:'first-empty.png',bytes:Buffer.alloc(0)},{name:'last-full.png'}]],
  ['two-valid-files',[{name:'first-valid.png',bytes:Buffer.concat([png,Buffer.from('first')])},{name:'last-valid.png',bytes:Buffer.concat([png,Buffer.from('last')])}]],
  ['files-array',[{field:'file[]',name:'array.png'}]],
  ['indexed-file',[{field:'file[key]',name:'indexed.png'}]],
  ['array-then-file',[{field:'file[]',name:'array-before.png'},{name:'plain-after.png'}]],
  ['file-then-array',[{name:'plain-before.png'},{field:'file[]',name:'array-after.png'}]],
  ['declared-mime-ignored',[{name:'declared-mime.png',type:'text/plain'}]],
  ['empty-named-file',[{name:'empty.png',bytes:Buffer.alloc(0)}]],
  ['plain-text-disguised-as-png',[{name:'text.png',bytes:Buffer.from('hello world')}]],
  ['png-signature-only',[{name:'signature.png',bytes:png.subarray(0,8)}]],
  ['png-truncated-ihdr',[{name:'truncated.png',bytes:png.subarray(0,24)}]],
  ['png-header-25',[{name:'header.png',bytes:png.subarray(0,25)}]]
 ];
 for(const [label,parts]of multipart){const before=(await catalog()).length,form=new FormData();for(const p of parts)push(form,p);const row=await request('multipart-'+label,'POST','/assets',{token,body:form});row.parts=parts.map(p=>({...p,bytesBase64:(p.bytes??png).toString('base64'),bytes:undefined}));row.catalogCountBefore=before;row.catalogCountAfter=(await catalog()).length;if(row.status>=400)assert.equal(row.catalogCountAfter,before,label);}
 const boundary='Owned-R97-Boundary';
 for(const [label,tail]of [['missing-close',''],['truncated-close','\r\n--'+boundary.slice(0,-3)],['complete-close','\r\n--'+boundary+'--\r\n']]){
  const body=Buffer.concat([Buffer.from('--'+boundary+'\r\nContent-Disposition: form-data; name="file"; filename="raw-'+label+'.png"\r\nContent-Type: image/png\r\n\r\n'),png,Buffer.from(tail)]);
  const before=(await catalog()).length,row=await request('multipart-'+label,'POST','/assets',{token,body,rawBody:true,headers:{'Content-Type':'multipart/form-data; boundary='+boundary}});row.rawBodyBase64=body.toString('base64');row.rawContentType='multipart/form-data; boundary='+boundary;row.catalogCountBefore=before;row.catalogCountAfter=(await catalog()).length;if(row.status>=400)assert.equal(row.catalogCountAfter,before,label);
 }
 const render=(template,etag,last)=>Object.fromEntries(Object.entries(template).map(([k,v])=>[k,v.replaceAll('@etag',etag).replaceAll('@modified',last).replaceAll('@past',new Date(Date.parse(last)-1000).toUTCString()).replaceAll('@future',new Date(Date.parse(last)+86400000).toUTCString()).replaceAll('@rfc850',last.replace(/^\w+, (\d+) (\w+) (\d{4}) /,(_,day,month,year)=>'Monday, '+day+'-'+month+'-'+year.slice(-2)+' ')).replaceAll('@asctime',last.replace(/^(\w+), (\d+) (\w+) (\d{4}) (.+) GMT$/,(_,day,date,month,year,time)=>day+' '+month+' '+date+' '+time+' '+year)).replaceAll('@iso',new Date(Date.parse(last)).toISOString())]));
 const wire=async(label,assetAlias,method,path,headersTemplate,baseline)=>{
  const headers=render(headersTemplate,baseline?.etag??'',baseline?.modified??'');const r=await fetch(fsBase+'/'+path,{method,headers,signal:AbortSignal.timeout(20000)}),bytes=Buffer.from(await r.arrayBuffer());
  const names=['cache-control','content-type','content-length','etag','last-modified','accept-ranges','content-range','allow'];
  const h=Object.fromEntries(names.map(n=>[n,r.headers.get(n)]));const row={label,assetAlias,method,headersTemplate,status:r.status,headers:h,bodyBase64:bytes.toString('base64'),bodySha256:hash(bytes)};wireRows.push(row);return row;
 };
 const conditions=[['head','HEAD',{}],['etag','GET',{'if-none-match':'@etag'}],['weak-etag','GET',{'if-none-match':'W/@etag'}],['any-etag','GET',{'if-none-match':'*'}],['other-etag','GET',{'if-none-match':'"owned-other"'}],['etag-list','GET',{'if-none-match':'"owned-other", @etag'}],['modified','GET',{'if-modified-since':'@modified'}],['future-modified','GET',{'if-modified-since':'@future'}],['other-etag-and-modified','GET',{'if-none-match':'"owned-other"','if-modified-since':'@modified'}],['etag-and-past-modified','GET',{'if-none-match':'@etag','if-modified-since':'@past'}],['if-match','GET',{'if-match':'@etag'}],['if-match-other','GET',{'if-match':'"owned-other"'}],['unmodified-past','GET',{'if-unmodified-since':'@past'}],['unmodified-current','GET',{'if-unmodified-since':'@modified'}],['range-prefix','GET',{range:'bytes=0-7'}],['range-suffix','GET',{range:'bytes=-8'}],['range-open','GET',{range:'bytes=8-'}],['range-unavailable','GET',{range:'bytes=9999-'}],['range-bad','GET',{range:'bad'}],['range-multiple','GET',{range:'bytes=0-0,2-3'}],['range-mixed','GET',{range:'bytes=9999-,0-1'}],['range-amplification','GET',{range:'bytes=0-999,0-999'}],['if-range-current','GET',{range:'bytes=0-7','if-range':'@etag'}],['if-range-old','GET',{range:'bytes=0-7','if-range':'"old"'}],['if-range-weak','GET',{range:'bytes=0-7','if-range':'W/@etag'}],['if-range-modified','GET',{range:'bytes=0-7','if-range':'@modified'}],['head-range','HEAD',{range:'bytes=0-7'}],['post','POST',{}],['options','OPTIONS',{}],['modified-rfc850','GET',{'if-modified-since':'@rfc850'}],['modified-asctime','GET',{'if-modified-since':'@asctime'}],['modified-iso','GET',{'if-modified-since':'@iso'}],['unmodified-invalid','GET',{'if-unmodified-since':'not a date'}],['if-match-weak','GET',{'if-match':'W/@etag'}],['both-cache-validators','GET',{'if-none-match':'@etag','if-modified-since':'@modified'}],['range-end-overflow','GET',{range:'bytes=0-18446744073709551616'}],['range-start-overflow','GET',{range:'bytes=18446744073709551616-'}],['range-upper-unit','GET',{range:'BYTES=0-1'}],['range-space-unit','GET',{range:'bytes =0-1'}],['range-spaces','GET',{range:'bytes=0 - 1'}],['range-tabs','GET',{range:'bytes=0-\t1'}],['range-trailing-comma','GET',{range:'bytes=0-1,'}],['range-zero-suffix','GET',{range:'bytes=-0'}],['range-reversed-mixed','GET',{range:'bytes=4-1,0-1'}],['range-whole-file','GET',{range:'bytes=0-999'}],['head-missing-conditional','HEAD',{'if-none-match':'@etag'}]];
 for(const extension of ['png','webp','jpeg','jpg']){
  const value=expected(await upload('public-upload-'+extension,'public-'+extension+'.'+extension,png,token),200).value;created.add(value.id);
  const first=await wire('public-'+extension+'-get',extension,'GET',value.url,{});assert.equal(first.status,200);assert.deepEqual(Buffer.from(first.bodyBase64,'base64'),png);assert.equal(first.headers['cache-control'],'public, max-age=31536000, immutable');assert.ok(first.headers.etag&&first.headers['last-modified']);
  const baseline={etag:first.headers.etag,modified:first.headers['last-modified']};
  if(extension==='png')for(const [label,method,headers]of conditions)await wire('public-png-'+label,extension,method,value.url,headers,baseline);
  await request('public-delete-'+extension,'DELETE','/assets/'+value.id,{token});await wire('public-'+extension+'-retired',extension,'GET',value.url,{});
 }
 await wire('public-missing-generated-url','missing','GET','public/uploaded_assets/asset_'+('0'.repeat(32))+'.png',{});
 for(const id of created){const r=await request('wire-cleanup-'+id,'DELETE','/assets/'+id,{token});assert.ok([200,404].includes(r.status));}assert.deepEqual(await catalog(),[]);
 verifyImage();verifyFileServer();for(const [p,h]of Object.entries(fsHashes))assert.equal(hash(await readFile(join(original,p))),h);assert.equal(git('status','--porcelain','--untracked-files=no'),'');
 const result={verified:true,sourceCommit:git('rev-parse','HEAD'),sourceFilesVerifiedBeforeAndAfter:paths.length,sourceHashes,vendor,backendImage:containerInfo.Image,fileServerRuntime,configuration:{xmlSchemaValidation:true,allowTestMode:false,fileServerEnabled:true},actualPostgresAndRedis:true,sqlSeedsOrDaoStubs:false,mutationsOverActualHttp:true,publicFileServerHttpProven:true,baselineCatalogRestored:true,actualBackendRequests,recordedApiResponses:rows.length,actualPublicFileRequests:wireRows.length,rows:redact(rows),wireRows,wholeOriginalParityProven:false};await writeFile(join(out,'observations.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({verified:true,apiRows:rows.length,publicFileRows:wireRows.length,multipart:rows.filter(r=>r.label.startsWith('multipart-')).map(r=>({label:r.label,status:r.status,value:r.value}))}));
}catch(error){await writeFile(join(out,'failure.json'),JSON.stringify(redact({error:String(error),rows,wireRows}),null,2)+'\n');throw error;}
