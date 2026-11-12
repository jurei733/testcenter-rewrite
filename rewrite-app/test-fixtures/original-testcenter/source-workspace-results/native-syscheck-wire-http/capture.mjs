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

let token,workspace;const assets=[];
const xml=(type,body)=>'<'+type+' xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="https://w3id.org/iqb/spec/'+({Unit:'unit-xml/17.6',Booklet:'testcenter-booklet-xml/18.0',Testtakers:'testcenter-testtaker-xml/18.0',SysCheck:'testcenter-syscheck-xml/18.0'}[type])+'">'+body+'</'+type+'>';
try{
 const root=(await send('admin','PUT','/session/admin',{body:{name:'super',password:adminPassword}})).value;token=root.token;
 const grants=(await send('initial-grants','GET','/user/'+root.id+'/workspaces',{token})).value.filter(r=>r.selected).map(r=>({id:r.id,role:r.role}));
 workspace=Number((await send('workspace','PUT','/workspace',{token,body:{name:'Owned R98 Theme'}},201)).value);
 await send('grant-workspace','PATCH','/user/'+root.id+'/workspaces',{token,body:{ws:[...grants,{id:workspace,role:'RW'}]}});
 const upload=async(name,text)=>{const body=new FormData();body.append('fileforvo[]',new Blob([text],{type:'application/xml'}),name);const r=await request('upload-'+name,'POST','/workspace/'+workspace+'/file',{token,body});assert.ok([201,207].includes(r.status));assert.deepEqual(Object.values(r.value).flatMap(v=>v.error??[]),[],JSON.stringify(redact(r)));};
 const metadata={$schema:'https://raw.githubusercontent.com/verona-interfaces/metadata/master/verona-module-metadata.json',id:'owned-theme-player',version:'1.0.0',specVersion:'6.0',metadataVersion:'2.0',type:'player',name:[{lang:'de',value:'Owned theme Player'}]};
 await upload('owned-theme-player-1.0.html','<html><script type="application/ld+json">'+JSON.stringify(metadata)+'</script></html>');
 await upload('unit.xml',xml('Unit','<Metadata><Id>R98.UNIT</Id><Label>Owned</Label></Metadata><Definition player="owned-theme-player-1.0">Owned</Definition>'));
 await upload('booklet.xml',xml('Booklet','<Metadata><Id>R98.BOOK</Id><Label>Owned Theme Book</Label></Metadata><Units><Unit id="R98.UNIT" label="Owned"/></Units>'));
 await upload('booklet2.xml',xml('Booklet','<Metadata><Id>R98.BOOK2</Id><Label>Owned Theme Book2</Label></Metadata><Units><Unit id="R98.UNIT" label="Owned"/></Units>'));
 await upload('syscheck.xml',xml('SysCheck','<Metadata><Id>R98.CHECK</Id><Label>Owned Theme Check</Label></Metadata><Config skipnetwork="true"><Q id="owned" type="string" prompt="Owned"/></Config>'));
 for(const name of ['global','group','user']){const body=new FormData();body.append('file',new Blob([png],{type:'image/png'}),'owned-r98-'+name+'.png');assets.push((await send('asset-'+name,'POST','/assets',{token,body})).value);}
 await send('global-assets','POST','/asset-assignments',{token,body:{assignments:[{slotName:'logo',assetID:assets[0].id}]}});
 const assignment=asset=>'<AssetAssignments><Asset slot="logo">'+asset.originalName+'</Asset></AssetAssignments>';
 const loginXml=(name,theme,mode='run-hot-return')=>'<Login name="'+name+'" pw="owned-r98-theme-password" mode="'+mode+'">'+(mode==='run-hot-return'?'<Booklet codes="c1">R98.BOOK</Booklet><Booklet codes="c1">R98.BOOK2</Booklet>':mode==='monitor-group'?'<Profile id="full"/>':'')+(theme==='Primar'?assignment(assets[2]):'')+(theme?'<ViewSettings><theme>'+theme+'</theme></ViewSettings>':'')+'</Login>';
 const roster=xml('Testtakers','<Metadata/><Profiles><GroupMonitor><Profile id="full" label="Owned" view="full"/></GroupMonitor></Profiles><Group id="R98.GROUP" label="Owned Theme Group">'+assignment(assets[1])+['','Primar','Sekundar','Erwachsene'].map(theme=>loginXml('r98-'+(theme||'global').toLowerCase(),theme)).join('')+loginXml('r98-monitor','Primar','monitor-group')+loginXml('r98-syscheck','Sekundar','sys-check-login')+'</Group>');
 await upload('people.xml',roster);
 const logins={};for(const name of ['r98-global','r98-primar','r98-sekundar','r98-erwachsene','r98-monitor','r98-syscheck']){const value=await login('auth-'+name,name);logins[name]=value;await send('asset-scope-'+name,'GET','/asset-assignments',{token:value.token});}

 const actor=logins['r98-syscheck'];
 await send('syscheck-person-read','GET','/session',{token:actor.token});
 await login('syscheck-new-login','r98-syscheck');
 const config='/workspace/'+workspace+'/sys-check/R98.CHECK';
 for(const [label,credential]of [['anonymous',undefined],['empty',''],['syscheck',actor.token],['participant-login',logins['r98-global'].token],['monitor',logins['r98-monitor'].token],['admin',token],['invalid','owned-invalid-token']]){
  await request('config-'+label,'GET',config,{token:credential});
  await request('unit-'+label,'GET',config+'/unit-and-player',{token:credential});
 }
 await upload('syscheck-unit.xml',xml('SysCheck','<Metadata><Id>R99.UNITCHECK</Id><Label>Owned Unit Check</Label><Description>Owned description</Description></Metadata><Config unit="R98.UNIT" savekey="owned-key" skipnetwork="false"><CustomText key="syscheck_intro">Owned intro</CustomText><Q id="yes" type="check" prompt="Owned check" required="true"/><Q id="radio" type="radio" prompt="Owned radio">A#B</Q></Config>'));
 await send('session-after-new-check','GET','/session',{token:actor.token});
 await request('config-with-unit','GET','/workspace/'+workspace+'/sys-check/R99.UNITCHECK',{token:actor.token});
 await request('unit-with-player','GET','/workspace/'+workspace+'/sys-check/R99.UNITCHECK/unit-and-player',{token:actor.token});
 const report={keyPhrase:'owned-wrong-key',title:'Must not become actor title',environment:[],network:[],questionnaire:[],unit:[],responses:[]};
 await request('save-own-no-save-key-authenticated','PUT',config+'/report',{token:actor.token,body:report});
 await request('save-own-check-with-key-authenticated','PUT','/workspace/'+workspace+'/sys-check/R99.UNITCHECK/report',{token:actor.token,body:report});
 await request('save-key-anonymous-wrong','PUT','/workspace/'+workspace+'/sys-check/R99.UNITCHECK/report',{body:report});
 await request('save-key-anonymous-correct','PUT','/workspace/'+workspace+'/sys-check/R99.UNITCHECK/report',{body:{...report,keyPhrase:'OWNED-KEY',title:'Owned anonymous'}});
 await request('save-as-monitor-source-counterexample','PUT','/workspace/'+workspace+'/sys-check/R99.UNITCHECK/report',{token:logins['r98-monitor'].token,body:report});
 await request('config-missing','GET','/workspace/'+workspace+'/sys-check/MISSING',{token:actor.token});
 await upload('syscheck-speed.xml',xml('SysCheck','<Metadata><Id>R100.SPEEDCHECK</Id><Label>Owned Speed Check</Label></Metadata><Config savekey="0" skipnetwork="1"><UploadSpeed min="9007199254740993" good="9007199254740994" maxErrorsPerSequence="2">100, 200,300</UploadSpeed><DownloadSpeed min="1"/><CustomText key="syscheck_intro">  Owned spaced intro  </CustomText><CustomText key="future">Owned second text</CustomText><Q id="radio" type="radio" prompt="Owned lexical boolean" required="1"> A # B # </Q></Config>'));
 await request('config-speed-lexical','GET','/workspace/'+workspace+'/sys-check/R100.SPEEDCHECK',{token:actor.token});
 await request('config-head','HEAD','/workspace/'+workspace+'/sys-check/R99.UNITCHECK',{token:actor.token});
 await request('unit-head','HEAD','/workspace/'+workspace+'/sys-check/R99.UNITCHECK/unit-and-player',{token:actor.token});
 await request('config-post-method','POST','/workspace/'+workspace+'/sys-check/R99.UNITCHECK',{token:actor.token,body:{}});
 await request('save-key-zero-anonymous','PUT','/workspace/'+workspace+'/sys-check/R100.SPEEDCHECK/report',{body:{...report,keyPhrase:'0'}});
 await request('save-key-space-anonymous','PUT','/workspace/'+workspace+'/sys-check/R99.UNITCHECK/report',{body:{...report,keyPhrase:' OWNED-KEY '}});
 await request('save-empty-date-zero-responses','PUT','/workspace/'+workspace+'/sys-check/R100.SPEEDCHECK/report',{token:actor.token,body:{...report,date:'',responses:'0'}});
 await request('save-zero-title-date-responses','PUT','/workspace/'+workspace+'/sys-check/R99.UNITCHECK/report',{body:{...report,keyPhrase:'OWNED-KEY',title:'0',date:'0',responses:'0'}});
 const bom='\uFEFF';
 await upload('owned-bom-player-1.0.html',bom+'<html><script type="application/ld+json">'+JSON.stringify({...metadata,id:'owned-bom-player'})+'</script></html>');
 await upload('owned-bom-definition.json',bom+'{"owned":"ä","value":"exact"}');
 await upload('unit-bom.xml',xml('Unit','<Metadata><Id>R100.BOM.UNIT</Id><Label>Owned referenced Unit</Label></Metadata><DefinitionRef player="owned-bom-player-1.0">owned-bom-definition.json</DefinitionRef>'));
 await upload('syscheck-bom.xml',xml('SysCheck','<Metadata><Id>R100.BOMCHECK</Id><Label>Owned reference Check</Label></Metadata><Config unit="R100.BOM.UNIT"/>'));
 await request('config-definition-ref','GET','/workspace/'+workspace+'/sys-check/R100.BOMCHECK',{token:actor.token});
 await request('unit-definition-ref-bom','GET','/workspace/'+workspace+'/sys-check/R100.BOMCHECK/unit-and-player',{token:actor.token});
 const php='$r=[];foreach(glob("/var/www/testcenter/data/ws_*/SysCheck/reports/*.json") as $p){$r[basename($p)]=json_decode(file_get_contents($p),true);}echo json_encode($r);';
 const persistedReports=JSON.parse(execFileSync('docker',['exec',container,'php','-r',php],{encoding:'utf8'}));
 await send('logout-syscheck','DELETE','/session',{token:actor.token},205);
 await request('session-after-logout','GET','/session',{token:actor.token});
 await request('assets-after-logout','GET','/asset-assignments',{token:actor.token});
 verifyImage();assert.equal(git('status','--porcelain','--untracked-files=no'),'');
 await writeFile(join(out,'observations.json'),JSON.stringify({sourceCommit:git('rev-parse','HEAD'),sourceHashes,vendor,backendImage:containerInfo.Image,configuration:{xmlSchemaValidation:true,allowTestMode:false,bruteForceProtection:'login person'},actualSourceBackend:true,actualSourceFrontend:false,sqlSeedsOrDaoStubs:false,roster,rows:redact(rows),persistedReports:redact(persistedReports),sourceUnsafeCounterexample:'Source accepts report writes by a monitor person and even when no report save key is configured. Preserve Rewrite dedicated actor/workspace/canSave guards.',wholeOriginalParityProven:false},null,2)+'\n');
 console.log(JSON.stringify({success:true,rows:rows.length,persistedReports:Object.keys(persistedReports).length}));
}catch(error){await writeFile(join(out,'failure.json'),JSON.stringify(redact({error:String(error),rows}),null,2)+'\n');throw error;}
