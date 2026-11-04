type EditorKind='create-user'|'create-workspace'|'rename-workspace'|'reset-password';

/** Native varchar(50) counts Unicode code points. Workspace PDO parameters
 * end at NUL and PostgreSQL accepts excess U+0020, truncating only that tail. */
export function exceedsOriginalAdministrationNameLimit(value:string,kind:EditorKind):boolean {
  if(kind==='reset-password')return false;
  const points=[...(kind==='create-user'?value:value.split('\0',1)[0]!)];
  return kind==='create-user'?points.length>50:points.slice(50).some(point=>point!==' ');
}

export function exceedsOriginalAdministrationPasswordBytes(value:string):boolean {
  return new TextEncoder().encode(value).length>60;
}

/** Native display timestamps are local calendar values. ISO's T separator
 * preserves that meaning without relying on implementation-defined SQL parsing. */
export function originalAdministrationModificationDate(value:string|null):Date|null {
  if(!value)return null;
  const date=new Date(value.replace(/^(\d{4}-\d{2}-\d{2}) /,'$1T'));
  return Number.isFinite(date.getTime())?date:null;
}
