import type {IncomingMessage} from 'node:http';
import {randomUUID} from 'node:crypto';
import {FirstSliceError,originalCommandInteger,decodeOriginalTestLogJson,type FirstSliceServices} from '@testcenter-rewrite-app/application';

const passwordRoute=/^\/user\/([^/]+)\/password$/;
const workspaceUsersRoute=/^\/workspace\/([^/]+)\/users$/;
const userWorkspacesRoute=/^\/user\/([^/]+)\/workspaces$/;
const superAdminRoute=/^\/user\/([^/]+)\/super-admin\/([^/]+)$/;
const workspaceRoute=/^\/workspace\/([^/]+)$/;
const methods=new Map<string,string[]>([['/users',['GET','DELETE']],['/workspaces',['GET','DELETE']],['/user',['PUT']],['/workspace',['PUT']]]);
const object=(value:unknown):value is Record<string,unknown>=>Boolean(value&&typeof value==='object'&&!Array.isArray(value));
const escape=(value:string)=>value.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]!));
export function originalAdminRouteLabel(method:string,pathname:string):string|null {
  if(workspaceUsersRoute.test(pathname))return method+' /workspace/:workspaceId/users';
  if(userWorkspacesRoute.test(pathname))return method+' /user/:userId/workspaces';
  if(superAdminRoute.test(pathname))return method+' /user/:userId/super-admin/:status';
  if(workspaceRoute.test(pathname)&&method!=='GET')return method+' /workspace/:workspaceId';
  return passwordRoute.test(pathname)?method+' /user/:userId/password':methods.has(pathname)?method+' '+pathname:null;
}
export async function handleOriginalAdminHttp(input:{request:IncomingMessage;pathname:string;services:FirstSliceServices;
  readBody:(decode?:(payload:Uint8Array)=>unknown)=>Promise<unknown>;header:(name:string,value:string)=>void;raw:(status:number,value:string,contentType:string)=>void;
  propagateError:(error:unknown)=>boolean;reportError:(receipt:{errorId:string;statusCode:number;errorCode:string})=>void;clean?:()=>void}):Promise<boolean> {
  const workspaceUsers=workspaceUsersRoute.exec(input.pathname),userWorkspaces=userWorkspacesRoute.exec(input.pathname);
  const permission=workspaceUsers??userWorkspaces;
  const workspace=workspaceRoute.exec(input.pathname);
  // GET is owned by the existing native workspace-access handler, whose
  // explicit membership gate is different from Root's rename capability.
  if(workspace&&input.request.method==='GET')return false;
  const superAdmin=superAdminRoute.exec(input.pathname);
  const password=passwordRoute.exec(input.pathname),allowed=permission?['GET','PATCH']:workspace?['GET','PATCH']:superAdmin||password?['PATCH']:methods.get(input.pathname);
  if(!allowed)return false;
  input.header('cache-control','private, no-store');
  try {
    if(!allowed.includes(input.request.method??'')){input.header('allow',allowed.join(', '));throw new FirstSliceError(405,'original_method_not_allowed','Method not allowed. Must be one of: '+allowed.join(', '));}
    const token=input.request.headers.authtoken;
    if(typeof token!=='string'||!token)throw new FirstSliceError(401,'original_token_missing','Auth Header not sufficient: '+(token===''?'empty':'missing'));
    if(permission){
      let reference:string;try{reference=decodeURIComponent(permission[1]!);}catch{throw new FirstSliceError(400,'original_request_invalid','Invalid permission reference.');}
      if(input.request.method==='GET'){
        const result=workspaceUsers?await input.services.originalAdminPermissions.usersByWorkspace({token,reference})
          :await input.services.originalAdminPermissions.workspacesByUser({token,reference});
        input.raw(200,result,'application/json');return true;
      }
      await input.services.originalAdminSession.authorize({token,superAdmin:true});
      let body:unknown;try{body=await input.readBody(decodeOriginalTestLogJson);}catch(error){if(error instanceof SyntaxError)throw new FirstSliceError(500,'original_json_invalid','Internal error.');throw error;}
      if(workspaceUsers)await input.services.originalAdminPermissions.replaceWorkspaceUsers({token,reference,body});
      else await input.services.originalAdminPermissions.replaceUserWorkspaces({token,reference,body});
      input.raw(200,'',workspaceUsers?'text/plain;charset=UTF-8':'text/html; charset=UTF-8');return true;
    }
    if(input.pathname==='/users'&&input.request.method==='DELETE'){
      await input.services.originalAdminSession.authorize({token,superAdmin:true});
      let body:unknown;try{body=await input.readBody(decodeOriginalTestLogJson);}catch(error){if(error instanceof SyntaxError)throw new FirstSliceError(500,'original_json_invalid','Internal error.');throw error;}
      await input.services.originalAdminDirectory.deleteUsers({token,body});input.raw(200,'','text/html; charset=UTF-8');return true;
    }
    if(input.pathname==='/workspaces'&&input.request.method==='DELETE'){
      await input.services.originalAdminSession.authorize({token,superAdmin:true});
      let body:unknown;try{body=await input.readBody(decodeOriginalTestLogJson);}catch(error){if(error instanceof SyntaxError)throw new FirstSliceError(500,'original_json_invalid','Internal error.');throw error;}
      await input.services.originalAdminDirectory.deleteWorkspaces({token,body});
      input.clean?.();input.raw(200,'','text/html; charset=UTF-8');return true;
    }
    if(superAdmin){
      await input.services.originalAdminSession.authorize({token,superAdmin:true});
      let reference:string,status:string;try{reference=decodeURIComponent(superAdmin[1]!);status=decodeURIComponent(superAdmin[2]!);}catch{throw new FirstSliceError(400,'original_request_invalid','Invalid administrator reference.');}
      let body:unknown;try{body=await input.readBody(decodeOriginalTestLogJson);}catch(error){if(error instanceof SyntaxError)throw new FirstSliceError(500,'original_json_invalid','Internal error.');throw error;}
      await input.services.originalAdminDirectory.setSuperadmin({token,reference,status,body});input.raw(200,'','text/html; charset=UTF-8');return true;
    }
    if(workspace||input.pathname==='/workspace'){
      await input.services.originalAdminSession.authorize({token,superAdmin:true});
      let reference='';if(workspace)try{reference=decodeURIComponent(workspace[1]!);}catch{throw new FirstSliceError(400,'original_request_invalid','Invalid workspace reference.');}
      let body:unknown;try{body=await input.readBody(decodeOriginalTestLogJson);}catch(error){if(error instanceof SyntaxError)throw new FirstSliceError(500,'original_json_invalid','Internal error.');throw error;}
      if(workspace){await input.services.originalAdminDirectory.renameWorkspace({token,reference,body});input.raw(200,'','text/html; charset=UTF-8');}
      else input.raw(201,await input.services.originalAdminDirectory.createWorkspace({token,body}),'text/html; charset=UTF-8');
      return true;
    }
    if(input.request.method==='GET'){
      const result=input.pathname==='/users'?await input.services.originalAdminDirectory.listUsers({token}):await input.services.originalAdminDirectory.listWorkspaces({token});
      input.raw(200,result,'application/json');return true;
    }
    let number:string|undefined;
    if(password){let reference:string;try{reference=decodeURIComponent(password[1]!);}catch{throw new FirstSliceError(400,'original_request_invalid','Invalid user reference.');}number=originalCommandInteger(reference).toString();}
    // Keep Source's middleware precedence. The mutation revalidates the same
    // capability and current roles in its own durable boundary after parsing.
    await input.services.originalAdminSession.authorize({token,...password?{adminNumber:number!}:{superAdmin:true}});
    let body:unknown;try{body=await input.readBody();}catch(error){if(error instanceof SyntaxError)throw new FirstSliceError(500,'original_json_invalid','Internal error.');throw error;}
    if(password){
      if(!object(body)||body.p==null)throw new FirstSliceError(400,'original_password_missing','Password missing');
      const fresh=await input.services.originalAdminSession.changePassword({token,adminNumber:number!,password:body.p as string,...body.oldPassword==null?{}:{oldPassword:body.oldPassword as string}});
      // Preserve Source's empty200 body while the native UI can adopt the new,
      // password-confirmed capability. The old token is never retained.
      if(fresh)input.header('AuthToken',fresh.token);
      input.raw(200,'','text/html; charset=UTF-8');return true;
    }
    if(!object(body)||body.n==null||body.p==null)throw new FirstSliceError(400,'original_user_fields_missing','Username or Password missing');
    if(typeof body.n!=='string'||typeof body.p!=='string')throw new FirstSliceError(500,'original_user_malformed','Internal error.');
    const id=await input.services.originalAdminDirectory.createUser({token,name:body.n,password:body.p});
    input.raw(201,id,'text/html; charset=UTF-8');
  }catch(error){
    if(input.propagateError(error))throw error;
    const known=error instanceof FirstSliceError,statusCode=known?error.statusCode:500,errorCode=known?error.errorCode:'internal_error';
    let message=known?error.message:'Internal error.';
    if(known&&error.errorCode==='admin_password_policy_violation'&&object(error.details)){
      message=error.details.violation==='pattern'?'Password must match regex pattern: `'+String(error.details.pattern)+'`':error.details.violation==='maximum_length'?'Password too long':'Password must have at least '+String(error.details.minimumLength)+' characters.';
    }
    const errorId='error-'+randomUUID();input.header('Test-Mode','NO');input.header('Error-ID',errorId);
    input.reportError({errorId,statusCode,errorCode});
    input.raw(statusCode,escape(statusCode>=500?'Internal error.':message),'text/html;charset=UTF-8');
  }
  return true;
}
