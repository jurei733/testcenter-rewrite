import {originalSessionPaths} from '@testcenter-rewrite-app/contracts/original-session';
import type {IncomingMessage} from 'node:http';
import {FirstSliceError, type FirstSliceServices} from '@testcenter-rewrite-app/application';
import {OriginalSessionProof} from './original-session-proof.js';

export const originalSessionRoutes = new Map<string, string[]>([
  [originalSessionPaths.login, ['PUT']], [originalSessionPaths.person, ['PUT']], [originalSessionPaths.session, ['GET', 'PUT', 'DELETE']],
  [originalSessionPaths.challenge, ['POST']], [originalSessionPaths.personChallenge, ['POST']]
]);
const object = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const fields = (value: unknown, required: string[], optional: string[] = []) => {
  if (!object(value) || required.some(key => typeof value[key] !== 'string') ||
    optional.some(key => value[key] !== undefined && typeof value[key] !== 'string')) {
    throw new FirstSliceError(400, 'original_request_invalid', 'Invalid session request fields.');
  }
  return value as Record<string, string | undefined>;
};

/** Original's participant session wire contract. Canonical RPC routes retain
 * their existing DTO, authorization and proof manager. */
export async function handleOriginalSessionHttp(input: {
  request: IncomingMessage; pathname: string; services: FirstSliceServices; proof: OriginalSessionProof;
  readBody: () => Promise<unknown>; send: (status: number, value: unknown) => void;
  header: (name: string, value: string) => void;
}): Promise<boolean> {
  const methods = originalSessionRoutes.get(input.pathname);
  if (!methods) return false;
  input.header('cache-control', 'private, no-store');
  const method = input.request.method ?? '';
  if (!methods.includes(method)) { input.header('allow', methods.join(', ')); input.send(405, 'Method not allowed'); return true; }
  const token = () => {
    const header = input.request.headers.authtoken;
    if (typeof header !== 'string' || !header) throw new FirstSliceError(401, 'original_token_missing', 'Auth Header not sufficient: missing or empty');
    return header;
  };
  const session = input.services.originalSession;
  const readBody = async () => {
    try { return await input.readBody(); }
    catch (error) {
      if (error instanceof SyntaxError) throw new FirstSliceError(400, 'original_json_invalid', 'Request body must be valid JSON.');
      throw error;
    }
  };
  try {
    if (input.pathname === '/session/login') {
      const body = fields(await readBody(), ['name'], ['password']);
      input.proof.directAllowed('login', body.name!);
      input.send(200, await session.login({name: body.name!, password: body.password ?? ''}));
    } else if (input.pathname === '/session/person') {
      const loginToken = token(); await session.requireLogin({token: loginToken});
      const body = fields(await readBody(), [], ['code']);
      input.proof.directAllowed('person', body.code ?? '');
      input.send(200, await session.person({loginToken, code: body.code ?? ''}));
    } else if (input.pathname === '/session/challenge') {
      const body = fields(await readBody(), ['loginType', 'name', 'password']);
      if (body.loginType !== 'login') throw new FirstSliceError(400, 'original_login_type_unsupported', 'This session login type is unavailable.');
      input.send(200, input.proof.create({kind: 'login', name: body.name!, password: body.password!}));
    } else if (input.pathname === '/session/person/challenge') {
      const loginToken = token(); await session.requireLogin({token: loginToken});
      const body = fields(await readBody(), ['code']);
      input.send(200, input.proof.create({kind: 'person', code: body.code!, tokenHash: OriginalSessionProof.tokenHash(loginToken)}));
    } else if (method === 'PUT') {
      const rawHeader = input.request.headers.authtoken;
      const loginToken = typeof rawHeader === 'string' ? rawHeader : '';
      const target = await input.proof.consume(await readBody(), loginToken, token => session.requireLogin({token}));
      input.send(200, target.kind === 'login' ? await session.login({name: target.name, password: target.password})
        : await session.person({loginToken, code: target.code}));
    } else if (method === 'GET') input.send(200, await session.read({token: token()}));
    else { await session.logout({token: token()}); input.send(205, null); }
  } catch (error) {
    if (!(error instanceof FirstSliceError)) throw error;
    const badCredentials = ['original_login_invalid', 'participant_login_invalid', 'participant_password_invalid', 'participant_code_required'];
    input.send(badCredentials.includes(error.errorCode) ? 400 : error.statusCode, error.message);
  }
  return true;
}
