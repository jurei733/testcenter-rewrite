import {originalSessionPaths} from '@testcenter-rewrite-app/contracts/original-session';
import type {IncomingMessage} from 'node:http';
import {randomBytes, randomInt} from 'node:crypto';
import {setTimeout} from 'node:timers/promises';
import {formatOriginalAdminAccessSet} from '@testcenter-rewrite-app/application';
import {FirstSliceError, type FirstSliceServices} from '@testcenter-rewrite-app/application';
import {OriginalSessionProof} from './original-session-proof.js';

export const originalSessionRoutes = new Map<string, string[]>([
  [originalSessionPaths.admin, ['PUT']], [originalSessionPaths.login, ['PUT']], [originalSessionPaths.person, ['PUT']], [originalSessionPaths.session, ['GET', 'PUT', 'DELETE']],
  [originalSessionPaths.challenge, ['POST']], [originalSessionPaths.personChallenge, ['POST']]
]);
const object = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const requireFields = (value: unknown, required: string[]): void => {
  for (const key of required) if (!object(value) || value[key] === undefined || value[key] === null) {
    throw new FirstSliceError(400, 'original_request_invalid', `Required body-parameter is missing: \`${key}\``);
  }
};
const fields = (value: unknown, required: string[], optional: string[] = []) => {
  requireFields(value, required);
  if (!object(value) || required.some(key => typeof value[key] !== 'string') ||
    optional.some(key => value[key] !== undefined && typeof value[key] !== 'string')) {
    throw new FirstSliceError(400, 'original_request_invalid', 'Invalid session request fields.');
  }
  return value as Record<string, string | undefined>;
};
const escapeHtml = (value: string): string => value.replace(/[&<>"']/g, character =>
  ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'}[character]!));
const sourceDate = (value: unknown, timeZone: string): string | null => {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) return null;
  const parts = new Intl.DateTimeFormat('en-GB', {timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23'}).formatToParts(new Date(value));
  const part = (type: string) => parts.find(item => item.type === type)!.value;
  return `${part('day')}/${part('month')}/${part('year')} ${part('hour')}:${part('minute')}`;
};
const createErrorId = (): string => `error-${randomBytes(7).toString('hex')}.${String(randomInt(100_000_000)).padStart(8, '0')}`;
export type OriginalSessionErrorReceipt = {errorId: string; errorCode: string; statusCode: number};

/** Original's Admin and participant session wire contract. Canonical RPC routes retain
 * their existing DTO, authorization and proof manager. */
export async function handleOriginalSessionHttp(input: {
  request: IncomingMessage; pathname: string; services: FirstSliceServices; proof: OriginalSessionProof;
  readBody: () => Promise<unknown>; send: (status: number, value: unknown) => void;
  raw: (status: number, value: string, contentType: string) => void;
  header: (name: string, value: string) => void;
  timeZone: string;
  // The optional server-owned ID source lets owned visual fixtures use the same
  // captured diagnostic input on both surfaces. HTTP callers cannot set it.
  createErrorId?: () => string;
  reportError: (receipt: OriginalSessionErrorReceipt) => void;
  propagateError: (error: unknown) => boolean;
}): Promise<boolean> {
  const methods = originalSessionRoutes.get(input.pathname);
  if (!methods) return false;
  input.header('cache-control', 'private, no-store');
  const method = input.request.method ?? '';
  let loginName: string | undefined;
  const token = () => {
    const header = input.request.headers.authtoken;
    if (typeof header !== 'string' || !header) throw new FirstSliceError(401, 'original_token_missing',
      `Auth Header not sufficient: ${header === '' ? 'empty' : 'missing'}`);
    return header;
  };
  const session = input.services.originalSession;
  const admin = input.services.originalAdminSession;
  const sendAdmin = (value: Awaited<ReturnType<typeof admin.login>>) => input.raw(200, formatOriginalAdminAccessSet(value), 'application/json');
  const adminLogin = async (name: string, password: string) => {
    // Source's fixed anti-brute-force delay precedes credential lookup; keep
    // it asynchronous so other HTTP requests and cancellation can progress.
    await setTimeout(500);
    return admin.login({name,password});
  };
  const readBody = async () => {
    try { return await input.readBody(); }
    catch (error) {
      if (error instanceof SyntaxError) throw new FirstSliceError(500, 'original_json_invalid', 'Internal error.');
      throw error;
    }
  };
  try {
    if (!methods.includes(method)) {
      input.header('allow', methods.join(', '));
      throw new FirstSliceError(405, 'original_method_not_allowed', `Method not allowed. Must be one of: ${methods.join(', ')}`);
    }
    if (input.pathname === '/session/admin') {
      const body=await readBody(); requireFields(body,['name','password']);
      input.proof.directAllowed('admin','');
      if(!object(body)||typeof body.name!=='string'||typeof body.password!=='string')throw new FirstSliceError(500,'original_admin_credentials_malformed','Internal error.');
      sendAdmin(await adminLogin(body.name,body.password));
    } else if (input.pathname === '/session/login') {
      const body = fields(await readBody(), ['name'], ['password']);
      loginName = body.name!;
      input.proof.directAllowed('login', body.password ?? '');
      input.send(200, await session.login({name: body.name!, password: body.password ?? ''}));
    } else if (input.pathname === '/session/person') {
      const loginToken = token(); await session.requireLogin({token: loginToken});
      const body = fields(await readBody(), [], ['code']);
      input.proof.directAllowed('person', body.code ?? '');
      input.send(200, await session.person({loginToken, code: body.code ?? ''}));
    } else if (input.pathname === '/session/challenge') {
      const body = fields(await readBody(), ['loginType', 'name', 'password']);
      if (body.loginType !== 'login' && body.loginType !== 'admin') throw new FirstSliceError(400, 'original_login_type_unsupported', 'This session login type is unavailable.');
      input.send(200, input.proof.create({kind: body.loginType, name: body.name!, password: body.password!}));
    } else if (input.pathname === '/session/person/challenge') {
      const loginToken = token(); await session.requireLogin({token: loginToken});
      const body = fields(await readBody(), ['code']);
      input.send(200, input.proof.create({kind: 'person', code: body.code!, tokenHash: OriginalSessionProof.tokenHash(loginToken)}));
    } else if (method === 'PUT') {
      const rawHeader = input.request.headers.authtoken;
      const loginToken = typeof rawHeader === 'string' ? rawHeader : '';
      const body = await readBody();
      requireFields(body, ['algorithm', 'challenge', 'salt', 'signature', 'number']);
      const target = await input.proof.consume(body, loginToken, token => session.requireLogin({token}));
      if (target.kind === 'login') loginName = target.name;
      if(target.kind === 'admin')sendAdmin(await adminLogin(target.name,target.password));
      else input.send(200, target.kind === 'login' ? await session.login({name: target.name, password: target.password})
        : await session.person({loginToken, code: target.code}));
    } else if (method === 'GET') {
      const credential=token();
      if(await admin.recognizes(credential))sendAdmin(await admin.read({token:credential}));
      else input.send(200,await session.read({token:credential}));
    } else {
      const credential=token();
      if(await admin.recognizes(credential))await admin.logout({token:credential});
      else await session.logout({token:credential});
      input.send(205,null);
    }
  } catch (error) {
    // The outer transport owner handles aborted and oversized requests. All
    // other native Session errors use Source's production error envelope.
    if (input.propagateError(error)) throw error;
    const known = error instanceof FirstSliceError;
    const errorCode = known ? error.errorCode : 'internal_error';
    let statusCode = known ? error.statusCode : 500;
    let message = known ? error.message : 'Internal error.';
    const badCredentials = ['original_login_invalid', 'participant_login_invalid', 'participant_password_invalid', 'participant_code_required'];
    if (badCredentials.includes(errorCode)) {
      statusCode = 400;
      if (loginName !== undefined) message = `No Login for \`${escapeHtml(loginName)}\` with this password.`;
    } else if (errorCode === 'participant_login_rate_limited' || errorCode === 'admin_login_rate_limited') message = 'Too many login attempts';
    else if (errorCode === 'original_session_invalid' || errorCode === 'original_admin_session_invalid') {
      statusCode = 403;
      // Source echoes the supplied bearer. Keep the existing credential
      // redaction boundary while retaining its native forbidden status.
      message = 'Invalid token.';
    } else if (known && object(error.details)) {
      const end = sourceDate(error.details.validUntil, input.timeZone), start = sourceDate(error.details.validFrom, input.timeZone);
      if (errorCode === 'participant_access_expired' && end) message = `Testing Period for this login is over since ${end}`;
      if (errorCode === 'participant_access_not_started' && start) message = `Testing Period for this login has not yet started and will begin at ${start}`;
    }
    const errorId = (input.createErrorId ?? createErrorId)();
    input.header('Error-ID', errorId); input.header('Test-Mode', 'NO');
    input.reportError({errorId, errorCode, statusCode});
    input.raw(statusCode, statusCode >= 500 ? 'Internal error.' : escapeHtml(message), 'text/html;charset=UTF-8');
  }
  return true;
}
