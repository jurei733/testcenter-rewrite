import type {IncomingMessage} from 'node:http';
import {randomUUID} from 'node:crypto';
import {FirstSliceError,OriginalReviewInteger,type FirstSliceServices} from '@testcenter-rewrite-app/application';
import {selectOriginalReportFormat} from '@testcenter-rewrite-app/contracts';

export function originalReviewRouteLabel(method:string,raw:string):string|null{
  let path=raw;try{path=decodeURIComponent(raw);}catch{}
  if(path==='/reviews/export')return method+' /reviews/export';
  const match=/^\/test\/[^/]+(\/unit\/[^/]+)?\/(reviews|review)(\/[^/]+)?$/.exec(path);
  return match?method+' /test/:testId'+(match[1]?'/unit/:unitName':'')+'/'+match[2]+(match[3]?'/'+':reviewId':''):null;
}
export function decodeOriginalReviewBody(bytes:Uint8Array):unknown{
  const decoder=JSON.parse as (text:string,reviver:(key:string,value:unknown,context?:{source?:string})=>unknown)=>unknown;
  return decoder(new TextDecoder('utf-8',{fatal:true}).decode(bytes),(key,value,context)=>{
    if(key==='page'&&typeof value==='number'&&!Number.isSafeInteger(value)&&context?.source&&/^-?\d+$/.test(context.source))return new OriginalReviewInteger(context.source);
    return value;
  });
}
export async function handleOriginalReviewHttp(input:{request:IncomingMessage;pathname:string;services:FirstSliceServices;
  readBody:(allowEmpty?:boolean,decode?:(bytes:Uint8Array)=>unknown)=>Promise<unknown>;
  raw:(status:number,text:string,contentType:string)=>void;header:(key:string,value:string)=>void;
  propagateError?:(error:unknown)=>boolean;reportError?:(receipt:{statusCode:number;errorCode:string;errorId:string})=>void}):Promise<boolean>{
  let path=input.pathname;try{path=decodeURIComponent(path);}catch{}
  const match=/^\/test\/([^/]+)(?:\/unit\/([^/]+))?\/(reviews|review)(?:\/([^/]+))?$/.exec(path),exporting=path==='/reviews/export';
  if(!match&&!exporting)return false;
  input.header('Cache-Control','private, no-store');
  const error=(status:number,message:string,code='original_review_error')=>{
    const errorId='error-'+randomUUID();input.header('Error-ID',errorId);input.header('Test-Mode','NO');
    input.reportError?.({statusCode:status,errorCode:code,errorId});
    const escaped=(status>=500?'Internal error.':message).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
    input.raw(status,escaped,'text/html;charset=UTF-8');
  };
  const list=match?.[3]==='reviews'&&!match[4],create=match?.[3]==='review'&&!match[4],detail=match?.[3]==='review'&&!!match[4];
  const allowed=exporting||list?['GET']:create?['PUT']:detail?['PATCH','DELETE']:[];
  const method=input.request.method??'';
  if(!allowed.includes(method)){input.header('Allow',allowed.join(', '));error(405,'Method not allowed. Must be one of: '+allowed.join(', '));return true;}
  try{
    const token=input.request.headers.authtoken;
    if(typeof token!=='string'||!token)throw new FirstSliceError(401,'original_token_missing','Auth Header not sufficient: '+(typeof token==='string'?'empty':'missing'));
    if(exporting){
      const format=selectOriginalReportFormat(input.request.headers.accept,'csv'),result=await input.services.originalReview.export({token,format});
      input.raw(result.status,result.body,format==='csv'?'text/csv;charset=UTF-8':'application/json');return true;
    }
    const request={token,testNumber:match![1]!,unitName:match![2]??null};
    // Enforce native person, current mode and Test ownership before reading an
    // untrusted body. The store rechecks ownership/mode inside its transaction.
    await input.services.originalReview.authorize({...request,write:method!=='GET'});
    if(method==='GET'){input.raw(200,await input.services.originalReview.list(request),'application/json');return true;}
    if(method==='DELETE'){await input.services.originalReview.delete({...request,reviewNumber:match![4]!});input.raw(204,'','text/html; charset=UTF-8');return true;}
    let body:unknown;try{body=await input.readBody(true,decodeOriginalReviewBody);}catch(caught){if(caught instanceof SyntaxError){error(500,'Internal error.');return true;}throw caught;}
    if(method==='PUT')await input.services.originalReview.create({...request,body});
    else await input.services.originalReview.update({...request,reviewNumber:match![4]!,body});
    input.raw(method==='PUT'?201:200,'','text/html; charset=UTF-8');
  }catch(caught){
    if(input.propagateError?.(caught))throw caught;
    if(caught instanceof FirstSliceError)error(caught.statusCode,caught.message,caught.errorCode);
    else error(500,'Internal error.','internal_error');
  }
  return true;
}
