import {readParticipantTestLogTimestamp,type ParticipantTestLog} from '@testcenter-rewrite-app/domain';
import {FirstSliceError} from './first-slice-error.js';
import {encodeOriginalReportJson} from './original-workspace-report-wire.js';

const min = -9223372036854775808n, max = 9223372036854775807n;
class PhpNumber {
  readonly integer: bigint | null;
  readonly value: number;
  constructor(readonly literal: string) {
    const bounded = literal.length <= (literal.startsWith('-') ? 20 : 19);
    const integer = bounded && /^-?(?:0|[1-9][0-9]*)$/.test(literal) ? BigInt(literal) : null;
    this.integer = integer !== null && integer >= min && integer <= max ? integer : null;
    this.value = Number(literal);
    Object.freeze(this);
  }
}
class PhpObject {
  constructor(readonly fields: Map<string, unknown>) {}
}
const internal = () => new FirstSliceError(500, 'original_test_log_json_invalid', 'Internal error.');
const missing = (field: string) => new FirstSliceError(400, 'original_request_invalid', 'Required body-parameter is missing: `'+field+'`');
const unicode = (value: string): void => {
  for (const letter of value) if (letter.length === 1 && letter.charCodeAt(0) >= 0xd800 && letter.charCodeAt(0) <= 0xdfff) {
    throw new SyntaxError('Malformed UTF-16 in native JSON.');
  }
};

/** Preserve PHP int/float tokens and stdClass property order, including numeric
 * names. JSON.parse first validates the grammar; this bounded second pass only
 * retains information that ordinary JS decoding would irreversibly discard. */
export function decodeOriginalTestLogJson(payload: Uint8Array | string): unknown {
  let text: string;
  try { text = typeof payload === 'string' ? payload : new TextDecoder('utf-8', {fatal:true,ignoreBOM:true}).decode(payload); }
  catch { throw new SyntaxError('Malformed UTF-8 in native JSON.'); }
  JSON.parse(text);
  let offset = 0;
  const space = (): void => { while (/[\x20\t\r\n]/.test(text[offset] ?? '') && offset < text.length) offset++; };
  const string = (): string => {
    const start = offset++;
    while (offset < text.length) {
      if (text[offset] === '\\') offset += 2;
      else if (text[offset++] === '"') break;
    }
    const value = JSON.parse(text.slice(start, offset)) as string;
    unicode(value); return value;
  };
  const value = (depth: number): unknown => {
    space(); const token = text[offset];
    if (token === '"') return string();
    if (token === '[' || token === '{') {
      if (depth >= 511) throw new SyntaxError('Maximum native JSON depth exceeded.');
      offset++; space();
      if (token === '[') {
        const result: unknown[] = [];
        if (text[offset] !== ']') for (;;) {
          result.push(value(depth + 1)); space();
          if (text[offset] !== ',') break; offset++;
        }
        offset++; return result;
      }
      const result = new Map<string, unknown>();
      if (text[offset] !== '}') for (;;) {
        space(); const key = string();
        if (key.startsWith('\0')) throw new SyntaxError('Invalid native object property.');
        space(); offset++; result.set(key, value(depth + 1)); space();
        if (text[offset] !== ',') break; offset++;
      }
      offset++; return new PhpObject(result);
    }
    for (const [literal, result] of [['true',true],['false',false],['null',null]] as const) {
      if (text.startsWith(literal, offset)) { offset += literal.length; return result; }
    }
    const number = /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?/.exec(text.slice(offset))![0];
    offset += number.length;
    const numeric=Number(number);
    // Ordinary integer tokens need no wrapper; floats retain their lexical
    // type even when numerically integral (a strict PHP timestamp distinction).
    if (/^-?(?:0|[1-9][0-9]*)$/.test(number) && Number.isSafeInteger(numeric)) return numeric === 0 ? 0 : numeric;
    return new PhpNumber(number);
  };
  const result = value(0); space();
  if (offset !== text.length) throw new SyntaxError('Invalid trailing native JSON.');
  return result;
}

const floating = (value: number): string => {
  if (!Number.isFinite(value)) throw internal();
  if (Object.is(value, -0)) return '-0';
  const absolute = Math.abs(value);
  if (absolute !== 0 && (absolute < 0.0001 || absolute >= 1e17)) {
    const [mantissa, exponent] = value.toExponential().split('e');
    return mantissa + (mantissa!.includes('.') ? '' : '.0') + 'e' + exponent;
  }
  return JSON.stringify(value);
};
/** Content is already PHP-encoded when it reaches a durable log. Never pass
 * numeric tokens through JS JSON.stringify or reorder stdClass numeric names. */
export function encodeOriginalTestLogContent(input: unknown): string {
  const seen = new Set<object>();
  const encode = (value: unknown, depth: number): string => {
    if (depth > 511) throw internal();
    if (value instanceof PhpNumber) return value.integer === null ? floating(value.value) : value.integer.toString();
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) throw internal();
      const token = new PhpNumber(JSON.stringify(value));
      return token.integer === null ? floating(token.value) : token.integer.toString();
    }
    if (value === null || typeof value === 'boolean' || typeof value === 'string') {
      if (typeof value === 'string') unicode(value);
      return encodeOriginalReportJson(value);
    }
    if (!value || typeof value !== 'object' || seen.has(value)) throw internal();
    seen.add(value);
    try {
      if (Array.isArray(value)) return '['+Array.from(value,item=>encode(item,depth+1)).join(',')+']';
      const entries = value instanceof PhpObject ? [...value.fields] :
        [Object.prototype,null].includes(Object.getPrototypeOf(value)) ? Object.entries(value) : null;
      if (!entries) throw internal();
      return '{'+entries.map(([key,item])=>{unicode(key);if(key.startsWith('\0'))throw internal();return encodeOriginalReportJson(key)+':'+encode(item,depth+1);}).join(',')+'}';
    } finally { seen.delete(value); }
  };
  try { return encode(input,0); } catch (error) { if (error instanceof FirstSliceError) throw error; throw internal(); }
}

/** Required-field extraction precedes the durable lock; strict TestLog field
 * validation follows it, matching the observed production controller order. */
export function readOriginalTestLockFields(body: unknown): {message: unknown; timeStamp: unknown} {
  const field = (name: string): unknown => body instanceof PhpObject ? body.fields.get(name) :
    body && typeof body === 'object' && !Array.isArray(body) && Object.hasOwn(body,name) ? (body as Record<string,unknown>)[name] : undefined;
  const timeStamp = field('timeStamp');
  if (timeStamp === undefined || timeStamp === null) throw missing('timeStamp');
  return {message: field('message') ?? '', timeStamp};
}
export function parseOriginalTestLockLog(fields: {message: unknown; timeStamp: unknown}): ReturnType<typeof parseOriginalTestLogEntries>[number] {
  const entry = parseOriginalTestLogEntries([{key: fields.message, timeStamp: fields.timeStamp}])[0]!;
  // Lock passes a raw key and absent content to TestLog, not a JSON string.
  return {...entry, content: ''};
}

export function parseOriginalTestLogEntries(body: unknown): Array<{key:string;content:string;timeStamp:number;originalClientTimestamp?:string}> {
  if (!Array.isArray(body)) throw new FirstSliceError(400,'original_test_state_invalid','body has to be an array');
  return body.map(row => {
    const field = (name:string): unknown => row instanceof PhpObject ? row.fields.get(name) :
      row && typeof row === 'object' && !Array.isArray(row) && Object.hasOwn(row,name) ? row[name] : undefined;
    const key = field('key'), timestamp = field('timeStamp');
    if (key === undefined || key === null) throw missing('key');
    if (timestamp === undefined || timestamp === null) throw missing('timeStamp');
    if (typeof key !== 'string') throw internal();
    let clock: Pick<ParticipantTestLog,'timestamp'|'originalClientTimestamp'>;
    try {
      if (timestamp instanceof PhpNumber) {
        if (timestamp.integer === null) throw internal();
        clock = readParticipantTestLogTimestamp(timestamp.integer);
      } else {
        if (typeof timestamp !== 'number' || !Number.isInteger(timestamp)) throw internal();
        clock = readParticipantTestLogTimestamp(timestamp);
      }
      unicode(key);
    } catch { throw internal(); }
    const content = encodeOriginalTestLogContent(field('content') ?? '');
    // Actual Source52 proves PDO text parameters end at the first NUL in
    // the assembled logentry. JSON-escaped content itself contains no NUL.
    const separator = key.indexOf('\0');
    return {key:separator < 0 ? key : key.slice(0,separator),timeStamp:clock.timestamp,
      ...(clock.originalClientTimestamp === undefined ? {} : {originalClientTimestamp:clock.originalClientTimestamp}),
      content:separator < 0 ? content : ''};
  });
}
