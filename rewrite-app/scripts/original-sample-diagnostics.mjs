import {mkdir, writeFile} from 'node:fs/promises';
import {join} from 'node:path';

// Read-only observations of the owned Original sample. Never record headers,
// URL queries, player configuration, definitions, or unrelated request fields.
export async function observeOriginalSample(page) {
  const data={version:1,events:[],requests:[],acknowledgements:[],diagnosticErrors:[]};
  let active=true,nextFrame=0;const frames=new WeakMap(),pending=new Set();
  const append=(name,value,limit=256)=>{if(!active)return;data[name].push(value);if(data[name].length>limit)data[name].shift();};
  await page.exposeBinding('__ownedOriginalSampleTrace',({frame},record)=>{
    if(!frames.has(frame))frames.set(frame,++nextFrame);
    append('events',{observedAt:Date.now(),frame:frames.get(frame),...record});
  });
  await page.addInitScript(()=>{
    const nodes=new WeakMap();let nextNode=0;
    const state=()=>{const input=document.querySelector('input[name="required-text-field"]');
      if(input&&!nodes.has(input))nodes.set(input,++nextNode);
      return{document:performance.timeOrigin,value:input?.value??null,node:input?nodes.get(input):null,
        documentFocused:document.hasFocus(),inputFocused:input===document.activeElement};};
    const record=value=>{void globalThis.__ownedOriginalSampleTrace(value).catch(()=>{});};
    for(const type of ['input','change','keydown','keyup'])addEventListener(type,event=>{
      if(event.target?.matches?.('input[name="required-text-field"]'))record({kind:'input',type,
        trusted:event.isTrusted,key:event.key??null,inputType:event.inputType??null,data:event.data??null,...state()});
    },true);
    addEventListener('message',event=>{
      const packet=event.data;if(typeof packet?.type!=='string'||!packet.type.startsWith('vop'))return;
      record({kind:'message',type:packet.type,sessionId:packet.sessionId??null,timeStamp:packet.timeStamp??null,
        unitState:packet.unitState?Object.fromEntries(['dataParts','presentationProgress','responseProgress','unitStateDataType']
          .filter(key=>Object.hasOwn(packet.unitState,key)).map(key=>[key,packet.unitState[key]])):null,fromCurrentFrame:event.source===document.querySelector('#participantVeronaPlayerFrame')?.contentWindow,
        fromParent:event.source===parent,origin:event.origin,...state()});
      if(packet.type==='vopStartCommand')queueMicrotask(()=>record({kind:'start-after',sessionId:packet.sessionId,...state()}));
    },true);
  });
  const isSave=request=>new URL(request.url()).origin===new URL(page.url()).origin&&request.method()==='POST'&&/^\/api\/v1\/participant\/test-runs\/[^/]+\/save-progress$/.test(new URL(request.url()).pathname);
  const onRequest=request=>{
    if(!active||!isSave(request))return;
    try{const body=request.postDataJSON();append('requests',{observedAt:Date.now(),path:new URL(request.url()).pathname,
      body:Object.fromEntries(['deliveryId','responseOnly','responseTimestamp','currentUnitKey','responseUnitKey','status','unitResponse']
        .filter(key=>Object.hasOwn(body,key)).map(key=>[key,body[key]]))},32);
    }catch(error){append('diagnosticErrors','Request decode: '+String(error),16);}
  };
  const onResponse=response=>{
    if(!active||!isSave(response.request()))return;
    const task=response.json().then(payload=>{
      const run=(payload.currentRunState??payload.runtimeState??payload).testRun;
      append('acknowledgements',{observedAt:Date.now(),status:response.status(),
        deliveryId:response.request().postDataJSON()?.deliveryId??null,run:run?{
        testRunId:run.testRunId,stateRevision:run.stateRevision,currentUnitKey:run.currentUnitKey,
        unitResponses:run.unitResponses,unitResponseFieldTimestamps:run.unitResponseFieldTimestamps}:null},32);
    }).catch(error=>append('diagnosticErrors','ACK decode: '+String(error),16)).finally(()=>pending.delete(task));
    pending.add(task);
  };
  page.on('request',onRequest);page.on('response',onResponse);
  return {data,async write(directory){
    let timer;
    try{await Promise.race([Promise.allSettled([...pending]),new Promise(done=>{timer=setTimeout(()=>{
      append('diagnosticErrors','ACK diagnostic capture deadline',16);done();},2000);})]);}
    finally{clearTimeout(timer);}
    await mkdir(directory,{recursive:true});
    await writeFile(join(directory,'trace.json'),JSON.stringify(data,null,2));
  },stop(){active=false;page.off('request',onRequest);page.off('response',onResponse);}};
}
