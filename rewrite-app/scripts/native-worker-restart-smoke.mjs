import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {writeFile} from 'node:fs/promises';
import {join} from 'node:path';

const hash=value=>createHash('sha256').update(value).digest('hex');

// Stop the actual worker realm, then observe the browser's scheduled retry.
// The blank protocol control never loads application code. It closes before
// the retried write is released; no sync event or application wake is injected.
export async function runNativeWorkerRestartSmoke({browser,context,worker,configure,release,testId,entry,revision,out,wait,serverMessages,responseReceipts,writes,mark}) {
 const syncTagsBeforeStop=await worker.evaluate(()=>self.registration.sync?.getTags?.()??[]);
 assert.ok(syncTagsBeforeStop.includes('testcenter-native-save-v1'),'The durable retry must be registered before the final window is gone');
 const rootProtocol=await browser.newBrowserCDPSession();
 try {
  await configure('native-geogebra-worker-restarted',0,'stars-closure',undefined,{testIds:[testId],closureIds:[entry.id]});
  const control=await context.newPage();
  const versionEvents=[];let version;
  try {
   assert.equal(control.url(),'about:blank');
   const protocol=await context.newCDPSession(control);
   protocol.on('ServiceWorker.workerVersionUpdated',event=>versionEvents.push(...event.versions));
   await protocol.send('ServiceWorker.enable');
   version=await wait(()=>versionEvents.find(row=>row.scriptURL===worker.url()&&row.runningStatus==='running'),'exact running worker version');
   await protocol.send('ServiceWorker.stopWorker',{versionId:version.versionId});
   await wait(()=>versionEvents.some(row=>row.versionId===version.versionId&&row.runningStatus==='stopped'),'protocol confirms stopped worker version');
  } finally {await control.close();}
  assert.equal(context.pages().length,0);
  await writeFile(join(out,'native-geogebra-worker-stopped.json'),JSON.stringify({testId,versionId:version.versionId,versionEvents,syncTagsBeforeStop,actorPages:context.pages().length,protocolControlUrl:'about:blank',protocolControlClosed:true,deliveryId:entry.id,sealedRevision:revision,sealedPayloadSha256:hash(entry.payload),manualWorkerWake:false},null,2));
  const started=Date.now(),deadline=started+420_000;let announced=started;
  while(!serverMessages.some(row=>row.nativeHeld==='native-geogebra-worker-restarted:'+testId)&&Date.now()<deadline){
   if(Date.now()-announced>30_000){console.log('waiting-for-automatic-worker-restart-ms='+(Date.now()-started));announced=Date.now();}
   await new Promise(done=>setTimeout(done,50));
  }
  const automaticallyRestarted=serverMessages.some(row=>row.nativeHeld==='native-geogebra-worker-restarted:'+testId);
  await writeFile(join(out,'native-geogebra-worker-restart-observation.json'),JSON.stringify({testId,automaticallyRestarted,elapsedMs:Date.now()-started,syncTagsBeforeStop,actorPages:context.pages().length,manualWorkerWake:false,targetsAfter:(await rootProtocol.send('Target.getTargets')).targetInfos.filter(target=>target.type==='service_worker'),versionEvents,responseReceipts:responseReceipts.filter(row=>row.phase.startsWith('native-geogebra-worker')||row.phase==='native-geogebra-large-closed')},null,2));
  assert.equal(automaticallyRestarted,true,'Actual worker must resume its sealed real GeoGebra response after termination without any actor page or manual wake');
  assert.equal(context.pages().length,0);
  assert.equal(await release('native-geogebra-worker-restarted:'+testId),true);
  await wait(()=>writes.some(row=>row.deliveryId===entry.id),'restarted worker receives the exact real large response acknowledgement');
  mark('native-real-GeoGebra-worker-termination-restarts-and-delivers-with-zero-actor-pages');
 } finally {await rootProtocol.detach();}
}
