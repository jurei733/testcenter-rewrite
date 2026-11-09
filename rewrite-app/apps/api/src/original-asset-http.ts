import type {IncomingMessage} from 'node:http';
import {randomUUID} from 'node:crypto';
import {FirstSliceError,type FirstSliceServices} from '@testcenter-rewrite-app/application';

const asset=/^\/assets\/([^/]+)$/;
const file=/^\/public\/uploaded_assets\/([^/]+)$/;
const escape=(text:string)=>text.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]!));
export function originalAssetRouteLabel(method:string,pathname:string):string|null {
  return pathname==='/assets'||pathname==='/asset-assignments'?method+' '+pathname:asset.test(pathname)?method+' /assets/:assetId':file.test(pathname)?method+' /public/uploaded_assets/:storedName':null;
}
const noFile=()=>new FirstSliceError(400,'original_asset_file_missing','No file uploaded');
/** One bounded multipart request, with binary-safe delimiters and UTF8 names.
 * PHP uses the final `file` field when the name is repeated. */
export function originalAssetMultipart(contentType:string,body:Buffer):{originalName:string;mediaType:string;dataBase64:string} {
  const match=/(?:^|;)\s*boundary=(?:"([^"\r\n]+)"|([^;\s]+))/i.exec(contentType),boundary=match?.[1]??match?.[2];
  if(!boundary||boundary.length>200)throw noFile();
  const marker=Buffer.from('--'+boundary),next=Buffer.from('\r\n--'+boundary);let cursor=body.indexOf(marker),result:ReturnType<typeof originalAssetMultipart>|undefined;
  while(cursor>=0){
    cursor+=marker.length;
    if(body.subarray(cursor,cursor+2).equals(Buffer.from('--')))break;
    if(!body.subarray(cursor,cursor+2).equals(Buffer.from('\r\n')))throw noFile();
    const end=body.indexOf(Buffer.from('\r\n\r\n'),cursor+2);if(end<0)throw noFile();
    const headers=new TextDecoder('utf-8',{fatal:true}).decode(body.subarray(cursor+2,end));
    const disposition=/^content-disposition:\s*(.+)$/im.exec(headers)?.[1]??'';
    const field=/(?:^|;)\s*name="([^"]*)"/i.exec(disposition)?.[1];
    const filename=/(?:^|;)\s*filename="([^"]*)"/i.exec(disposition)?.[1];
    let stop=body.indexOf(next,end+4);
    while(stop>=0&&!['\r\n','--'].includes(body.toString('latin1',stop+next.length,stop+next.length+2)))stop=body.indexOf(next,stop+1);
    if(stop<0)throw noFile();
    if(field==='file'&&filename!==undefined&&filename!=='')result={originalName:filename,mediaType:/^content-type:\s*([^;\r\n]+)/im.exec(headers)?.[1]?.trim()??'application/octet-stream',dataBase64:body.subarray(end+4,stop).toString('base64')};
    cursor=stop+2;
  }
  if(!result)throw noFile();return result;
}
export async function handleOriginalAssetHttp(input:{request:IncomingMessage;pathname:string;services:FirstSliceServices;
  readBody:()=>Promise<unknown>;readBuffer:(limit:number)=>Promise<Buffer>;header:(name:string,value:string)=>void;
  raw:(status:number,value:string,contentType:string)=>void;binary:(bytes:Buffer,contentType:string)=>void;
  propagateError:(error:unknown)=>boolean;reportError:(receipt:{errorId:string;statusCode:number;errorCode:string})=>void}):Promise<boolean>{
  const item=asset.exec(input.pathname),stored=file.exec(input.pathname);
  const allowed=stored?['GET']:item?['DELETE']:input.pathname==='/assets'?['GET','POST']:input.pathname==='/asset-assignments'?['GET','POST']:undefined;
  if(!allowed)return false;
  input.header('cache-control','private, no-store');
  try{
    const method=input.request.method??'';
    if(!allowed.includes(method)){input.header('allow',allowed.join(', '));throw new FirstSliceError(405,'original_method_not_allowed','Method not allowed. Must be one of: '+allowed.join(', '));}
    if(stored){
      const value=await input.services.originalAssets.file({storedName:stored[1]!});
      if(!value)throw new FirstSliceError(404,'original_asset_not_found','Not found');
      input.binary(Buffer.from(value.dataBase64,'base64'),value.mediaType);return true;
    }
    const token=input.request.headers.authtoken;
    if(input.pathname==='/asset-assignments'&&method==='GET'){
      input.raw(200,JSON.stringify(await input.services.originalAssets.getAssignments({token:typeof token==='string'?token:undefined})),'application/json');return true;
    }
    if(typeof token!=='string'||!token)throw new FirstSliceError(401,'original_token_missing','Auth Header not sufficient: '+(token===''?'empty':'missing'));
    // Source middleware verifies Root before parsing bodies or uploads.
    await input.services.originalAdminSession.authorize({token,superAdmin:true});
    if(item){
      let reference:string;try{reference=decodeURIComponent(item[1]!);}catch{throw new FirstSliceError(400,'original_request_invalid','Invalid asset reference.');}
      await input.services.originalAssets.delete({token,reference});input.raw(200,'{"status":"deleted"}','application/json');return true;
    }
    if(input.pathname==='/assets'){
      if(method==='GET'){input.raw(200,JSON.stringify(await input.services.originalAssets.list({token})),'application/json');return true;}
      const type=input.request.headers['content-type']??'';
      if(!/^multipart\/form-data(?:;|$)/i.test(type))throw noFile();
      const uploaded=originalAssetMultipart(type,await input.readBuffer(2*1024*1024+65536));
      try{input.raw(200,JSON.stringify(await input.services.originalAssets.upload({token,...uploaded})),'application/json');}
      catch(error){
        if(error instanceof FirstSliceError){
          if(error.errorCode==='application_asset_file_too_large')throw new FirstSliceError(400,error.errorCode,'File too large (max 2MB)');
          if(error.errorCode==='application_asset_extension_invalid')throw new FirstSliceError(400,error.errorCode,'Invalid file extension: `'+(uploaded.originalName.split('.').at(-1)?.toLowerCase()??'')+'`');
          if(error.errorCode==='application_asset_image_signature_invalid')throw new FirstSliceError(400,error.errorCode,'File is not a valid image');
        }
        throw error;
      }
      return true;
    }
    let body:unknown;try{body=await input.readBody();}catch(error){if(error instanceof SyntaxError)throw new FirstSliceError(500,'original_json_invalid','Internal error.');throw error;}
    await input.services.originalAssets.setAssignments({token,body});input.raw(200,'{"status":"ok"}','application/json');
  }catch(error){
    if(input.propagateError(error))throw error;
    const known=error instanceof FirstSliceError;let statusCode=known?error.statusCode:500;
    const errorCode=known?error.errorCode:'internal_error';
    if(['original_session_invalid','admin_session_invalid','admin_session_missing'].includes(errorCode))statusCode=403;
    const errorId='error-'+randomUUID();input.header('Test-Mode','NO');input.header('Error-ID',errorId);input.reportError({errorId,statusCode,errorCode});
    input.raw(statusCode,escape(statusCode>=500?'Internal error.':known?error.message:'Internal error.'),'text/html;charset=UTF-8');
  }
  return true;
}
