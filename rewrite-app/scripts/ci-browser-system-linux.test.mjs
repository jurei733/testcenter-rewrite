import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {mkdtemp,mkdir,readFile,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';
import {verifyArtifact} from './ci-browser-system.mjs';

assert.equal(process.platform,'linux','Run native Debian archive qualification in its Linux workflow job.');
const digest=body=>createHash('sha256').update(body).digest('hex');
async function ownedArtifact(action){
  const root=await mkdtemp(join(tmpdir(),'owned-native-deb-')),directory=join(root,'artifact'),source=join(root,'package');
  try{
    await mkdir(directory);await mkdir(join(source,'DEBIAN'),{recursive:true});
    await writeFile(join(source,'DEBIAN','control'),'Package: owned-browser-fixture\nVersion: 2:1.9+dfsg-1\nArchitecture: all\nMaintainer: Owned Fixture <fixture@example.invalid>\nDescription: Owned read-only archive inspection fixture\n');
    const archive=join(root,'fixture.deb');
    execFileSync('/usr/bin/dpkg-deb',['--build',source,archive],{stdio:'pipe'});
    const body=await readFile(archive),sha256=digest(body),entry={name:'owned-browser-fixture',version:'2:1.9+dfsg-1',arch:'all',
      file:sha256+'.deb',cacheFileName:'owned-browser-fixture_2%3a1.9+dfsg-1_all.deb',sha256,bytes:body.length};
    const context={requested:['owned-browser-fixture']},before='base\t1.0\tamd64\tii \n';
    const manifest={version:2,context,beforeInventory:before,afterInventory:before+'owned-browser-fixture\t2:1.9+dfsg-1\tall\tii \n',
      fontInventorySha256:'a'.repeat(64),packages:[entry]};
    const save=async()=>writeFile(join(directory,'manifest.json'),JSON.stringify(manifest));
    await writeFile(join(directory,entry.file),body);await save();
    await action({root,directory,entry,context,before,manifest,save});
  }finally{await rm(root,{recursive:true,force:true});}
}
test('the real dpkg-deb reader accepts a freshly built Debian archive without installing it',async()=>{
  await ownedArtifact(async f=>{
    const result=await verifyArtifact(f.directory,f.context,f.before);
    assert.deepEqual(result.paths,[join(f.directory,f.entry.file)]);assert.equal(result.bytes,f.entry.bytes);
  });
});
test('a valid artifact hash cannot turn arbitrary bytes into an installable Debian package',async()=>{
  await ownedArtifact(async f=>{
    await rm(join(f.directory,f.entry.file));
    const body=Buffer.from('Owned bytes which are not a Debian archive'),sha256=digest(body);
    Object.assign(f.entry,{file:sha256+'.deb',sha256,bytes:body.length});
    await writeFile(join(f.directory,f.entry.file),body);await f.save();
    await assert.rejects(verifyArtifact(f.directory,f.context,f.before),error=>/dpkg-deb failed/.test(error.message)&&error.exitCode>0);
  });
});
test('the native package identity must agree with both the manifest and the expected APT inventory',async()=>{
  await ownedArtifact(async f=>{
    f.entry.version='9.9';f.manifest.afterInventory=f.manifest.afterInventory.replace('2:1.9+dfsg-1','9.9');await f.save();
    await assert.rejects(verifyArtifact(f.directory,f.context,f.before),/metadata mismatch/);
  });
});
