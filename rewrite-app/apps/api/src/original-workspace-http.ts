import {randomUUID} from 'node:crypto';
import type {IncomingMessage} from 'node:http';
import {FirstSliceError,originalReportQuery,decodeOriginalTestLogJson,encodeOriginalReportJson,formatOriginalTestAdministrationJson,type FirstSliceServices} from '@testcenter-rewrite-app/application';

const route=/^\/workspace\/([^/]+)\/(results|responses(?:\/detailed)?|report\/([^/]+))$/;
const contextRoute=/^\/api\/v1\/tenants\/([^/]+)\/workspaces\/([^/]+)\/original-administration$/;
export function originalWorkspaceRouteLabel(method:string,pathname:string):string|null {
  if(contextRoute.test(pathname))return method+' /api/v1/tenants/:tenantKey/workspaces/:workspaceKey/original-administration';
  const match=route.exec(pathname);return match?method+' /workspace/:workspaceId/'+(match[3]?'report/:reportType':match[2]):null;
}
/** Native routes always require a current admin capability, independently of
 * canonical operator-demo configuration and its inherited role model. */
export async function handleOriginalWorkspaceHttp(input:{request:IncomingMessage;pathname:string;searchParams?:URLSearchParams;services:FirstSliceServices;
  readBody:(decode:(payload:Uint8Array)=>unknown)=>Promise<unknown>;
  propagateError:(error:unknown)=>boolean;
  header:(name:string,value:string)=>void;raw:(status:number,text:string,contentType:string)=>void}):Promise<boolean> {
  const context=contextRoute.exec(input.pathname);
  const match=route.exec(input.pathname);if(!match&&!context)return false;
  if(context){
    input.header('cache-control','private, no-store');
    try{
      if(input.request.method!=='GET'){input.header('allow','GET');throw new FirstSliceError(405,'original_method_not_allowed','Method not allowed. Must be one of: GET');}
      const token=input.request.headers.authtoken;
      if(typeof token!=='string'||!token)throw new FirstSliceError(401,'original_token_missing','Auth Header not sufficient.');
      let tenantKey:string,workspaceKey:string;
      try{tenantKey=decodeURIComponent(context[1]!);workspaceKey=decodeURIComponent(context[2]!);}catch{throw new FirstSliceError(400,'original_workspace_invalid','Invalid workspace scope.');}
      const value=await input.services.originalWorkspaceAdministration.context({token,tenantKey,workspaceKey});
      input.raw(200,JSON.stringify(value),'application/json; charset=UTF-8');
    }catch(error){
      if(input.propagateError(error))throw error;
      if(!(error instanceof FirstSliceError))throw error;
      input.raw(error.statusCode,JSON.stringify({error:error.errorCode,message:error.statusCode>=500?'Internal error.':error.message}),'application/json; charset=UTF-8');
    }
    return true;
  }
  if(!match)return false;
  input.header('cache-control','private, no-store');const methods=match[2]==='results'||match[3]?['GET']:match[2]==='responses'?['DELETE']:['GET','DELETE'];
  try {
    if(!methods.includes(input.request.method??'')){input.header('allow',methods.join(', '));throw new FirstSliceError(405,'original_method_not_allowed','Method not allowed. Must be one of: '+methods.join(', '));}
    const token=input.request.headers.authtoken;
    if(typeof token!=='string'||!token)throw new FirstSliceError(401,'original_token_missing','Auth Header not sufficient: '+(token===''?'empty':'missing'));
    const scope=await input.services.originalWorkspaceAdministration.resolve({token,workspacePathSegment:match[1]!,write:input.request.method==='DELETE'});
    if(input.request.method==='GET'){
      if(match[3]){
        const type=match[3];if(type!=='response'&&type!=='log'&&type!=='review')throw new FirstSliceError(404,'original_report_type_missing',"Report type '"+type+"' not found.");
        const params=input.searchParams??new URLSearchParams(),result=await input.services.originalWorkspaceReport.read({...scope,type,dataIds:originalReportQuery(params,'dataIds'),accept:input.request.headers.accept??'',useNewVersion:originalReportQuery(params,'useNewVersion')==='true'});
        input.raw(200,result.body,result.contentType);return true;
      }
      const body=match[2]==='results'?encodeOriginalReportJson(await input.services.originalGroupResults.list(scope)):formatOriginalTestAdministrationJson(await input.services.originalTestAdministration.list(scope));
      input.raw(200,body,'application/json');return true;
    }
    let body:unknown;try{body=await input.readBody(decodeOriginalTestLogJson);}catch(error){if(error instanceof SyntaxError)throw new FirstSliceError(500,'original_workspace_json_invalid','Internal error.');throw error;}
    await input.services.originalWorkspaceAdministration.delete({token,workspacePathSegment:match[1]!,kind:match[2]==='responses'?'groups':'tests',body});
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
