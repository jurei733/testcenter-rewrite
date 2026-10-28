import type {TestSessionChange} from './common/test-session-change.interface';
const nativeId=(value:string):string=>{if(!/^[1-9][0-9]{0,18}$/.test(value)||BigInt(value)>9223372036854775807n)throw Error('Ungültige native Testkennung.');return value;};
/** Source emits signed-int64 JSON integers. Modern JSON.parse source context
 * preserves their exact tokens; older engines must fail closed for unsafe IDs. */
export function parseNativeMonitorSnapshot(text:string):TestSessionChange[]{
 const rows:unknown=JSON.parse(text,function(this:Record<string,unknown>,key:string,value:unknown,context?:{source?:string}){
  if(!Object.hasOwn(this,'personId')||!Object.hasOwn(this,'testId')||!Object.hasOwn(this,'groupName'))return value;
  if(key!=='testId'&&key!=='personId')return value;
  if(typeof value!=='number')throw Error('Ungültige native Sitzungskennung.');
  if(context?.source)return nativeId(context.source);
  if(!Number.isSafeInteger(value))throw Error('Dieser Browser kann die native Sitzungskennung nicht verlustfrei lesen.');
  return nativeId(String(value));
 });
 if(!Array.isArray(rows)||rows.some(row=>!row||typeof row!=='object'||typeof row.testId!=='string'||typeof row.personId!=='string'||typeof row.groupName!=='string'||typeof row.personLabel!=='string'||!Number.isFinite(row.timestamp)||!row.testState||!row.unitState))throw Error('Ungültige native Sitzungsdaten.');
 return rows as TestSessionChange[];
}
export function nativeMonitorSelectionBody(ids:string[],fields:Record<string,unknown>={}):string{
 const base=JSON.stringify(fields);return base.slice(0,-1)+(base.length>2?',':'')+'"testIds":['+ids.map(nativeId).join(',')+']}';
}
