import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {join} from 'node:path';
const source=process.env.ORIGINAL_TEST_ADMIN_SOURCE_ROOT;
const out=process.env.ORIGINAL_TEST_ADMIN_OUTPUT_DIR;
assert.ok(source&&out);mkdirSync(out,{recursive:true});
const image='sha256:d7045f22e834e2907ed39b5f8c99eed3d81f37643c50c3f66746e3f654381328';
const files=['backend/src/helper/Version.class.php','backend/src/helper/FileID.class.php'];
assert.equal(execFileSync('git',['--no-optional-locks','-C',source,'rev-parse','HEAD'],{encoding:'utf8'}).trim(),'eedae41840cbe90e5547c0211da818bdf620f5aa');
assert.equal(execFileSync('git',['--no-optional-locks','-C',source,'status','--porcelain'],{encoding:'utf8'}).trim(),'');
const sourceHashes=Object.fromEntries(files.map(p=>[p,createHash('sha256').update(readFileSync(join(source,p))).digest('hex')]));
const references=['owned-player@1.2.9','source-r85-player@1.0.0','source-r85-player.html','unversioned','Resource/owned-player@1.0.0','v2-player@6.1.0','ä-player@1.0.0','module-1e3.2.0','moduleV2.3.html','name-9007199254740993.0.html','0',''];
const versions=['0.0.0-0','1.2.3-0','0.0.0-preview','01.002.0003-beta-more','1e3.2.0','1e999.0.0','9007199254740993.0.0','9223372036854775808.0.0','1e19.0.0','1e20.0.0','1e308.0.0','9e18.0.0','1e309.0.0','123foo.0.0','9223372036854775808foo.0.0'];
const php=`require '/var/www/testcenter/backend/src/helper/Version.class.php';require '/var/www/testcenter/backend/src/helper/FileID.class.php';
$input=json_decode(stream_get_contents(STDIN),true,512,JSON_THROW_ON_ERROR);$hashes=[];foreach($input['files'] as $f){$hashes[$f]=hash_file('sha256','/var/www/testcenter/'.$f);}
$out=['sourceHashes'=>$hashes,'references'=>[],'versions'=>[]];foreach($input['references'] as $r){$g=Version::guessFromFileName($r);foreach(['major','minor','patch'] as $k){$g[$k]=(string)$g[$k];}$out['references'][]=['input'=>$r,'guess'=>$g,'id'=>FileID::normalize($r)];}
foreach($input['versions'] as $v){$parts=Version::split($v);$text=Version::asString($parts['major'],$parts['minor'],$parts['patch'],$parts['label']);foreach(['major','minor','patch'] as $k){$parts[$k]=(string)$parts[$k];}$out['versions'][]=['input'=>$v,'parts'=>$parts,'text'=>$text];}echo json_encode($out,JSON_THROW_ON_ERROR|JSON_UNESCAPED_UNICODE);`;
const raw=execFileSync('docker',['--context','colima-testcenter','run','--rm','-i','--network','none','--read-only','--entrypoint','php',image,'-r',php],{encoding:'utf8',input:JSON.stringify({files,references,versions})});
const observed=JSON.parse(raw);assert.deepEqual(observed.sourceHashes,sourceHashes);
writeFileSync(join(out,'observations.json'),JSON.stringify({sourceCommit:'eedae41840cbe90e5547c0211da818bdf620f5aa',runtimeImage:image,readOnlyContainer:true,network:'none',sourceFilesMatched:true,...observed},null,2)+'\n');
console.log(JSON.stringify({references:references.length,versions:versions.length,sourceFilesMatched:true}));
