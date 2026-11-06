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
const workspace=async label=>{const result=await request('create-'+label,'PUT','/workspace',{token:adminToken,body:{name:'Owned R86 reports '+label+' '+Date.now()}});assert.equal(result.status,201);const id=Number(result.value);workspaces.push(id);await grant(id);return id;};
const upload=async(label,id,entries,name=label+'.zip')=>{const bytes=zip(entries);inputs.push({label,name,archiveSha256:hash(bytes),archiveBytes:bytes.length,entries:entries.map(([name,data])=>({name,base64:Buffer.from(data).toString('base64'),sha256:hash(Buffer.from(data))}))});await writeFile(join(out,label+'.zip'),bytes);const form=new FormData();form.append('fileforvo[]',new Blob([bytes],{type:'application/zip'}),name);return request(label,'POST','/workspace/'+id+'/file',{token:adminToken,body:form});};
const files=(label,id)=>request(label,'GET','/workspace/'+id+'/files',{token:adminToken});
const download=(label,id,type,name)=>request(label,'GET','/workspace/'+id+'/file/'+type+'/'+encodeURIComponent(name),{token:adminToken,raw:true});
const env=JSON.parse(execFileSync('docker',['inspect',container],{encoding:'utf8'}))[0].Config.Env;assert.ok(env.includes('XML_SCHEMA_VALIDATION=true'));assert.ok(env.includes('ALLOW_TEST_MODE=false'));
const ownedRunTag=Date.now().toString(36);
const metadataSchema='https://raw.githubusercontent.com/verona-interfaces/metadata/master/verona-module-metadata.json';
const html=(id,version='1.0.0',spec='6.0',mode='current')=>{
 const meta=mode==='legacy'?'<meta name="application-name" content="'+id+'" data-version="'+version+'" data-api-version="'+spec+'">':
 '<script type="application/ld+json">'+JSON.stringify(mode==='context'?{'@context':'https://w3id.org/iqb/verona-modules','@id':id,'@type':'player',version,apiVersion:spec,name:{de:'Owned'},description:{de:'Owned'}}:{$schema:metadataSchema,id,version,specVersion:spec,type:'player',name:[{lang:'de',value:'Owned'}],description:[{lang:'de',value:'Owned'}]})+'</script>';
 return '<!doctype html><html><head><title>Owned Player</title>'+meta+'</head><body>Owned player</body></html>';
};
const unitFor=(id='R86.UNIT',extra='',player='owned-player@1.0.0')=>xml('Unit','<Metadata><Id>'+id+'</Id><Label>Owned Unit</Label></Metadata><Definition player="'+player+'">Owned definition</Definition>'+extra);
const bookletFor=id=>xml('Booklet','<Metadata><Id>'+id+'</Id><Label>Owned Book</Label></Metadata><Units><Unit id="R86.UNIT" label="Owned Unit"/></Units>');
try{
 const admin=await request('admin-r86','PUT','/session/admin',{body:{name:'super',password:adminPassword}});assert.equal(admin.status,200);adminToken=admin.value.token;adminId=admin.value.id;
 const full=await workspace('r86-full');
 await upload('complete-warnings',full,[['people.xml',roster('r86-'+ownedRunTag).replaceAll('R85.BOOK','R86.BOOK')],['book.xml',bookletFor('R86.BOOK')],['unit.xml',unitFor('R86.UNIT','<Dependencies><File>reading.txt</File></Dependencies>')],['owned-player-1.0.html',html('owned-player')],['reading.txt','read'],['unused.bin','unused']]);await files('complete-files',full);
 await upload('replace-unit',full,[['unit.xml',unitFor('R86.UNIT','<Dependencies><File>reading.txt</File></Dependencies>')]]);
 await upload('replace-player',full,[['owned-player-1.0.html',html('owned-player','1.0.1')]]);
 const metadata=await workspace('r86-metadata');
 await upload('metadata-forms',metadata,[['legacy-player-1.0.html',html('legacy-player','1.0.0','3.0','legacy')],['context-player-1.0.html',html('context-player','1.0.0','3.5','context')],['nonstandard.html',html('renamed-player')],['plain.html','<html><body>plain</body></html>'],['missing-schema.html',player],['oldver-player-1.0.html',html('oldver-player','1.0.0','1.0')],['outer.itcr.zip',zip([['folder/',''],['folder/a.txt','a']])]]);await files('metadata-files',metadata);
 const bad=await workspace('r86-errors');
 await upload('missing-dependencies',bad,[['unit.xml',unitFor('R86.UNIT','<Dependencies><File>missing.txt</File></Dependencies>','missing-player@1.0.0')],['book.xml',bookletFor('R86.BOOK')],['people.xml',roster('r86bad-'+ownedRunTag).replaceAll('R85.BOOK','R86.BOOK')],['independent.bin','keep'],['bad-root.xml','<Unknown/>'],['bad-schema.xml','<Unit/>']]);await files('errors-files',bad);
 const dup=await workspace('r86-duplicates');
 await upload('duplicate-ids',dup,[['owned-player-1.0.html',html('owned-player')],['first.xml',unitFor()],['second.xml',unitFor()]]);await files('duplicate-files',dup);
 const deprecated=await workspace('r86-deprecated');
 const deprecatedUnit=xml('Unit','<Metadata><Id>R86.DEPRECATED</Id><Label>Owned Unit</Label><Lastchange>2026-01-01T00:00:00Z</Lastchange></Metadata><Definition player="owned-player@1.0.0" type="old-type">Owned definition</Definition><BaseVariables><Variable id="photo" type="attachment" format="image"/></BaseVariables><Dependencies>'+Array.from({length:7},()=>'<file>reading.txt</file>').join('')+'</Dependencies>');
 await upload('deprecated-unit',deprecated,[['owned-player-1.0.html',html('owned-player')],['reading.txt','read'],['deprecated.xml',deprecatedUnit]]);await files('deprecated-files',deprecated);
 verifyImage();assert.equal(git('status','--porcelain','--untracked-files=no'),'');
 const result={verified:true,sourceCommit:git('rev-parse','HEAD'),sourceFilesVerifiedBeforeAndAfter:paths.length,sourceHashes,vendor,backendImage:JSON.parse(execFileSync('docker',['inspect',container],{encoding:'utf8'}))[0].Image,configuration:{xmlSchemaValidation:true,allowTestMode:false},sqlSeedsOrDaoStubs:false,mutationsOverActualHttp:true,rows};
 await writeFile(join(out,'observations.json'),JSON.stringify(result,null,2)+'\n');await writeFile(join(out,'inputs.json'),JSON.stringify(inputs,null,2)+'\n');console.log(JSON.stringify({verified:true,rows:rows.length,uploads:rows.filter(row=>row.method==='POST').map(({label,status,value})=>({label,status,value}))}));
}catch(error){await writeFile(join(out,'failure.json'),JSON.stringify({error:String(error),rows,inputs},null,2)+'\n');throw error;}
