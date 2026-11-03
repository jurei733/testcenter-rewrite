import {randomUUID} from 'node:crypto';
import type {IncomingMessage} from 'node:http';
import {FirstSliceError, encodeOriginalReportJson, decodeOriginalTestLogJson, type FirstSliceServices} from '@testcenter-rewrite-app/application';

const profilePath = /^\/monitor\/profile\/([^/]+)$/;
const bookletPath = /^\/booklet\/([^/]+)$/;
const lockPath = /^\/monitor\/group\/([^/]+)\/tests\/(lock|unlock)$/;
const groupPath = /^\/monitor\/group\/([^/]+)\/test-sessions$/;
export function originalMonitorRouteLabel(method: string, pathname: string): string | null {
  const lock=lockPath.exec(pathname);if(lock)return method+' /monitor/group/:groupName/tests/'+lock[2];
  return pathname === '/monitor/test-sessions' ? method + ' /monitor/test-sessions' : groupPath.test(pathname) ? method + ' /monitor/group/:groupName/test-sessions' : profilePath.test(pathname) ? method + ' /monitor/profile/:profileId' : bookletPath.test(pathname) ? method + ' /booklet/:bookletName' : null;
}
export async function handleOriginalMonitorHttp(input: {request: IncomingMessage; pathname: string; services: FirstSliceServices;
  readBody: (allowEmpty?:boolean,decode?:(payload:Uint8Array)=>unknown)=>Promise<unknown>;
  subscribe?:(target:{channel:'test-sessions';groupKey?:string},credential:string)=>Promise<void>;
  header: (name: string, value: string) => void; raw: (status: number, text: string, contentType: string) => void}): Promise<boolean> {
  if (!originalMonitorRouteLabel('', input.pathname)) return false;
  input.header('cache-control', 'private, no-store');
  const mutation=lockPath.exec(input.pathname),method=mutation?'POST':'GET';
  if(input.request.method!==method){input.header('allow',method);if(mutation){input.header('Test-Mode','NO');input.header('Error-ID','error-'+randomUUID());input.raw(405,'Method not allowed. Must be one of: '+method,'text/html;charset=UTF-8');}else input.raw(405,encodeOriginalReportJson('Method not allowed.'),'application/json');return true;}
  try {
    const token = input.request.headers.authtoken;
    if (typeof token !== 'string' || !token) throw new FirstSliceError(401, 'original_token_missing', 'Auth Header not sufficient: missing or empty');
    // Role and current private credential provenance precede group decoding.
    const booklet=bookletPath.exec(input.pathname),profile=profilePath.exec(input.pathname);
    if(booklet)await input.services.originalTest.requirePerson({token});else await input.services.originalMonitor.requireMonitor({token});
    if(mutation){let groupKey:string;try{groupKey=decodeURIComponent(mutation[1]!);}catch{throw new FirstSliceError(400,'original_monitor_path_invalid','Invalid path.');}
      await input.services.originalMonitor.requireMonitor({token,groupKey});
      let body:unknown;try{body=await input.readBody(true,decodeOriginalTestLogJson);}catch(error){if(error instanceof SyntaxError)throw new FirstSliceError(500,'original_monitor_json_invalid','Internal error.');throw error;}
      await input.services.originalMonitor.changeLocks({token,groupKey,locked:mutation[2]==='lock',body});input.raw(200,'','text/html; charset=UTF-8');return true;}
    if(booklet||profile){let identifier:string;try{identifier=decodeURIComponent((booklet??profile)![1]!);}catch{throw new FirstSliceError(400,'original_monitor_path_invalid','Invalid path.');}
      if(booklet)input.raw(200,await input.services.originalMonitor.booklet({token,bookletName:identifier}),'application/xml');
      else input.raw(200,encodeOriginalReportJson(await input.services.originalMonitor.profile({token,profileId:identifier})),'application/json');return true;}
    let groupKey: string | undefined;
    const match = groupPath.exec(input.pathname);
    if (match) {try {groupKey = decodeURIComponent(match[1]!);} catch {throw new FirstSliceError(400, 'original_monitor_path_invalid', 'Invalid path.');}}
    const snapshot=await input.services.originalMonitor.sessions({token,groupKey});
    await input.subscribe?.({channel:'test-sessions',groupKey},token);
    input.raw(200,snapshot,'application/json');
  } catch (error) {
    if (!(error instanceof FirstSliceError)) throw error;
    if(mutation||profilePath.test(input.pathname)||bookletPath.test(input.pathname)){
      input.header('Error-ID','error-'+randomUUID());input.header('Test-Mode','NO');
      input.raw(error.statusCode,(error.statusCode>=500?'Internal error.':error.message).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\"/g,'&quot;').replace(/'/g,'&#039;'),'text/html;charset=UTF-8');
    }else input.raw(error.statusCode, encodeOriginalReportJson(error.message), 'application/json');
  }
  return true;
}
