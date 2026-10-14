import assert from 'node:assert/strict';
import test from 'node:test';
import {spawn} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';

test('the actual API close callback waits until File access registration has been released', async()=>{
  const root=await mkdtemp(join(tmpdir(),'api-file-shutdown-')),file=join(root,'owned.json');
  const api=new URL('../apps/api/dist/apps/api/src/index.js',import.meta.url).href;
  const child=spawn(process.execPath,['--input-type=module','-e',`
    import fs from 'node:fs/promises';
    import {syncBuiltinESMExports} from 'node:module';
    let release;const barrier=new Promise(done=>release=done),remove=fs.rm;
    fs.rm=async function(path,...args){
      if(String(path).includes('/writer.')&&String(path).endsWith('.lease')){
        process.send({phase:'release-entered'});await barrier;
      }
      return remove.call(this,path,...args);
    };syncBuiltinESMExports();
    const {createProductionApiServer}=await import(${JSON.stringify(api)});
    const server=await createProductionApiServer();
    server.listen(0,'127.0.0.1',()=>process.send({phase:'ready'}));
    process.on('message',action=>{
      if(action==='close')server.close(error=>process.send({phase:'closed',error:error?.message}));
      if(action==='release')release();
      if(action==='quit')process.exit(0);
    });
  `],{env:{...process.env,FIRST_SLICE_STORE:'file',FIRST_SLICE_FILE:file,FIRST_SLICE_BOOTSTRAP_DEMO:'false',FIRST_SLICE_OPERATOR_AUTH_REQUIRED:'false',FIRST_SLICE_PROOF_OF_WORK_SCOPES:'',FIRST_SLICE_XML_SCHEMA_PROFILE:'legacy-compatibility'},stdio:['ignore','pipe','pipe','ipc']});
  const messages=[];let output='';child.stdout.on('data',c=>output+=c);child.stderr.on('data',c=>output+=c);child.on('message',m=>messages.push(m));
  const closed=new Promise(resolve=>child.once('close',resolve));
  const wait=async phase=>{const until=Date.now()+10_000;while(Date.now()<until&&!messages.some(m=>m.phase===phase))await delay(10);assert.ok(messages.some(m=>m.phase===phase),phase+' '+output);};
  try{
    await wait('ready');child.send('close');await wait('release-entered');await delay(30);
    assert.equal(messages.some(m=>m.phase==='closed'),false,'Storage ownership must be released before the public server close callback fires.');
    child.send('release');await wait('closed');assert.equal(messages.find(m=>m.phase==='closed').error,undefined);
  }finally{
    if(child.connected){child.send('release');child.send('quit');}
    const timer=setTimeout(()=>{if(child.exitCode===null&&child.signalCode===null)child.kill('SIGTERM');},5000);
    await closed;clearTimeout(timer);await rm(root,{recursive:true,force:true});
  }
});
