import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
const out=process.env.ORIGINAL_ADMIN_OUTPUT_DIR,original=process.env.ORIGINAL_ADMIN_SOURCE_ROOT;
assert.ok(out&&original);await mkdir(out,{recursive:true});
const containers={open:'source-native-admin-session-r58-backend-1',protected:'source-native-admin-session-r58-backend-protected-1'};
const postgres='source-native-admin-session-r58-postgres-1',redis='source-native-admin-session-r58-redis-1';
const bases=Object.fromEntries(Object.entries(containers).map(([key,name])=>{const port=execFileSync('docker',['port',name,'8080'],{encoding:'utf8'}).trim();assert.match(port,/^127\.0\.0\.1:\d+$/);return[key,'http://'+port];}));
const hash=b=>createHash('sha256').update(b).digest('hex'),git=(...a)=>execFileSync('git',['-C',original,...a],{encoding:'utf8'}).trim();
assert.equal(git('rev-parse','HEAD'),'eedae41840cbe90e5547c0211da818bdf620f5aa');assert.equal(git('status','--porcelain','--untracked-files=no'),'');
const paths=git('ls-files','backend/src','backend/index.php','backend/routes.php','backend/initialize.php','definitions/testtaker','scripts/database/full.sql').split('\n');
const sourceHashes=Object.fromEntries(await Promise.all(paths.map(async p=>[p,hash(await readFile(join(original,p)))])));
const verifyImages=()=>{for(const name of Object.values(containers)){
 const php='$paths=json_decode(stream_get_contents(STDIN),true,512,JSON_THROW_ON_ERROR);$out=[];foreach($paths as $p){$f="/var/www/testcenter/".$p;if(!is_file($f))throw new RuntimeException("Missing pinned source: ".$p);$out[$p]=hash_file("sha256",$f);}echo json_encode($out,JSON_THROW_ON_ERROR);';
 assert.deepEqual(JSON.parse(execFileSync('docker',['exec','-i',name,'php','-r',php],{encoding:'utf8',input:JSON.stringify(paths)})),sourceHashes);
}};verifyImages();
const lockBytes=await readFile(join(original,'backend/composer.lock')),lock=JSON.parse(lockBytes),vendors=[];
for(const name of Object.values(containers)){
 const bytes=execFileSync('docker',['exec',name,'php','-r','echo file_get_contents("/var/www/testcenter/backend/vendor/composer/installed.json");']);
 const installed=JSON.parse(bytes),known=new Map([...lock.packages,...lock['packages-dev']].map(p=>[p.name,p]));
 for(const p of installed.packages){assert.ok(known.has(p.name));assert.equal(p.version,known.get(p.name).version);assert.equal(p.source?.reference,known.get(p.name).source?.reference);}
 for(const p of lock.packages)assert.ok(installed.packages.some(i=>i.name===p.name));
 vendors.push({containerRole:name===containers.open?'open':'protected',installedPackages:installed.packages.length,requiredProductionPackages:lock.packages.length,installedMetadataSha256:hash(bytes)});
}
const rootPassword='owned-source-super-secret',password='Owned native admin password Ω',newPassword='Changed owned admin password β';
const aliases=new Map([[rootPassword,'[owned-root-password]'],[password,'[owned-password]'],[newPassword,'[owned-new-password]']]),rows=[],sql=[];
const register=value=>{if(value&&typeof value==='object')for(const[k,v]of Object.entries(value)){if(/^(token|groupToken|salt|signature)$/i.test(k)&&typeof v==='string'&&!aliases.has(v))aliases.set(v,'[owned-'+k+'-'+aliases.size+']');else register(v);}};
const redact=value=>{if(typeof value==='string'){for(const[s,a]of [...aliases].sort((a,b)=>b[0].length-a[0].length))value=value.replaceAll(s,a);return value;}if(Array.isArray(value))return value.map(redact);if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,redact(v)]));return value;};
const request=async(label,method,path,{body,token,endpoint='open'}={})=>{
 const started=performance.now(),r=await fetch(bases[endpoint]+path,{method,headers:{Accept:'application/json',...(token===undefined?{}:{AuthToken:token}),...(body===undefined||body instanceof FormData?{}:{'Content-Type':'application/json'})},...(body===undefined?{}:{body:body instanceof FormData?body:JSON.stringify(body)}),signal:AbortSignal.timeout(20000)});
 const bytes=Buffer.from(await r.arrayBuffer()),rawText=bytes.toString();let value;try{value=JSON.parse(rawText);}catch{value=rawText;}register(value);
 const result={label,endpoint,method,path,status:r.status,contentType:r.headers.get('content-type'),errorId:r.headers.get('error-id'),testMode:r.headers.get('test-mode'),elapsedMs:Math.round(performance.now()-started),value,rawText,unredactedBodySha256:hash(bytes),requestBody:body instanceof FormData?'[actual multipart upload]':body};rows.push(result);return result;
};
const checked=async(label,method,path,options,status)=>{const r=await request(label,method,path,options);assert.equal(r.status,status,JSON.stringify(redact(r)));return r;};
const solve=c=>{assert.equal(c.algorithm,'SHA-256');assert.ok(c.maxNumber<=1000000);for(let number=0;number<=c.maxNumber;number++)if(hash(c.salt+number)===c.challenge)return{algorithm:c.algorithm,challenge:c.challenge,salt:c.salt,signature:c.signature,number};assert.fail('Source challenge has no bounded solution');};
const query=(label,text)=>{assert.match(text,/^(SELECT|SHOW) /);const raw=execFileSync('docker',['exec',postgres,'psql','-U','source_oracle','-d','source_oracle','-Atc',text],{encoding:'utf8'}).trim();sql.push({label,query:text,rawText:raw});return raw;};
const login=async(label,name='super',secret=rootPassword,endpoint='open')=>(await checked(label,'PUT','/session/admin',{body:{name,password:secret},endpoint},200)).value;
let root,admin,workspaces=[],users={};
try{
 for(const endpoint of Object.keys(bases)){const c=await checked('config-'+endpoint,'GET','/system/config',{endpoint},200);assert.deepEqual(c.value.bruteForceProtection,endpoint==='open'?['login','person']:['admin','login','person']);}
 root=await login('root-first');assert.equal(root.loginName,'super');assert.equal(root.groupLabel,null);assert.equal(root.groupToken,null);assert.deepEqual(root.claims,{workspaceAdmin:[],superAdmin:[]});assert.deepEqual(root.access,{workspaceAdmin:[],superAdmin:[]});
 await checked('root-get-initial','GET','/session',{token:root.token},200);
 for(const[name,body]of Object.entries({'missing-body':undefined,'missing-name':{password},'missing-password':{name:'super'},'null-name':{name:null,password},'null-password':{name:'super',password:null}}))await checked('direct-'+name,'PUT','/session/admin',{body},400);
 for(const[name,value]of [['empty',''],['over50','x'.repeat(51)],['number',7],['array',[]],['object',{}]])await request('direct-name-'+name,'PUT','/session/admin',{body:{name:value,password}});
 for(const[name,value]of [['empty',''],['number',7],['array',[]],['object',{}]])await request('direct-password-'+name,'PUT','/session/admin',{body:{name:'not-a-real-user-'+name,password:value}});
 for(const[name,body]of [['empty-name',{name:'',password:''}],['valid-name',{name:'super',password:rootPassword}],['missing-password',{name:'super'}]])await checked('protected-direct-'+name,'PUT','/session/admin',{body,endpoint:'protected'},400);
 for(const name of ['OwnedÄdmin','NoWorkspaces','RateOwned','R58Observer']){const r=await checked('create-user-'+name,'PUT','/user',{token:root.token,body:{n:name,p:password}},201);users[name]=Number(r.rawText);assert.ok(Number.isSafeInteger(users[name]));}
 for(const name of ['Zulu Ω','Alpha Ä']){const r=await checked('create-workspace-'+name,'PUT','/workspace',{token:root.token,body:{name}},201);workspaces.push(Number(r.rawText));}
 const directory=await checked('root-users','GET','/users',{token:root.token},200);assert.equal(directory.value.length,5);assert.ok(directory.value.every(u=>Object.hasOwn(u,'email')&&u.email===null));
 const wsDirectory=await checked('root-workspaces','GET','/workspaces',{token:root.token},200);assert.deepEqual(wsDirectory.value.map(w=>w.name),['Alpha Ä','Zulu Ω']);assert.ok(wsDirectory.value.every(w=>w.latest_modification_ts===null));
 const noWorkspace=await login('user-no-workspaces','NoWorkspaces',password);assert.deepEqual(noWorkspace.claims,{workspaceAdmin:[]});assert.equal(noWorkspace.pwSetByAdmin,true);
 await checked('regular-users-denied','GET','/users',{token:noWorkspace.token},403);await checked('regular-workspaces-denied','GET','/workspaces',{token:noWorkspace.token},403);
 admin=await login('admin-no-grants','OwnedÄdmin',password);assert.equal(admin.loginName,'OwnedÄdmin');assert.equal(admin.id,users['OwnedÄdmin']);assert.deepEqual(admin.claims,{workspaceAdmin:[]});
 const oldToken=admin.token;admin=await login('admin-case-folded-name','OWNEDÄDMIN',password);assert.equal(admin.loginName,'OwnedÄdmin');assert.notEqual(admin.token,oldToken);await checked('old-admin-token-rotated','GET','/session',{token:oldToken},403);
 await request('admin-leading-space-name','PUT','/session/admin',{body:{name:' OwnedÄdmin',password}});await request('admin-trailing-space-name','PUT','/session/admin',{body:{name:'OwnedÄdmin ',password}});
 for(const [token,status,name]of [[undefined,401,'missing'],['',401,'empty'],['owned-invalid',403,'invalid']]){await checked('session-get-'+name,'GET','/session',{token},status);await checked('session-delete-'+name,'DELETE','/session',{token},status);}
 await checked('admin-get-method','GET','/session/admin',{},405);await checked('session-post-method','POST','/session',{},405);
 const grant=ws=>checked('set-admin-grants-'+rows.length,'PATCH','/user/'+users['OwnedÄdmin']+'/workspaces',{token:root.token,body:{ws}},200);
 await grant([{id:workspaces[0],role:'RO'},{id:workspaces[1],role:'RW'}]);
 const claims=(await checked('session-live-explicit-grants','GET','/session',{token:admin.token},200)).value;
 assert.deepEqual(new Set(claims.claims.workspaceAdmin.map(w=>w.id)),new Set(workspaces.map(String)));assert.equal(claims.claims.workspaceAdmin.find(w=>w.id===String(workspaces[0])).flags.mode,'RO');
 await checked('root-no-inherited-workspace','GET','/workspace/'+workspaces[0]+'/results',{token:root.token},404);
 await checked('regular-RO-results','GET','/workspace/'+workspaces[0]+'/results',{token:admin.token},200);
 await checked('workspace-live-rename','PATCH','/workspace/'+workspaces[0],{token:root.token,body:{name:'Changed current workspace β'}},200);
 const renamed=(await checked('session-live-renamed-label','GET','/session',{token:admin.token},200)).value;assert.equal(renamed.claims.workspaceAdmin.find(w=>w.id===String(workspaces[0])).label,'Changed current workspace β');
 const before=query('admin-expiry-before-refresh','SELECT extract(epoch FROM valid_until)::bigint FROM admin_sessions WHERE user_id='+users['OwnedÄdmin']);
 await delay(1200);await checked('session-refreshes-expiry','GET','/session',{token:admin.token},200);
 const after=query('admin-expiry-after-refresh','SELECT extract(epoch FROM valid_until)::bigint FROM admin_sessions WHERE user_id='+users['OwnedÄdmin']);assert.ok(BigInt(after)>BigInt(before));
 const ttl=Number(query('admin-expiry-minutes','SELECT round(extract(epoch FROM valid_until-current_timestamp)/60) FROM admin_sessions WHERE user_id='+users['OwnedÄdmin']));assert.ok(ttl>=599&&ttl<=600);
 await grant(workspaces.map(id=>({id,role:''})));assert.deepEqual((await checked('session-live-all-grants-revoked','GET','/session',{token:admin.token},200)).value.claims,{workspaceAdmin:[]});await checked('revoked-workspace-hidden','GET','/workspace/'+workspaces[0]+'/results',{token:admin.token},404);
 await checked('promote-admin','PATCH','/user/'+users['OwnedÄdmin']+'/super-admin/on',{token:root.token,body:{p:rootPassword}},200);assert.ok(Object.hasOwn((await checked('session-live-promoted','GET','/session',{token:admin.token},200)).value.claims,'superAdmin'));await checked('promoted-directory-current-token','GET','/users',{token:admin.token},200);
 await checked('demote-admin','PATCH','/user/'+users['OwnedÄdmin']+'/super-admin/off',{token:root.token,body:{p:rootPassword}},200);assert.ok(!Object.hasOwn((await checked('session-live-demoted','GET','/session',{token:admin.token},200)).value.claims,'superAdmin'));await checked('demoted-directory-current-token-denied','GET','/users',{token:admin.token},403);
 await checked('self-password-missing-old','PATCH','/user/'+admin.id+'/password',{token:admin.token,body:{p:newPassword}},400);await checked('self-password-wrong-old','PATCH','/user/'+admin.id+'/password',{token:admin.token,body:{p:newPassword,oldPassword:'Owned wrong old password'}},403);
 await checked('self-password-change','PATCH','/user/'+admin.id+'/password',{token:admin.token,body:{p:newPassword,oldPassword:password}},200);const afterPassword=(await checked('session-after-self-password-change','GET','/session',{token:admin.token},200)).value;assert.equal(afterPassword.pwSetByAdmin,false);
 await checked('old-password-after-change','PUT','/session/admin',{body:{name:'OwnedÄdmin',password}},400);admin=await login('new-password-after-change','OwnedÄdmin',newPassword);
 await checked('root-resets-user-password','PATCH','/user/'+admin.id+'/password',{token:root.token,body:{p:password}},200);assert.equal((await checked('session-after-root-password-reset','GET','/session',{token:admin.token},200)).value.pwSetByAdmin,true);admin=await login('root-reset-password-login','OwnedÄdmin',password);
 await checked('admin-logout','DELETE','/session',{token:admin.token},205);await checked('logged-out-admin-read-denied','GET','/session',{token:admin.token},403);await checked('logged-out-admin-delete-denied','DELETE','/session',{token:admin.token},403);
 const protectedChallenge=(await checked('protected-admin-challenge','POST','/session/challenge',{endpoint:'protected',body:{loginType:'admin',name:'OwnedÄdmin',password}},200)).value,solution=solve(protectedChallenge);
 admin=(await checked('protected-admin-solution','PUT','/session',{endpoint:'protected',body:solution},200)).value;assert.equal(admin.id,users['OwnedÄdmin']);assert.equal(admin.loginName,'OwnedÄdmin');
 const previous=admin.token;admin=(await checked('protected-admin-proof-replay','PUT','/session',{endpoint:'protected',body:solution},200)).value;assert.notEqual(admin.token,previous);await checked('replay-rotates-previous-admin','GET','/session',{token:previous},403);
 await checked('proof-mutated-signature','PUT','/session',{endpoint:'protected',body:{...solution,signature:'0'.repeat(64)}},400);await checked('proof-mutated-challenge','PUT','/session',{endpoint:'protected',body:{...solution,challenge:'0'.repeat(64)}},400);
 for(const field of ['algorithm','challenge','salt','signature','number']){const partial={...solution};delete partial[field];await checked('proof-missing-'+field,'PUT','/session',{endpoint:'protected',body:partial},400);}
 const wrong=(await checked('protected-wrong-password-challenge','POST','/session/challenge',{endpoint:'protected',body:{loginType:'admin',name:'OwnedÄdmin',password:'Owned wrong password'}},200)).value;await checked('protected-wrong-password-solved','PUT','/session',{endpoint:'protected',body:solve(wrong)},400);
 const unknown=(await checked('protected-unknown-user-challenge','POST','/session/challenge',{endpoint:'protected',body:{loginType:'admin',name:'Owned unknown admin',password}},200)).value;await checked('protected-unknown-user-solved','PUT','/session',{endpoint:'protected',body:solve(unknown)},400);
 for(let i=0;i<5;i++)await checked('rate-wrong-'+i,'PUT','/session/admin',{body:{name:'RateOwned',password:'Owned wrong password'}},400);
 await checked('rate-correct-still-denied','PUT','/session/admin',{body:{name:'RateOwned',password}},429);
 await login('case-variant-rate-bucket','RATEOWNED',password);
 const observer=await login('observer-before-delete','R58Observer',password);await checked('delete-observer','DELETE','/users',{token:root.token,body:{u:[users.R58Observer],p:rootPassword}},200);await checked('deleted-user-token-denied','GET','/session',{token:observer.token},403);
 await checked('root-grant-own-workspace','PATCH','/user/'+root.id+'/workspaces',{token:root.token,body:{ws:[{id:workspaces[0],role:'RW'}]}},200);
 const upload=async(name,text)=>{const body=new FormData();body.append('fileforvo[]',new Blob([text],{type:'application/xml'}),name);const r=await request('upload-'+name,'POST','/workspace/'+workspaces[0]+'/file',{token:root.token,body});assert.ok([201,207].includes(r.status),JSON.stringify(redact(r)));assert.deepEqual(Object.values(r.value??{}).flatMap(v=>v.error??[]),[]);};
 await upload('owned-tests-r53-player.html','<html><script type="application/ld+json">'+JSON.stringify({id:'owned-tests-r53-player',version:'1.0.0',specVersion:'6.0',metadataVersion:'2.0',type:'player',name:[{lang:'de',value:'Owned Player'}]})+'</script><main>Owned</main></html>');
 await upload('r58-unit.xml','<Unit xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="https://w3id.org/iqb/spec/unit-xml/17.6"><Metadata><Id>R58.UNIT</Id><Label>Owned</Label></Metadata><Definition player="owned-tests-r53-player@1.0.0">Owned</Definition></Unit>');
 await upload('r58-booklet.xml','<Booklet xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="https://w3id.org/iqb/spec/testcenter-booklet-xml/18.0"><Metadata><Id>R58.BOOKLET</Id><Label>Owned</Label></Metadata><Units><Unit id="R58.UNIT" label="Owned"/></Units></Booklet>');
 await upload('r58-people.xml','<Testtakers xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="https://w3id.org/iqb/spec/testcenter-testtaker-xml/18.0"><Metadata/><Group id="R58.GROUP" label="Owned"><Login name="OwnedÄdmin" pw="'+password+'" mode="run-hot-return"><Booklet>R58.BOOKLET</Booklet></Login></Group></Testtakers>');
 const participantChallenge=(await checked('same-name-participant-challenge','POST','/session/challenge',{endpoint:'protected',body:{loginType:'login',name:'OwnedÄdmin',password}},200)).value;
 const participant=(await checked('same-name-participant-solution','PUT','/session',{endpoint:'protected',body:solve(participantChallenge)},200)).value;assert.equal(participant.id,null);assert.equal(participant.groupLabel,'Owned');assert.ok(Object.hasOwn(participant.claims,'test'));
 await checked('participant-token-directory-denied','GET','/users',{token:participant.token},403);const sameNameAdmin=(await checked('same-name-admin-refresh','GET','/session',{token:admin.token},200)).value;assert.equal(sameNameAdmin.id,users['OwnedÄdmin']);assert.equal(sameNameAdmin.groupLabel,null);
 verifyImages();assert.equal(git('status','--porcelain','--untracked-files=no'),'');
 const phpVersions=Object.fromEntries(Object.entries(containers).map(([key,name])=>[key,execFileSync('docker',['exec',name,'php','-r','echo PHP_VERSION;'],{encoding:'utf8'}).trim()]));
 const result={verified:true,sourceCommit:git('rev-parse','HEAD'),sourceHashes,sourceFilesVerifiedBeforeAndAfter:paths.length,sourceComposerLockSha256:hash(lockBytes),vendors,phpVersions,actualPostgres:query('runtime-postgres','SELECT version()'),actualRedis:execFileSync('docker',['exec',redis,'redis-cli','-a','owned-source-redis','INFO','server'],{encoding:'utf8',stdio:['pipe','pipe','ignore']}).trim(),configuration:{ownedDedicatedStack:true,testMode:false,xmlSchemaValidation:true,unprotectedAdminEndpoint:['login','person'],protectedAdminEndpoint:['admin','login','person']},mutationsOverActualHttp:true,sqlReadsOnly:sql,sqlSeedsOrDaoStubs:false,rows:redact(rows),sourceCodeAndVendorUnmodified:true,securityDivergencesToPreserve:['Rewrite keeps encrypted credential tickets, durable one-use proof claims, normalized rate buckets and password-change session revocation; Source replay acceptance and retained old-password sessions must not weaken those gates.'],fullOriginalParityProven:false};
 for(const row of result.rows)row.redactedBodySha256=hash(row.rawText);
 await writeFile(join(out,'observations.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({verified:true,cases:rows.length,sourceFiles:paths.length,phpVersions,workspaces,users}));
}catch(error){await writeFile(join(out,'failure.json'),JSON.stringify({error:String(error),rows:redact(rows),sqlReadsOnly:sql},null,2)+'\n');throw error;}
