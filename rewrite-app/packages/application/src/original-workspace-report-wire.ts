import {exactParticipantTestLogTimestamp} from '@testcenter-rewrite-app/domain';
import type {OriginalReportFormat} from '@testcenter-rewrite-app/contracts';
import {formatOriginalReportCsv} from './original-report-csv.js';

type Identity = {groupname:string; loginname:string; code:string; bookletname:string; unitname:string};
export type OriginalResponseReportRecord = Identity & {
  laststate:string|null; originalUnitId:string;
  responses:Array<{id:string; content:string; ts:number; responseType:string}>;
};
export type OriginalLogReportRecord = Identity & {originalUnitId:string; timestamp:number; originalClientTimestamp?:string; logentry:string};
/** DAO-shaped data: code is the stored person suffix, and reviewtime has
 * already been rendered in the configured system timezone. */
export type OriginalReviewReportRecord = Identity & {
  priority:number; categories:string; reviewtime:string|null; entry:string;
  page:number|null; pagelabel:string|null; originalUnitId:string; userAgent:string|null; reviewer:string|null;
};
export type OriginalReportLabels = {unitlabel:string; bookletlabel:string};
const requireUnicode = (text:string):void => {
  for (const letter of text) if (letter.length===1 && letter.charCodeAt(0)>=0xd800 && letter.charCodeAt(0)<=0xdfff) {
    throw new RangeError('An Original report requires valid Unicode strings.');
  }
};

/** PHP json_encode's default string dialect, including nested response arrays.
 * Keep the caller's row/key order; Source's CSV column order is independent. */
export function encodeOriginalReportJson(value: unknown): string {
  const text = JSON.stringify(value, (key,item:unknown) => {
    requireUnicode(key);
    if (typeof item==='string') requireUnicode(item);
    if (typeof item==='number' && !Number.isFinite(item)) throw new RangeError('An Original report requires finite numbers.');
    return item;
  });
  if (text === undefined) throw new TypeError('An Original report requires JSON data.');
  return text.replace(/\//g, '\\/').replace(/[\u0080-\uffff]/g,
    letter => '\\u'+letter.charCodeAt(0).toString(16).padStart(4,'0'));
}

const identity = (row:Identity):Identity => ({groupname:row.groupname, loginname:row.loginname,
  code:row.code, bookletname:row.bookletname, unitname:row.unitname});
const render = (format:OriginalReportFormat, rows:Record<string,unknown>[], columns?:string[]):string => {
  // Report::generate returns false before Report::asString on an empty report.
  // That is zero bytes even for JSON, rather than [] or a CSV header/BOM.
  if (!rows.length) return '';
  if (format === 'json') return encodeOriginalReportJson(rows);
  const names=columns ?? [...new Set(rows.flatMap(row => Object.keys(row)))];
  for (const name of names) requireUnicode(name);
  for (const row of rows) for (const value of Object.values(row)) if (typeof value==='string') requireUnicode(value);
  return formatOriginalReportCsv(names, rows);
};

export function formatOriginalResponseReport(rows:OriginalResponseReportRecord[], format:OriginalReportFormat):string {
  const records = rows.map(row => ({...identity(row), laststate:row.laststate,
    originalUnitId:row.originalUnitId, responses:row.responses.map(part =>
      ({id:part.id, content:part.content, ts:part.ts, responseType:part.responseType}))}));
  if (format === 'json') return render(format, records);
  return render(format, records.map(row => ({...row, responses:encodeOriginalReportJson(row.responses)})),
    ['groupname','loginname','code','bookletname','unitname','originalUnitId','responses','laststate']);
}

export function formatOriginalLogReport(rows:OriginalLogReportRecord[], format:OriginalReportFormat):string {
  // AdminDAO uses UNION ALL, without an ORDER BY: retain the supplied sequence.
  return render(format, rows.map(row => ({...identity(row), originalUnitId:row.originalUnitId,
    timestamp:row.originalClientTimestamp === undefined ? row.timestamp : format === 'csv' ? exactParticipantTestLogTimestamp(row) :
      (JSON as unknown as {rawJSON:(value:string)=>unknown}).rawJSON(exactParticipantTestLogTimestamp(row)), logentry:row.logentry})),
  ['groupname','loginname','code','bookletname','unitname','originalUnitId','timestamp','logentry']);
}

const trim = (text:string):string => text.replace(/^[ \t\n\r\0\v]+|[ \t\n\r\0\v]+$/g,'');
const numeric = (text:string):boolean => /^[ \t\n\r\f\v]*[+-]?(?:[0-9]+\.?[0-9]*|\.[0-9]+)(?:[eE][+-]?[0-9]+)?[ \t\n\r\f\v]*$/.test(text);
const phpNumber = (text:string):{integer:bigint|null; floating:number; overflow:number} => {
  const source=text.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g,'');
  const unsigned=source.replace(/^[+-]/,'').replace(/^0+/,'');
  // Zend stops its integer scan after twenty significant prefix digits before
  // strtod, retaining overflow even if a decimal point/exponent follows.
  if ((/^[0-9]+/.exec(unsigned)?.[0].length ?? 0)>=20) {
    return {integer:null,floating:Number(source),overflow:source.startsWith('-')?-1:1};
  }
  if (/^[+-]?[0-9]+$/.test(source)) {
    const value=BigInt(source);
    const overflow=value < -9223372036854775808n ? -1 : value > 9223372036854775807n ? 1 : 0;
    return {integer:overflow ? null : value,floating:Number(source),overflow};
  }
  return {integer:null,floating:Number(source),overflow:0};
};
// PHP asort(SORT_REGULAR) and the non-strict array_keys used to collect
// categories compare two numeric strings numerically. Other strings compare
// their UTF-8 bytes. Stable ties retain the first observed spelling.
const compareCategory = (left:string, right:string):number => {
  if (numeric(left) && numeric(right)) {
    const a=phpNumber(left), b=phpNumber(right);
    if (a.integer!==null && b.integer!==null) return a.integer<b.integer?-1:a.integer>b.integer?1:0;
    if (a.integer!==null && b.overflow) return -b.overflow;
    if (b.integer!==null && a.overflow) return a.overflow;
    // Zend smart string comparison falls back to bytes when equal doubles
    // would erase an overflowing integer identity, or both are non-finite.
    if (!(a.overflow && a.overflow===b.overflow && a.floating-b.floating===0) &&
        !(a.floating===b.floating && !Number.isFinite(a.floating))) {
      return a.floating<b.floating?-1:a.floating>b.floating?1:0;
    }
  }
  return Buffer.compare(Buffer.from(left,'utf8'),Buffer.from(right,'utf8'));
};
const categoryKeys = (rows:OriginalReviewReportRecord[]):string[] => {
  const keys:string[]=[];
  for (const row of rows) {
    // PHP empty('0') is true. Internal spaces still produce empty categories.
    if (!row.categories || row.categories==='0') continue;
    for (const key of trim(row.categories).split(' ')) {
      if (!keys.some(existing => compareCategory(existing,key)===0)) keys.push(key);
    }
  }
  return keys.sort(compareCategory);
};

export function formatOriginalReviewReport(input:{rows:OriginalReviewReportRecord[]; format:OriginalReportFormat;
  useNewVersion:boolean; labels?:(bookletName:string,unitName:string)=>OriginalReportLabels}):string {
  const keys=categoryKeys(input.rows);
  const rows=input.rows.map(row => {
    const values=trim(row.categories).split(' ');
    const categories=Object.fromEntries(keys.map(key => {
      const selected=values.includes(key);
      return input.useNewVersion ? ['category_'+key,input.format==='csv'?(selected?'TRUE':'FALSE'):selected]
        : ['category: '+key,selected?'X':null];
    }));
    const record:Record<string,unknown>={...identity(row),priority:row.priority,...categories,
      reviewtime:row.reviewtime,...(input.useNewVersion?{}:{entry:row.entry}),page:row.page,pagelabel:row.pagelabel,
      originalUnitId:row.originalUnitId,userAgent:row.userAgent};
    if (input.useNewVersion) {
      const labels=row.bookletname && row.bookletname!=='0' ? input.labels?.(row.bookletname,row.unitname) : undefined;
      Object.assign(record,{reviewer:row.reviewer,entry:row.entry,
        unitlabel:labels?.unitlabel ?? '',bookletlabel:labels?.bookletlabel ?? ''});
    }
    return record;
  });
  return render(input.format,rows);
}

/** Source TimeStamp::toDisplayFormat: seconds, configured system timezone,
 * null for an observed epoch at/before zero. Do not use the Run update time. */
export function formatOriginalReviewTimestamp(value:string|null, timeZone:string):string|null {
  if (value===null) return null;
  const timestamp=Date.parse(value);
  if (!Number.isFinite(timestamp)) throw new RangeError('An Original review requires its stored timestamp.');
  if (timestamp<1000) return null;
  const parts=new Map(new Intl.DateTimeFormat('en-GB',{timeZone,calendar:'gregory',numberingSystem:'latn',
    year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'})
    .formatToParts(timestamp).map(part => [part.type,part.value]));
  return `${parts.get('year')!.padStart(4,'0')}-${parts.get('month')}-${parts.get('day')} ${parts.get('hour')}:${parts.get('minute')}:${parts.get('second')}`;
}
