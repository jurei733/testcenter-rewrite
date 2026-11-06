import type {NativeUnitDelivery} from './native-unit-journal';

/** Apply only fields the server would still accept. Definition stays an opaque
 * string: restoring pending answers must not parse the large Unit definition. */
export function restoreNativeUnit(value:any,pending:readonly NativeUnitDelivery[],originalUnitId:string):any{
 const clocks=value?.nativeClocks;
 const record=(v:unknown):v is Record<string,number>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.values(v).every(Number.isSafeInteger);
 if(!clocks||clocks.version!==1||!record(clocks.stateClocks)||!record(clocks.partClocks))throw Error('Native Unit read clocks unavailable.');
 const {nativeClocks,...result}=value;
 if(!pending.length)return result;
 const state=new Map<string,unknown>(Object.entries(value.state)),parts=new Map<string,unknown>(Object.entries(value.dataParts));
 const stateClocks=new Map<string,number>(Object.entries(clocks.stateClocks)),partClocks=new Map<string,number>(Object.entries(clocks.partClocks));
 let responseType=value.unitResponseType;
 for(const entry of pending){
  if(entry.originalUnitId.toUpperCase()!==originalUnitId.toUpperCase())continue;
  const body=JSON.parse(entry.payload);
  if(entry.kind==='state')for(const row of body.newState){
   if(typeof row?.key!=='string'||typeof row.content!=='string'||!Number.isSafeInteger(row.timeStamp))throw Error('Invalid retained Unit state.');
   if(row.timeStamp>(stateClocks.get(row.key)??0)){state.set(row.key,row.content);stateClocks.set(row.key,row.timeStamp);}
  }
  if(entry.kind==='response')for(const [id,content]of Object.entries(body.dataParts)){
   if(content!==null&&typeof content!=='string'||!Number.isSafeInteger(body.timeStamp))throw Error('Invalid retained Unit response.');
   if(!partClocks.has(id)||body.timeStamp>partClocks.get(id)!){parts.set(id,content);partClocks.set(id,body.timeStamp);responseType=body.responseType;}
  }
 }
 return {...result,state:Object.fromEntries(state),dataParts:Object.fromEntries(parts),unitResponseType:responseType};
}
