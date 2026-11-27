import {randomUUID} from 'node:crypto';
import type {IncomingMessage} from 'node:http';
import {FirstSliceError,originalReportFormat,originalReportQuery,decodeOriginalTestLogJson,encodeOriginalReportJson,formatOriginalTestAdministrationJson,findOriginalWorkspaceFile,projectOriginalWorkspaceFileDigests,readOriginalWorkspaceFileSelection,type FirstSliceServices} from '@testcenter-rewrite-app/application';
import {deleteOriginalWorkspaceFiles,readOriginalWorkspaceFileDeletion,prepareOriginalSystemCheckReportSelection} from '@testcenter-rewrite-app/application';

const route=/^\/workspace\/([^/]+)\/(files(?:-dependencies)?|results|responses(?:\/detailed)?|report\/([^/]+)|file(?:\/([^/]+)\/([^/]+))?|sys-check\/reports(?:\/overview)?)$/;
const contextRoute=/^\/api\/v1\/tenants\/([^/]+)\/workspaces\/([^/]+)\/original-administration$/;
export function isOriginalSystemCheckReportDeletion(method:string|undefined,pathname:string):boolean {
  return method==='DELETE'&&route.exec(pathname)?.[2]==='sys-check/reports';
}
async function readOriginalWorkspaceUpload(contentType:string,bytes:Buffer) {
  if(!bytes.length)throw new FirstSliceError(400,'original_workspace_upload_missing','No Upload File.');
  let form:FormData;
  try {form=await new Response(new Uint8Array(bytes),{headers:{'content-type':contentType}}).formData();}
  catch {throw new FirstSliceError(400,'original_workspace_multipart_invalid','Invalid multipart upload.');}
  // PHP assembles uploaded slots in multipart order. A scalar replaces an
  // earlier array, and an indexed slot replaces its content in place.
  const slots = new Map<string, File>();
  const maxPhpIndex = (1n << 63n) - 1n;
  let nextIndex: bigint | null = null;
  let single: File | undefined;
  for (const [field, file] of form) {
    if (typeof file === 'string') continue;
    if (field === 'fileforvo') {
      slots.clear();
      nextIndex = null;
      single = file;
      continue;
    }
    const slot = /^fileforvo\[([^\[\]]*)\]$/.exec(field)?.[1];
    if (slot === undefined) continue;
    single = undefined;
    const appendIndex: bigint = nextIndex ?? 0n;
    if (slot === '' && appendIndex > maxPhpIndex) continue;
    const key = slot || appendIndex.toString();
    slots.set(key, file);
    if (/^(?:0|-?[1-9]\d{0,18})$/.test(key)) {
      const index = BigInt(key);
      if (index >= -maxPhpIndex - 1n && index <= maxPhpIndex &&
          (nextIndex === null || index >= nextIndex)) {
        nextIndex = index + 1n;
      }
    }
  }
  const files = single ? [single] : [...slots.values()];
  if(!files.length){
    // Original distinguishes a submitted form without any uploaded files
    // from a form whose files use a different field.
    if(!Array.from(form.values()).some(value=>typeof value!=='string')){
      throw new FirstSliceError(413,'original_workspace_upload_missing','Request size exceeds the maximum for post data!');
    }
    throw new FirstSliceError(400,'original_workspace_upload_missing','No Upload File in fileforvo');
  }
  return Promise.all(files.map(async file=>({fileName:file.name,bytes:new Uint8Array(await file.arrayBuffer())})));
}
export function originalWorkspaceRouteLabel(method:string,pathname:string):string|null {
  if(contextRoute.test(pathname))return method+' /api/v1/tenants/:tenantKey/workspaces/:workspaceKey/original-administration';
  const match=route.exec(pathname);
  if(!match||(match[2]==='sys-check/reports'&&method!=='DELETE'))return null;
  return method+' /workspace/:workspaceId/'+(match[3]?'report/:reportType':match[4]?'file/:fileType/:fileName':match[2]);
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
  if(!match||(match[2]==='sys-check/reports'&&input.request.method!=='DELETE'))return false;
  input.header('cache-control','private, no-store');
  const operation=match[2], download=!!match[4];
  const upload=operation==='file';
  const deleteFiles=operation==='files'&&input.request.method==='DELETE';
  const methods=operation==='files-dependencies'||upload?['POST']
    :download||operation==='results'||operation==='sys-check/reports/overview'||match[3]?['GET']:
      operation==='responses'||operation==='sys-check/reports'?['DELETE']:['GET','DELETE'];
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
    if(upload||deleteFiles){
      const lock=await administration.acquireFileMutation({...scope,token});
      let status:number,report:unknown;
      try{
        const writableScope=async()=>{
          const writable=await administration.authorizeWrite(access);
          confirmCurrentScope(writable);
          return {...writable,authority:{...writable.authority,fileMutationId:lock.id}};
        };
        if(upload){
          const contentType=input.request.headers['content-type']??'';
          if(!/^multipart\/form-data(?:;|$)/i.test(contentType)){
            const hasBody=input.request.headers['transfer-encoding']||Number(input.request.headers['content-length']??0)>0;
            if(!hasBody)throw new FirstSliceError(400,'original_workspace_upload_missing','No Upload File.');
            throw new FirstSliceError(400,'original_workspace_multipart_invalid','A workspace file upload requires multipart form data.');
          }
          const files=await readOriginalWorkspaceUpload(contentType,await input.readUpload());
          const result=await input.services.contentIntake.uploadOriginalWorkspaceFiles({...await writableScope(),files});
          status=result.containsErrors?207:201;
          report=result.report;
        }else{
          const body=await readJson(decodeJson);
          const writable=await writableScope();
          const paths=readOriginalWorkspaceFileDeletion(body);
          const catalog=await input.services.workspaceAdminRead.getWorkspaceFileCatalog(scope);
          await confirmScope();
          report=await deleteOriginalWorkspaceFiles(writable,catalog,paths,input.services.contentIntake.deleteSourcePackage);
          status=207;
        }
      }finally{
        await lock.release();
      }
      input.raw(status,encodeOriginalReportJson(report),'application/json');
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
    if(operation==='files'||operation==='files-dependencies'){
      const selection=operation==='files-dependencies'?readOriginalWorkspaceFileSelection(await readJson(decodeJson)):undefined;
      const catalog=await input.services.workspaceAdminRead.getWorkspaceFileCatalog({...scope,original:{includeDependencies:selection!==undefined}});
      await confirmScope();
      input.raw(200,encodeOriginalReportJson(projectOriginalWorkspaceFileDigests(catalog,selection)),'application/json');
      return true;
    }
    if(operation==='sys-check/reports'){
      const body=await readJson(bytes=>bytes.length?decodeOriginalTestLogJson(bytes):{});
      const writable=await administration.authorizeWrite(access);
      confirmCurrentScope(writable);
      const report=await input.services.workspaceResults.deleteOriginalSystemCheckReports({
        ...writable,checkIds:prepareOriginalSystemCheckReportSelection(body)
      });
      input.raw(207,encodeOriginalReportJson(report),'application/json');return true;
    }
    if(input.request.method==='GET'){
      if(operation==='sys-check/reports/overview'){
        const rows=await input.services.workspaceAdminRead.listOriginalSystemCheckReportOverview(scope);
        await confirmScope();
        input.raw(200,encodeOriginalReportJson(rows),'application/json');return true;
      }
      if(match[3]){
        const type=match[3],params=input.searchParams??new URLSearchParams();
        const dataIds=originalReportQuery(params,'dataIds'),accept=input.request.headers.accept??'';
        if(type==='sys-check'){
          if(dataIds===null)throw new FirstSliceError(500,'original_report_query_invalid','Internal error.');
          const format=originalReportFormat(accept);
          // Repeated IDs keep archived identifiers containing a literal comma distinct.
          const exactIds=params.getAll('checkId');
          const checkIds=exactIds.length?exactIds:dataIds===''?null:dataIds.split(',');
          const body=await input.services.workspaceAdminRead.exportOriginalSystemCheckReports({...scope,checkIds,format});
          await confirmScope();
          input.raw(200,body,format==='csv'?'text/csv;charset=UTF-8':'application/json');return true;
        }
        if(type!=='response'&&type!=='log'&&type!=='review')throw new FirstSliceError(404,'original_report_type_missing',"Report type '"+type+"' not found.");
        const result=await input.services.originalWorkspaceReport.read({...scope,type,dataIds,accept,useNewVersion:originalReportQuery(params,'useNewVersion')==='true'});
        await confirmScope();
        input.raw(200,result.body,result.contentType);return true;
      }
      if(operation==='results'){
        const selection=originalReportQuery(input.searchParams??new URLSearchParams(),'groups');
        if(selection===null)throw new FirstSliceError(500,'original_result_query_invalid','Internal error.');
        const rows=await input.services.originalGroupResults.list({...scope,groups:selection===''?undefined:selection.split(',')});
        input.raw(200,encodeOriginalReportJson(rows),'application/json');return true;
      }
      input.raw(200,formatOriginalTestAdministrationJson(await input.services.originalTestAdministration.list(scope)),'application/json');return true;
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
