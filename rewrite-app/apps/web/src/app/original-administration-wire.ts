import type {OriginalAdminAccessSet} from '@testcenter-rewrite-app/contracts/original-session';

export type OriginalAdmin = {id:string;name:string;email:null|string;isSuperadmin:boolean};
export type OriginalWorkspace = {id:string;name:string;latest_modification_ts:string|null};
export type OriginalPermission = {id:string;name:string;selected:boolean;role:string};
const maximum=9223372036854775807n;
export function originalAdministrationId(value:string):string {
  if(!/^[1-9][0-9]{0,18}$/.test(value)||BigInt(value)>maximum)throw Error('Ungültige native Verwaltungskennung.');
  return value;
}
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
/** Keep Source int64 tokens before a JavaScript Number can round them. */
export function parseOriginalAdministrationWire(path:string,text:string):unknown {
  if(path==='/user'||path==='/workspace')return originalAdministrationId(text.trim());
  if(text==='')return undefined;
  const numericIds=new WeakSet<object>();
  const value:unknown=JSON.parse(text,function(this:object,key:string,v:unknown,context?:{source?:string}){
    if(key!=='id'||typeof v!=='number')return v;
    numericIds.add(this);
    return originalAdministrationId(context?.source??(Number.isSafeInteger(v)?String(v):''));
  });
  if(path==='/session'){
    if(!object(value)||!numericIds.has(value)||typeof value['id']!=='string'||typeof value['token']!=='string'||!object(value['claims'])||
      !Array.isArray(value['claims']['superAdmin'])||!Array.isArray(value['claims']['workspaceAdmin']))throw Error('Keine gültige Superadmin-Sitzung.');
    return value as OriginalAdminAccessSet;
  }
  if(!Array.isArray(value))throw Error('Ungültiges natives Verwaltungsverzeichnis.');
  const ids=new Set<string>();
  for(const row of value){
    if(!object(row)||!numericIds.has(row)||typeof row['id']!=='string'||typeof row['name']!=='string'||ids.has(row['id']))throw Error('Mehrdeutiges natives Verwaltungsverzeichnis.');
    ids.add(row['id']);
    if(path==='/users'){
      if(typeof row['isSuperadmin']!=='boolean'||!(row['email']===null||typeof row['email']==='string'))throw Error('Ungültiges Administratorverzeichnis.');
    }else if(path==='/workspaces'){
      if(!(row['latest_modification_ts']===null||typeof row['latest_modification_ts']==='string'))throw Error('Ungültiges Arbeitsbereichsverzeichnis.');
    }else if(typeof row['selected']!=='boolean'||typeof row['role']!=='string'||(!row['selected']&&row['role']!==''))throw Error('Ungültige Berechtigungsmatrix.');
  }
  return value;
}

/** A selected opaque empty role is different from an absent membership.
 * Source skips literal "" before PDO conversion, but stores the nonempty NUL
 * parameter as "". Preserve that measured round trip without granting access. */
export function originalAdministrationPermissionBody(rows:OriginalPermission[]):Array<{id:string;role:string}> {
  return rows.map(row=>({id:originalAdministrationId(row.id),role:row.selected?(row.role===''?'\0':row.role):''}));
}
