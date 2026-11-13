/** Read-only observation of the current unsealed draft. Staged revisions may
 * coalesce under one delivery ID; only a sealed revision is immutable. */
export function readCurrentNativeUnitMirror(page,identity){
 return page.evaluate(async({bucket,actor,testId,id,unitAlias,originalUnitId,queuedAt})=>{
  const db=await new Promise((resolve,reject)=>{
   const request=indexedDB.open('testcenter-native-save-v1',1);
   request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
  });
  try{
   return await new Promise((resolve,reject)=>{
    const request=db.transaction('documents').objectStore('documents').get(bucket);
    request.onerror=()=>reject(request.error);
    request.onsuccess=()=>{
     try{
      // Read the live local revision in the same task as its IndexedDB result.
      const local=JSON.parse(localStorage.getItem(bucket)||'null'),row=request.result;
      if(!local||local.version!==1||local.actor!==actor||local.testId!==testId||
       !row||row.sealed!==false||row.document.actor!==actor||row.document.testId!==testId||
       !Number.isSafeInteger(row.revision)||row.revision<(local.revision??0)){
       resolve(false);return;
      }
      const current=local.entries.find(entry=>entry.id===id),stored=row.document.entries.find(entry=>entry.id===id);
      const expected=entry=>entry?.kind==='response'&&entry.phase==='staged'&&
       entry.unitAlias===unitAlias&&entry.originalUnitId===originalUnitId&&entry.queuedAt===queuedAt;
      if(!expected(current)||!expected(stored)||stored.payload!==current.payload){resolve(false);return;}
      resolve({key:bucket,actor,testId,entry:current,localRevision:local.revision??0,mirrorRevision:row.revision});
     }catch(error){reject(error);}
    };
   });
  }finally{db.close();}
 },identity);
}
