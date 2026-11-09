/* Shared by the application and the classic Service Worker. No private API is cached. */
(function(root,factory){
 if(typeof module==='object'&&module.exports)module.exports=factory();
 else root.TestcenterNativeSave=factory();
})(globalThis,function(){
 const DATABASE='testcenter-native-save-v1',DOCUMENTS='documents',GRANTS='grants',SYNC_TAG='testcenter-native-save-v1';
 const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
 const HASH=/^[a-f0-9]{64}$/,PREFIX='testcenter-native-';
 const integer=n=>Number.isSafeInteger(n)&&n>=0;
 const token=t=>typeof t==='string'&&/^[\x21-\x7e]{1,4096}$/.test(t);
 const invalid=()=>Error('Invalid native background save.');
 const runLock=(actor,testId)=>'testcenter-native-recovery:'+actor+':'+testId;
 const unitLock=(actor,testId)=>'testcenter-native-foreground-unit:'+actor+':'+testId;
 function stateBase(base,length){
  if(!base||base.version!==1||!integer(base.revision)||!integer(base.controlEpoch)||base.controlEpoch>base.revision||JSON.stringify(base).length>8192||
   Object.keys(base).some(k=>!['version','revision','controlEpoch','previousDeliveryId','segments'].includes(k))||base.previousDeliveryId!==undefined&&!UUID.test(base.previousDeliveryId))throw invalid();
  let last=0;if(base.segments!==undefined&&(!Array.isArray(base.segments)||!base.segments.length||base.segments.length>32||base.segments.some(s=>{
   if(!s||!integer(s.start)||s.start<=last||s.start>=length||!integer(s.revision)||!integer(s.controlEpoch)||s.controlEpoch>s.revision||Object.keys(s).some(k=>!['start','revision','controlEpoch'].includes(k)))return true;last=s.start;return false;
  })))throw invalid();
 }
 function snapshot(bucket,text){
  if(typeof bucket!=='string'||typeof text!=='string'||text.length>4_500_000)throw invalid();
  const match=/^testcenter-native-(unit|test)-journal:v1:([a-f0-9]{64}):([1-9][0-9]{0,18}):(.+)$/.exec(bucket);
  if(!match||!UUID.test(match[4])||BigInt(match[3])>9223372036854775807n)throw invalid();
  const document=JSON.parse(text),kind=match[1],actor=match[2],testId=match[3];
  if(!document||document.version!==1||document.actor!==actor||document.testId!==testId||!integer(document.revision??0)||!Array.isArray(document.entries)||document.entries.length>10000||new Set(document.entries.map(e=>e?.id)).size!==document.entries.length)throw invalid();
  for(const entry of document.entries){
   if(!entry||!UUID.test(entry.id)||!integer(entry.queuedAt)||!['staged','ready'].includes(entry.phase)||typeof entry.payload!=='string')throw invalid();
   const body=JSON.parse(entry.payload);
   if(kind==='unit'){
    if(!['state','response','log'].includes(entry.kind)||typeof entry.unitAlias!=='string'||!entry.unitAlias.length||Array.from(entry.unitAlias).length>255||/[\/\\\u0000-\u001f\u007f]/.test(entry.unitAlias)||typeof entry.originalUnitId!=='string'||Array.from(entry.originalUnitId).length>255||!body||typeof body!=='object'||Array.isArray(body)||body.originalUnitId!==entry.originalUnitId||
      entry.kind==='state'&&!Array.isArray(body.newState)||entry.kind==='response'&&(!integer(body.timeStamp)||!body.dataParts||typeof body.dataParts!=='object'||Array.isArray(body.dataParts)||typeof body.responseType!=='string')||entry.kind==='log'&&!Array.isArray(body.logEntries))throw invalid();
   }else{
    if(!['state','log'].includes(entry.kind)||!Array.isArray(body)||entry.kind==='log'&&(entry.phase!=='ready'||entry.base!==undefined))throw invalid();
    if(entry.kind==='state'){stateBase(entry.base,body.length);if(entry.base.previousDeliveryId===entry.id)throw invalid();}
   }
  }
  return {bucket,kind,actor,testId,revision:document.revision??0,document};
 }
 async function actorHash(crypto,value){
  if(!token(value)||!crypto?.subtle)throw invalid();
  const raw=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));return Array.from(new Uint8Array(raw),byte=>byte.toString(16).padStart(2,'0')).join('');
 }
 async function entryFingerprint(crypto,entry){
  const value=JSON.stringify({kind:entry.kind,unitAlias:entry.unitAlias,originalUnitId:entry.originalUnitId,payload:entry.payload,base:entry.base});
  const raw=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));return Array.from(new Uint8Array(raw),byte=>byte.toString(16).padStart(2,'0')).join('');
 }
 function createRuntime(env){
  const open=()=>new Promise((resolve,reject)=>{
   const request=env.indexedDB.open(DATABASE,1);
   request.onupgradeneeded=()=>{const db=request.result;if(!db.objectStoreNames.contains(DOCUMENTS)){const store=db.createObjectStore(DOCUMENTS,{keyPath:'bucket'});store.createIndex('pending','pending');}if(!db.objectStoreNames.contains(GRANTS))db.createObjectStore(GRANTS,{keyPath:'actor'});};
   request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error??invalid());request.onblocked=()=>reject(Error('Native save database is blocked.'));
  });
  const transaction=async(store,mode,operation)=>{
   const db=await open();try{return await new Promise((resolve,reject)=>{
    const tx=db.transaction(store,mode);let result;operation(tx.objectStore(store),value=>{result=value;});
    tx.oncomplete=()=>resolve(result);tx.onabort=()=>reject(tx.error??invalid());tx.onerror=()=>reject(tx.error??invalid());
   });}finally{db.close();}
  };
  const read=(store,key)=>transaction(store,'readonly',(s,done)=>{const request=s.get(key);request.onsuccess=()=>done(request.result);});
  const pending=()=>transaction(DOCUMENTS,'readonly',(s,done)=>{const request=s.index('pending').getAll(1);request.onsuccess=()=>done(request.result);});
  const controllers=new Map();let draining,requested=0,deferUnsealed=false;
  const authorize=async value=>{const actor=await actorHash(env.crypto,value);await transaction(GRANTS,'readwrite',s=>s.put({actor,token:value,active:true}));return actor;};
  const retire=async value=>{
   const actor=await actorHash(env.crypto,value);controllers.get(actor)?.controller.abort();
   await transaction(GRANTS,'readwrite',s=>s.put({actor,active:false}));
  };
  const putSnapshot=async(bucket,text,sealed=false,preferredUnitAlias)=>{
   const value=snapshot(bucket,text);return transaction(DOCUMENTS,'readwrite',s=>{
    const request=s.get(bucket);request.onsuccess=()=>{
     const previous=request.result;
     if(previous&&(previous.revision>value.revision||previous.revision===value.revision&&(previous.sealed||!sealed)))return;
     s.put({...value,sealed:!!sealed,pending:Number(value.document.entries.length>0),receipts:value.document.entries.length?(previous?.receipts??{}):{},...(typeof preferredUnitAlias==='string'?{preferredUnitAlias}:previous?.preferredUnitAlias?{preferredUnitAlias:previous.preferredUnitAlias}:{} )});
    };
   });
  };
  const acknowledge=async(record,entry)=>{const fingerprint=await entryFingerprint(env.crypto,entry);return transaction(DOCUMENTS,'readwrite',s=>{
   const request=s.get(record.bucket);request.onsuccess=()=>{
    const current=request.result;if(!current||!current.sealed||current.revision!==record.revision)return;
    const row=current.document.entries.find(row=>row.id===entry.id);
    if(!row||row.kind!==entry.kind||row.payload!==entry.payload||JSON.stringify(row.base)!==JSON.stringify(entry.base))throw invalid();
    current.document.entries=current.document.entries.filter(row=>row.id!==entry.id);current.pending=Number(current.document.entries.length>0);current.receipts={...current.receipts,[entry.id]:fingerprint};s.put(current);
   };
  });};
  const locked=async(name,operation)=>{
   if(!env.locks?.request)throw Error('Native save ownership is unavailable.');
   return env.locks.request(name,{ifAvailable:true},lock=>lock?operation():false);
  };
  const runRecovery=async(actor,testId,signal,operation)=>{
   if(!HASH.test(actor)||!/^\d+$/.test(testId)||!env.locks?.request)throw invalid();
   return env.locks.request(runLock(actor,testId),{signal},operation);
  };
  const yieldUnits=(actor,testId)=>{
   const active=controllers.get(actor);if(active?.testId===testId&&active.kind==='unit')active.controller.abort();
  };
  const drainOnce=async options=>{
   const io={pending,readRecord:bucket=>read(DOCUMENTS,bucket),readGrant:actor=>read(GRANTS,actor),acknowledge,send:env.fetch,retireGrant:retire,locked,...options};
   const records=await io.pending(),runs=new Map();let retry=false;
   for(const row of records)try{
    if(!row?.sealed){
     // A sync opportunity must survive until its final handoff arrives. Keep
     // the authored window intact: an unsealed draft is never dispatched.
     if(options?.deferUnsealed&&row?.pending){
      const checked=snapshot(row.bucket,JSON.stringify(row.document));
      if(['actor','testId','kind','revision'].some(key=>checked[key]!==row[key]))throw invalid();
      const grant=await io.readGrant(row.actor);
      if(grant?.active&&token(grant.token)&&await actorHash(env.crypto,grant.token)===row.actor)retry=true;
     }
     continue;
    }
    const checked=snapshot(row.bucket,JSON.stringify(row.document));
    if(['actor','testId','kind','revision'].some(key=>checked[key]!==row[key]))throw invalid();
    const key=row.actor+':'+row.testId;if(!runs.has(key))runs.set(key,[]);runs.get(key).push(row);
   }catch{retry=true;}
   for(const group of runs.values())try{
    const first=group[0],result=await io.locked(runLock(first.actor,first.testId),async()=>{
     const grant=await io.readGrant(first.actor);if(!grant?.active||!token(grant.token)||await actorHash(env.crypto,grant.token)!==first.actor)return true;
     const active={controller:new AbortController(),testId:first.testId,kind:undefined};controllers.set(first.actor,active);
     try{
      for(const original of group){
       active.kind=original.kind;const controller=active.controller=new AbortController();
       const deliver=()=>io.locked(original.bucket,async()=>{
        const record=await io.readRecord(original.bucket);if(!record?.sealed||!record.pending)return true;
        const checked=snapshot(record.bucket,JSON.stringify(record.document));
        if(['actor','testId','kind','revision'].some(key=>checked[key]!==record[key])||record.actor!==first.actor||record.testId!==first.testId)throw invalid();
        const rows=order(record),blocked=new Set();for(const entry of rows){
         const dependency=record.kind==='unit'?entry.unitAlias:entry.base?.previousDeliveryId;
         if(dependency&&blocked.has(dependency)){if(record.kind==='test')blocked.add(entry.id);continue;}
         try{
         const latest=await io.readGrant(record.actor);if(!latest?.active||latest.token!==grant.token||controller.signal.aborted)return true;
         const send=async(kind,payload,id,base)=>{
          const path=record.kind==='unit'?`/test/${record.testId}/unit/${encodeURIComponent(entry.unitAlias)}/${kind}`:`/test/${record.testId}/${kind}`;
          const response=await io.send(new URL(path,env.origin),{method:kind==='state'?'PATCH':'PUT',cache:'no-store',credentials:'omit',redirect:'error',signal:AbortSignal.any([controller.signal,AbortSignal.timeout(20000)]),headers:{AuthToken:grant.token,'Content-Type':'application/json','X-Native-Delivery-Id':id,...(base?{'X-Native-State-Base':JSON.stringify(base)}:{})},body:payload});
          if(!response.ok){if([401,403].includes(response.status))await io.retireGrant(grant.token);throw Error('Native background delivery remains queued ('+response.status+').');}
          if(record.kind==='test'&&kind==='state'){
           const value=JSON.parse(response.headers.get('x-native-state-result')??'null');if(!value||value.version!==1||!integer(value.revision)||!integer(value.controlEpoch)||value.controlEpoch>value.revision||typeof value.superseded!=='boolean')throw invalid();
          }
          await response.text();controller.signal.throwIfAborted();
         };
         if(record.kind==='unit'&&entry.kind==='response')await send('state',JSON.stringify({newState:[],originalUnitId:entry.originalUnitId}),entry.id);
         await send(entry.kind,entry.payload,entry.id,entry.base);
         const currentGrant=await io.readGrant(record.actor);if(!currentGrant?.active||currentGrant.token!==grant.token)throw Error('Native save grant retired.');
         await io.acknowledge(record,entry);
         }catch{retry=true;blocked.add(record.kind==='unit'?entry.unitAlias:entry.id);}
        }return true;
       });
       const accepted=original.kind==='unit'?await io.locked(unitLock(first.actor,first.testId),deliver):await deliver();if(accepted===false)retry=true;
      }
     }finally{if(controllers.get(first.actor)===active)controllers.delete(first.actor);}
     return true;
    });if(result===false)retry=true;
   }catch{retry=true;}
   if(retry)throw Error('Native background saves remain queued.');
  };
  const drain=options=>{deferUnsealed||=options?.deferUnsealed===true;requested++;return draining??=(async()=>{
   for(;;){
    const observed=requested;let failure;
    try{await drainOnce({...options,deferUnsealed});}catch(error){failure=error;}
    // A late handoff still owns a pass when an older independent packet fails.
    if(observed!==requested)continue;if(failure)throw failure;return;
   }
  })().finally(()=>{draining=undefined;deferUnsealed=false;});};
  return {authorize,retire,putSnapshot,drain,runRecovery,yieldUnits,readRecord:bucket=>read(DOCUMENTS,bucket),pending,actorHash:value=>actorHash(env.crypto,value),entryFingerprint:entry=>entryFingerprint(env.crypto,entry)};
 }
 function order(record){
  const entries=[...record.document.entries];
  if(record.kind==='unit')return entries.sort((a,b)=>Number(b.unitAlias===record.preferredUnitAlias)-Number(a.unitAlias===record.preferredUnitAlias)||(a.kind==='state'?0:1)-(b.kind==='state'?0:1)||a.queuedAt-b.queuedAt);
  const pending=new Map(entries.map(row=>[row.id,row])),visited=new Set(),visiting=new Set(),result=[];
  const visit=row=>{if(visited.has(row.id))return;if(visiting.has(row.id))throw invalid();visiting.add(row.id);const before=pending.get(row.base?.previousDeliveryId);if(before)visit(before);visiting.delete(row.id);visited.add(row.id);result.push(row);};
  entries.sort((a,b)=>a.queuedAt-b.queuedAt).forEach(visit);return result;
 }
 function installWorker(worker){
  const runtime=createRuntime({indexedDB:worker.indexedDB,crypto:worker.crypto,locks:worker.navigator?.locks,fetch:worker.fetch.bind(worker),origin:worker.location.origin});
  const retry=()=>worker.registration.sync?.register(SYNC_TAG);
  const notify=async()=>{
   const clients=await worker.clients?.matchAll?.({type:'window',includeUncontrolled:true})??[];
   for(const client of clients)try{const url=new URL(client.url);if(url.origin===worker.location.origin&&url.pathname.startsWith(new URL(worker.registration.scope).pathname))client.postMessage({type:'testcenter-native-save-receipt-v1'});}catch{/* Ignore a retired client. */}
  };
  let grants=Promise.resolve();
  worker.addEventListener('message',event=>{
   const m=event.data;if(!m||m.type!=='testcenter-native-save-v1')return;
   let source;try{source=new URL(event.source?.url);}catch{return;}
   if(source.origin!==worker.location.origin||!source.pathname.startsWith(new URL(worker.registration.scope).pathname))return;
   const operation=async()=>{
    if(m.action==='seal'){await runtime.putSnapshot(m.bucket,m.text,true,m.preferredUnitAlias);return runtime.drain();}
    if(m.action==='authorize'){grants=grants.catch(()=>{}).then(()=>runtime.authorize(m.token));await grants;return runtime.drain();}
    if(m.action==='retire'){grants=grants.catch(()=>{}).then(()=>runtime.retire(m.token));return grants;}
    if(m.action==='yield-units'){runtime.yieldUnits(await runtime.actorHash(m.token),m.testId);return;}
    if(m.action==='drain')return runtime.drain();
    throw invalid();
   };
   event.waitUntil(operation().then(async()=>{await notify();event.ports?.[0]?.postMessage({ok:true});},async()=>{
    try{await retry();}catch{/* A missing Background Sync capability leaves the stored packet intact. */}
    await notify();
    event.ports?.[0]?.postMessage({ok:false});
   }));
  });
  worker.addEventListener('sync',event=>{if(event.tag===SYNC_TAG)event.waitUntil(runtime.drain({deferUnsealed:true}).finally(notify));});
 }
 return {DATABASE,SYNC_TAG,snapshot,order,runLock,unitLock,createRuntime,installWorker};
});
