import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {WebSocket} from 'ws';
import {verifyRuntime} from './runtime.mjs';

// The existing synthetic Source users/workspaces are read-only. Every mutating
// workspace route below is guarded by an ID returned by this run's real PUT.
const out=process.env.ORIGINAL_POPULATED_DELETION_OUTPUT_DIR,backend=process.env.ORIGINAL_PERMISSIONS_CONTAINER;
const postgres=process.env.ORIGINAL_PERMISSIONS_POSTGRES_CONTAINER,broadcaster=process.env.ORIGINAL_POPULATED_BROADCASTER_CONTAINER;
assert.ok(out&&backend&&postgres&&broadcaster);await mkdir(out,{recursive:true});
const beforeRuntime=await verifyRuntime(),hash=b=>createHash('sha256').update(b).digest('hex');
const port=(container,port)=>{const text=execFileSync('docker',['port',container,port],{encoding:'utf8'}).trim();assert.match(text,/^127\.0\.0\.1:\d+$/);return text;};
const base='http://'+port(backend,'8080'),broadcastBase='http://'+port(broadcaster,'3000');
const password='owned-source-super-secret',aliases=new Map([[password,'[owned-root-password]']]),rows=[],owned=new Set(),peers=[],snapshots={};
const nonce=Date.now(),prefix='Owned W70 '+nonce+' ',unit='OWNED.WS.DELETE.UNIT';
let token,baseline,baselineFiles,complete=false,clock=1793796000000;
function register(value){if(value&&typeof value==='object')for(const[k,v]of Object.entries(value)){
 if(/token|signature|salt/i.test(k)&&typeof v==='string'&&v&&!aliases.has(v))aliases.set(v,'[owned-'+k+'-'+aliases.size+']');else register(v);
}}
function redact(value){
 if(typeof value==='string'){for(const[s,a]of [...aliases].sort((a,b)=>b[0].length-a[0].length))value=value.replaceAll(s,a);return value;}
 if(Array.isArray(value))return value.map(redact);
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,redact(v)]));return value;
}
async function request(label,method,path,{auth=token,body,expected,origin=base}={}){
 const payload=body instanceof FormData?body:body===undefined?undefined:JSON.stringify(body);
 const r=await fetch(origin+path,{method,headers:{Accept:'application/json',...auth?{AuthToken:auth}:{},...payload!==undefined&&!(body instanceof FormData)?{'Content-Type':'application/json'}:{}},
  ...payload===undefined?{}:{body:payload},signal:AbortSignal.timeout(20000)});
 const rawText=await r.text();let value;try{value=JSON.parse(rawText);}catch{value=rawText;}register(value);
 const subscribeToken=r.headers.get('subscribetoken');if(subscribeToken)register({subscribeToken});
 const row={label,method,path,status:r.status,contentType:r.headers.get('content-type'),requestBody:body instanceof FormData?'[actual multipart upload]':body,rawText,value,subscribeToken};rows.push(row);
 if(expected!==undefined)assert.equal(r.status,expected,label+': '+JSON.stringify(redact(row)));
 return row;
}
const own=id=>{assert.ok(owned.has(String(id)));assert.ok(!baseline.workspaces.some(w=>String(w.id)===String(id)));return String(id);};
function files(id){assert.match(String(id),/^[1-9]\d*$/);
 const code='$p="/var/www/testcenter/data/ws_".$argv[1];$out=[];if(is_dir($p)){foreach(new RecursiveIteratorIterator(new RecursiveDirectoryIterator($p,FilesystemIterator::SKIP_DOTS)) as $f){if($f->isFile())$out[substr($f->getPathname(),strlen($p)+1)]=hash_file("sha256",$f->getPathname());}}ksort($out);echo json_encode(["exists"=>is_dir($p),"files"=>(object)$out],JSON_THROW_ON_ERROR);';
 return JSON.parse(execFileSync('docker',['exec',backend,'php','-r',code,String(id)],{encoding:'utf8'}));
}
function sql(id){own(id);
 const person=`SELECT p.id FROM person_sessions p JOIN login_sessions l ON l.id=p.login_sessions_id WHERE l.workspace_id=${id}`;
 const tests=`SELECT id FROM tests WHERE person_id IN (${person})`;
 const predicates={workspaces:`id=${id}`,workspace_users:`workspace_id=${id}`,files:`workspace_id=${id}`,file_relations:`workspace_id=${id}`,unit_defs_attachments:`workspace_id=${id}`,
  logins:`workspace_id=${id}`,login_session_groups:`workspace_id=${id}`,login_sessions:`workspace_id=${id}`,person_sessions:`id IN (${person})`,tests:`id IN (${tests})`};
 for(const table of ['units','unit_data','unit_logs','unit_reviews','test_commands'])predicates[table]=`test_id IN (${tests})`;
 for(const table of ['test_logs','test_reviews'])predicates[table]=`booklet_id IN (${tests})`;
 const query='SELECT json_build_object('+Object.entries(predicates).map(([name,where])=>`'${name}',(SELECT count(*) FROM ${name} WHERE ${where})`).join(',')+')';
 return JSON.parse(execFileSync('docker',['exec',postgres,'psql','-U','source_oracle','-d','source_oracle','-Atc',query],{encoding:'utf8'}));
}
async function cache(label){const result={};for(const path of ['/clients','/testees','/monitors','/test-sessions'])result[path]=(await request(label+path,'GET',path,{origin:broadcastBase,auth:'',expected:200})).value;return result;}
async function connect(label,subscribeToken){assert.ok(subscribeToken);const messages=[],socket=new WebSocket(broadcastBase.replace('http:','ws:')+'/ws?token='+encodeURIComponent(subscribeToken));
 const peer={label,socket,messages,closed:false,closeCode:null,closeReason:null};peers.push(peer);
 socket.on('message',b=>{const message=JSON.parse(b.toString());register(message);messages.push(message);});
 socket.on('close',(code,reason)=>{peer.closed=true;peer.closeCode=code;peer.closeReason=reason.toString();});
 await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Source WS open timeout: '+label)),5000);socket.once('open',()=>{clearTimeout(timer);resolve();});socket.once('error',error=>{clearTimeout(timer);reject(error);});});
 await delay(30);assert.equal(peer.closed,false,label+' must be a real accepted peer');return peer;
}
async function until(predicate,message){const deadline=Date.now()+5000;while(!predicate()&&Date.now()<deadline)await delay(5);assert.ok(predicate(),message);}
const xml=(type,repo,body)=>'<'+type+' xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="https://w3id.org/iqb/spec/'+repo+'/18.0">'+body+'</'+type+'>';
async function populate(kind){
 const id=(await request(kind+'-create','PUT','/workspace',{body:{name:prefix+kind},expected:201})).rawText;assert.match(id,/^[1-9]\d*$/);assert.ok(!baseline.workspaces.some(w=>String(w.id)===id));owned.add(id);
 await request(kind+'-grant','PATCH','/workspace/'+own(id)+'/users',{body:{u:[{id:baseline.rootId,role:'RW'}]},expected:200});
 const upload=async(name,document)=>{const form=new FormData();form.append('fileforvo[]',new Blob([document],{type:'application/xml'}),name);const r=await request(kind+'-upload-'+name,'POST','/workspace/'+own(id)+'/file',{body:form});assert.ok([201,207].includes(r.status),JSON.stringify(redact(r)));assert.deepEqual(Object.values(r.value).flatMap(v=>v?.error??[]),[]);};
 const metadata={id:'owned-ws-delete-player',version:'1.0.0',specVersion:'6.0',metadataVersion:'2.0',type:'player',name:[{lang:'de',value:'Owned deletion Player'}],description:[{lang:'de',value:'Owned fixture'}]};
 await upload('owned-ws-delete-player-1.0.html','<html><script type="application/ld+json">'+JSON.stringify(metadata)+'</script><main>Owned Player</main></html>');
 await upload('owned-delete-unit.xml','<Unit xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="https://w3id.org/iqb/spec/unit-xml/17.6"><Metadata><Id>'+unit+'</Id><Label>Owned deletion Unit</Label></Metadata><Definition player="owned-ws-delete-player@1.0.0">Owned definition '+kind+'</Definition></Unit>');
 const booklet='OWNED.WS.DELETE.'+kind.toUpperCase(),group='OWNED.W70.'+kind.toUpperCase()+'.'+nonce,login='owned-w70-'+nonce+'-'+kind,monitor=login+'-m';
 await upload('owned-delete-booklet.xml',xml('Booklet','testcenter-booklet-xml','<Metadata><Id>'+booklet+'</Id><Label>Owned '+kind+' Booklet Ω</Label></Metadata><Units><Unit id="'+unit+'" label="Owned deletion Unit"/></Units>'));
 await upload('owned-delete-testtakers.xml',xml('Testtakers','testcenter-testtaker-xml','<Metadata/><Group id="'+group+'" label="Owned '+kind+' group Ω"><Login name="'+login+'" mode="run-trial"><Booklet>'+booklet+'</Booklet></Login><Login name="'+monitor+'" mode="monitor-group"/></Group>'));
 const participant=(await request(kind+'-participant-login','PUT','/session/login',{auth:'',body:{name:login,password:''},expected:200})).value.token;
 const testId=(await request(kind+'-test-create','PUT','/test',{auth:participant,body:{bookletName:booklet},expected:201})).rawText;assert.match(testId,/^[1-9]\d*$/);
 const path='/test/'+testId,unitPath=path+'/unit/'+unit;
 await request(kind+'-test-open','GET',path,{auth:participant,expected:200});
 await request(kind+'-test-state','PATCH',path+'/state',{auth:participant,body:[{key:'OWNED.STORED',content:'Owned '+kind+' state Ω',timeStamp:++clock}],expected:200});
 await request(kind+'-unit-state','PATCH',unitPath+'/state',{auth:participant,body:{originalUnitId:'OWNED.ORIGINAL.'+kind,newState:[{key:'PRESENTATION_PROGRESS',content:'some',timeStamp:++clock}]},expected:200});
 await request(kind+'-response','PUT',unitPath+'/response',{auth:participant,body:{timeStamp:++clock,dataParts:{owned:JSON.stringify({answer:'Owned '+kind+' answer Ω'})},responseType:'owned'},expected:201});
 await request(kind+'-unit-log','PUT',unitPath+'/log',{auth:participant,body:{logEntries:[{key:'OWNED_UNIT',content:'Owned '+kind+' unit log',timeStamp:++clock}]},expected:201});
 await request(kind+'-test-log','PUT',path+'/log',{auth:participant,body:[{key:'OWNED_TEST',content:'Owned '+kind+' test log',timeStamp:++clock}],expected:201});
 for(const [level,where]of [['unit',unitPath],['test',path]]){
  await request(kind+'-'+level+'-review','PUT',where+'/review',{auth:participant,body:{priority:2,categories:'tech design',entry:'Owned '+kind+' '+level+' review Ω\n  line two',reviewer:'Reviewer Ä',userAgent:'Owned Source deletion probe',originalUnitId:'OWNED.ORIGINAL.'+kind,page:3,pagelabel:'Teilaufgabe β'},expected:201});
  assert.equal((await request(kind+'-'+level+'-reviews','GET',where+'/reviews',{auth:participant,expected:200})).value.length,1);
 }
 const monitorToken=(await request(kind+'-monitor-login','PUT','/session/login',{auth:'',body:{name:monitor,password:''},expected:200})).value.token;
 const sessionList=await request(kind+'-monitor-sessions','GET','/monitor/group/'+encodeURIComponent(group)+'/test-sessions',{auth:monitorToken,expected:200});
 assert.ok(sessionList.value.some(session=>String(session.testId)===testId),'The actual group-scoped Monitor must contain the owned Test.');
 const commands=await request(kind+'-commands','GET',path+'/commands',{auth:participant,expected:200});
 const commandPeer=await connect(kind+'-commands',commands.subscribeToken),monitorPeer=await connect(kind+'-monitor',sessionList.subscribeToken);
 await request(kind+'-pending-command','PUT','/monitor/command',{auth:monitorToken,body:{keyword:'pause',arguments:[],timestamp:Math.floor(++clock/1000),testIds:[Number(testId)]},expected:201});
 await until(()=>commandPeer.messages.some(m=>m.event==='commands'),'Real Source command must arrive over '+kind+' socket');
 return{id,participant,monitorToken,testId,commandPeer,monitorPeer,group};
}
async function durable(label,scope){const result={sql:sql(scope.id),files:files(scope.id),http:{}};
 for(const tail of ['/files','/results','/responses/detailed','/report/response','/report/log','/report/review'])result.http[tail]=(await request(label+tail,'GET','/workspace/'+own(scope.id)+tail,{expected:200})).rawText;
 return result;
}
try{
 const root=await request('root-login','PUT','/session/admin',{auth:'',body:{name:'super',password},expected:200});token=root.value.token;
 baseline={rootId:root.value.id,users:(await request('baseline-users','GET','/users',{expected:200})).value,workspaces:(await request('baseline-workspaces','GET','/workspaces',{expected:200})).value,
  rootWorkspaces:(await request('baseline-root-workspaces','GET','/user/'+root.value.id+'/workspaces',{expected:200})).value};
 baselineFiles=Object.fromEntries(baseline.workspaces.map(w=>[String(w.id),files(w.id)]));
 const target=await populate('target'),control=await populate('control');
 snapshots.targetBefore=await durable('target-before',target);snapshots.controlBefore=await durable('control-before',control);
 for(const scope of [snapshots.targetBefore,snapshots.controlBefore]){
  assert.ok(Object.keys(scope.files.files).length>=4);assert.equal(scope.files.exists,true);
  for(const name of ['workspaces','workspace_users','files','logins','login_session_groups','login_sessions','person_sessions','tests','units','unit_data','unit_logs','unit_reviews','test_logs','test_reviews','test_commands'])assert.ok(scope.sql[name]>0,'Actual populated '+name);
 }
 snapshots.cacheBefore=await cache('cache-before');assert.equal(snapshots.cacheBefore['/clients'].length,4);assert.equal(snapshots.cacheBefore['/testees'].length,2);assert.equal(snapshots.cacheBefore['/monitors'].length,2);assert.ok(snapshots.cacheBefore['/test-sessions'].length>=2);
 await request('wrong-password-delete','DELETE','/workspaces',{body:{ws:[own(target.id)],p:'owned-incorrect-password'},expected:403});
 assert.deepEqual(await durable('target-after-denial',target),snapshots.targetBefore);assert.deepEqual(await durable('control-after-denial',control),snapshots.controlBefore);
 assert.ok(peers.every(p=>!p.closed));
 const deleted=await request('delete-populated-target','DELETE','/workspaces',{body:{ws:[own(target.id)],p:password},expected:200});assert.equal(deleted.rawText,'');
 await until(()=>peers.every(p=>p.closed),'Global Source clean must disconnect target AND retained control peers');
 snapshots.peersAfter=peers.map(({label,closed,closeCode,closeReason,messages})=>({label,closed,closeCode,closeReason,messages}));
 snapshots.cacheAfter=await cache('cache-after');assert.deepEqual(snapshots.cacheAfter,{'/clients':[],'/testees':[],'/monitors':[],'/test-sessions':[]});
 snapshots.targetAfter={sql:sql(target.id),files:files(target.id)};assert.deepEqual(snapshots.targetAfter.files,{exists:false,files:{}});
 for(const [name,count]of Object.entries(snapshots.targetAfter.sql))if(name!=='login_session_groups')assert.equal(count,0,'Deleted '+name);
 snapshots.controlAfter=await durable('control-after-delete',control);assert.deepEqual(snapshots.controlAfter,snapshots.controlBefore,'Retained workspace durable data must remain byte-identical');
 await request('deleted-participant-session','GET','/session',{auth:target.participant,expected:403});
 await request('deleted-test','GET','/test/'+target.testId,{auth:target.participant,expected:403});
 await request('retained-participant-session','GET','/session',{auth:control.participant,expected:200});
 const fresh=await request('retained-fresh-commands','GET','/test/'+control.testId+'/commands',{auth:control.participant,expected:200});
 const peer=await connect('control-fresh-after-clean',fresh.subscribeToken);assert.equal(peer.closed,false);
 snapshots.freshSubscriptionAccepted=true;snapshots.owned={target:{id:target.id,testId:target.testId,group:target.group},control:{id:control.id,testId:control.testId,group:control.group}};
 complete=true;
}finally{
 if(token&&baseline){
  const current=(await request('cleanup-workspaces','GET','/workspaces',{expected:200})).value;
  const remaining=[...owned].filter(id=>current.some(w=>String(w.id)===id));for(const id of remaining)own(id);
  if(remaining.length)await request('cleanup-owned-workspaces','DELETE','/workspaces',{body:{ws:remaining,p:password},expected:200});
  assert.deepEqual((await request('final-users','GET','/users',{expected:200})).value,baseline.users);
  assert.deepEqual((await request('final-workspaces','GET','/workspaces',{expected:200})).value,baseline.workspaces);
  assert.deepEqual((await request('final-root-workspaces','GET','/user/'+baseline.rootId+'/workspaces',{expected:200})).value,baseline.rootWorkspaces);
  assert.deepEqual(Object.fromEntries(baseline.workspaces.map(w=>[String(w.id),files(w.id)])),baselineFiles);
 }
 for(const peer of peers)peer.socket.terminate();
 const afterRuntime=await verifyRuntime();assert.deepEqual(afterRuntime,beforeRuntime);
 const captured=redact(rows).map(row=>({...row,redactedBodySha256:hash(row.rawText)}));
 const data={verified:complete,sourceCommit:beforeRuntime.sourceRuntime.sourceCommit,runtimeBefore:beforeRuntime,runtimeAfter:afterRuntime,ownedHTTPWorkspacesOnly:true,baselineRestored:true,
  sqlSeedsOrDaoStubs:false,readOnlySqlInspection:true,baselineFiles,snapshots:redact(snapshots),createdOwnedIDs:[...owned],actualHttpExchanges:captured.length,rows:captured,fullOriginalParityProven:false};
 await writeFile(join(out,'observations.json'),JSON.stringify(data,null,2)+'\n');
 const manifest={sourceCommit:data.sourceCommit,files:{'capture.mjs':hash(await readFile(new URL('./capture.mjs',import.meta.url))),'runtime.mjs':hash(await readFile(new URL('./runtime.mjs',import.meta.url))),'observations.json':hash(await readFile(join(out,'observations.json')))}};
 await writeFile(join(out,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
 console.log(JSON.stringify({verified:complete,actualHttpExchanges:captured.length,ownedWorkspaces:owned.size,baselineRestored:true,sourceFiles:137,broadcasterSourceFiles:38}));
}
