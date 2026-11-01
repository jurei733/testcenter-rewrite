// GNU locale archive layout derived from glibc2.41 locale/locarchive.h and
// locale/langinfo.h. LGPL2.1-or-later; see the bundled GNU collation notice.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import {deflateSync} from 'node:zlib';
const [archivePath,outputPath]=process.argv.slice(2);
assert.ok(archivePath&&outputPath,'Supply the qualified Source locale archive and output TypeScript path.');
const archive=await readFile(archivePath),hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const archiveSha256=hash(archive);
assert.equal(archiveSha256,'4c3b8c3ae5e03113701a5e760ca2135573679e212e048a578d04c1651cee43c0','A changed Source locale needs independent requalification.');
const word=offset=>archive.readUInt32LE(offset);
assert.equal(word(0),0xde020109);
let record;
for(let n=0;n<word(16);n++){
 const offset=word(8)+12*n,nameOffset=word(offset+4),recordOffset=word(offset+8);
 if(recordOffset&&archive.toString('utf8',nameOffset,archive.indexOf(0,nameOffset))==='en_US.utf8')record=recordOffset;
}
assert.ok(record);
const begin=word(record+4+8*3),size=word(record+8+8*3),collation=archive.subarray(begin,begin+size);
assert.equal(collation.readUInt32LE(0),0x20051017);assert.equal(collation.readUInt32LE(4),19);
assert.equal(hash(collation),'f062bf818ec7c394208e4b12db855fbe3765ca1463b2e0cfe05e434f1c293981');
const offsets=Array.from({length:19},(_,n)=>collation.readUInt32LE(8+4*n));
const sections=offsets.slice(0,6).map(offset=>collation.subarray(offset,Math.min(...offsets.filter(next=>next>offset),collation.length)));
const packed=Buffer.concat(sections),compressed=deflateSync(packed,{level:9}).toString('base64');
const metadata={locale:'en_US.utf8',provider:'libc',version:'2.41',archiveSha256,collationSha256:hash(collation),dataSha256:hash(packed),bytes:packed.length,sections:sections.map(section=>section.length)};
const chunks=compressed.match(/.{1,100}/g);
const text='// Generated from the independently qualified GNU libc2.41 en_US.utf8 locale.\n'+
 '// LGPL2.1-or-later. See vendor/gnu-collation/NOTICE.txt and COPYING.LIB.\n'+
 '// Reproduce with scripts/generate-original-report-collation.mjs.\n'+
 'export const originalReportCollationData = '+JSON.stringify(metadata,null,2).slice(0,-1)+
 ',\n  deflateBase64: [\n'+chunks.map(chunk=>'    '+JSON.stringify(chunk)).join(',\n')+'\n  ].join(\'\')\n} as const;\n';
await writeFile(outputPath,text);console.log(JSON.stringify({bytes:packed.length,compressedBytes:Buffer.from(compressed,'base64').length,dataSha256:metadata.dataSha256}));
