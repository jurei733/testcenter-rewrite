import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {join} from 'node:path';

const hash=b=>createHash('sha256').update(b).digest('hex');
export async function verifyRuntime(){
 const root=process.env.ORIGINAL_PERMISSIONS_SOURCE_ROOT,backend=process.env.ORIGINAL_PERMISSIONS_CONTAINER;
 const broadcaster=process.env.ORIGINAL_POPULATED_BROADCASTER_CONTAINER;
 assert.ok(root&&backend&&broadcaster);
 const run=(...args)=>execFileSync('docker',args,{encoding:'utf8'}).trim();
 const sourceRuntime=JSON.parse(execFileSync(process.execPath,[new URL('../native-workspace-permissions-http/verify.mjs',import.meta.url).pathname],{encoding:'utf8',env:process.env}));
 const paths=execFileSync('git',['-C',root,'ls-files','broadcaster','common'],{encoding:'utf8'}).trim().split('\n');
 const sourceHashes=Object.fromEntries(await Promise.all(paths.map(async path=>[path,hash(await readFile(join(root,path)))])));
 assert.equal(paths.length,38);
 const actual=JSON.parse(execFileSync('docker',['exec','-i',broadcaster,'node','-e',`const fs=require('fs'),crypto=require('crypto');let input='';process.stdin.on('data',b=>input+=b);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(Object.fromEntries(JSON.parse(input).map(p=>[p,crypto.createHash('sha256').update(fs.readFileSync('/work/'+p)).digest('hex')])))));`],{input:JSON.stringify(paths),encoding:'utf8'}));
 assert.deepEqual(actual,sourceHashes);
 const info=JSON.parse(run('inspect',broadcaster))[0];assert.equal(info.State.Running,true);
 const bundleSha256=run('exec',broadcaster,'node','-e',"process.stdout.write(require('crypto').createHash('sha256').update(require('fs').readFileSync('/work/broadcaster/dist/main.js')).digest('hex'))");
 assert.equal(bundleSha256,'daa495c5d0a510a6eb29e75cb7149834365028829b9b5a8b4b636550a74ac05b');
 const broadcasting=JSON.parse(run('exec',backend,'php','-r','define("ROOT_DIR","/var/www/testcenter");require ROOT_DIR."/backend/vendor/autoload.php";SystemConfig::readEnvironment();echo json_encode(["url"=>SystemConfig::$broadcaster_url,"status"=>BroadcastService::getStatus()],JSON_THROW_ON_ERROR);'));
 assert.deepEqual(broadcasting,{url:'http://broadcaster:3000',status:'on'});
 return{sourceRuntime,broadcaster:{sourceHashes,sourceFiles:paths.length,image:info.Image,node:run('exec',broadcaster,'node','--version'),bundleSha256,broadcasting,originalUnmodified:true}};
}
