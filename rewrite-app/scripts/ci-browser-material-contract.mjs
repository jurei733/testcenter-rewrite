import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
// Diagnostic comparison never grants admission; the separate runtime schema
// is consumed only together with authenticated package/context verification.
export const materialProfileSource={commit:'eedae41840cbe90e5547c0211da818bdf620f5aa',
 playerSha256:'bece3e969e4267a5690620b4a9b056c5245c02697628b1306dca630423a7b2d3',
 definitionSha256:'532310b1f4bf1eab6eaaa1603962a39566919b5669974f7b1a7dc2de4316d202',
 resourceZipSha256:'da2ae859b77f8a6ba09b3f61cab38ea0c5d6de5f08b9fcefef9d263aef187f4e'};
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const hashPattern=/^[a-f0-9]{64}$/;
export function canonicalMaterial(value){
 const encode=value=>{
  if(value===null||typeof value==='boolean')return value;
  if(typeof value==='number'){assert.ok(Number.isFinite(value));return value;}
  if(typeof value==='string'){assert.ok(value.length<=1024*1024);return value;}
  if(Array.isArray(value)){assert.ok(value.length<=8192);return value.map(encode);}
  assert.ok(value&&Object.getPrototypeOf(value)===Object.prototype,'Profile values must be plain JSON.');
  assert.ok(!Object.hasOwn(value,'__proto__'));
  return Object.fromEntries(Object.keys(value).sort().map(key=>[key,encode(value[key])]));
 };
 const result=JSON.stringify(encode(value));assert.ok(Buffer.byteLength(result)<=4*1024*1024);return result;
}
export function validateDiagnosticProfile(profile){
 assert.equal(profile?.version,1);assert.equal(profile.qualification,'diagnostic-only');
 const context=profile.context;
 assert.match(context?.commit??'',/^[a-f0-9]{40}$/);
 for(const key of ['runId','runAttempt'])assert.match(context[key]??'',/^[1-9][0-9]*$/);
 assert.match(context.imageVersion??'',/^[A-Za-z0-9._-]{1,80}$/);assert.equal(context.imageOS,'ubuntu24');
 assert.match(context.lockSha256??'',hashPattern);
 assert.deepEqual(profile.material?.source,materialProfileSource);
 assert.match(profile.material.scriptSha256??'',hashPattern);
 assert.ok(Array.isArray(profile.material.files)&&profile.material.files.length>0);
 const names=[];
 for(const file of profile.material.files){assert.ok(typeof file.name==='string'&&file.name.length>0);assert.match(file.sha256??'',hashPattern);assert.ok(Number.isSafeInteger(file.bytes)&&file.bytes>0);names.push(file.name);}
 assert.deepEqual(names,[...new Set(names)].sort(),'Material files must be unique and sorted.');
 const views=profile.material.views;
 assert.deepEqual(views?.map(view=>view.name),['desktop-empty','desktop-input','mobile-empty','mobile-input']);
 for(const view of views){assert.match(view.pixelSha256??'',hashPattern);assert.ok(view.width>0&&view.height>0);}
 assert.equal(profile.materialSha256,digest(canonicalMaterial(profile.material)),'Material profile digest mismatch.');
 return profile;
}
export function compareDiagnosticProfiles(left,right){
 validateDiagnosticProfile(left);validateDiagnosticProfile(right);
 const {imageVersion:leftImage,...leftContext}=left.context,{imageVersion:rightImage,...rightContext}=right.context;
 assert.equal(canonicalMaterial(leftContext),canonicalMaterial(rightContext),'Diagnostic profiles must share the exact workflow, lock and platform.');
 return {qualification:'diagnostic-only',productionAdmission:false,leftImage,rightImage,
  sameImageVersion:leftImage===rightImage,materialEqual:left.materialSha256===right.materialSha256,
  leftMaterialSha256:left.materialSha256,rightMaterialSha256:right.materialSha256};
}

const exactKeys=(value,keys,label)=>{
 assert.ok(value&&Object.getPrototypeOf(value)===Object.prototype,label+' must be a plain record.');
 assert.deepEqual(Object.keys(value).sort(),[...keys].sort(),'Unexpected '+label+' fields.');
};
/** Strict production measurement schema, deliberately separate from diagnostics. */
export function validateRuntimeMaterial(profile){
 exactKeys(profile,['version','qualification','context','material','materialSha256'],'runtime measurement');
 assert.equal(profile.version,1);assert.equal(profile.qualification,'runtime-measurement');
 const context=profile.context;
 exactKeys(context,['commit','runId','runAttempt','imageOS','imageVersion','osSha256','platform','arch','nodeMajor','lockSha256','nativeDepsSha256','playwrightVersion','requested'],'runtime context');
 assert.match(context.commit,/^[a-f0-9]{40}$/);
 for(const key of ['runId','runAttempt'])assert.ok(/^[1-9][0-9]*$/.test(context[key])&&Number.isSafeInteger(Number(context[key])));
 assert.equal(context.imageOS,'ubuntu24');assert.equal(context.platform,'linux');assert.equal(context.arch,'x64');assert.equal(context.nodeMajor,'22');
 assert.match(context.imageVersion,/^[A-Za-z0-9._-]{1,80}$/);
 for(const key of ['osSha256','lockSha256','nativeDepsSha256'])assert.match(context[key],hashPattern);
 assert.match(context.playwrightVersion,/^\d+\.\d+\.\d+$/);
 assert.ok(Array.isArray(context.requested)&&context.requested.length>0&&context.requested.length<=128);
 assert.deepEqual(context.requested,[...new Set(context.requested)].sort());
 assert.ok(context.requested.every(name=>/^[a-z0-9][a-z0-9+.-]*$/.test(name)));
 const material=profile.material;
 exactKeys(material,['source','scriptSha256','nodeVersion','browserVersion','packageInventorySha256','fontCatalogSha256','screen','files','views'],'runtime material');
 assert.deepEqual(material.source,materialProfileSource);
 for(const key of ['scriptSha256','packageInventorySha256','fontCatalogSha256'])assert.match(material[key],hashPattern);
 assert.match(material.nodeVersion,/^v22\.\d+\.\d+$/);assert.match(material.browserVersion,/^\d+\.\d+\.\d+\.\d+$/);
 exactKeys(material.screen,['width','height','colorDepth','pixelDepth'],'runtime screen');
 for(const key of ['width','height'])assert.ok(Number.isSafeInteger(material.screen[key])&&material.screen[key]>0&&material.screen[key]<=8192);
 for(const key of ['colorDepth','pixelDepth'])assert.ok([24,32].includes(material.screen[key]));
 assert.ok(Array.isArray(material.files)&&material.files.length>0&&material.files.length<=8192);
 const names=[];
 for(const entry of material.files){
  exactKeys(entry,['name','bytes','mode','sha256'],'runtime file');
  assert.ok(typeof entry.name==='string'&&entry.name.length<=4096&&!/[\x00-\x1f\x7f]/.test(entry.name));
  assert.ok(entry.name.startsWith('chromium/')||entry.name.startsWith('native:/'));
  assert.ok(!entry.name.split('/').some(part=>part==='.'||part==='..'));
  assert.match(entry.sha256,hashPattern);assert.ok(Number.isSafeInteger(entry.bytes)&&entry.bytes>0&&entry.bytes<=512*1024*1024);
  assert.ok(Number.isSafeInteger(entry.mode)&&entry.mode>=0&&entry.mode<=0o7777);names.push(entry.name);
 }
 assert.deepEqual(names,[...new Set(names)].sort());
 for(const name of ['chromium/chrome','native:/etc/fonts/fonts.conf','native:/usr/bin/Xvfb','native:/usr/bin/fc-list','native:/usr/bin/fc-match'])assert.ok(names.includes(name),'Missing required material file '+name);
 assert.ok(names.some(name=>/^native:\/.*\/bin\/node$/.test(name)),'Missing actual Node binary.');
 assert.ok(names.some(name=>name.startsWith('native:')&&/\.(?:ttf|otf|ttc)$/i.test(name)),'Missing actual font files.');
 assert.ok(names.some(name=>name.startsWith('native:')&&/\.so(?:\.|$)/.test(name)),'Missing mapped browser libraries.');
 assert.ok(Array.isArray(material.views));assert.deepEqual(material.views.map(view=>view.name),['desktop-empty','desktop-input','mobile-empty','mobile-input']);
 for(const [index,view]of material.views.entries()){
  exactKeys(view,['name','width','height','pixelSha256'],'runtime Source view');
  assert.equal(view.width,index<2?1366:390);assert.equal(view.height,index<2?900:844);assert.match(view.pixelSha256,hashPattern);
 }
 assert.notEqual(material.views[0].pixelSha256,material.views[1].pixelSha256);assert.notEqual(material.views[2].pixelSha256,material.views[3].pixelSha256);
 assert.equal(profile.materialSha256,digest(canonicalMaterial(material)),'Runtime material digest mismatch.');
 return profile;
}
