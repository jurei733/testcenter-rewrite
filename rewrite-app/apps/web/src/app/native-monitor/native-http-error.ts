export class NativeMonitorHttpError extends Error {
 constructor(readonly status:number,message:string,readonly response?:{url:string;statusText:string;errorId?:string|null;testMode?:string|null}){super(message);}
}
