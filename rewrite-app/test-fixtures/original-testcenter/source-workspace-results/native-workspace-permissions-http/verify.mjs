import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';

// Read-only independent revalidation of the frozen capture, its actual Source
// checkout and running owned production container. This does not seed, mutate
// or replay any HTTP request against an already-used Source database.
const root=process.env.ORIGINAL_PERMISSIONS_SOURCE_ROOT;
const backend=process.env.ORIGINAL_PERMISSIONS_CONTAINER;
const postgres=process.env.ORIGINAL_PERMISSIONS_POSTGRES_CONTAINER;
assert.ok(root&&backend&&postgres,'Provide the owned Source root and backend/PostgreSQL container names.');
const directory=new URL('./',import.meta.url),hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const manifest=JSON.parse(await readFile(new URL('manifest.json',directory)));
for(const [name,digest]of Object.entries(manifest.files))assert.equal(hash(await readFile(new URL(name,directory))),digest,name);
const bytes=await readFile(new URL('observations.json',directory)),source=JSON.parse(bytes);
const proof=JSON.parse(await readFile(new URL('independent-verification.json',directory)));
assert.equal(hash(bytes),proof.observationSha256);
const git=(...args)=>execFileSync('git',['-C',root,...args],{encoding:'utf8'}).trim();
assert.equal(git('rev-parse','HEAD'),source.sourceCommit);assert.equal(git('status','--porcelain','--untracked-files=no'),'');
for(const [name,digest]of Object.entries(source.sourceHashes))assert.equal(hash(await readFile(join(root,name))),digest,name);
const container=JSON.parse(execFileSync('docker',['inspect',backend],{encoding:'utf8'}))[0];
assert.equal(container.State.Running,true);assert.equal(container.Image,source.backendImage);assert.equal(container.Image,proof.exactImage);
const php=code=>execFileSync('docker',['exec','-i',backend,'php','-r',code],{encoding:'utf8',input:JSON.stringify(Object.keys(source.sourceHashes))});
const hashes=JSON.parse(php('$out=[];foreach(json_decode(stream_get_contents(STDIN),true,512,JSON_THROW_ON_ERROR) as $p){$out[$p]=hash_file("sha256","/var/www/testcenter/".$p);}echo json_encode($out,JSON_THROW_ON_ERROR);'));
assert.deepEqual(hashes,source.sourceHashes);
const lockBytes=await readFile(join(root,'backend/composer.lock')),lock=JSON.parse(lockBytes);
assert.equal(hash(lockBytes),source.vendor.sourceComposerLockSha256);
const installedBytes=php('echo file_get_contents("/var/www/testcenter/backend/vendor/composer/installed.json");');
assert.equal(hash(installedBytes),source.vendor.installedMetadataSha256);
const installed=JSON.parse(installedBytes).packages;
assert.equal(installed.length,19);assert.equal(lock.packages.length,19);
for(const item of installed){const expected=[...lock.packages,...lock['packages-dev']].find(p=>p.name===item.name);assert.ok(expected);assert.equal(item.version,expected.version);assert.equal(item.source?.reference,expected.source?.reference);}
for(const item of lock.packages)assert.ok(installed.some(p=>p.name===item.name));
const actual=JSON.parse(php('define("ROOT_DIR","/var/www/testcenter");require ROOT_DIR."/backend/vendor/autoload.php";SystemConfig::readEnvironment();SystemConfig::applyVersionFromPackageJson();echo json_encode(["php"=>PHP_VERSION,"configuration"=>["version"=>SystemConfig::$system_version,"xmlSchemaValidation"=>SystemConfig::$xmlSchema_validation,"allowTestMode"=>SystemConfig::$debug_allowTestMode,"staticTime"=>SystemConfig::$debug_useStaticTime,"staticTokens"=>SystemConfig::$debug_useStaticTokens,"insecurePasswords"=>SystemConfig::$debug_useInsecurePasswords,"protection"=>SystemConfig::$bruteForceProtection_sessions]],JSON_THROW_ON_ERROR);'));
assert.equal(actual.php,proof.runtime.php);assert.deepEqual(actual.configuration,proof.configuration);
const version=execFileSync('docker',['exec',postgres,'psql','-U','source_oracle','-d','source_oracle','-Atc','SELECT version()'],{encoding:'utf8'}).trim();
assert.equal(version,proof.runtime.postgres);
assert.equal(source.rows.length,112);assert.equal(new Set(source.rows.map(r=>r.label)).size,112);
for(const row of source.rows)assert.equal(hash(row.rawText),row.redactedBodySha256,row.label);
console.log(JSON.stringify({verified:true,sourceCommit:source.sourceCommit,sourceFiles:Object.keys(hashes).length,composerPackages:installed.length,actualHttpExchanges:source.rows.length,observationSha256:hash(bytes),backendImage:container.Image,php:actual.php,configuration:actual.configuration,readOnlyVerification:true}));
