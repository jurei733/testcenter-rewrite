import type {IncomingMessage} from 'node:http';
import {FirstSliceError, encodeOriginalReportJson, type FirstSliceServices} from '@testcenter-rewrite-app/application';

const groupPath = /^\/monitor\/group\/([^/]+)\/test-sessions$/;
export function originalMonitorRouteLabel(method: string, pathname: string): string | null {
  return pathname === '/monitor/test-sessions' ? method + ' /monitor/test-sessions' : groupPath.test(pathname) ? method + ' /monitor/group/:groupName/test-sessions' : null;
}
export async function handleOriginalMonitorHttp(input: {request: IncomingMessage; pathname: string; services: FirstSliceServices;
  header: (name: string, value: string) => void; raw: (status: number, text: string, contentType: string) => void}): Promise<boolean> {
  if (!originalMonitorRouteLabel('', input.pathname)) return false;
  input.header('cache-control', 'private, no-store');
  if (input.request.method !== 'GET') {input.header('allow', 'GET'); input.raw(405, encodeOriginalReportJson('Method not allowed.'), 'application/json'); return true;}
  try {
    const token = input.request.headers.authtoken;
    if (typeof token !== 'string' || !token) throw new FirstSliceError(401, 'original_token_missing', 'Auth Header not sufficient: missing or empty');
    // Role and current private credential provenance precede group decoding.
    await input.services.originalMonitor.requireMonitor({token});
    let groupKey: string | undefined;
    const match = groupPath.exec(input.pathname);
    if (match) {try {groupKey = decodeURIComponent(match[1]!);} catch {throw new FirstSliceError(400, 'original_monitor_path_invalid', 'Invalid path.');}}
    input.raw(200, await input.services.originalMonitor.sessions({token, groupKey}), 'application/json');
  } catch (error) {
    if (!(error instanceof FirstSliceError)) throw error;
    input.raw(error.statusCode, encodeOriginalReportJson(error.message), 'application/json');
  }
  return true;
}
