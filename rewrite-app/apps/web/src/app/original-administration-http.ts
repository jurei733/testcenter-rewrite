import {parseOriginalAdministrationWire} from './original-administration-wire';

export class OriginalAdministrationHttpError extends Error {
  constructor(readonly statusCode:number,readonly error:string,message:string){super(message);}
}
export type OriginalAdministrationReply={value:unknown;authToken?:string};
export type NativeAdministrationTransport=(method:string,path:string,body:unknown,token:string,signal:AbortSignal)=>Promise<OriginalAdministrationReply>;
const allowed=(method:string,path:string)=>
  method==='GET'&&/^\/(?:session|users|workspaces|user\/[1-9]\d*\/workspaces|workspace\/[1-9]\d*\/users)$/.test(path)||
  method==='PUT'&&/^\/(?:user|workspace)$/.test(path)||
  method==='DELETE'&&/^\/(?:users|workspaces)$/.test(path)||
  method==='PATCH'&&/^\/(?:user\/[1-9]\d*\/(?:workspaces|password|super-admin\/(?:on|off))|workspace\/[1-9]\d*(?:\/users)?)$/.test(path);
/** Captured credentials, bounded requests and raw response text. This transport
 * never routes expected confirmation errors through participant/session logout. */
export function createOriginalAdministrationTransport(fetcher:typeof fetch=globalThis.fetch):NativeAdministrationTransport {
  return async(method,path,body,token,owner)=>{
    owner.throwIfAborted();
    if(!token||!allowed(method,path))throw Error('Native Verwaltungsanfrage außerhalb des Sitzungsbereichs.');
    const signal=AbortSignal.any([owner,AbortSignal.timeout(20000)]);
    const response=await fetcher(path,{method,cache:'no-store',credentials:'omit',redirect:'error',signal,
      headers:{Accept:'application/json',AuthToken:token,...body===undefined?{}:{'Content-Type':'application/json'}},
      ...body===undefined?{}:{body:JSON.stringify(body)}});
    const text=await response.text();signal.throwIfAborted();
    if(!response.ok){
      const message=text.replaceAll(token,'[redacted]');
      const code=response.status===403&&/^Invalid (?:current )?password for user [1-9]\d*$/.test(text)?'admin_password_confirmation_invalid'
        :(response.status===401||response.status===403&&text==='Invalid token.')?'original_admin_session_invalid':'original_administration_failed';
      throw new OriginalAdministrationHttpError(response.status,code,message);
    }
    const fresh=response.headers.get('AuthToken');
    if(fresh&&!(method==='PATCH'&&/^\/user\/[1-9]\d*\/password$/.test(path)))throw Error('Unerwarteter Verwaltungstoken.');
    return {value:parseOriginalAdministrationWire(path,text),...fresh?{authToken:fresh}:{}};
  };
}
