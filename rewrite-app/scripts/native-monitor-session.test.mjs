import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
await import('@angular/compiler');
const path=new URL('../apps/web/src/app/native-monitor/native-session.service.ts',import.meta.url);
let code=ts.transpileModule(await readFile(path,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022,experimentalDecorators:true}}).outputText;
code=code.replaceAll("'@angular/core'",JSON.stringify(import.meta.resolve('@angular/core'))).replace("import('altcha-lib')",'Promise.resolve(globalThis.__nativeMonitorChallengeFixture)');
const sessionModuleUrl='data:text/javascript;base64,'+Buffer.from(code).toString('base64');
const {NativeMonitorSessionService,NativeMonitorHttpError}=await import(sessionModuleUrl);
const {createEnvironmentInjector,Injector}=await import('@angular/core');
let starterCode=ts.transpileModule(await readFile(new URL('../apps/web/src/app/native-participant/native-test-starter.service.ts',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022,experimentalDecorators:true}}).outputText;
starterCode=starterCode.replaceAll("'@angular/core'",JSON.stringify(import.meta.resolve('@angular/core'))).replace("'../native-monitor/native-session.service'",JSON.stringify(sessionModuleUrl));
const {NativeTestStarterService}=await import('data:text/javascript;base64,'+Buffer.from(starterCode).toString('base64'));
const storageKey='testcenter-native-monitor-session';
const access=token=>({token,claims:{testGroupMonitor:[{id:'owned',label:'Owned',type:'testGroupMonitor',flags:[]}]},customTexts:{}});
const response=(value,status=200)=>new Response(typeof value==='string'?value:JSON.stringify(value),{status});
const deferred=()=>{let resolve;const promise=new Promise(done=>resolve=done);return {promise,resolve};};
const settle=()=>new Promise(done=>setImmediate(done));
async function fixture(run,token){const oldFetch=globalThis.fetch,oldStorage=globalThis.localStorage,oldTabStorage=globalThis.sessionStorage,oldSecure=globalThis.isSecureContext,values=new Map(token?[[storageKey,token]]:[]),tabValues=new Map();globalThis.localStorage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};globalThis.sessionStorage={getItem:key=>tabValues.get(key)??null,setItem:(key,value)=>tabValues.set(key,value),removeItem:key=>tabValues.delete(key)};globalThis.isSecureContext=true;try{await run(values,tabValues);}finally{globalThis.fetch=oldFetch;globalThis.localStorage=oldStorage;globalThis.sessionStorage=oldTabStorage;globalThis.isSecureContext=oldSecure;}}

test('late native restoration cannot replace a newer real login',()=>fixture(async values=>{
 const pending=deferred(),requests=[];globalThis.fetch=async(path,options)=>{requests.push({path,options});return options.method==='GET'?pending.promise:response(access('new'));};const session=new NativeMonitorSessionService();assert.equal(session.restoring(),true);
 await session.login('owned','password');pending.resolve(response(access('old')));await settle();assert.equal(session.access().token,'new');assert.equal(values.get(storageKey),'new');assert.equal(session.restoring(),false);
 const login=requests.find(r=>r.options.method==='PUT');assert.equal(login.options.headers.AuthToken,undefined);assert.equal(login.options.headers.Authorization,undefined);assert.equal(login.options.cache,'no-store');assert.deepEqual(JSON.parse(login.options.body),{name:'owned',password:'password'});
},'old'));
test('logout prevents a late restoring request from bringing a native session back',()=>fixture(async values=>{
 const pending=deferred();globalThis.fetch=()=>pending.promise;const session=new NativeMonitorSessionService();await session.logout();pending.resolve(response(access('old')));await settle();assert.equal(session.access(),null);assert.equal(values.has(storageKey),false);
},'old'));
test('current revoked native credentials clear local access; a stale old-token failure cannot clear a replacement',()=>fixture(async values=>{
 let handler=()=>response(access('current'));globalThis.fetch=(path,options)=>handler(path,options);const session=new NativeMonitorSessionService();await session.login('owned','password');
 handler=()=>response('revoked current',403);await assert.rejects(session.text('GET','/monitor/group/owned/test-sessions'),error=>error instanceof NativeMonitorHttpError&&error.status===403&&!error.message.includes('current'));assert.equal(session.access(),null);assert.equal(values.has(storageKey),false);
 handler=()=>response(access('replacement'));await session.login('owned','password');handler=()=>response('revoked old',401);await assert.rejects(session.text('GET','/session',undefined,'old'));assert.equal(session.access().token,'replacement');
}));
test('restored claims must still authorize the monitor and insecure password entry sends no request',()=>fixture(async values=>{
 globalThis.fetch=async()=>response({token:'old',claims:{},customTexts:{}});const session=new NativeMonitorSessionService();await settle();assert.equal(session.access(),null);assert.equal(values.has(storageKey),false);
 globalThis.isSecureContext=false;let called=false;globalThis.fetch=async()=>{called=true;throw Error('Unexpected request');};await assert.rejects(session.login('owned','password'),/HTTPS/);assert.equal(called,false);assert.equal(session.busy(),false);
},'old'));
test('snapshot cancellation is combined with the existing finite HTTP deadline',()=>fixture(async()=>{
 globalThis.fetch=async()=>response(access('current'));const session=new NativeMonitorSessionService();await session.login('owned','password');const controller=new AbortController();let received;
 globalThis.fetch=async(path,options)=>{received=options.signal;return response([]);};await session.text('GET','/monitor/group/owned/test-sessions',undefined,undefined,false,controller.signal);assert.notEqual(received,controller.signal);assert.equal(received.aborted,false);controller.abort();assert.equal(received.aborted,true);
}));
test('access changes abort in-flight transport and reject an already-received late body',()=>fixture(async()=>{
 globalThis.fetch=async()=>response(access('current'));const session=new NativeMonitorSessionService();await session.login('owned','password');
 const body=deferred();let signal;globalThis.fetch=async(path,options)=>{signal=options.signal;return {ok:true,text:()=>body.promise};};
 const read=session.text('GET','/booklet/BOOK'),rejected=assert.rejects(read,error=>error.name==='AbortError');await settle();const old=session.accessSignal;
 session.clear();assert.equal(signal.aborted,true);assert.equal(old.aborted,true);assert.notEqual(session.accessSignal,old);body.resolve('Private old Booklet');await rejected;assert.equal(session.access(),null);
}));
test('starting a replacement login invalidates pending actions from the old access',()=>fixture(async()=>{
 globalThis.fetch=async()=>response(access('current'));const session=new NativeMonitorSessionService();await session.login('owned','password');const old=session.accessSignal;
 globalThis.fetch=async()=>response(access('replacement'));await session.login('replacement','password');assert.equal(old.aborted,true);assert.notEqual(session.accessSignal,old);assert.equal(session.access().token,'replacement');
}));

test('retiring a login owner rejects late credentials and revokes only its orphan access',()=>fixture(async values=>{
 const pending=deferred(),requests=[],owner=new AbortController();globalThis.fetch=async(path,options)=>{requests.push({path,options});return options.method==='DELETE'?response(''):pending.promise;};
 const session=new NativeMonitorSessionService(),login=session.login('owned','password',owner.signal),rejected=assert.rejects(login);owner.abort();const busyAfterRetirement=session.busy();
 pending.resolve(response(access('orphan')));await rejected;assert.equal(busyAfterRetirement,false);assert.equal(session.access(),null);assert.equal(values.has(storageKey),false);assert.equal(session.problem(),'');
 assert.deepEqual(requests.filter(r=>r.options.method==='DELETE').map(r=>r.options.headers.AuthToken),['orphan']);
}));
test('a retired credential failure cannot start proof-of-work or change replacement login state',()=>fixture(async()=>{
 const old=deferred(),current=deferred(),owner=new AbortController(),requests=[];globalThis.fetch=async(path,options)=>{requests.push(path);if(path==='/session/challenge')return response({});return requests.length===1?old.promise:current.promise;};
 const session=new NativeMonitorSessionService(),oldLogin=session.login('old','password',owner.signal),oldRejected=assert.rejects(oldLogin);
 const next=session.login('current','password');owner.abort();old.resolve(response('Brute Force protection active',400));await oldRejected;
 assert.equal(session.busy(),true);assert.equal(session.problem(),'');assert.deepEqual(requests,['/session/login','/session/login']);
 current.resolve(response(access('current')));await next;assert.equal(session.access().token,'current');assert.equal(session.problem(),'');
}));
test('a late failed login cannot overwrite a newer successful login problem state',()=>fixture(async()=>{
 const old=deferred();let first=true;globalThis.fetch=async()=>{if(first){first=false;return old.promise;}return response(access('current'));};
 const session=new NativeMonitorSessionService(),prior=session.login('old','password'),rejected=assert.rejects(prior);await session.login('current','password');old.resolve(response('old failure',401));await rejected;
 assert.equal(session.access().token,'current');assert.equal(session.problem(),'');assert.equal(session.busy(),false);
}));
test('retiring a proof-of-work login stops its workers and sends no proof completion',()=>fixture(async()=>{
 const saved={document:globalThis.document,Worker:globalThis.Worker,solver:globalThis.__nativeMonitorChallengeFixture};
 const work=deferred(),started=deferred(),workers=[],requests=[];globalThis.document={baseURI:'https://owned.example/'};
 globalThis.Worker=class extends EventTarget{constructor(url,options){super();assert.equal(url.pathname,'/altcha-lib/dist/worker.js');assert.deepEqual(options,{type:'module'});this.stopped=false;workers.push(this);}terminate(){this.stopped=true;}};
 globalThis.__nativeMonitorChallengeFixture={solveChallengeWorkers:(factory)=>{if(typeof factory==='function')factory();started.resolve();return work.promise;}};
 globalThis.fetch=async(path,options)=>{requests.push({path,method:options.method});return path==='/session/login'?response('Brute Force protection active',400):response({challenge:'owned',salt:'owned',algorithm:'SHA-256',signature:'owned',maxNumber:1});};
 try{const owner=new AbortController(),session=new NativeMonitorSessionService(),login=session.login('owned','password',owner.signal),rejected=assert.rejects(login);
  await started.promise;owner.abort();work.resolve({number:1});await rejected;assert.ok(workers.length);assert.ok(workers.every(w=>w.stopped));
  assert.deepEqual(requests,[{path:'/session/login',method:'PUT'},{path:'/session/challenge',method:'POST'}]);assert.equal(session.access(),null);assert.equal(session.busy(),false);
 }finally{globalThis.document=saved.document;globalThis.Worker=saved.Worker;globalThis.__nativeMonitorChallengeFixture=saved.solver;}
}));

test('finish targets survive restoration and same-token refresh but never a replacement credential',()=>fixture(async(values,tabValues)=>{
 let next='current';globalThis.fetch=async()=>response(access(next));const first=new NativeMonitorSessionService();await first.login('owned','password');first.rememberFinishTargets('owned',['9007199254740993']);
 const restored=new NativeMonitorSessionService();await settle();assert.deepEqual(restored.pendingFinishTargets('owned'),['9007199254740993']);await restored.refresh();assert.deepEqual(restored.pendingFinishTargets('owned'),['9007199254740993']);
 next='replacement';await restored.login('replacement','password');assert.deepEqual(restored.pendingFinishTargets('owned'),[]);assert.equal(tabValues.size,0);
 restored.rememberFinishTargets('owned',['2']);restored.clear();assert.equal(tabValues.size,0);assert.deepEqual(restored.pendingFinishTargets('owned'),[]);
}));
test('an unauthorized restoration clears retained finish targets before any new access',()=>fixture(async(values,tabValues)=>{
 tabValues.set(storageKey+'-unfinished-finish',JSON.stringify({token:'old',groups:{A:['1']}}));globalThis.fetch=async()=>response('revoked',403);
 const session=new NativeMonitorSessionService();await settle();assert.deepEqual(session.pendingFinishTargets('owned'),[]);assert.equal(tabValues.size,0);assert.equal(values.size,0);
},'old'));

test('same-token claim refresh erases retained targets for a revoked group',()=>fixture(async(values,tabValues)=>{
 let claims=access('current');globalThis.fetch=async()=>response(claims);const session=new NativeMonitorSessionService();await session.login('owned','password');session.rememberFinishTargets('owned',['1']);
 claims={...claims,claims:{testGroupMonitor:[{id:'other',flags:[]}]}};await session.refresh();assert.deepEqual(session.pendingFinishTargets('owned'),[]);assert.equal(tabValues.size,0);
}));

const participant=(token,flags=[],claims={test:[{id:'BOOKLET#native assignment',type:'test',label:'Owned Booklet',flags:{locked:false,running:false}}]})=>({token,flags,claims,customTexts:{},groupToken:'owned-group',loginName:'owned',access:{test:claims.test?.map(x=>x.id)}});
test('participant entry retains the native Booklet claim and purpose without inventing a run ID',()=>fixture(async values=>{
 const requests=[];globalThis.fetch=async(path,options)=>{requests.push({path,options});return response(participant('person'));};
 const session=new NativeMonitorSessionService(),result=await session.loginParticipant('owned','password');
 assert.equal(result.claims.test[0].id,'BOOKLET#native assignment');assert.equal(session.purpose(),'participant');assert.equal(values.get(storageKey+'-purpose'),'participant');assert.equal(values.get(storageKey),'person');
 assert.deepEqual(requests.map(x=>x.path),['/session/login']);assert.deepEqual(JSON.parse(requests[0].options.body),{name:'owned',password:'password'});
 assert.equal(requests[0].options.credentials,'omit');assert.equal(requests[0].options.redirect,'error');
}));
test('participant purpose restores empty assigned lists while default Monitor restoration still rejects them',()=>fixture(async values=>{
 values.set(storageKey,'person');values.set(storageKey+'-purpose','participant');globalThis.fetch=async()=>response(participant('person',[],{}));
 const session=new NativeMonitorSessionService();await settle();assert.equal(session.purpose(),'participant');assert.equal(session.access().token,'person');assert.deepEqual(session.access().claims,{});
 session.clear();assert.equal(values.size,0);assert.equal(session.purpose(),'monitor');
 values.set(storageKey,'person');const monitor=new NativeMonitorSessionService();await settle();assert.equal(monitor.access(),null);assert.equal(values.size,0);
}));
test('code entry requires a current participant Login stage and sends its exact native credential',()=>fixture(async()=>{
 const requests=[];globalThis.fetch=async(path,options)=>{requests.push({path,options});return response(path==='/session/person'?participant('person'):participant('login',['codeRequired'],{}));};
 const session=new NativeMonitorSessionService();await assert.rejects(session.person('code'),/Code-Anmeldung/);assert.equal(requests.length,0);
 await session.loginParticipant('owned','');const scope=session.accessSignal;await session.person('unchanged code');assert.equal(scope.aborted,true);assert.equal(session.access().token,'person');
 assert.deepEqual(requests.map(x=>[x.path,x.options.headers.AuthToken]),[['/session/login',undefined],['/session/person','login']]);assert.deepEqual(JSON.parse(requests[1].options.body),{code:'unchanged code'});
 await assert.rejects(session.person('again'),/Code-Anmeldung/);assert.equal(requests.length,2);
}));
test('participant code proof completion remains bound to its Login credential',()=>fixture(async()=>{
 const saved={document:globalThis.document,Worker:globalThis.Worker,solver:globalThis.__nativeMonitorChallengeFixture};const requests=[],workers=[];
 globalThis.document={baseURI:'https://owned.example/'};globalThis.Worker=class extends EventTarget{terminate(){this.stopped=true;}};
 globalThis.__nativeMonitorChallengeFixture={solveChallengeWorkers:async factory=>{workers.push(factory());return {number:7};}};
 globalThis.fetch=async(path,options)=>{requests.push({path,options});if(path==='/session/login')return response(participant('login',['codeRequired'],{}));if(path==='/session/person')return response('Brute Force protection active',400);if(path==='/session/person/challenge')return response({algorithm:'SHA-256',salt:'salt',challenge:'challenge',signature:'signature',maxNumber:7});return response(participant('person'));};
 try{const session=new NativeMonitorSessionService();await session.loginParticipant('owned','');await session.person('native-code');assert.equal(session.access().token,'person');
  assert.deepEqual(requests.slice(1).map(x=>[x.path,x.options.headers.AuthToken]),[['/session/person','login'],['/session/person/challenge','login'],['/session','login']]);assert.deepEqual(JSON.parse(requests[2].options.body),{code:'native-code'});assert.deepEqual(JSON.parse(requests[3].options.body),{algorithm:'SHA-256',salt:'salt',challenge:'challenge',signature:'signature',number:7});assert.ok(workers.length&&workers.every(w=>w.stopped));
 }finally{globalThis.document=saved.document;globalThis.Worker=saved.Worker;globalThis.__nativeMonitorChallengeFixture=saved.solver;}
}));
test('retired code completion is read and only its orphan Person credential is revoked',()=>fixture(async()=>{
 const pending=deferred(),requests=[],owner=new AbortController();globalThis.fetch=async(path,options)=>{requests.push({path,options});if(options.method==='DELETE')return response('');if(path==='/session/person')return pending.promise;return response(JSON.parse(options.body).name==='replacement'?access('replacement'):participant('login',['codeRequired'],{}));};
 const session=new NativeMonitorSessionService();await session.loginParticipant('owned','');const person=session.person('code',owner.signal),rejected=assert.rejects(person,error=>error.name==='AbortError');const write=requests.find(x=>x.path==='/session/person');
 owner.abort();await session.login('replacement','');assert.equal(write.options.signal.aborted,false);pending.resolve(response(participant('orphan')));await rejected;
 assert.equal(session.access().token,'replacement');assert.equal(session.purpose(),'monitor');assert.equal(session.problem(),'');assert.deepEqual(requests.filter(x=>x.options.method==='DELETE').map(x=>x.options.headers.AuthToken),['orphan']);
}));
test('late code completion cannot revoke a credential now owned by a replacement login',()=>fixture(async()=>{
 const pending=deferred(),requests=[],owner=new AbortController();globalThis.fetch=async(path,options)=>{requests.push({path,options});if(path==='/session/person')return pending.promise;return response(JSON.parse(options.body).name==='replacement'?access('shared'):participant('login',['codeRequired'],{}));};
 const session=new NativeMonitorSessionService();await session.loginParticipant('owned','');const person=session.person('code',owner.signal),rejected=assert.rejects(person);owner.abort();await session.login('replacement','');pending.resolve(response(participant('shared')));await rejected;
 assert.equal(session.access().token,'shared');assert.equal(requests.filter(x=>x.options.method==='DELETE').length,0);
}));
test('revoked current Login credentials clear the code stage without exposing its token',()=>fixture(async values=>{
 globalThis.fetch=async path=>path==='/session/login'?response(participant('private-login',['codeRequired'],{})):response('revoked private-login',403);
 const session=new NativeMonitorSessionService();await session.loginParticipant('owned','');await assert.rejects(session.person('code'),error=>error.status===403&&!error.message.includes('private-login'));assert.equal(session.access(),null);assert.equal(session.busy(),false);assert.equal(values.size,0);
}));
test('running-only participant refresh retains ownership; actual grant, lock and group changes retire it',()=>fixture(async()=>{
 let result=participant('person');globalThis.fetch=async()=>response(result);const session=new NativeMonitorSessionService();await session.loginParticipant('owned','');const scope=session.accessSignal;
 result=participant('person');result.claims.test[0].flags.running=true;await session.refresh();assert.equal(session.accessSignal,scope);assert.equal(scope.aborted,false);assert.equal(session.access().claims.test[0].flags.running,true);
 for(const change of [a=>a.claims.test[0].flags.locked=true,a=>a.claims.test[0].id='another Booklet',a=>a.groupToken='replacement group',a=>a.claims.test=[]]){
  const before=session.accessSignal;result=participant('person');change(result);await session.refresh();assert.equal(before.aborted,true);assert.notEqual(session.accessSignal,before);
 }
}));

async function stalledWorkers(run){
 const saved={document:globalThis.document,Worker:globalThis.Worker,solver:globalThis.__nativeMonitorChallengeFixture};const started=deferred(),workers=[];
 globalThis.document={baseURI:'https://owned.example/app/'};globalThis.Worker=class extends EventTarget{constructor(url){super();assert.equal(url.pathname,'/app/altcha-lib/dist/worker.js');}terminate(){this.stopped=true;}};
 globalThis.__nativeMonitorChallengeFixture={solveChallengeWorkers:factory=>{workers.push(factory(),factory());started.resolve();return new Promise(()=>{});}};
 globalThis.fetch=async path=>path==='/session/login'?response('Brute Force protection active',400):response({challenge:'owned',salt:'owned',algorithm:'SHA-256',signature:'owned',maxNumber:1});
 try{const session=new NativeMonitorSessionService();await run(session,workers,started.promise);}finally{globalThis.document=saved.document;globalThis.Worker=saved.Worker;globalThis.__nativeMonitorChallengeFixture=saved.solver;}
}
test('worker transport and decoding errors stop every worker and release native login',()=>fixture(async()=>{
 for(const kind of ['error','messageerror'])await stalledWorkers(async(session,workers,started)=>{
  const login=session.loginParticipant('owned',''),rejected=assert.rejects(login,/Sicherheitsprüfung/);await started;const event=new Event(kind,{cancelable:true});workers[0].dispatchEvent(event);await rejected;
  assert.equal(event.defaultPrevented,true);assert.equal(session.busy(),false);assert.equal(session.access(),null);assert.ok(workers.every(w=>w.stopped));
 });
}));
test('a silent worker cannot leave native login busy beyond its finite20s work deadline',t=>fixture(async()=>{
 t.mock.timers.enable({apis:['setTimeout']});await stalledWorkers(async(session,workers,started)=>{
  const login=session.loginParticipant('owned',''),rejected=assert.rejects(login,/nicht rechtzeitig/);await started;t.mock.timers.tick(19999);assert.equal(session.busy(),true);t.mock.timers.tick(1);await rejected;
  assert.equal(session.busy(),false);assert.equal(session.access(),null);assert.ok(workers.every(w=>w.stopped));
 });
}));

function cardStarter(text){
 let actor=new AbortController();const value=participant('owned'),session={access:()=>value,get accessSignal(){return actor.signal;},text};
 const injector=createEnvironmentInjector([{provide:NativeMonitorSessionService,useValue:session},NativeTestStarterService],Injector.NULL);
 return {service:injector.get(NativeTestStarterService),access:value,replace(){actor.abort();actor=new AbortController();},close(){injector.destroy();}};
}
test('native card start sends the exact Booklet and accepts only lossless positive int64 receipts',async()=>{
 let raw='9223372036854775807';const calls=[],f=cardStarter(async(...args)=>{calls.push(args);return raw;});try{
  assert.equal(await f.service.start('BOOKLET#native assignment',new AbortController().signal),'9223372036854775807');assert.deepEqual(calls[0].slice(0,4),['PUT','/test',{bookletName:'BOOKLET#native assignment'},'owned']);
  for(raw of ['0','01','-1','"9007199254740993"','9223372036854775808','1e3','NaN',''])await assert.rejects(f.service.start('BOOKLET#native assignment',new AbortController().signal),/Test-ID/);assert.equal(f.service.pendingBooklet(),'');
 }finally{f.close();}
});
test('native card start checks current grants and locks before creating a Test',async()=>{
 let calls=0;const f=cardStarter(async()=>{calls++;return '1';});try{
  await assert.rejects(f.service.start('another Booklet',new AbortController().signal),/nicht freigegeben/);f.access.claims.test[0].flags.locked=true;await assert.rejects(f.service.start('BOOKLET#native assignment',new AbortController().signal),/nicht freigegeben/);assert.equal(calls,0);
 }finally{f.close();}
});
test('retired card owners cannot block or clear replacement starts in the same actor',async()=>{
 const responses=[],f=cardStarter(()=>new Promise(resolve=>responses.push(resolve))),owner=new AbortController();try{
  const old=f.service.start('BOOKLET#native assignment',owner.signal),rejected=assert.rejects(old,{name:'AbortError'});await assert.rejects(f.service.start('BOOKLET#native assignment',new AbortController().signal),/bereits geöffnet/);assert.equal(responses.length,1);
  owner.abort();assert.equal(f.service.pendingBooklet(),'');const replacement=f.service.start('BOOKLET#native assignment',new AbortController().signal);assert.equal(responses.length,2);responses[0]('1');await rejected;assert.equal(f.service.pendingBooklet(),'BOOKLET#native assignment');responses[1]('9007199254740993');assert.equal(await replacement,'9007199254740993');assert.equal(f.service.pendingBooklet(),'');
 }finally{f.close();}
});
test('destroying or replacing the native starter scope rejects late create receipts and stale instances',async()=>{
 for(const retire of ['destroy','replace']){
  let resolve,signal;const f=cardStarter((...args)=>{signal=args[5];return new Promise(done=>resolve=done);});try{
   const start=f.service.start('BOOKLET#native assignment',new AbortController().signal),rejected=assert.rejects(start,{name:'AbortError'});
   if(retire==='destroy'){f.service.ngOnDestroy();assert.equal(signal.aborted,true);await assert.rejects(f.service.start('BOOKLET#native assignment',new AbortController().signal),{name:'AbortError'});}else f.replace();assert.equal(f.service.pendingBooklet(),'');resolve('9007199254740993');await rejected;
  }finally{f.close();}
 }
});
