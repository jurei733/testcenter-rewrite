export type OriginalWorkspaceResultsTransport=(method:'GET'|'DELETE',path:string,body:unknown,token:string,signal:AbortSignal,csv?:boolean)=>Promise<unknown>;
/** Bounded native requests keep expected authorization failures in this view.
 * CSV is never decoded or reserialized on its way to the browser download. */
export function createOriginalWorkspaceResultsTransport(fetcher:typeof fetch=globalThis.fetch):OriginalWorkspaceResultsTransport {
 return async(method,path,body,token,owner,csv=false)=>{
  const allowed=method==='GET'&&/^\/api\/v1\/tenants\/[^/?]+\/workspaces\/[^/?]+\/original-administration$/.test(path)||
   method==='GET'&&/^\/workspace\/[1-9]\d*\/(?:results|responses\/detailed|report\/(?:response|log|review)\?[^#]*)$/.test(path)||
   method==='DELETE'&&/^\/workspace\/[1-9]\d*\/responses(?:\/detailed)?$/.test(path);
  if(!token||!allowed)throw Error('Ungültige Anfrage der Ergebnisverwaltung.');
  owner.throwIfAborted();const signal=AbortSignal.any([owner,AbortSignal.timeout(30000)]);
  const response=await fetcher(path,{method,signal,cache:'no-store',credentials:'omit',redirect:'error',
   headers:{AuthToken:token,Accept:csv?'text/csv':'application/json',...body===undefined?{}:{'Content-Type':'application/json'}},
   ...body===undefined?{}:{body:JSON.stringify(body)}});
  if(!response.ok){await response.body?.cancel();throw Error(response.status===401||response.status===403?
   'Die Anmeldung oder die Berechtigung ist nicht mehr gültig.':`Die Ergebnisanfrage ist fehlgeschlagen (${response.status}).`);}
  const value=csv?await response.blob():method==='DELETE'?undefined:await response.json();
  signal.throwIfAborted();return value;
 };
}
