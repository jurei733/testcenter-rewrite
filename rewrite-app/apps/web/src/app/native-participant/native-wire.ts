/** Native PHP int64 identities are opaque decimal strings inside the controller. */
const maximum=9223372036854775807n;
function integer(value:unknown,source:string|undefined,zero=false):string{
 if(typeof value!=='number')throw Error('Native identity must be a JSON integer.');
 const raw=source??(Number.isSafeInteger(value)?String(value):'');
 if(!(zero?/^(?:0|[1-9][0-9]{0,18})$/:/^[1-9][0-9]{0,18}$/).test(raw)||BigInt(raw)>maximum)throw Error('Native identity cannot be read without loss.');
 return raw;
}
export type NativeCommand={id:string;keyword:string;arguments:string[];timestamp:string};
export function parseNativeParticipantJson(path:string,text:string):unknown{
 if(path==='/test')return integer(Number(text),text);
 const tokens=new WeakMap<object,Record<string,string>>();
 const data:unknown=JSON.parse(text,function(this:object,key:string,value:unknown,context?:{source?:string}){
  if(context?.source&&['id','timestamp','workspaceId'].includes(key)&&typeof value==='number'){
   const fields=tokens.get(this)??{};fields[key]=context.source;tokens.set(this,fields);
  }return value;
 });
 if(/^\/test\/[^/]+\/commands$/.test(path)){
  if(!Array.isArray(data))throw Error('Native commands must be an array.');
  let previous=0n;
  return data.map(row=>{
   if(!row||typeof row!=='object'||typeof row.keyword!=='string'||!Array.isArray(row.arguments)||row.arguments.some((v:unknown)=>typeof v!=='string'))throw Error('Malformed native command.');
   const raw=tokens.get(row),id=integer(row.id,raw?.['id']),timestamp=integer(row.timestamp,raw?.['timestamp'],true);
   if(BigInt(id)<=previous)throw Error('Native commands must have distinct ascending identities.');previous=BigInt(id);
   return {id,keyword:row.keyword,arguments:row.arguments,timestamp} satisfies NativeCommand;
  });
 }
 if(/^\/test\/[^/]+$/.test(path)&&data&&typeof data==='object'&&!Array.isArray(data)){
  const object=data as Record<string,unknown>;object['workspaceId']=integer(object['workspaceId'],tokens.get(object)?.['workspaceId']);
 }
 return data;
}
