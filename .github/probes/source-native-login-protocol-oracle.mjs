import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {join} from 'node:path';

const base=process.env.SOURCE_ORACLE_URL;
assert.ok(/^http:\/\/127\.0\.0\.1:\d+$/.test(base??''));
const credentials=new Map(),responses=[];
const receipt={sourceCommit:'eedae41840cbe90e5547c0211da818bdf620f5aa',transport:'unchanged production Apache HTTP',testMode:false,checks:[],sourceFiles:{}};
const register=value=>{
 if(!value||typeof value!=='object')return;
 for(const [key,item]of Object.entries(value)){
  if(/token$/i.test(key)&&typeof item==='string'&&item.length>10&&!credentials.has(item))credentials.set(item,'[redacted-owned-token-'+(credentials.size+1)+']');
  else register(item);
 }
};
const redact=value=>{
 if(typeof value==='string'){for(const [token,alias]of credentials)value=value.replaceAll(token,alias);return value;}
 if(Array.isArray(value))return value.map(redact);
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,redact(item)]));
 return value;
};
const check=(name,details={})=>{receipt.checks.push({name,...details});console.log('source_oracle='+name);};
const request=async(method,path,{token,body,status=200}={})=>{
 const response=await fetch(base+path,{method,headers:{accept:'application/json',...(token?{AuthToken:token}:{}),...(body!==undefined&&!(body instanceof FormData)?{'content-type':'application/json'}:{})},...(body===undefined?{}:{body:body instanceof FormData?body:JSON.stringify(body)}),signal:AbortSignal.timeout(20000)});
 const bytes=Buffer.from(await response.arrayBuffer());let value=null;
 if(bytes.length){try{value=JSON.parse(bytes.toString('utf8'));}catch{value=bytes.toString('utf8');}}
 register(value);responses.push({method,path,status:response.status,wireSha256:createHash('sha256').update(bytes).digest('hex'),value});
 assert.ok((Array.isArray(status)?status:[status]).includes(response.status),method+' '+path+' returned '+response.status);
 return {status:response.status,value};
};
try{
 for(const path of ['scripts/database/full.sql','backend/src/dao/SessionDAO.class.php','backend/src/dao/TestDAO.class.php','backend/src/controller/SessionController.class.php','backend/src/controller/TestController.class.php','backend/src/data-collection/AccessSet.class.php','backend/src/files/XMLFileTesttakers.class.php','backend/src/helper/Token.class.php','backend/src/helper/CacheService.class.php','backend/src/helper/DBSchema.class.php','backend/src/workspace/Workspace.class.php'])receipt.sourceFiles[path]=createHash('sha256').update(await readFile(join('original-reference',path))).digest('hex');
 const deadline=Date.now()+90000;
 while(true){try{receipt.version=(await request('GET','/version')).value;assert.ok(receipt.version.version);break;}catch(error){if(Date.now()>deadline)throw error;await new Promise(done=>setTimeout(done,1000));}}
 check('actual pinned production Apache is ready');
 const admin=(await request('PUT','/session/admin',{body:{name:'super',password:'owned-source-super-secret'}})).value;
 const workspace=Number((await request('PUT','/workspace',{token:admin.token,body:{name:'Owned native login protocol'},status:201})).value);
 await request('PATCH','/user/'+admin.id+'/workspaces',{token:admin.token,body:{ws:[{id:workspace,role:'RW'}]}});
 const root='/workspace/'+workspace;
 check('all fixture data enters through granted admin HTTP, without SQL seeding');
 const xml=(type,repo,version,body)=>`<${type} xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="https://w3id.org/iqb/spec/${repo}/${version}">${body}</${type}>`;
 const upload=async(name,text,type='application/xml')=>{
  const form=new FormData();form.append('fileforvo[]',new Blob([text],{type}),name);
  return request('POST',root+'/file',{token:admin.token,body:form,status:201});
 };
 const player='<!doctype html><html><script type="application/ld+json">'+JSON.stringify({$schema:'https://raw.githubusercontent.com/verona-interfaces/metadata/master/verona-module-metadata.json',id:'owned-oracle-player',version:'6.0.4',specVersion:'6.0',metadataVersion:'2.0',type:'player',name:[{lang:'de',value:'Owned Oracle player'}],description:[{lang:'de',value:'Owned API Oracle module'}]})+'</script><main>Owned native protocol fixture</main></html>';
 await upload('player.html',player,'text/html');
 await upload('unit.xml',xml('Unit','unit-xml','17.6','<Metadata><Id>ORACLE.UNIT</Id><Label>Owned unit</Label></Metadata><Definition player="owned-oracle-player@6.0.4">Owned definition</Definition>'));
 await upload('booklet.xml',xml('Booklet','testcenter-booklet-xml','18.0','<Metadata><Id>ORACLE.BOOK.A</Id><Label>Owned booklet</Label></Metadata><Units><Unit id="ORACLE.UNIT" label="Owned unit"/></Units>'));
 check('actual XSD-validated production Unit and Booklet fixture is uploaded');
 const names=['owned-native-binary-login','OWNED-native-binary-login','owned-native-Ä-login','owned-native-ä-login','owned-native-é-login','owned-native-e\u0301-login'];
 const password=index=>'owned-native-protocol-'+index+'-secret';
 const roster=(selected=names,{mode='run-hot-return',firstPassword=password(0),firstCode='Shared'}={})=>xml('Testtakers','testcenter-testtaker-xml','18.0','<Metadata/><Group id="ORACLE.NATIVE.LOGIN" label="Owned native login Ω">'+selected.map(name=>{const index=names.indexOf(name);return `<Login name="${name}" pw="${index===0?firstPassword:password(index)}" mode="${index===0?mode:'run-hot-return'}"><Booklet codes="${index===0?firstCode:'Shared'}">ORACLE.BOOK.A</Booklet></Login>`;}).join('')+'</Group>');
 const login=async(name,pw)=>(await request('PUT','/session/login',{body:{name,password:pw}})).value;
 const person=async(token,code)=>(await request('PUT','/session/person',{token,body:{code}})).value;
 await upload('native-logins.xml',roster([names[0]]));
 const initialLogin=await login(names[0],password(0));
 assert.deepEqual(initialLogin.flags,['codeRequired']);assert.deepEqual(initialLogin.claims,{});assert.deepEqual(initialLogin.access,{});assert.equal(initialLogin.loginName,names[0]);
 assert.equal(initialLogin.displayName,'Owned native login Ω/'+names[0]);assert.equal(initialLogin.id,null);assert.equal(initialLogin.pwSetByAdmin,null);
 check('coded credential phase returns a Login AccessSet without person or Test claims',{accessSet:initialLogin});
 await request('PUT','/session/login',{body:{name:names[1],password:password(0)},status:400});
 check('an unauthored case alias does not authenticate an existing native login');
 const repeat=await login(names[0],password(0));assert.ok(repeat.token===initialLogin.token,'credential reentry retains Login token');assert.ok(repeat.groupToken===initialLogin.groupToken,'credential reentry retains group token');
 const loginRead=(await request('GET','/session',{token:initialLogin.token})).value;assert.deepEqual(loginRead,initialLogin);
 check('repeated credential login and GET session retain the stable Login AccessSet');
 await request('PUT','/test',{token:initialLogin.token,body:{bookletName:'ORACLE.BOOK.A'},status:403});
 await request('PUT','/session/person',{token:admin.token,body:{code:'Shared'},status:403});
 check('Login and admin tokens cannot substitute for the required person or Login token types');
 await upload('native-logins.xml',roster());
 const people=[],logins=[],tests=[];
 for(let index=0;index<names.length;index++){
  const stage=await login(names[index],password(index));assert.equal(stage.loginName,names[index]);
  assert.ok(!logins.some(other=>other.token===stage.token),'exact native names get separate stable Login tokens');
  logins.push(stage);const entry=await person(stage.token,'sHaReD');
  assert.ok(!people.some(other=>other.token===entry.token),'exact native names get separate person tokens');people.push(entry);
  assert.equal(entry.loginName,names[index]);assert.equal(entry.displayName,'Owned native login Ω/'+names[index]+'/sHaReD');
  const id=Number((await request('PUT','/test',{token:entry.token,body:{bookletName:'ORACLE.BOOK.A'},status:201})).value);
  assert.ok(Number.isSafeInteger(id)&&id>0&&!tests.includes(id),'same code in distinct exact logins never aliases a Test');tests.push(id);
  assert.equal((await request('GET','/test/'+id,{token:entry.token})).value.mode,'run-hot-return');
  await request('PATCH','/test/'+id+'/state',{token:entry.token,body:[{key:'CURRENT_UNIT_ID',content:'ORACLE.UNIT',timeStamp:Date.now()}]});
  check('exact native Login identity is isolated for '+['ASCII lowercase','ASCII uppercase','Unicode uppercase','Unicode lowercase','NFC','NFD'][index],{loginName:names[index],accessSet:entry,testId:id});
 }
 assert.ok(logins[0].token===initialLogin.token,'same exact Login remains stable across roster replacement');
 for(let index=1;index<names.length;index++)await request('GET','/test/'+tests[0],{token:people[index].token,status:403});
 check('all case and composition peers are denied access to another native Login Test');
 const before=(await request('GET','/test/'+tests[0],{token:people[0].token})).value;
 await upload('native-logins.xml',roster(names,{mode:'run-review'}));
 const liveReview=(await request('GET','/session',{token:people[0].token})).value;
 const liveTest=(await request('GET','/test/'+tests[0],{token:people[0].token})).value;
 assert.ok(Object.hasOwn(liveReview.claims,'review'));assert.equal(liveTest.mode,'run-review');assert.deepEqual(liveTest.laststate,before.laststate);
 check('already-open native person observes imported review mode without reauthentication and retains Test state',{accessSet:liveReview,testMode:liveTest.mode,testId:tests[0],laststate:liveTest.laststate});
 await upload('native-logins.xml',roster());
 const liveReturn=(await request('GET','/session',{token:people[0].token})).value;
 assert.ok(!Object.hasOwn(liveReturn.claims,'review'));assert.equal((await request('GET','/test/'+tests[0],{token:people[0].token})).value.mode,'run-hot-return');
 check('already-open native person observes return mode again without rotating its bearer');
 await upload('native-logins.xml',roster(names,{firstPassword:'owned-native-replaced-secret',firstCode:'Replacement'}));
 await request('PUT','/session/login',{body:{name:names[0],password:password(0)},status:400});
 const next=await person(initialLogin.token,'replacement');assert.equal(next.loginName,names[0]);
 await request('PUT','/session/person',{token:initialLogin.token,body:{code:'Shared'},status:400});
 const changedLogin=await login(names[0],'owned-native-replaced-secret');assert.ok(changedLogin.token===initialLogin.token,'password replacement retains native Login token');
 check('existing native Login token uses current code assignments after password replacement without replaying a password',{accessSet:next});
 await request('DELETE','/session',{token:initialLogin.token,status:205});
 assert.ok((await request('GET','/session',{token:initialLogin.token})).value.token===initialLogin.token,'Login logout is a no-op');
 const nextTest=Number((await request('PUT','/test',{token:next.token,body:{bookletName:'ORACLE.BOOK.A'},status:201})).value);await request('GET','/test/'+nextTest,{token:next.token});
 await request('DELETE','/session',{token:next.token,status:205});await request('GET','/session',{token:next.token,status:403});
 const renewed=await person(initialLogin.token,'replacement');assert.ok(renewed.token!==next.token,'person logout/reentry rotates person token');
 assert.equal(Number((await request('PUT','/test',{token:renewed.token,body:{bookletName:'ORACLE.BOOK.A'},status:201})).value),nextTest);
 check('Login logout preserves its phase token while person logout/reentry retains Test and rotates only the person bearer',{testId:nextTest});
 await upload('native-logins.xml',roster(names.slice(1)));
 await request('GET','/session',{token:initialLogin.token,status:410});await request('GET','/session',{token:renewed.token,status:410});
 for(let index=1;index<names.length;index++)assert.equal((await request('GET','/session',{token:people[index].token})).value.loginName,names[index]);
 check('removing one exact native Login disables its two token types with 410 and retains every case or composition peer');
 await upload('native-logins.xml',roster(names,{firstPassword:'owned-native-replaced-secret',firstCode:'Replacement'}));
 assert.ok((await request('GET','/session',{token:initialLogin.token})).value.token===initialLogin.token,'restored exact Login retains stable phase token');
 assert.equal((await request('GET','/session',{token:renewed.token})).value.loginName,names[0]);
 check('restoring the same exact native Login makes its retained Login and active person tokens readable again');
 const rows=Object.values((await request('GET',root+'/responses/detailed',{token:admin.token})).value).flat();
 assert.equal(rows.length,7);for(const name of names)assert.ok(rows.some(row=>row.loginName===name));
 check('native detailed Test rows retain all six exact Login names and the separate replacement-code Test',{testSessions:rows});
 assert.equal(receipt.checks.length,21);receipt.success=true;
}finally{
 const directory=process.env.SOURCE_ORACLE_ARTIFACT_DIR;assert.ok(directory);await mkdir(directory,{recursive:true});
 const files={'receipt.json':redact(receipt),'http-observations.json':redact(responses)};
 for(const [name,value]of Object.entries(files)){
  const text=JSON.stringify(value,null,2)+'\n';for(const token of credentials.keys())assert.ok(!text.includes(token),'public evidence must not contain an owned bearer');
  await writeFile(join(directory,name),text);
 }
}
