import assert from 'node:assert/strict';
import test from 'node:test';
import {spawn} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

test('failed API bootstrap releases File writer ownership so the same process can retry',async()=>{
  const root=await mkdtemp(join(tmpdir(),'api-file-startup-failure-')),file=join(root,'owned.json');
  const api=new URL('../apps/api/dist/apps/api/src/index.js',import.meta.url).href;
  const child=spawn(process.execPath,['--input-type=module','-e',`
    import assert from 'node:assert/strict';import fs from 'node:fs/promises';import{syncBuiltinESMExports}from'node:module';
    const write=fs.writeFile;let fail=true;
    fs.writeFile=async function(path,...args){if(fail&&String(path).includes('/.pending.'))throw Object.assign(Error('Owned injected bootstrap I/O failure'),{code:'EIO'});return write.call(this,path,...args);};syncBuiltinESMExports();
    const{createProductionApiServer}=await import(${JSON.stringify(api)});
    await assert.rejects(createProductionApiServer(),{code:'EIO'});
    assert.deepEqual(await fs.readdir(${JSON.stringify(file+'.actors')}),[],'Failed runtime construction must release File writer ownership.');
    fail=false;const server=await createProductionApiServer();
    await new Promise(done=>server.listen(0,'127.0.0.1',done));
    await new Promise((done,reject)=>server.close(error=>error?reject(error):done()));
    assert.deepEqual(await fs.readdir(${JSON.stringify(file+'.actors')}),[]);
  `],{env:{...process.env,FIRST_SLICE_STORE:'file',FIRST_SLICE_FILE:file,FIRST_SLICE_BOOTSTRAP_DEMO:'true',FIRST_SLICE_OPERATOR_AUTH_REQUIRED:'false',FIRST_SLICE_PROOF_OF_WORK_SCOPES:'',FIRST_SLICE_XML_SCHEMA_PROFILE:'legacy-compatibility'},stdio:['ignore','pipe','pipe']});
  let output='';child.stdout.on('data',c=>output+=c);child.stderr.on('data',c=>output+=c);
  const timer=setTimeout(()=>{if(child.exitCode===null&&child.signalCode===null)child.kill('SIGTERM');},20_000);
  try{const code=await new Promise(resolve=>child.once('close',resolve));assert.equal(code,0,output);}
  finally{clearTimeout(timer);await rm(root,{recursive:true,force:true});}
});
