import type {IncomingMessage} from 'node:http';
import {FirstSliceError, type FirstSliceServices} from '@testcenter-rewrite-app/application';

export const originalTestCreationPath = '/test';
export async function handleOriginalTestHttp(input: {
  request: IncomingMessage; pathname: string; services: FirstSliceServices;
  readBody: () => Promise<unknown>; send: (status: number, value: unknown) => void;
  raw: (status: number, text: string, contentType: string) => void; header: (name: string, value: string) => void;
}): Promise<boolean> {
  if (input.pathname !== originalTestCreationPath) return false;
  input.header('cache-control', 'private, no-store');
  if (input.request.method !== 'PUT') {input.header('allow', 'PUT'); input.send(405, 'Method not allowed'); return true;}
  try {
    const token = input.request.headers.authtoken;
    if (typeof token !== 'string' || !token) throw new FirstSliceError(401, 'original_token_missing', 'Auth Header not sufficient: missing or empty');
    await input.services.originalTest.requirePerson({token});
    let body: unknown;
    try {body = await input.readBody();} catch (error) {
      if (error instanceof SyntaxError) throw new FirstSliceError(400, 'original_json_invalid', 'Request body must be valid JSON.');
      throw error;
    }
    if (body === null || typeof body !== 'object' || Array.isArray(body) || typeof (body as Record<string, unknown>).bookletName !== 'string') {
      throw new FirstSliceError(400, 'original_request_invalid', 'Required body-parameter is missing: `bookletName`');
    }
    const number = await input.services.originalTest.create({token, bookletName: (body as {bookletName: string}).bookletName});
    input.raw(201, number, 'text/html; charset=UTF-8');
  } catch (error) {
    if (!(error instanceof FirstSliceError)) throw error;
    input.send(error.statusCode, error.message);
  }
  return true;
}
