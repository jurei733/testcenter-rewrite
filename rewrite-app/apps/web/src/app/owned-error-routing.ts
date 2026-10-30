/** Async errors retain their original owner even after its view has retired. */
const owners=new WeakMap<object,{deliver:()=>void;delivered:boolean}>();
export function ownAsyncError<T extends object>(error:T,deliver:()=>void):T {
 if(!owners.has(error))owners.set(error,{deliver,delivered:false});
 return error;
}
export function dispatchOwnedError(error:unknown):boolean {
 const seen=new Set<object>();
 while(error&&typeof error==='object'&&!seen.has(error)){
  seen.add(error);
  const owner=owners.get(error);
  if(owner){if(!owner.delivered){owner.delivered=true;owner.deliver();}return true;}
  // Angular's rejected-promise wrapper preserves the original Error identity.
  error='rejection' in error?error.rejection:null;
 }
 return false;
}
