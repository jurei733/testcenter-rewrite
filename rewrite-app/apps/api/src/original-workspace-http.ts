import {randomUUID} from 'node:crypto';
import type {IncomingMessage} from 'node:http';
import {FirstSliceError,originalReportQuery,decodeOriginalTestLogJson,encodeOriginalReportJson,formatOriginalTestAdministrationJson,findOriginalWorkspaceFile,projectOriginalWorkspaceFileDigests,readOriginalWorkspaceFileSelection,type FirstSliceServices} from '@testcenter-rewrite-app/application';
import {deleteOriginalWorkspaceFiles,readOriginalWorkspaceFileDeletion} from '@testcenter-rewrite-app/application';

const route=/^\/workspace\/([^/]+)\/(files(?:-dependencies)?|results|responses(?:\/detailed)?|report\/([^/]+)|file(?:\/([^/]+)\/([^/]+))?)$/;
const contextRoute=/^\/api\/v1\/tenants\/([^/]+)\/workspaces\/([^/]+)\/original-administration$/;
async function readOriginalWorkspaceUpload(contentType:string,bytes:Buffer) {
  if(!bytes.length)throw new FirstSliceError(400,'original_workspace_upload_missing','No Upload File.');
  let form:FormData;
  try {form=await new Response(new Uint8Array(bytes),{headers:{'content-type':contentType}}).formData();}
  catch {throw new FirstSliceError(400,'original_workspace_multipart_invalid','Invalid multipart upload.');}
  const array=form.getAll('fileforvo[]').filter(value=>typeof value!=='string');
  const single=form.getAll('fileforvo').filter(value=>typeof value!=='string').at(-1);
  const files=array.length?array:single?[single]:[];
  if(!files.length)throw new FirstSliceError(400,'original_workspace_upload_missing','No Upload File in fileforvo');
  return Promise.all(files.map(async file=>({fileName:file.name,bytes:new Uint8Array(await file.arrayBuffer())})));
}
export function originalWorkspaceRouteLabel(method:string,pathname:string):string|null {
  if(contextRoute.test(pathname))return method+' /api/v1/tenants/:tenantKey/workspaces/:workspaceKey/original-administration';
  const match=route.exec(pathname);return match?method+' /workspace/:workspaceId/'+(match[3]?'report/:reportType':match[4]?'file/:fileType/:fileName':match[2]):null;
}
/** Native routes always require a current admin capability, independently of
 * canonical operator-demo configuration and its inherited role model. */
export async function handleOriginalWorkspaceHttp(input:{request:IncomingMessage;pathname:string;searchParams?:URLSearchParams;services:FirstSliceServices;
  readBody:(decode:(payload:Uint8Array)=>unknown)=>Promise<unknown>;
  readUpload:()=>Promise<Buffer>;
  propagateError:(error:unknown)=>boolean;
  header:(name:string,value:string)=>void;raw:(status:number,text:string,contentType:string)=>void;
  download:(body:Buffer,fileName:string,mediaType:string)=>void}):Promise<boolean> {
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
  input.header('cache-control','private, no-store');
  const operation=match[2], download=!!match[4];
  const upload=operation==='file';
  const methods=operation==='files-dependencies'||upload?['POST']
    :download||operation==='results'||match[3]?['GET']:operation==='responses'?['DELETE']:['GET','DELETE'];
  const readJson=async(decode:(payload:Uint8Array)=>unknown)=>{
    try{return await input.readBody(decode);}
    catch(error){if(error instanceof SyntaxError)throw new FirstSliceError(500,'original_workspace_json_invalid','Internal error.');throw error;}
  };
  const decodeJson=(bytes:Uint8Array):unknown=>JSON.parse(Buffer.from(bytes).toString('utf8'));
  try {
    if(!methods.includes(input.request.method??'')){input.header('allow',methods.join(', '));throw new FirstSliceError(405,'original_method_not_allowed','Method not allowed. Must be one of: '+methods.join(', '));}
    const token=input.request.headers.authtoken;
    if(typeof token!=='string'||!token)throw new FirstSliceError(401,'original_token_missing','Auth Header not sufficient: '+(token===''?'empty':'missing'));
    const administration=input.services.originalWorkspaceAdministration;
    const access={token,workspacePathSegment:match[1]!,write:upload||input.request.method==='DELETE'};
    const scope=await administration.resolve(access);
    const confirmCurrentScope=(current:typeof scope)=>{
      if(current.tenantId!==scope.tenantId||current.workspaceId!==scope.workspaceId){
        throw new FirstSliceError(404,'original_workspace_not_found','Workspace not found.');
      }
    };
    const confirmScope=async()=>confirmCurrentScope(await administration.resolve(access));
    if(upload){
      const contentType=input.request.headers['content-type']??'';
      if(!/^multipart\/form-data(?:;|$)/i.test(contentType)){
        throw new FirstSliceError(400,'original_workspace_multipart_invalid','A workspace file upload requires multipart form data.');
      }
      const files=await readOriginalWorkspaceUpload(contentType,await input.readUpload());
      const writable=await administration.authorizeWrite(access);
      confirmCurrentScope(writable);
      const result=await input.services.contentIntake.uploadOriginalWorkspaceFiles({...writable,files});
      input.raw(result.containsErrors?207:201,encodeOriginalReportJson(result.report),'application/json');
      return true;
    }
    if(download){
      const missing=()=>new FirstSliceError(404,'original_workspace_file_not_found','File not found.');
      let fileType:string,fileName:string;
      try {
        fileType=decodeURIComponent(match[4]!);
        fileName=decodeURIComponent(match[5]!);
      } catch {throw missing();}
      if(!fileName||fileName==='.'||fileName==='..'||/[/\\\x00-\x1f\x7f]/.test(fileName+fileType))throw missing();
      const catalog=await input.services.workspaceAdminRead.getWorkspaceFileCatalog(scope);
      const file=findOriginalWorkspaceFile(catalog,fileType,fileName);
      if(!file)throw missing();
      const result=await input.services.workspaceAdminRead.downloadSourcePackage({...scope,sourcePackageId:file.sourcePackageId})
        .catch(error=>{
          if(error instanceof FirstSliceError&&['source_package_not_found','source_package_download_unavailable'].includes(error.errorCode))throw missing();
          throw error;
        });
      await confirmScope();
      input.download(Buffer.from(result.dataBase64,'base64'),fileName,fileType==='Resource'?'application/octet-stream':'text/xml');
      return true;
    }
    if(operation==='files'&&input.request.method==='DELETE'){
      const body=await readJson(decodeJson);
      const writable=await administration.authorizeWrite(access);
      confirmCurrentScope(writable);
      const paths=readOriginalWorkspaceFileDeletion(body);
      const catalog=await input.services.workspaceAdminRead.getWorkspaceFileCatalog(scope);
      await confirmScope();
      const report=await deleteOriginalWorkspaceFiles(writable,catalog,paths,input.services.contentIntake.deleteSourcePackage);
      input.raw(207,encodeOriginalReportJson(report),'application/json');
      return true;
    }
    if(operation==='files'||operation==='files-dependencies'){
      const selection=operation==='files-dependencies'?readOriginalWorkspaceFileSelection(await readJson(decodeJson)):undefined;
      const catalog=await input.services.workspaceAdminRead.getWorkspaceFileCatalog({...scope,original:{includeDependencies:selection!==undefined}});
      await confirmScope();
      input.raw(200,encodeOriginalReportJson(projectOriginalWorkspaceFileDigests(catalog,selection)),'application/json');
      return true;
    }
    if(input.request.method==='GET'){
      if(match[3]){
        const type=match[3];if(type!=='response'&&type!=='log'&&type!=='review')throw new FirstSliceError(404,'original_report_type_missing',"Report type '"+type+"' not found.");
        const params=input.searchParams??new URLSearchParams(),result=await input.services.originalWorkspaceReport.read({...scope,type,dataIds:originalReportQuery(params,'dataIds'),accept:input.request.headers.accept??'',useNewVersion:originalReportQuery(params,'useNewVersion')==='true'});
        input.raw(200,result.body,result.contentType);return true;
      }
      const body=match[2]==='results'?encodeOriginalReportJson(await input.services.originalGroupResults.list(scope)):formatOriginalTestAdministrationJson(await input.services.originalTestAdministration.list(scope));
      input.raw(200,body,'application/json');return true;
    }
    const body=await readJson(decodeOriginalTestLogJson);
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
