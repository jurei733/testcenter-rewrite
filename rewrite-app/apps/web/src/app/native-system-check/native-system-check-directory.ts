export type NativeSystemCheckInfo={workspaceId:string;name:string;label:string;description:string};

export function parseNativeSystemCheckDirectory(text:string):NativeSystemCheckInfo[]{
 if(text==='')return[];
 const value:unknown=JSON.parse(text,(key,value,context?:{source?:string})=>{
  if(key!=='workspaceId'||typeof value!=='number')return value;
  if(context?.source&&/^[1-9][0-9]*$/.test(context.source))return context.source;
  if(Number.isSafeInteger(value)&&value>0)return String(value);
  throw new Error('Die Arbeitsbereichsnummer ist nicht verlustfrei lesbar.');
 });
 if(!Array.isArray(value))throw new Error('Ungültige Systemcheck-Auswahl.');
 return value.map(row=>{
  if(!row||typeof row!=='object'||typeof row.workspaceId!=='string'||!/^[1-9][0-9]{0,18}$/.test(row.workspaceId)||
   BigInt(row.workspaceId)>9223372036854775807n||typeof row.name!=='string'||!row.name||/[\/\\\u0000-\u001f\u007f]/.test(row.name)||
   typeof row.label!=='string'||typeof row.description!=='string')throw new Error('Ungültiger Systemcheck-Eintrag.');
  return{workspaceId:row.workspaceId,name:row.name,label:row.label,description:row.description};
 });
}
