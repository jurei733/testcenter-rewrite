import {execFileSync} from 'node:child_process';
import {crc32} from 'node:zlib';
import {writeFile,readFile} from 'node:fs/promises';
const field=(id,body)=>{const b=Buffer.alloc(4);b.writeUInt16LE(id);b.writeUInt16LE(body.length,2);return Buffer.concat([b,body]);};
const ut=Buffer.alloc(5);ut[0]=1;ut.writeUInt32LE(981179045,1);
const ntfs=Buffer.alloc(32);ntfs.writeUInt16LE(1,4);ntfs.writeUInt16LE(24,6);for(const offset of [8,16,24])ntfs.writeBigUInt64LE((1015234567n+11644473600n)*10000000n,offset);
const make=(localExtra,centralExtra,zero=false)=>{const name=Buffer.from('entry.txt'),data=Buffer.from('metadata'),a=Buffer.alloc(30),b=Buffer.alloc(46),end=Buffer.alloc(22),time=zero?0:(3<<11)|(4<<5)|3,date=zero?0:(40<<9)|(1<<5)|2;
 a.writeUInt32LE(0x04034b50);a.writeUInt16LE(20,4);a.writeUInt16LE(time,10);a.writeUInt16LE(date,12);a.writeUInt32LE(crc32(data),14);a.writeUInt32LE(data.length,18);a.writeUInt32LE(data.length,22);a.writeUInt16LE(name.length,26);a.writeUInt16LE(localExtra.length,28);
 b.writeUInt32LE(0x02014b50);b.writeUInt16LE(20,4);b.writeUInt16LE(20,6);b.writeUInt16LE(time,12);b.writeUInt16LE(date,14);b.writeUInt32LE(crc32(data),16);b.writeUInt32LE(data.length,20);b.writeUInt32LE(data.length,24);b.writeUInt16LE(name.length,28);b.writeUInt16LE(centralExtra.length,30);
 const local=Buffer.concat([a,name,localExtra,data]),central=Buffer.concat([b,name,centralExtra]);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(1,8);end.writeUInt16LE(1,10);end.writeUInt32LE(central.length,12);end.writeUInt32LE(local.length,16);return Buffer.concat([local,central,end]);};
const u=field(0x5455,ut),n=field(0x000a,ntfs),empty=Buffer.alloc(0),rows=[];
for(const [label,l,c,zero]of [['dos',empty,empty,false],['dos-zero',empty,empty,true],['ut-both',u,u],['ut-local',u,empty],['ut-central',empty,u],['ntfs',n,n],['both-ut-first',Buffer.concat([u,n]),Buffer.concat([u,n])],['both-ntfs-first',Buffer.concat([n,u]),Buffer.concat([n,u])]]){
 const bytes=make(l,c,zero),php='$p=tempnam(sys_get_temp_dir(),"r85");file_put_contents($p,base64_decode(stream_get_contents(STDIN)));$z=new ZipArchive;$r=$z->open($p);if($r!==true)throw new Exception("open:".$r);$s=$z->statIndex(0);echo json_encode(["mtime"=>$s["mtime"],"libzip"=>ZipArchive::LIBZIP_VERSION]);$z->close();unlink($p);';
 const result=JSON.parse(execFileSync('docker',['--context','colima-testcenter','exec','-i','source-native-zip-r85-backend-1','php','-r',php],{input:bytes.toString('base64'),encoding:'utf8'}));rows.push({label,zipBase64:bytes.toString('base64'),...result});
}
await writeFile('/Users/julian/Documents/Codex/2026-10-28/lies-users-julian-documents-codex-2026/work/round85-source-zip-timestamps.json',JSON.stringify({source:'Actual pinned Source PHP ZipArchive statIndex in the owned verified backend image',rows},null,2)+'\n');console.log(JSON.stringify(rows.map(({label,mtime,libzip})=>({label,mtime,libzip}))));
