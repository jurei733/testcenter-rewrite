import {randomUUID} from 'node:crypto';
import type {IncomingMessage} from 'node:http';
import {FirstSliceError,encodeOriginalReportJson,type FirstSliceServices} from '@testcenter-rewrite-app/application';
const route=/^\/workspace\/([^/]+)\/sys-check\/([^/]+)(?:\/(unit-and-player|report))?$/;
export function originalSystemCheckRouteLabel(method:string,pathname:string):string|null{
 if(pathname==='/sys-check-mode'||pathname==='/sys-checks')return method+' '+pathname;
 const match=route.exec(pathname);return match?method+' /workspace/:workspaceId/sys-check/:checkName'+(match[3]?'/'+match[3]:''):null;
}
export async function handleOriginalSystemCheckHttp(input:{request:IncomingMessage;pathname:string;services:FirstSliceServices;
 readBody:()=>Promise<unknown>;propagateError:(error:unknown)=>boolean;header:(name:string,value:string)=>void;
 raw:(status:number,text:string,contentType:string)=>void;reportError:(receipt:{errorId:string;errorCode:string;statusCode:number})=>void}):Promise<boolean>{
 const directory=input.pathname==='/sys-check-mode'||input.pathname==='/sys-checks';
 const match=route.exec(input.pathname);if(!match&&!directory)return false;
 input.header('cache-control','private, no-store');
 try{
  if(directory){
   if(input.request.method!=='GET'&&input.request.method!=='HEAD'){input.header('allow','GET');throw new FirstSliceError(405,'original_method_not_allowed','Method not allowed. Must be one of: GET');}
   if(input.pathname==='/sys-check-mode')input.raw(200,JSON.stringify(await input.services.originalSystemCheck.mode()),'application/json');
   else{const list=await input.services.originalSystemCheck.list();input.raw(list===null?204:200,list??'',list===null?'text/html; charset=UTF-8':'application/json');}
   return true;
  }
  if(!match)return false;
  const method=match[3]==='report'?'PUT':'GET';
  if(input.request.method!==method&&!(method==='GET'&&input.request.method==='HEAD')){input.header('allow',method);throw new FirstSliceError(405,'original_method_not_allowed','Method not allowed. Must be one of: '+method);}
  let workspaceNumber:string,checkName:string;
  try{workspaceNumber=decodeURIComponent(match[1]!);checkName=decodeURIComponent(match[2]!);}catch{throw new FirstSliceError(400,'original_system_check_path_invalid','Invalid Systemcheck path.');}
  if(/[\/\\\u0000-\u001f\u007f]/.test(checkName)||!checkName.length)throw new FirstSliceError(400,'original_system_check_path_invalid','Invalid Systemcheck path.');
  const header=input.request.headers.authtoken;
  if(header!==undefined&&typeof header!=='string')throw new FirstSliceError(403,'original_session_invalid','Invalid token.');
  const request={workspaceNumber,checkName,token:header||undefined};
  if(match[3]==='report'){
   await input.services.originalSystemCheck.authorize({...request,write:true});
   const body=await input.readBody();await input.services.originalSystemCheck.saveReport({...request,body});
   input.raw(201,'','text/html; charset=UTF-8');
  }else if(match[3]==='unit-and-player')input.raw(200,encodeOriginalReportJson(await input.services.originalSystemCheck.unit(request)),'application/json');
  else input.raw(200,await input.services.originalSystemCheck.config(request),'application/json');
 }catch(error){
  if(input.propagateError(error))throw error;
  const statusCode=error instanceof FirstSliceError?error.statusCode:500,errorCode=error instanceof FirstSliceError?error.errorCode:'internal_error',errorId='error-'+randomUUID();
  input.header('Test-Mode','NO');input.header('Error-ID',errorId);input.reportError({errorId,errorCode,statusCode});
  const message=statusCode>=500?'Internal error.':error instanceof Error?error.message:'Invalid Systemcheck request.';
  input.raw(statusCode,message.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;'),'text/html;charset=UTF-8');
 }
 return true;
}
