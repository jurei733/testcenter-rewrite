import {crc32} from 'node:zlib';
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


const adminPassword='owned-source-super-secret',aliases=new Map([[adminPassword,'[owned-admin-password]']]),rows=[],inputs=[];
const register=value=>{if(value&&typeof value==='object')for(const[key,item]of Object.entries(value)){if(/^(token|groupToken|salt|signature)$/i.test(key)&&typeof item==='string'&&!aliases.has(item))aliases.set(item,'[owned-'+key+'-'+aliases.size+']');else register(item);}};
const redact=value=>{if(typeof value==='string'){for(const [secret,label]of [...aliases].sort((a,b)=>b[0].length-a[0].length))value=value.replaceAll(secret,label);return value;}if(Array.isArray(value))return value.map(redact);if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,redact(v)]));return value;};
const request=async(label,method,path,{body,token,raw=false}={})=>{
 const multipart=body instanceof FormData;const response=await fetch(base+path,{method,headers:{...(token===undefined?{}:{AuthToken:token}),Accept:'application/json',...(body===undefined||multipart?{}:{'Content-Type':'application/json'})},...(body===undefined?{}:{body:multipart?body:JSON.stringify(body)}),signal:AbortSignal.timeout(30_000)});
 const bytes=Buffer.from(await response.arrayBuffer());let value;try{value=JSON.parse(bytes.toString());}catch{value=bytes.toString();}register(value);
 rows.push(redact({label,method,path,status:response.status,contentType:response.headers.get('content-type'),bodySha256:hash(bytes),value,rawText:bytes.toString()}));return{status:response.status,value,bytes};
};
function zip(entries){
 const local=[],central=[];let offset=0;
 for(const [name,data]of entries){const bytes=Buffer.isBuffer(data)?data:Buffer.from(data),filename=Buffer.from(name);const crc=crc32(bytes);
  const a=Buffer.alloc(30);a.writeUInt32LE(0x04034b50);a.writeUInt16LE(20,4);a.writeUInt16LE(0x800,6);a.writeUInt32LE(crc,14);a.writeUInt32LE(bytes.length,18);a.writeUInt32LE(bytes.length,22);a.writeUInt16LE(filename.length,26);local.push(a,filename,bytes);
  const b=Buffer.alloc(46);b.writeUInt32LE(0x02014b50);b.writeUInt16LE(20,4);b.writeUInt16LE(20,6);b.writeUInt16LE(0x800,8);b.writeUInt32LE(crc,16);b.writeUInt32LE(bytes.length,20);b.writeUInt32LE(bytes.length,24);b.writeUInt16LE(filename.length,28);b.writeUInt32LE(offset,42);central.push(b,filename);offset+=a.length+filename.length+bytes.length;
 }
 const directory=Buffer.concat(central),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(entries.length,8);end.writeUInt16LE(entries.length,10);end.writeUInt32LE(directory.length,12);end.writeUInt32LE(offset,16);return Buffer.concat([...local,directory,end]);
}
const xml=(type,body)=>'<'+type+' xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="https://w3id.org/iqb/spec/'+(type==='Unit'?'unit-xml/17.6':type==='Booklet'?'testcenter-booklet-xml/18.0':'testcenter-testtaker-xml/18.0')+'">'+body+'</'+type+'>';
const player='<html><script type="application/ld+json">'+JSON.stringify({id:'source-r85-player',version:'1.0.0',specVersion:'6.0',metadataVersion:'2.0',type:'player',name:[{lang:'de',value:'Owned source ZIP Player'}],description:[{lang:'de',value:'Owned fixture'}]})+'</script><main>Owned root ZIP player</main></html>';
const unit=(id='R85.UNIT',text='Source root definition Ω')=>xml('Unit','<Metadata><Id>'+id+'</Id><Label>Root Unit</Label></Metadata><Definition player="source-r85-player@1.0.0">'+text+'</Definition>');
const booklet=xml('Booklet','<Metadata><Id>R85.BOOK</Id><Label>Root Booklet</Label></Metadata><Units><Unit id="R85.UNIT" alias="1" label="Root Unit"/></Units>');
const roster=label=>xml('Testtakers','<Metadata/><Group id="R85.'+label.toUpperCase()+'" label="Owned root group"><Login name="source-r85-'+label+'" mode="run-hot-return"><Booklet>R85.BOOK</Booklet></Login></Group>');
const workspaces=[];let adminToken,adminId;
const grant=async(id,role='RW')=>{const result=await request('grant-'+id+'-'+role,'PATCH','/user/'+adminId+'/workspaces',{token:adminToken,body:{ws:workspaces.map(ws=>({id:ws,role:ws===id?role:'RW'}))}});assert.equal(result.status,200);};
const workspace=async label=>{const result=await request('create-'+label,'PUT','/workspace',{token:adminToken,body:{name:'Owned R85 ZIP '+label}});assert.equal(result.status,201);const id=Number(result.value);workspaces.push(id);await grant(id);return id;};
const upload=async(label,id,entries,name=label+'.zip')=>{const bytes=zip(entries);inputs.push({label,name,archiveSha256:hash(bytes),archiveBytes:bytes.length,entries:entries.map(([name,data])=>({name,base64:Buffer.from(data).toString('base64'),sha256:hash(Buffer.from(data))}))});await writeFile(join(out,label+'.zip'),bytes);const form=new FormData();form.append('fileforvo[]',new Blob([bytes],{type:'application/zip'}),name);return request(label,'POST','/workspace/'+id+'/file',{token:adminToken,body:form});};
const files=(label,id)=>request(label,'GET','/workspace/'+id+'/files',{token:adminToken});
const download=(label,id,type,name)=>request(label,'GET','/workspace/'+id+'/file/'+type+'/'+encodeURIComponent(name),{token:adminToken,raw:true});
const env=JSON.parse(execFileSync('docker',['inspect',container],{encoding:'utf8'}))[0].Config.Env;assert.ok(env.includes('XML_SCHEMA_VALIDATION=true'));assert.ok(env.includes('ALLOW_TEST_MODE=false'));
try{
 assert.equal((await request('configuration','GET','/system/config')).status,200);
 const admin=await request('admin','PUT','/session/admin',{body:{name:'super',password:adminPassword}});assert.equal(admin.status,200);adminToken=admin.value.token;adminId=admin.value.id;
 const id=await workspace('all');
 const entries=[['nested/people.xml',roster('all')],['nested/books/book.xml',booklet],['nested/units/unit.xml',unit()],['nested/players/source-r85-player.html',player],['nested/raw.bin',Buffer.from([0,255,7])]];
 const all=await upload('all-shuffled',id,entries);assert.equal(all.status,201);await files('all-files',id);
 for(const [name,data]of entries){const basename=name.split('/').at(-1),type=name.includes('people')?'Testtakers':name.includes('/books/')?'Booklet':name.includes('/units/')?'Unit':'Resource';const result=await download('all-byte-'+type,id,type,basename);assert.equal(result.status,200);assert.equal(hash(result.bytes),hash(Buffer.from(data)));}
 const login=await request('all-participant-login','PUT','/session/login',{body:{name:'source-r85-all',password:''}});assert.equal(login.status,200);const actor=login.value.token;
 const test=await request('all-native-test-create','PUT','/test',{token:actor,body:{bookletName:'R85.BOOK'}});assert.equal(test.status,201);
 assert.equal((await request('all-native-test','GET','/test/'+test.value,{token:actor})).status,200);
 const read=await request('all-native-unit','GET','/test/'+test.value+'/unit/R85.UNIT/alias/1',{token:actor});assert.equal(read.status,200);assert.equal(read.value.definition,'Source root definition Ω');
 const mixed=await workspace('mixed');await upload('mixed',mixed,[['first.txt','independent'],['bad.xml','<Unit/>'],['book.xml',booklet],['unit.xml',unit()],['source-r85-player.html',player]]);await files('mixed-files',mixed);
 const duplicates=await workspace('duplicates');await upload('duplicates',duplicates,[['left/shared.bin','left'],['right/shared.bin','right'],['other.bin','keep']]);await files('duplicates-files',duplicates);await download('duplicates-shared',duplicates,'Resource','shared.bin');
 const nested=await workspace('nested');const inner=zip([['inside.txt','nested payload']]);await upload('nested',nested,[['plain.zip',inner],['pkg.itcr.zip',inner],['a/data.txt','plain payload']]);await files('nested-files',nested);assert.equal(hash((await download('nested-ordinary-zip',nested,'Resource','plain.zip')).bytes),hash(inner));await download('nested-installed-member',nested,'Resource','pkg/inside.txt');
 const overwrite=await workspace('overwrite');await upload('overwrite-initial',overwrite,[['source-r85-player.html',player],['unit.xml',unit()]]);await upload('overwrite-wrong-id',overwrite,[['unit.xml',unit('OTHER.UNIT','must not replace')],['unrelated.txt','retained']]);await files('overwrite-files',overwrite);assert.equal(hash((await download('overwrite-preserved-unit',overwrite,'Unit','unit.xml')).bytes),hash(Buffer.from(unit())));
 await upload('overwrite-same-id',overwrite,[['unit.xml',unit('R85.UNIT','new text')]]);assert.equal(hash((await download('overwrite-current-unit',overwrite,'Unit','unit.xml')).bytes),hash(Buffer.from(unit('R85.UNIT','new text'))));
 await grant(overwrite,'RO');const denied=await upload('read-only-denied',overwrite,[['forbidden.txt','forbidden']]);assert.equal(denied.status,403);await files('read-only-files',overwrite);
 verifyImage();assert.equal(git('status','--porcelain','--untracked-files=no'),'');
 const result={verified:true,sourceCommit:git('rev-parse','HEAD'),sourceFilesVerifiedBeforeAndAfter:paths.length,sourceHashes,vendor,backendImage:JSON.parse(execFileSync('docker',['inspect',container],{encoding:'utf8'}))[0].Image,
  configuration:{xmlSchemaValidation:true,allowTestMode:false,bruteForceProtection:['login','person'],staticTime:'now'},mutationsOverActualHttp:true,sqlSeedsOrDaoStubs:false,
  runtime:{php:execFileSync('docker',['exec',container,'php','-r','echo PHP_VERSION;'],{encoding:'utf8'}).trim(),postgres:execFileSync('docker',['exec','source-native-zip-r85-postgres-1','psql','-U','source_oracle','-d','source_oracle','-Atc','select version();'],{encoding:'utf8'}).trim(),redis:execFileSync('docker',['exec','source-native-zip-r85-redis-1','redis-server','--version'],{encoding:'utf8'}).trim()},rows};
 await writeFile(join(out,'observations.json'),JSON.stringify(result,null,2)+'\n');await writeFile(join(out,'inputs.json'),JSON.stringify(inputs,null,2)+'\n');console.log(JSON.stringify({verified:true,sourceFiles:paths.length,rows:rows.length,zipCases:inputs.length,statuses:rows.filter(row=>row.method==='POST').map(({label,status,value})=>({label,status,report:value}))}));
}catch(error){await writeFile(join(out,'failure.json'),JSON.stringify({error:String(error),rows,inputs},null,2)+'\n');throw error;}
