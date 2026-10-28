import {OriginalPhpNumber,OriginalPhpObject} from './original-test-log-json.js';
import {FirstSliceError} from './first-slice-error.js';
import {encodeOriginalReportJson} from './original-workspace-report-wire.js';

export type OriginalCommandFields={keyword:string;arguments:string[];timestamp:string;testNumbers:string[]};
export type OriginalCommandPacket={id:string;keyword:string;arguments:string[];timestamp:string};
const minimum=-9223372036854775808n,maximum=9223372036854775807n;
const internal=()=>new FirstSliceError(500,'original_command_invalid','Internal error.');
const field=(body:unknown,key:string):unknown=>body instanceof OriginalPhpObject?body.fields.get(key):
  body&&typeof body==='object'&&!Array.isArray(body)&&Object.hasOwn(body,key)?(body as Record<string,unknown>)[key]:undefined;
const required=(body:unknown,key:string):unknown=>{const value=field(body,key);if(value===undefined||value===null)throw new FirstSliceError(400,'original_request_invalid','Required body-parameter is missing: `'+key+'`');return value;};

/** zend_dval_to_lval wraps binary floats; numeric strings use its saturating variant.
 * Pinned PHP8.3.36 Zend/zend_operators.c and .h, plus actual Source67 HTTP vectors. */
export function originalCommandInteger(value:unknown):bigint{
  if(value instanceof OriginalPhpNumber)return value.integer??floatInteger(value.value);
  if(value===undefined||value===null||value===false)return 0n;
  if(value===true)return 1n;
  if(typeof value==='number')return floatInteger(value);
  if(typeof value==='string'){
    const token=/^[\x20\t\n\r\v\f]*([+-]?(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)(?:[eE][+-]?[0-9]+)?)/.exec(value)?.[1];
    if(!token)return 0n;
    if(/^[+-]?[0-9]+$/.test(token)){const digits=token.replace(/^[+-]?0*/, '');if(digits.length>19)return token.startsWith('-')?minimum:maximum;const n=BigInt(token);return n<minimum?minimum:n>maximum?maximum:n;}
    const n=Number(token);if(!Number.isFinite(n))return 0n;
    return n>=Number(maximum)?maximum:n<Number(minimum)?minimum:BigInt(Math.trunc(n));
  }
  if(Array.isArray(value))return value.length?1n:0n;
  if(typeof value==='object')return 1n;
  throw internal();
}
const floatInteger=(value:number):bigint=>Number.isFinite(value)?BigInt.asIntN(64,BigInt(Math.trunc(value))):0n;

/** Round the actual binary64 rational to PHP's precision=14, ties to even.
 * No decimal-to-binary-to-decimal double rounding or JS shortest-number formatting. */
export function originalCommandFloatString(value:number):string{
  if(Number.isNaN(value))return'NAN';if(!Number.isFinite(value))return value<0?'-INF':'INF';
  if(value===0)return Object.is(value,-0)?'-0':'0';
  const negative=value<0,absolute=Math.abs(value),data=new DataView(new ArrayBuffer(8));data.setFloat64(0,absolute);
  const bits=data.getBigUint64(0),exponentBits=Number((bits>>52n)&2047n),fraction=bits&((1n<<52n)-1n);
  const mantissa=exponentBits?(1n<<52n)+fraction:fraction,shift=exponentBits?exponentBits-1023-52:-1074;
  const numerator=shift>=0?mantissa<<BigInt(shift):mantissa,denominator=shift<0?1n<<BigInt(-shift):1n;
  const compare=(power:number)=>{const left=power<0?numerator*10n**BigInt(-power):numerator,right=power>=0?denominator*10n**BigInt(power):denominator;return left<right?-1:left>right?1:0;};
  let exponent=Math.floor(Math.log10(absolute));while(compare(exponent)<0)exponent--;while(compare(exponent+1)>=0)exponent++;
  const scale=13-exponent,n=scale>=0?numerator*10n**BigInt(scale):numerator,d=scale<0?denominator*10n**BigInt(-scale):denominator;
  let rounded=n/d;const remainder=n%d;if(remainder*2n>d||(remainder*2n===d&&rounded%2n===1n))rounded++;
  if(rounded>=100000000000000n){rounded/=10n;exponent++;}
  const digits=rounded.toString().replace(/0+$/,''),sign=negative?'-':'';
  if(exponent< -4||exponent>=14)return sign+digits[0]+'.'+(digits.slice(1)||'0')+'E'+(exponent<0?'-':'+')+Math.abs(exponent);
  const point=exponent+1;
  return sign+(point<=0?'0.'+'0'.repeat(-point)+digits:point>=digits.length?digits+'0'.repeat(point-digits.length):digits.slice(0,point)+'.'+digits.slice(point));
}
function argument(value:unknown):string{
  if(value instanceof OriginalPhpNumber)return value.integer?.toString()??originalCommandFloatString(value.value);
  if(value===null||value===undefined||value===false)return'';if(value===true)return'1';
  if(typeof value==='string')return value;
  if(typeof value==='number')return Number.isSafeInteger(value)?String(value):originalCommandFloatString(value);
  if(Array.isArray(value))return'Array';
  throw internal();
}

/** Construction and target coercion happen before existence checks/allocation.
 * SQL value validation is deliberately a separate later phase. */
export function parseOriginalCommandFields(body:unknown):OriginalCommandFields{
  const keyword=required(body,'keyword'),timestamp=required(body,'timestamp');
  if(typeof keyword!=='string')throw internal();
  const args=field(body,'arguments')??[],targets=field(body,'testIds')??[];
  if(!Array.isArray(args)||!Array.isArray(targets))throw internal();
  return{keyword,arguments:args.map(argument),timestamp:originalCommandInteger(timestamp).toString(),testNumbers:[...new Set(targets.map(value=>originalCommandInteger(value).toString()))]};
}
function daysFromCivil(year:number,month:number,day:number):number{
  year-=month<=2?1:0;const era=Math.floor(year/400),yoe=year-era*400,doy=Math.floor((153*(month+(month>2?-3:9))+2)/5)+day-1;
  return era*146097+yoe*365+Math.floor(yoe/4)-Math.floor(yoe/100)+doy-719468;
}
const lastSqlSecond=BigInt(daysFromCivil(294277,1,1))*86400n-1n;
const firstUnreadableSecond=BigInt(daysFromCivil(10000,1,1))*86400n;

/** Invoke only after committing the reserved command ID. Native SQL rejects
 * invalid timestamps, varchar length and JSONB NUL without refunding its sequence. */
export function prepareOriginalCommandInsert(fields:OriginalCommandFields):Omit<OriginalCommandFields,'testNumbers'>{
  const keyword=fields.keyword.split('\0',1)[0]!,clock=BigInt(fields.timestamp);
  if([...keyword].length>50||fields.arguments.some(value=>value.includes('\0'))||clock<=0n||clock>lastSqlSecond)throw internal();
  return{keyword,arguments:[...fields.arguments],timestamp:clock.toString()};
}
export function readOriginalLastCommandId(body:unknown):string|null{
  const value=field(body,'lastCommandId');if(value===undefined||value===null)return null;
  if(value instanceof OriginalPhpNumber){if(value.integer===null)throw internal();return value.integer===0n?null:value.integer.toString();}
  if(typeof value!=='number'||!Number.isSafeInteger(value))throw internal();return value===0?null:String(value);
}
export function formatOriginalCommandsJson(commands:OriginalCommandPacket[]):string{
  return'['+commands.map(command=>{
    if(typeof command.id!=='string'||typeof command.timestamp!=='string'||!Array.isArray(command.arguments)||command.arguments.some(value=>typeof value!=='string')||!/^[1-9][0-9]*$/.test(command.id)||BigInt(command.id)>maximum||!/^[1-9][0-9]*$/.test(command.timestamp)||BigInt(command.timestamp)>=firstUnreadableSecond)throw internal();
    return'{"id":'+command.id+',"keyword":'+encodeOriginalReportJson(command.keyword)+',"arguments":'+encodeOriginalReportJson(command.arguments)+',"timestamp":'+command.timestamp+'}';
  }).join(',')+']';
}
