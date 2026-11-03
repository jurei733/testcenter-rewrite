import assert from 'node:assert/strict';
import {createReadStream} from 'node:fs';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createInterface} from 'node:readline';
import {resolve,join} from 'node:path';
import {createOriginalReportTextComparator} from '../packages/application/dist/packages/application/src/original-report-collation.js';
assert.ok(process.argv[2],'Supply the fresh capture directory produced by capture-original-report-collation.py.');
const directory=resolve(process.argv[2]),capture=JSON.parse(await readFile(join(directory,'capture.json'),'utf8'));
assert.equal(capture.generateOnly,false);assert.equal(capture.readOnly,true);
assert.equal(capture.databaseProfile,'c|en_US.utf8|en_US.utf8|2.41|2.41');
assert.equal(capture.localeArchiveSha256,'4c3b8c3ae5e03113701a5e760ca2135573679e212e048a578d04c1651cee43c0');
const results=[];
for(const scalar of [true,false]){
 const name=scalar?'scalars.txt':'compounds.hex',seen=scalar?new Uint8Array(0x110000):null;
 const compare=createOriginalReportTextComparator(),hash=createHash('sha256'),failures=[];let previous=null,count=0,failed=0;
 for await(const line of createInterface({input:createReadStream(join(directory,name)),crlfDelay:Infinity})){
  let text;
  if(scalar){const point=Number(line);assert.ok(Number.isInteger(point)&&point>0&&point<=0x10ffff&&(point<0xd800||point>0xdfff));assert.equal(seen[point],0);seen[point]=1;text=String.fromCodePoint(point);}
  else{assert.match(line,/^(?:[a-f0-9]{2})*$/);text=Buffer.from(line,'hex').toString('utf8');}
  hash.update(line+'\n');if(previous!==null&&compare(previous,text)>0){failed++;if(failures.length<20)failures.push({row:count,previous,current:text});}
  previous=text;count++;
 }
 assert.equal(count,scalar?capture.scalarCount:capture.compoundCount);
 const sha256=hash.digest('hex');assert.equal(sha256,capture.orders[name].sha256);
 results.push({name,count,comparisons:count-1,failed,failures,sha256});
}
const sources={};for(const name of ['original-report-collation','original-report-collation-data'])for(const suffix of ['src/'+name+'.ts','dist/packages/application/src/'+name+'.js']){
 const path='packages/application/'+suffix;sources[path]=createHash('sha256').update(await readFile(new URL('../'+path,import.meta.url))).digest('hex');
}
const receipt={capture,results,sources,passed:results.every(result=>result.failed===0)};
await writeFile(join(directory,'qualification.json'),JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify({passed:receipt.passed,results}));
assert.ok(receipt.passed,'The unchanged Original comparison orders must all pass.');
