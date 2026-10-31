/** Native PHP int64 identities are opaque decimal strings inside the controller. */
const maximum=9223372036854775807n;
function integer(value:unknown,source:string|undefined,zero=false):string{
 if(typeof value!=='number')throw Error('Native identity must be a JSON integer.');
 const raw=source??(Number.isSafeInteger(value)?String(value):'');
 if(!(zero?/^(?:0|[1-9][0-9]{0,18})$/:/^[1-9][0-9]{0,18}$/).test(raw)||BigInt(raw)>maximum)throw Error('Native identity cannot be read without loss.');
 return raw;
}
export type NativeCommand={id:string;keyword:string;arguments:string[];timestamp:string};
export function parseNativeParticipantJson(path:string,text:string):unknown{return parseNativeWire(path,text);}
export function parseNativeParticipantBroadcast(path:string,text:string):NativeCommand[]|undefined{return parseNativeWire(path,text,'commands') as NativeCommand[]|undefined;}
function parseNativeWire(path:string,text:string,channel?:string):unknown{
 if(path==='/test')return integer(Number(text),text);
 const tokens=new WeakMap<object,Record<string,string>>();
 let data:unknown=JSON.parse(text,function(this:object,key:string,value:unknown,context?:{source?:string}){
  if(context?.source&&['id','timestamp','workspaceId','person_id','test_id','booklet_id','page'].includes(key)&&typeof value==='number'){
   const fields=tokens.get(this)??{};fields[key]=context.source;tokens.set(this,fields);
  }return value;
 });
 if(channel){if(!data||typeof data!=='object'||Array.isArray(data)||typeof (data as any).event!=='string')throw Error('Malformed native broadcast');if((data as any).event!==channel)return;data=(data as any).data;}
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
 if(/^\/test\/[^/]+(?:\/unit\/[^/]+)?\/reviews$/.test(path)){
  if(!Array.isArray(data))throw Error('Native Reviews must be an array.');
  const unit=path.includes('/unit/');
  return data.map(row=>{
   if(!row||typeof row!=='object'||typeof row.entry!=='string'||typeof row.categories!=='string'||!Number.isInteger(row.priority)||row.priority<0||row.priority>3||!(row.reviewer===null||typeof row.reviewer==='string'))throw Error('Malformed native Review.');
   const raw=tokens.get(row);let page:string|null=null;
   if(unit&&row.page!==null){const value=raw?.['page']??(Number.isSafeInteger(row.page)?String(row.page):'');
    if(typeof row.page!=='number'||!/^(?:0|-?[1-9][0-9]{0,18})$/.test(value)||BigInt(value)<-9223372036854775808n||BigInt(value)>maximum)throw Error('Native Review page cannot be read without loss.');page=value;}
   return {...row,id:integer(row.id,raw?.['id']),person_id:integer(row.person_id,raw?.['person_id']),
    ...(unit?{test_id:integer(row.test_id,raw?.['test_id']),page}:{booklet_id:integer(row.booklet_id,raw?.['booklet_id'])})};
  });
 }
 if(/^\/test\/[^/]+$/.test(path)&&data&&typeof data==='object'&&!Array.isArray(data)){
  const object=data as Record<string,unknown>;object['workspaceId']=integer(object['workspaceId'],tokens.get(object)?.['workspaceId']);
 }
 return data;
}
