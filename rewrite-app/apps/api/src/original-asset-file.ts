import {randomBytes} from 'node:crypto';
import type {IncomingHttpHeaders} from 'node:http';
import type {ApplicationAsset} from '@testcenter-rewrite-app/domain';

type Reply={status:number;headers:Record<string,string>;bytes:Buffer};
const immutable='public, max-age=31536000, immutable';
const empty=()=>Buffer.alloc(0);
const failure=(status:number,reason:string,extra:Record<string,string>={}):Reply=>{
 const bytes=Buffer.from(`<html>\r\n<head><title>${status} ${reason}</title></head>\r\n<body>\r\n<center><h1>${status} ${reason}</h1></center>\r\n<hr><center>nginx</center>\r\n</body>\r\n</html>\r\n`);
 return {status,headers:{'cache-control':'private, no-store','content-type':'text/html; charset=utf-8','content-length':String(bytes.length),...extra},bytes};
};

// Source file-server/nginx.conf uses Nginx's default exact date comparison.
// Its three HTTP date formats ignore the weekday and the trailing zone text;
// Date.parse alone would additionally accept ISO dates that Nginx rejects.
function httpTime(value:string):number{
 const separator=value.search(/[, ]/);if(separator<0)return -1;
 const rest=value.slice(separator+1).replace(/^ */,'');let day:number,year:number,monthText:string,hour:number,minute:number,second:number;
 if(value[separator]===','){
  const m=/^(\d{2})([ -])(.{3})\2(\d{4}|\d{2}) (\d{2}):(\d{2}):(\d{2})/.exec(rest);
  if(!m||m[2]===' '&&m[4]!.length!==4||m[2]==='-'&&m[4]!.length!==2)return -1;
  day=Number(m[1]);monthText=m[3]!;year=Number(m[4]);if(m[2]==='-')year+=year<70?2000:1900;
  hour=Number(m[5]);minute=Number(m[6]);second=Number(m[7]);
 }else{
  const m=/^(.{3}). ?(\d{1,2}) (\d{2}):(\d{2}):(\d{2}) (\d{4})/.exec(rest);if(!m)return -1;
  monthText=m[1]!;day=Number(m[2]);hour=Number(m[3]);minute=Number(m[4]);second=Number(m[5]);year=Number(m[6]);
 }
 const months:Record<string,number>={F:1,S:8,O:9,N:10,D:11};
 const month=monthText[0]==='J'?(monthText[1]==='a'?0:monthText[2]==='n'?5:6):monthText[0]==='M'?(monthText[2]==='r'?2:4):monthText[0]==='A'?(monthText[1]==='p'?3:7):months[monthText[0]!];
 if(month===undefined||hour>23||minute>59||second>59)return -1;
 const leap=year%4===0&&(year%100!==0||year%400===0),days=[31,leap?29:28,31,30,31,30,31,31,30,31,30,31];if(day>days[month]!)return -1;
 const date=new Date(0);date.setUTCFullYear(year,month,day);date.setUTCHours(hour,minute,second,0);return date.getTime()/1000;
}
const matches=(value:string,etag:string,weak:boolean)=>value==='*'||value.split(',').some(part=>(weak?part.trim().replace(/^W\//,''):part.trim())===etag);

// End offsets are exclusive. Keep Source's 64-bit overflow rejection, mixed
// unsatisfied members, and refusal to amplify a file with repeated ranges.
function ranges(value:string,length:number):'ignore'|'unsatisfied'|Array<{start:number;end:number}>{
 if(value.length<7||!/^bytes=/i.test(value))return 'ignore';
 const result:Array<{start:number;end:number}>=[],limit=9223372036854775807n,total=BigInt(length);let size=0;
 for(const part of value.slice(6).split(',')){
  const m=/^ *(?:(\d+) *- *(\d*)|-(\d+)) *$/.exec(part);if(!m)return 'unsatisfied';
  let start:bigint,end:bigint;
  if(m[3]!==undefined){const suffix=BigInt(m[3]);if(suffix>limit)return 'unsatisfied';start=suffix<total?total-suffix:0n;end=total;}
  else{start=BigInt(m[1]!);const last=m[2]?BigInt(m[2]):null;if(start>limit||last!==null&&last>limit)return 'unsatisfied';end=last===null||last>=total?total:last+1n;}
  if(start<end){const row={start:Number(start),end:Number(end)};result.push(row);size+=row.end-row.start;}
  else if(start===0n)return 'ignore';
 }
 if(!result.length)return 'unsatisfied';return size>length?'ignore':result;
}

/** Native public assets follow the actual Source Nginx file-server contract.
 * API credentials are irrelevant here; assignment metadata remains no-store.
 * References: Nginx release-1.22.1 not_modified/range filters and HTTP time
 * parser; actual independent HTTP proof: native-application-asset-wire-http.
 */
export function originalAssetFile(method:string,request:IncomingHttpHeaders,asset:ApplicationAsset|null,storedName:string):Reply{
 if(!['GET','HEAD','POST'].includes(method))return failure(405,'Not Allowed');
 if(!asset)return {status:404,headers:{'cache-control':'private, no-store','content-type':'text/plain; charset=utf-8'},bytes:Buffer.from('File Server: File or Endpoint not found.')};
 if(method==='POST')return failure(405,'Not Allowed');
 const modified=Math.floor(Date.parse(asset.updatedAt)/1000);if(!Number.isSafeInteger(modified))throw Error('Invalid native asset modification time.');
 const etag='"'+modified.toString(16)+'-'+asset.byteLength.toString(16)+'"',last=new Date(modified*1000).toUTCString();
 if(request['if-unmodified-since']!==undefined&&httpTime(request['if-unmodified-since'])<modified||request['if-match']!==undefined&&!matches(request['if-match'],etag,false))return failure(412,'Precondition Failed');
 const validators=request['if-modified-since']!==undefined||request['if-none-match']!==undefined;
 const headers:Record<string,string>={'cache-control':immutable,etag,'last-modified':last};
 if(validators&&(request['if-modified-since']===undefined||httpTime(request['if-modified-since'])===modified)&&(request['if-none-match']===undefined||matches(request['if-none-match'],etag,true)))return {status:304,headers,bytes:empty()};
 // Nginx serves MIME by the generated filename extension, independently of
 // upload fileinfo. PNG bytes with an accepted .webp name are served as WebP.
 const type=storedName.endsWith('.webp')?'image/webp':/\.jpe?g$/.test(storedName)?'image/jpeg':'image/png';
 headers['content-type']=type;
 const ifRange=Array.isArray(request['if-range'])?request['if-range'].join(', '):request['if-range'];
 const range=request.range!==undefined&&(ifRange===undefined||(ifRange.endsWith('"')?ifRange===etag:httpTime(ifRange)===modified))?ranges(request.range,asset.byteLength):'ignore';
 if(range==='unsatisfied')return failure(416,'Requested Range Not Satisfiable',{'cache-control':immutable,'content-range':'bytes */'+asset.byteLength});
 if(range==='ignore')return {status:200,headers:{...headers,'content-length':String(asset.byteLength),'accept-ranges':'bytes'},bytes:method==='HEAD'?empty():Buffer.from(asset.dataBase64,'base64')};
 if(range.length===1){const {start,end}=range[0]!;return {status:206,headers:{...headers,'content-range':`bytes ${start}-${end-1}/${asset.byteLength}`,'content-length':String(end-start)},bytes:method==='HEAD'?empty():Buffer.from(asset.dataBase64,'base64').subarray(start,end)};}
 const boundary=randomBytes(8).readBigUInt64BE().toString().padStart(20,'0');
 const parts=range.map(row=>({header:Buffer.from(`\r\n--${boundary}\r\nContent-Type: ${type}\r\nContent-Range: bytes ${row.start}-${row.end-1}/${asset.byteLength}\r\n\r\n`),...row}));
 const closing=Buffer.from(`\r\n--${boundary}--\r\n`),length=parts.reduce((n,row)=>n+row.header.length+row.end-row.start,closing.length);
 const bytes=method==='HEAD'?empty():Buffer.from(asset.dataBase64,'base64');
 return {status:206,headers:{...headers,'content-type':'multipart/byteranges; boundary='+boundary,'content-length':String(length)},bytes:method==='HEAD'?empty():Buffer.concat([...parts.flatMap(row=>[row.header,bytes.subarray(row.start,row.end)]),closing])};
}
