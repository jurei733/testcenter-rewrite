import {randomUUID} from 'node:crypto';
import type {IncomingMessage} from 'node:http';
import {FirstSliceError,decodeOriginalTestLogJson,encodeOriginalReportJson,formatOriginalTestAdministrationJson,prepareOriginalNativeTestSelection,prepareOriginalNativeGroupSelection,type FirstSliceServices} from '@testcenter-rewrite-app/application';

const route=/^\/workspace\/([^/]+)\/(results|responses(?:\/detailed)?)$/;
export function originalWorkspaceRouteLabel(method:string,pathname:string):string|null {
  const match=route.exec(pathname);return match?method+' /workspace/:workspaceId/'+match[2]:null;
}
/** Native routes always require a current admin capability, independently of
 * canonical operator-demo configuration and its inherited role model. */
export async function handleOriginalWorkspaceHttp(input:{request:IncomingMessage;pathname:string;services:FirstSliceServices;
  readBody:(decode:(payload:Uint8Array)=>unknown)=>Promise<unknown>;
  propagateError:(error:unknown)=>boolean;
  header:(name:string,value:string)=>void;raw:(status:number,text:string,contentType:string)=>void}):Promise<boolean> {
  const match=route.exec(input.pathname);if(!match)return false;
  input.header('cache-control','private, no-store');const methods=match[2]==='results'?['GET']:match[2]==='responses'?['DELETE']:['GET','DELETE'];
  try {
    if(!methods.includes(input.request.method??'')){input.header('allow',methods.join(', '));throw new FirstSliceError(405,'original_method_not_allowed','Method not allowed. Must be one of: '+methods.join(', '));}
    const token=input.request.headers.authtoken;
    if(typeof token!=='string'||!token)throw new FirstSliceError(401,'original_token_missing','Auth Header not sufficient: '+(token===''?'empty':'missing'));
    const scope=await input.services.originalWorkspaceAdministration.resolve({token,workspacePathSegment:match[1]!,write:input.request.method==='DELETE'});
    if(input.request.method==='GET'){
      const body=match[2]==='results'?encodeOriginalReportJson(await input.services.originalGroupResults.list(scope)):formatOriginalTestAdministrationJson(await input.services.originalTestAdministration.list(scope));
      input.raw(200,body,'application/json');return true;
    }
    let body:unknown;try{body=await input.readBody(decodeOriginalTestLogJson);}catch(error){if(error instanceof SyntaxError)throw new FirstSliceError(500,'original_workspace_json_invalid','Internal error.');throw error;}
    if(match[2]==='responses')await input.services.originalGroupResults.delete({...scope,groups:prepareOriginalNativeGroupSelection(body)});
    else await input.services.originalTestAdministration.delete({...scope,personSessions:prepareOriginalNativeTestSelection(body)});
    input.raw(200,'','text/html; charset=UTF-8');
  }catch(error){
    if(input.propagateError(error))throw error;
    if(!(error instanceof FirstSliceError))throw error;
    input.header('Test-Mode','NO');input.header('Error-ID','error-'+randomUUID());
    const text=error.statusCode>=500?'Internal error.':error.message;
    input.raw(error.statusCode,text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;'),'text/html;charset=UTF-8');
  }
  return true;
}
