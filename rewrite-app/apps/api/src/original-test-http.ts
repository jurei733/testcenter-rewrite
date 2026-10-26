import type {IncomingMessage} from 'node:http';
import {FirstSliceError,formatOriginalTestReadJson,type FirstSliceServices} from '@testcenter-rewrite-app/application';
import {encodeOriginalReportJson} from '@testcenter-rewrite-app/application';
export const originalTestCreationPath='/test';
/** Redact capability-bearing paths even when an encoded/invalid spelling gets 404. */
export function originalResourceLogPath(pathname:string):string|null{
 // Decode ASCII escapes independently: an invalid escape in a Resource suffix
 // must never prevent recognizing the capability-bearing route prefix.
 let decoded=pathname.replace(/%25(?:25)*/gi,'%');
 for(;;){if(/^\/+file(?:\/|$)/i.test(decoded))return '/file/:groupToken/ws_:workspace/:resourcePath';
  const next=decoded.replace(/%([0-9a-f]{2})/gi,(_,hex:string)=>String.fromCharCode(Number.parseInt(hex,16)));
  if(next===decoded)break;decoded=next;}
 return null;
}
export function originalTestRouteLabel(method:string,pathname:string):string|null{
 if(originalResourceLogPath(pathname))return method+' /file/:groupToken/ws_:workspace/:resourcePath';
 let path=pathname;try{path=decodeURIComponent(pathname);}catch{}
 if(path==='/test')return method+' /test';if(/^\/test\/[^/]+$/.test(path))return method+' /test/:testId';if(/^\/test\/[^/]+\/state$/.test(path))return method+' /test/:testId/state';return null;
}
export async function handleOriginalTestHttp(input:{request:IncomingMessage;pathname:string;services:FirstSliceServices;readBody:()=>Promise<unknown>;send:(status:number,value:unknown)=>void;raw:(status:number,text:string,contentType:string)=>void;binary:(bytes:Uint8Array,contentType:string)=>void;header:(name:string,value:string)=>void}):Promise<boolean>{
 let pathname:string;try{pathname=decodeURIComponent(input.pathname);}catch{if(!/^\/(?:test|file)(?:\/|$)/.test(input.pathname))return false;input.header('cache-control','private, no-store');input.send(400,'Invalid path.');return true;}
 const read=/^\/test\/([^/]+)$/.exec(pathname),state=/^\/test\/([^/]+)\/state$/.exec(pathname),file=/^\/file\/([^/]+)\/ws_([^/]+)\/(.*)$/.exec(pathname);
 if(pathname!=='/test'&&!read&&!state&&!file)return false;
 input.header('cache-control','private, no-store');const method=file||read?'GET':state?'PATCH':'PUT';
 if(input.request.method!==method){input.header('allow',method);input.send(405,'Method not allowed');return true;}
 try{
  if(file){const groupToken=file[1]!,workspaceNumber=file[2]!,path=file[3]!;
   const result=await input.services.originalTest.resource({groupToken,workspaceNumber,path});input.header('cache-control','private');input.header('x-source','backend');input.binary(result.bytes,result.contentType);return true;}
  const token=input.request.headers.authtoken;if(typeof token!=='string'||!token)throw new FirstSliceError(401,'original_token_missing','Auth Header not sufficient: missing or empty');
  await input.services.originalTest.requirePerson({token});
  if(read){const testNumber=read[1]!;
   input.raw(200,formatOriginalTestReadJson(await input.services.originalTest.read({token,testNumber})),'application/json');return true;}
  let body:unknown;try{body=await input.readBody();}catch(error){if(error instanceof SyntaxError)throw new FirstSliceError(400,'original_json_invalid','Request body must be valid JSON.');throw error;}
  if(state){await input.services.originalTest.patchState({token,testNumber:state[1]!,patch:body});input.raw(200,'','text/html; charset=UTF-8');return true;}
  if(body===null||typeof body!=='object'||Array.isArray(body)||typeof(body as Record<string,unknown>).bookletName!=='string')throw new FirstSliceError(400,'original_request_invalid','Required body-parameter is missing: `bookletName`');
  input.raw(201,await input.services.originalTest.create({token,bookletName:(body as {bookletName:string}).bookletName}),'text/html; charset=UTF-8');
 }catch(error){if(!(error instanceof FirstSliceError))throw error;input.raw(error.statusCode,encodeOriginalReportJson(error.message),'application/json');}
 return true;
}
