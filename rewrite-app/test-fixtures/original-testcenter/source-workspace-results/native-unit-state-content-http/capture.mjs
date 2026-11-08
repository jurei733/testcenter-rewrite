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

const password='Owned source protected password',adminPassword='owned-source-super-secret',aliases=new Map([[password,'[owned-password]'],[adminPassword,'[owned-admin-password]']]),rows=[];
const register=v=>{if(v&&typeof v==='object')for(const[k,x]of Object.entries(v)){if(/^(token|groupToken|salt|signature)$/i.test(k)&&typeof x==='string'&&!aliases.has(x))aliases.set(x,'[owned-'+k+'-'+aliases.size+']');else register(x);}};
const redact=v=>{if(typeof v==='string'){for(const[s,a]of [...aliases].sort((a,b)=>b[0].length-a[0].length))v=v.replaceAll(s,a);return v;}if(Array.isArray(v))return v.map(redact);if(v&&typeof v==='object')return Object.fromEntries(Object.entries(v).map(([k,x])=>[k,redact(x)]));return v;};
const request=async(label,method,path,{body,token}={})=>{
 const r=await fetch(base+path,{method,headers:{Accept:'application/json',...(token===undefined?{}:{AuthToken:token}),...(body!==undefined&&!(body instanceof FormData)?{'Content-Type':'application/json'}:{})},...(body===undefined?{}:{body:body instanceof FormData?body:JSON.stringify(body)}),signal:AbortSignal.timeout(20000)});
 const bytes=Buffer.from(await r.arrayBuffer());let value;try{value=JSON.parse(bytes.toString());}catch{value=bytes.toString();}register(value);
 const result={label,method,path,status:r.status,value,bodySha256:hash(bytes),contentType:r.headers.get('content-type'),errorId:r.headers.get('error-id'),testMode:r.headers.get('test-mode'),rawText:bytes.toString(),requestBody:body instanceof FormData?'[actual multipart upload]':body};rows.push(result);return result;
};
const solve=c=>{assert.equal(c.algorithm,'SHA-256');assert.ok(c.maxNumber<=1000000);for(let number=0;number<=c.maxNumber;number++)if(hash(c.salt+number)===c.challenge)return{algorithm:c.algorithm,challenge:c.challenge,salt:c.salt,signature:c.signature,number};assert.fail('Actual Source ALTCHA has no bounded solution');};

const containerInfo=JSON.parse(execFileSync('docker',['inspect',container],{encoding:'utf8'}))[0];
assert.equal(containerInfo.Image,'sha256:d7045f22e834e2907ed39b5f8c99eed3d81f37643c50c3f66746e3f654381328');
assert.ok(containerInfo.Config.Env.includes('XML_SCHEMA_VALIDATION=true'));
assert.ok(containerInfo.Config.Env.includes('ALLOW_TEST_MODE=false'));
const entry=(key,content,timeStamp=200)=>({key,content,timeStamp});
const modern=newState=>({originalUnitId:'OWNED.R90.ORIGINAL',newState});
const cases=[
 ['string',modern([entry('STATE','Owned changed Ω /')])],
 ['json-string',modern([entry('STATE','{"answer":"Ω","path":"/owned","nested":[1,true]}')])],
 ['empty-string',modern([entry('STATE','')])],
 ['object',modern([entry('STATE',{answer:'Ω',nested:{path:'/owned',list:[1,true]}})])],
 ['empty-object',modern([entry('STATE',{})])],
 ['array',modern([entry('STATE',['Owned',{answer:'Ω'}])])],
 ['empty-array',modern([entry('STATE',[])])],
 ['integer',modern([entry('STATE',7)])],
 ['zero',modern([entry('STATE',0)])],
 ['float',modern([entry('STATE',0.5)])],
 ['boolean-true',modern([entry('STATE',true)])],
 ['boolean-false',modern([entry('STATE',false)])],
 ['null',modern([entry('STATE',null)])],
 ['missing-content',modern([{key:'STATE',timeStamp:200}])],
 ['object-stale',modern([entry('STATE',{stale:'Owned'},50)])],
 ['string-stale',modern([entry('STATE','Owned stale',50)])],
 ['object-then-string',modern([entry('STATE',{owned:'first'}),entry('OTHER','Owned other',201)])],
 ['string-then-object',modern([entry('OTHER','Owned other'),entry('STATE',{owned:'second'},201)])],
 ['object-then-missing',modern([entry('STATE',{owned:'first'}),{key:'OTHER',timeStamp:201}])],
 ['legacy-string',[entry('STATE','Owned legacy Ω')]],
 ['duplicate-clocks',modern([entry('STATE','Owned lower',200),entry('STATE','Owned higher',300),entry('STATE','Owned stale',250)])],
 ['prototype-key',modern([entry('__proto__','Owned proto'),entry('constructor','Owned constructor',201)])]
];
const tag=Date.now().toString(36),participants=cases.map(([label])=>'owned-state-r90-'+tag+'-'+label);
let workspace;const outcomes=[];
try{
 const configuration=await request('configuration','GET','/system/config');assert.equal(configuration.status,200);
 const admin=await request('admin','PUT','/session/admin',{body:{name:'super',password:adminPassword}});assert.equal(admin.status,200);const adminToken=admin.value.token;
 const created=await request('workspace','PUT','/workspace',{token:adminToken,body:{name:'Owned STATE R90 '+tag}});assert.equal(created.status,201);workspace=Number(created.value);
 const existing=await request('existing-grants','GET','/user/'+admin.value.id+'/workspaces',{token:adminToken});assert.equal(existing.status,200);
 const selected=existing.value.filter(row=>row.selected).map(row=>({id:row.id,role:row.role}));
 const grant=await request('grant','PATCH','/user/'+admin.value.id+'/workspaces',{token:adminToken,body:{ws:[...selected.filter(row=>Number(row.id)!==workspace),{id:workspace,role:'RW'}]}});assert.equal(grant.status,200);
 const schema='https://raw.githubusercontent.com/verona-interfaces/metadata/master/verona-module-metadata.json';
 const player='<html><script type="application/ld+json">'+JSON.stringify({$schema:schema,id:'owned-state-player',version:'1.0.0',specVersion:'6.0',type:'player',name:[{lang:'de',value:'Owned STATE Player'}],description:[]})+'</script><main>Owned inert Player</main></html>';
 const xml=(type,repo,body)=>'<'+type+' xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="https://w3id.org/iqb/spec/'+repo+'">'+body+'</'+type+'>';
 const unit=xml('Unit','unit-xml/17.6','<Metadata><Id>OWNED.STATE.UNIT</Id><Label>Owned state Unit</Label></Metadata><Definition player="owned-state-player@1.0.0">Owned state definition</Definition>');
 const book=xml('Booklet','testcenter-booklet-xml/18.0','<Metadata><Id>OWNED.STATE.BOOK</Id><Label>Owned state Booklet</Label></Metadata><Units><Unit id="OWNED.STATE.UNIT" label="Owned state Unit"/></Units>');
 const roster=xml('Testtakers','testcenter-testtaker-xml/18.0','<Metadata/><Group id="R90.'+tag.toUpperCase()+'" label="Owned state group">'+participants.map(name=>'<Login name="'+name+'" mode="run-hot-return"><Booklet>OWNED.STATE.BOOK</Booklet></Login>').join('')+'</Group>');
 const inputs={cases:cases.map(([label,body])=>({label,body})),files:[['owned-state-player-1.0.html',player],['owned-state-unit.xml',unit],['owned-state-book.xml',book],['owned-state-people.xml',roster]].map(([name,source])=>({name,base64:Buffer.from(source).toString('base64'),sha256:hash(source)}))};
 await writeFile(join(out,'inputs.json'),JSON.stringify(inputs,null,2)+'\n');
 for(const file of inputs.files){const form=new FormData();form.append('fileforvo[]',new Blob([Buffer.from(file.base64,'base64')],{type:file.name.endsWith('.html')?'text/html':'application/xml'}),file.name);const result=await request('upload-'+file.name,'POST','/workspace/'+workspace+'/file',{token:adminToken,body:form});assert.ok([201,207].includes(result.status),JSON.stringify(redact(result)));assert.deepEqual(Object.values(result.value).flatMap(row=>row.error??[]),[],JSON.stringify(redact(result)));}
 for(let i=0;i<cases.length;i++){
  const [label,body]=cases[i],loginName=participants[i];
  const person=await request(label+'-login','PUT','/session/login',{body:{name:loginName,password:''}});assert.equal(person.status,200);const token=person.value.token;
  const test=await request(label+'-test','PUT','/test',{token,body:{bookletName:'OWNED.STATE.BOOK'}});assert.equal(test.status,201);const testId=test.value;
  const path='/test/'+testId+'/unit/OWNED.STATE.UNIT';
  const initialized=await request(label+'-baseline','PATCH',path+'/state',{token,body:modern([entry('STATE','Owned baseline',100)])});assert.equal(initialized.status,200);
  const before=await request(label+'-before','GET',path,{token});assert.equal(before.status,200);
  const logsBefore=await request(label+'-logs-before','GET','/workspace/'+workspace+'/report/log',{token:adminToken});assert.equal(logsBefore.status,200);
  const result=await request(label+'-attempt','PATCH',path+'/state',{token,body});
  const after=await request(label+'-after','GET',path,{token});assert.equal(after.status,200);
  const logsAfter=await request(label+'-logs-after','GET','/workspace/'+workspace+'/report/log',{token:adminToken});assert.equal(logsAfter.status,200);
  const ownLogs=rows=>rows.filter(row=>row.loginname===loginName);
  outcomes.push({label,status:result.status,errorBody:result.status>=400?result.value:null,before:before.value.state,after:after.value.state,stateChanged:JSON.stringify(before.value.state)!==JSON.stringify(after.value.state),logsBefore:ownLogs(logsBefore.value),logsAfter:ownLogs(logsAfter.value),beforeSha256:before.bodySha256,afterSha256:after.bodySha256});
  await writeFile(join(out,'progress.json'),JSON.stringify(redact({rows,outcomes}),null,2)+'\n');
  console.log(JSON.stringify({label,status:result.status,stateChanged:outcomes.at(-1).stateChanged,logDelta:outcomes.at(-1).logsAfter.length-outcomes.at(-1).logsBefore.length}));
 }
 verifyImage();assert.equal(git('status','--porcelain','--untracked-files=no'),'');
 const result={verified:true,sourceCommit:git('rev-parse','HEAD'),sourceHashes,sourceFilesVerifiedBeforeAndAfter:paths.length,vendor,backendImage:containerInfo.Image,configuration:{xmlSchemaValidation:true,allowTestMode:false,ownedDedicatedStack:true},workspace,actualPostgresAndRedis:true,sqlSeedsOrDaoStubs:false,mutationsOverActualHttp:true,rows:redact(rows),outcomes:redact(outcomes),wholeOriginalParityProven:false};
 await writeFile(join(out,'observations.json'),JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify({verified:true,rows:rows.length,cases:outcomes.length}));
}catch(error){await writeFile(join(out,'failure.json'),JSON.stringify(redact({error:String(error),workspace,rows,outcomes}),null,2)+'\n');throw error;}
