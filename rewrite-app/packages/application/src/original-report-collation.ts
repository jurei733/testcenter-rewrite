/* Adapted from GNU libc2.41 locale/weight.h and string/strcoll_l.c.
 * Copyright (C) 1995-2025 Free Software Foundation, Inc.
 * TypeScript adaptation Copyright (C) 2026 Testcenter Rewrite contributors.
 * GNU LGPL2.1-or-later; see vendor/gnu-collation/NOTICE.txt and COPYING.LIB.
 *
 * Use the multibyte UTF-8 comparison and actual Source locale data. Host ICU,
 * binary ordering and a transformed-key approximation disagree with Source.
 */
import {createHash} from 'node:crypto';
import {inflateSync} from 'node:zlib';
import {originalReportCollationData as profile} from './original-report-collation-data.js';

type Tables={nrules:number;rules:Buffer;table:Buffer;weights:Buffer;extra:Buffer;indirect:Buffer};
type Scan={index:number;next:number};
type Prepared={bytes:Buffer;at:Map<number,Scan>};
type Sequence={text:Prepared;len:number;val:number;idxmax:number;idxcnt:number;backw:number;backwStop:number;
 us:number;backUs:number;idx:number;saveIdx:number;rule:number};
let loaded:Tables|undefined;
function tables():Tables{
 if(loaded)return loaded;
 const data=inflateSync(Buffer.from(profile.deflateBase64,'base64'),{maxOutputLength:profile.bytes});
 if(data.length!==profile.bytes||createHash('sha256').update(data).digest('hex')!==profile.dataSha256)throw Error('The Original report locale data is not qualified.');
 let offset=0;const sections=profile.sections.map(length=>{const part=data.subarray(offset,offset+length);offset+=length;return part;});
 if(offset!==data.length||sections[2].length!==1024)throw Error('Invalid Original report locale tables.');
 loaded={nrules:sections[0].readUInt32LE(0),rules:sections[1],table:sections[2],weights:sections[3],extra:sections[4],indirect:sections[5]};
 return loaded;
}

/** glibc findidx: UTF-8 sequences, contractions and indirect ranges. */
function findIndex(bytes:Buffer,start:number,data:Tables):Scan{
 let next=start+1,index=data.table.readInt32LE(bytes[start]*4);
 if(index>=0)return {index,next};
 const extra=data.extra;let offset=-index;
 for(;;){
  index=extra.readInt32LE(offset);offset+=4;const length=extra[offset++];
  if(index>=0){
   let count=0;while(count<length&&extra[offset+count]===bytes[next+count])count++;
   if(count===length)return {index,next:next+length};
   offset=(offset+length+3)&~3;
  }else{
   let lower=0,upper=0;
   for(let n=0;n<length;n++){
    if(next+n>=bytes.length){lower=1;break;}
    if(extra[offset+n]!==bytes[next+n]){lower=extra[offset+n]-bytes[next+n];break;}
   }
   for(let n=0;n<length;n++){
    if(next+n>=bytes.length){upper=1;break;}
    if(extra[offset+length+n]!==bytes[next+n]){upper=extra[offset+length+n]-bytes[next+n];break;}
   }
   if(lower<=0&&upper>=0){
    let delta=0;for(let n=0;n<length;n++)delta=delta*256+bytes[next+n]-extra[offset+n];
    return {index:data.indirect.readInt32LE((-index+delta)*4),next:next+length};
   }
   offset=(offset+2*length+3)&~3;
  }
 }
}
function prepare(text:string,data:Tables):Prepared{
 for(const c of text){const cp=c.codePointAt(0)!;if(cp===0||cp>=0xd800&&cp<=0xdfff)throw TypeError('The native report requires valid Unicode without NUL.');}
 const bytes=Buffer.from(text),at=new Map<number,Scan>();
 for(let offset=0;offset<bytes.length;){const item=findIndex(bytes,offset,data);at.set(offset,item);offset=item.next;}
 return {bytes,at};
}

/** Direct get_next_seq adaptation. Retain backward and ignored-element state
 * across passes; flattening these into sort keys changes compound comparisons. */
function nextSequence(seq:Sequence,pass:number,data:Tables):void{
 let val=0,len=seq.len,stop=seq.backwStop,back=seq.backw,count=seq.idxcnt,max=seq.idxmax,idx=seq.idx,us=seq.us;
 const scan=(position:number):Scan=>{const item=seq.text.at.get(position);if(!item)throw Error('Invalid Original collation cursor.');return item;};
 while(len===0){
  val++;
  if(stop!==-1){
   if(back===stop){if(count<max){idx=seq.saveIdx;stop=-1;}else{idx=0;break;}}
   else{
    let n=stop;us=seq.backUs;
    while(n<back){const item=scan(us);us=item.next;idx=item.index&0xffffff;n++;}
    back--;us=seq.us;
   }
  }else{
   stop=max;let previous=idx;
   while(us<seq.text.bytes.length){
    const item=scan(us);us=item.next;const rule=item.index>>>24;previous=idx;idx=item.index&0xffffff;count=max++;
    if(count===0)seq.rule=rule;
    if((data.rules[rule*data.nrules+pass]&2)===0)break;
    count++;
   }
   if(stop>=count){if(count===max||stop>count)break;stop=-1;}
   else{
    seq.backUs=seq.us;seq.us=us;back=count;
    if(max>count){back--;seq.saveIdx=idx;idx=previous;}
    if(back>stop)back--;
   }
  }
  len=data.weights[idx++];for(let n=0;n<pass;n++){idx+=len;len=data.weights[idx++];}
 }
 seq.val=val;seq.len=len;seq.backwStop=stop;seq.backw=back;seq.idxcnt=count;seq.idxmax=max;seq.us=us;seq.idx=idx;
}
function compareSequences(a:Sequence,b:Sequence,position:number,weights:Buffer):number{
 if(position&&a.val!==b.val)return a.val>b.val?1:-1;
 do{
  if(weights[a.idx]!==weights[b.idx])return weights[a.idx]-weights[b.idx];
  a.idx++;b.idx++;a.len--;b.len--;
 }while(a.len>0&&b.len>0);
 return position&&a.len!==b.len?a.len-b.len:0;
}
function sequence(text:Prepared):Sequence{return {text,len:0,val:0,idxmax:0,idxcnt:0,backw:-1,backwStop:-1,us:0,backUs:0,idx:0,saveIdx:0,rule:0};}
function compare(a:Prepared,b:Prepared,data:Tables):number{
 if(!a.bytes.length||!b.bytes.length)return Number(!!a.bytes.length)-Number(!!b.bytes.length);
 const left=sequence(a),right=sequence(b);let rule=0;
 for(let pass=0;pass<data.nrules;pass++){
  for(const seq of [left,right]){seq.idxcnt=0;seq.idx=0;seq.backwStop=-1;seq.backw=-1;seq.us=0;}
  const position=data.rules[rule*data.nrules+pass]&4;
  for(;;){
   nextSequence(left,pass,data);nextSequence(right,pass,data);
   if(left.len===0||right.len===0){if(left.len===right.len)break;return left.len===0?-1:1;}
   const result=compareSequences(left,right,position,data.weights);if(result)return result;
  }
  rule=left.rule;
 }
 // PostgreSQL18 varstr_cmp breaks deterministic libc ties using UTF-8 bytes.
 return Buffer.compare(a.bytes,b.bytes);
}

/** One bounded cache belongs to one report; no participant identifiers are
 * retained in a process-global cache or depend on host locale availability. */
export function createOriginalReportTextComparator():(left:string,right:string)=>number{
 const data=tables(),cache=new Map<string,Prepared>();
 const get=(text:string):Prepared=>{let value=cache.get(text);if(!value){value=prepare(text,data);if(cache.size>=10_000)cache.clear();cache.set(text,value);}return value;};
 return (left,right)=>left===right?0:compare(get(left),get(right),data);
}
