import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
const base=process.env.SOURCE_ORACLE_URL;
assert.ok(/^http:\/\/127\.0\.0\.1:\d+$/.test(base??''));
const nativeGroupHistory=[],nativeTestSessionHistory=[];
const receipt={sourceCommit:'eedae41840cbe90e5547c0211da818bdf620f5aa',testMode:false,transport:'production Apache HTTP',checks:[]};
const check=(name,details={})=>{receipt.checks.push({name,...details});console.log('source_oracle='+name);};
const request=async(method,path,{token,body,status=200,accept='application/json'}={})=>{
 const response=await fetch(base+path,{method,headers:{accept,...(token?{AuthToken:token}:{}),...(body!==undefined&&!(body instanceof FormData)?{'content-type':'application/json'}:{})},
  ...(body===undefined?{}:{body:body instanceof FormData?body:JSON.stringify(body)}),signal:AbortSignal.timeout(20000)});
 const bytes=Buffer.from(await response.arrayBuffer());
 if(response.status!==status && method==='POST' && path.endsWith('/file'))console.error('owned_upload_diagnostic='+bytes.toString('utf8'));
 assert.equal(response.status,status,method+' '+path+' returned '+response.status);
 let value=null;if(bytes.length){const text=bytes.toString('utf8');try{value=JSON.parse(text);}catch{value=text;}}
 return {value,bytes,headers:response.headers};
};
try{
 const deadline=Date.now()+90000;
 while(true){try{const r=await request('GET','/version');assert.ok(r.value.version);receipt.version=r.value.version;break;}catch(error){if(Date.now()>deadline)throw error;await new Promise(done=>setTimeout(done,1000));}}
 check('actual Apache readiness and version');
 const superSession=(await request('PUT','/session/admin',{body:{name:'super',password:'owned-source-super-secret'}})).value;
 assert.ok(typeof superSession.token==='string'&&superSession.token.length>10);const token=superSession.token;
 const ownedId=Number((await request('PUT','/workspace',{token,body:{name:'Owned report Oracle'},status:201})).value);
 const foreignId=Number((await request('PUT','/workspace',{token,body:{name:'Unassigned Oracle'},status:201})).value);
 assert.ok(Number.isSafeInteger(ownedId)&&ownedId>0&&foreignId!==ownedId);
 const overview='/workspace/'+ownedId+'/sys-check/reports/overview';
 await request('GET',overview,{status:401});
 await request('GET',overview,{token,status:404});
 check('superadmin still needs an explicit workspace grant',{unassignedSuperadminStatus:404,anonymousStatus:401});
 await request('PATCH','/user/'+superSession.id+'/workspaces',{token,body:{ws:[{id:ownedId,role:'RW'}]}});
 const users={};
 for(const mode of ['RO','RW']){
  const name='owned-source-'+mode.toLowerCase(),password='owned-source-'+mode.toLowerCase()+'-secret';
  const id=Number((await request('PUT','/user',{token,body:{n:name,p:password},status:201})).value);
  assert.ok(id>0);await request('PATCH','/user/'+id+'/workspaces',{token,body:{ws:[{id:ownedId,role:mode}]}});
  let session=(await request('PUT','/session/admin',{body:{name,password}})).value;
  await request('PATCH','/user/'+id+'/password',{token:session.token,body:{oldPassword:password,p:password+'-changed'}});
  session=(await request('PUT','/session/admin',{body:{name,password:password+'-changed'}})).value;
  users[mode]={id,token:session.token};
  await request('GET',overview,{token:session.token});
  await request('GET','/workspace/'+foreignId+'/sys-check/reports/overview',{token:session.token,status:404});
 }
 check('actual RO and RW accounts read only their assigned workspace');
 for(const id of ['ORACLE.A','ORACLE.B','ORACLE.C']){
  const document=`<SysCheck xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="https://w3id.org/iqb/spec/testcenter-syscheck-xml/18.0"><Metadata><Id>${id}</Id><Label>${id}</Label></Metadata><Config savekey="owned-oracle-report-key" skipnetwork="true"/></SysCheck>`;
  const form=new FormData();form.append('fileforvo[]',new Blob([document],{type:'application/xml'}),id+'.xml');
  await request('POST','/workspace/'+ownedId+'/file',{token:users.RW.token,body:form,status:201});
  await request('GET','/workspace/'+ownedId+'/sys-check/'+id);
 }
 check('unchanged native XSD validation and RW multipart upload');
 for(let index=0;index<505;index++){
  const id=index<501?'ORACLE.A':index<504?'ORACLE.B':'ORACLE.C';
  await request('PUT','/workspace/'+ownedId+'/sys-check/'+id+'/report',{status:201,body:{keyPhrase:'owned-oracle-report-key',title:'owned-source-report-'+index,
   responses:{text:'exact Ω\n"; value'},environment:[{id:'os',label:'Betriebssystem',value:'Linux'},{id:'os-version',label:'Betriebssystemversion',value:'6'},
    {id:'browser',label:'Browser',value:'Chromium'},{id:'browser-version',label:'Browserversion',value:'130'}],network:[],unit:[],
   questionnaire:[{id:'owned-question',label:id==='ORACLE.C'?'Unselected column':'Selected column',value:'Owned answer'}]}});
 }
 const ro=users.RO.token,root='/workspace/'+ownedId;
 const all=await request('GET',root+'/report/sys-check',{token:ro});assert.equal(all.value.length,505);
 const selected=await request('GET',root+'/report/sys-check?dataIds=ORACLE.A,ORACLE.B',{token:ro});assert.equal(selected.value.length,504);
 assert.ok(selected.value.every(row=>row.checkId!=='ORACLE.C'));
 const csv=await request('GET',root+'/report/sys-check?dataIds=ORACLE.A,ORACLE.B',{token:ro,accept:'text/csv'});
 assert.deepEqual([...csv.bytes.subarray(0,3)],[239,187,191]);
 assert.equal((csv.bytes.toString('utf8').match(/owned-source-report-/g)??[]).length,504);
 assert.ok(!csv.bytes.toString('utf8').includes('Unselected column'));
 check('complete selected and unfiltered native exports exceed 500 reports',{unfiltered:all.value.length,selected:selected.value.length,
  csvSha256:createHash('sha256').update(csv.bytes).digest('hex'),selectedFirstTitles:selected.value.slice(0,3).map(row=>row.title),
  selectedLastTitles:selected.value.slice(-3).map(row=>row.title),rawReportCarriesKeyPhrase:Object.hasOwn(selected.value[0],'keyPhrase')});
 const stats=(await request('GET',overview,{token:ro})).value;
 assert.deepEqual(stats.map(row=>[row.id,row.count]).sort(),[['ORACLE.A',501],['ORACLE.B',3],['ORACLE.C',1]]);
 assert.equal(stats.find(row=>row.id==='ORACLE.A').details.os['Linux 6'],501);
 assert.equal(stats.find(row=>row.id==='ORACLE.A').details.browser['Chromium 130'],501);
 check('native statistics retain OS and browser version labels');
 await request('DELETE',root+'/sys-check/reports',{token:ro,body:{checkIds:['ORACLE.A','ORACLE.B']},status:403});
 assert.equal((await request('GET',root+'/report/sys-check',{token:ro})).value.length,505);
 check('RO report deletion is denied without losing stored reports');
 const deleted=(await request('DELETE',root+'/sys-check/reports',{token:users.RW.token,body:{checkIds:['ORACLE.B']},status:207})).value;
 assert.equal(deleted.deleted.length,3);
 assert.equal((await request('GET',root+'/report/sys-check',{token:ro})).value.length,502);
 check('RW deletes every report of the selected Check and retains unrelated reports');

 // Exercise the native result/test lifecycle through unchanged production
 // routes. No direct SQL, fabricated token or test-mode shortcut seeds data.
 const xml=(type,repo,version,body)=>`<${type} xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="https://w3id.org/iqb/spec/${repo}/${version}">${body}</${type}>`;
 const player='<!doctype html><html><script type="application/ld+json">'+JSON.stringify({$schema:'https://raw.githubusercontent.com/verona-interfaces/metadata/master/verona-module-metadata.json',id:'owned-oracle-player',version:'6.0.4',specVersion:'6.0',metadataVersion:'2.0',type:'player',name:[{lang:'de',value:'Owned Oracle player'}],description:[{lang:'de',value:'Owned API Oracle module'}]})+'</script><main>Owned API fixture</main></html>';
 const files=[
  ['player.html',player,'text/html'],
  ['unit-one.xml',xml('Unit','unit-xml','17.6','<Metadata><Id>ORACLE.UNIT</Id><Label>Owned unit</Label></Metadata><Definition player="owned-oracle-player@6.0.4">Owned definition</Definition>')],
  ['unit-two.xml',xml('Unit','unit-xml','17.6','<Metadata><Id>ORACLE.UNIT2</Id><Label>Owned second unit</Label></Metadata><Definition player="owned-oracle-player@6.0.4">Owned second definition</Definition>')],
  ['booklet-one.xml',xml('Booklet','testcenter-booklet-xml','18.0','<Metadata><Id>ORACLE.BOOK.A</Id><Label>Owned booklet A</Label></Metadata><Units><Unit id="ORACLE.UNIT" label="Owned unit"/></Units>')],
  ['booklet-two.xml',xml('Booklet','testcenter-booklet-xml','18.0','<Metadata><Id>ORACLE.BOOK.B</Id><Label>Owned booklet B</Label></Metadata><Units><Unit id="ORACLE.UNIT" label="Owned unit"/><Unit id="ORACLE.UNIT2" label="Owned second unit"/></Units>')],
  ['people.xml',xml('Testtakers','testcenter-testtaker-xml','18.0','<Metadata/><Group id="ORACLE.GROUP" label="Owned source group"><Login name="owned-source-participant" pw="owned-source-participant-secret" mode="run-hot-return"><Booklet>ORACLE.BOOK.A</Booklet><Booklet>ORACLE.BOOK.B</Booklet></Login><Login name="owned-source-monitor" pw="owned-source-monitor-secret" mode="monitor-group"/></Group>')]
 ];
 for(const [name,document,type='application/xml']of files){
  const form=new FormData();form.append('fileforvo[]',new Blob([document],{type}),name);
  await request('POST',root+'/file',{token:users.RW.token,body:form,status:201});
 }
 check('native result fixture uses actual XSD-validated roster and two Booklets');
 const groups=async()=> {const value=(await request('GET',root+'/results',{token:ro})).value;nativeGroupHistory.push({afterCheck:receipt.checks.at(-1)?.name??null,value});return value;};
 const sessions=async()=> {const value=(await request('GET',root+'/responses/detailed',{token:ro})).value;nativeTestSessionHistory.push({afterCheck:receipt.checks.at(-1)?.name??null,value});return Object.values(value).flat();};
 const groupProjection=value=>value.map(row=>({groupName:row.groupName,bookletsStarted:row.bookletsStarted,
  min:row.numUnitsMin,max:row.numUnitsMax,total:row.numUnitsTotal,average:row.numUnitsAvg}));
 const login=(await request('PUT','/session/login',{body:{name:'owned-source-participant',password:'owned-source-participant-secret'}})).value;
 assert.ok(typeof login.token==='string'&&login.token.length>10);
 // Source's no-code sign-in already returns a person AccessSet. Its frontend
 // skips the second login step when codeRequired is absent.
 assert.ok(Array.isArray(login.flags)&&!login.flags.includes('codeRequired'));
 assert.deepEqual([...(login.access?.test??[])].sort(),['ORACLE.BOOK.A','ORACLE.BOOK.B']);
 const personToken=login.token;
 check('native no-code sign-in directly establishes the real person and both Booklet assignments');
 const createTest=async name=>Number((await request('PUT','/test',{token:personToken,body:{bookletName:name},status:201})).value);
 const first=await createTest('ORACLE.BOOK.A');assert.ok(first>0);
 assert.deepEqual(await groups(),[]);assert.deepEqual(await sessions(),[]);
 check('creating a Test without opening its Booklet creates no result row or stateful Test-Session');
 const monitor=(await request('PUT','/session/login',{body:{name:'owned-source-monitor',password:'owned-source-monitor-secret'}})).value;
 assert.ok(typeof monitor.token==='string'&&monitor.token.length>10);
 const setLock=locked=>request('POST','/monitor/group/ORACLE.GROUP/tests/'+(locked?'lock':'unlock'),{token:monitor.token,body:{testIds:[first]}});
 await setLock(true);assert.deepEqual(await groups(),[]);assert.deepEqual(await sessions(),[]);
 await setLock(false);assert.deepEqual(await groups(),[]);assert.deepEqual(await sessions(),[]);
 const opened=(await request('GET','/test/'+first,{token:personToken})).value;assert.equal(opened.firstStart,true);
 assert.deepEqual(groupProjection(await groups()),[{groupName:'ORACLE.GROUP',bookletsStarted:1,min:0,max:0,total:0,average:0}]);
 assert.deepEqual(await sessions(),[]);
 check('opening a Booklet counts a zero-Unit result while empty test state stays absent from deletion listing');
 // The unmodified TimeStamp helper returns Unix seconds and writes whole-second SQL times.
 // Cross that actual precision boundary; do not weaken the strict changed-time assertions.
 const openedTime=(await groups())[0].lastChange;
 assert.ok(Number.isSafeInteger(openedTime)&&openedTime>0);
 await new Promise(done=>setTimeout(done,1100));await setLock(true);
 const lockedTime=(await groups())[0].lastChange;assert.ok(lockedTime>openedTime);
 assert.deepEqual(await sessions(),[]);
 await new Promise(done=>setTimeout(done,1100));await setLock(true);
 const relockedTime=(await groups())[0].lastChange;assert.ok(relockedTime>lockedTime);
 assert.deepEqual(await sessions(),[]);
 await new Promise(done=>setTimeout(done,1100));await setLock(false);
 const unlockedTime=(await groups())[0].lastChange;assert.ok(unlockedTime>relockedTime);
 assert.deepEqual(await sessions(),[]);
 assert.deepEqual(groupProjection(await groups()),[{groupName:'ORACLE.GROUP',bookletsStarted:1,min:0,max:0,total:0,average:0}]);
 check('locking and same-value relocking advance Test time without nonempty Test state or Unit rows',{openedTime,lockedTime,relockedTime,unlockedTime,unopenedRemainedAbsent:true,emptyStateRemainedAbsent:true});
 const emptyUnit=(await request('GET',`/test/${first}/unit/ORACLE.UNIT`,{token:personToken})).value;
 assert.deepEqual(Object.keys(emptyUnit.dataParts),[]);assert.equal((await groups())[0].numUnitsTotal,0);
 await request('PUT',`/test/${first}/unit/ORACLE.UNIT/log`,{token:personToken,status:500,
  body:[{key:'OWNED',content:'before unit initialization',timeStamp:Date.now()}]});
 assert.equal((await groups())[0].numUnitsTotal,0);
 check('a definition read does not create a saved Unit; pre-initialization logs are rejected without a Unit row');
 const initializeUnit=async(testId,name)=>request('PATCH',`/test/${testId}/unit/${name}/state`,{token:personToken,
  body:{newState:[{key:'PRESENTATION_PROGRESS',content:'some',timeStamp:Date.now()}],originalUnitId:name}});
 await initializeUnit(first,'ORACLE.UNIT');
 await request('PUT',`/test/${first}/unit/ORACLE.UNIT/log`,{token:personToken,status:201,
  body:[{key:'OWNED',content:'log-only',timeStamp:Date.now()}]});
 assert.deepEqual(groupProjection(await groups()),[{groupName:'ORACLE.GROUP',bookletsStarted:1,min:1,max:1,total:1,average:1}]);
 assert.deepEqual(await sessions(),[]);
 assert.deepEqual(Object.keys((await request('GET',`/test/${first}/unit/ORACLE.UNIT`,{token:personToken})).value.dataParts),[]);
 assert.equal((await groups())[0].lastChange,unlockedTime);
 check('actual Unit definition/state/log writes leave Test-level result time unchanged',{testTime:unlockedTime});
 check('a persisted state-and-log Unit counts without answers or a stateful Test-Session');
 await request('PATCH',`/test/${first}/state`,{token:personToken,body:[{key:'CURRENT_UNIT_ID',content:'ORACLE.UNIT',timeStamp:Date.now()}]});
 let detailed=await sessions();assert.equal(detailed.length,1);assert.equal(detailed[0].bookletName,'ORACLE.BOOK.A');
 const second=await createTest('ORACLE.BOOK.B');assert.ok(second>0&&second!==first);
 await request('PATCH',`/test/${second}/state`,{token:personToken,body:[{key:'CURRENT_UNIT_ID',content:'ORACLE.UNIT2',timeStamp:Date.now()}]});
 detailed=await sessions();assert.deepEqual(detailed.map(row=>row.bookletName).sort(),['ORACLE.BOOK.A','ORACLE.BOOK.B']);
 assert.equal((await groups())[0].bookletsStarted,1);
 check('stateful Test-Session listing and opened-Booklet result listing have different inclusion rules');
 await request('GET','/test/'+second,{token:personToken});
 await initializeUnit(second,'ORACLE.UNIT');
 await request('PUT',`/test/${second}/unit/ORACLE.UNIT/response`,{token:personToken,status:201,
  body:{timeStamp:Date.now(),responseType:'owned',originalUnitId:'ORACLE.UNIT',dataParts:{owned:'Exact retained answer Ω'}}});
 await initializeUnit(second,'ORACLE.UNIT2');
 await request('PUT',`/test/${second}/unit/ORACLE.UNIT2/log`,{token:personToken,status:201,
  body:[{key:'OWNED',content:'second log-only unit',timeStamp:Date.now()}]});
 assert.deepEqual(groupProjection(await groups()),[{groupName:'ORACLE.GROUP',bookletsStarted:2,min:1,max:2,total:3,average:1.5}]);
 check('group statistics aggregate saved Unit rows across Booklets including log-only Units',{openedBooklets:2,savedUnits:3,minimum:1,maximum:2,average:1.5});
 const selectedSession=(await sessions()).find(row=>row.bookletName==='ORACLE.BOOK.A');assert.ok(selectedSession);
 const selection={loginName:selectedSession.loginName,code:selectedSession.code??'',nameSuffix:selectedSession.nameSuffix??'',bookletName:selectedSession.bookletName};
 const beforeDetailed=await sessions(),beforeGroups=await groups();
 const beforeResponse=(await request('GET',`/test/${second}/unit/ORACLE.UNIT`,{token:personToken})).value;
 await request('DELETE',root+'/responses/detailed',{token:ro,body:{personSessions:[selection]},status:403});
 assert.deepEqual(await sessions(),beforeDetailed);assert.deepEqual(await groups(),beforeGroups);
 check('RO selected-Test deletion returns 403 without changing results or Test-Session listing');
 await request('DELETE',root+'/responses/detailed',{token:users.RW.token,body:{personSessions:[selection]}});
 detailed=await sessions();assert.deepEqual(detailed.map(row=>row.bookletName),['ORACLE.BOOK.B']);
 assert.deepEqual(groupProjection(await groups()),[{groupName:'ORACLE.GROUP',bookletsStarted:1,min:2,max:2,total:2,average:2}]);
 assert.deepEqual((await request('GET',`/test/${second}/unit/ORACLE.UNIT`,{token:personToken})).value,beforeResponse);
 // IsTestOwner resolves ownership before the controller's not-found check.
 // Deleting this Test therefore denies its stale ID with 403, while the same
 // actual person token retains ownership of the unrelated Booklet below.
 await request('GET','/test/'+first,{token:personToken,status:403});
 const recreated=await createTest('ORACLE.BOOK.A');assert.ok(recreated>0&&recreated!==first&&recreated!==second);
 assert.deepEqual((await sessions()).map(row=>row.bookletName),['ORACLE.BOOK.B']);
 assert.deepEqual((await groups()).map(row=>row.bookletsStarted),[1]);
 check('selected-Test deletion retains the same person token, unrelated Booklet answer and assignment; relaunch creates a new empty Test');

 // Retain actual Source report schemas and row inclusion before implementing
 // the remaining native Results downloads. Everything below is authored data.
 const reviewRoster=xml('Testtakers','testcenter-testtaker-xml','18.0','<Metadata/><Group id="ORACLE.REVIEWS" label="Owned review group"><Login name="owned-source-reviewer" pw="owned-source-reviewer-secret" mode="run-trial"><Booklet>ORACLE.BOOK.B</Booklet></Login></Group>');
 const reviewForm=new FormData();reviewForm.append('fileforvo[]',new Blob([reviewRoster],{type:'application/xml'}),'reviews.xml');
 await request('POST',root+'/file',{token:users.RW.token,body:reviewForm,status:201});
 const reviewLogin=(await request('PUT','/session/login',{body:{name:'owned-source-reviewer',password:'owned-source-reviewer-secret'}})).value;
 assert.ok(reviewLogin.token && !reviewLogin.flags.includes('codeRequired'));
 const reviewToken=reviewLogin.token;
 const reviewTest=Number((await request('PUT','/test',{token:reviewToken,body:{bookletName:'ORACLE.BOOK.B'},status:201})).value);
 await request('GET','/test/'+reviewTest,{token:reviewToken});
 await request('PUT',`/test/${reviewTest}/unit/ORACLE.UNIT2/review`,{token:reviewToken,status:201,
  body:{priority:2,categories:'quality accuracy',entry:'Owned Unit review Ω\n"; exact',reviewer:'Owned Reviewer Ω',
   userAgent:'Owned Oracle browser',page:2,pagelabel:'Owned page',originalUnitId:'ORACLE.UNIT2'}});
 await request('PUT',`/test/${reviewTest}/review`,{token:reviewToken,status:201,
  body:{priority:1,categories:'accuracy',entry:'Owned Booklet review Ω',reviewer:'Owned Reviewer Ω',userAgent:'Owned Oracle browser'}});
 await request('PUT',`/test/${reviewTest}/unit/ORACLE.UNIT2/log`,{token:reviewToken,status:201,
  body:[{key:'OWNED_REVIEW',content:'review-initialized Unit',timeStamp:Date.now()}]});
 assert.deepEqual(groupProjection(await groups()).find(row=>row.groupName==='ORACLE.REVIEWS'),
  {groupName:'ORACLE.REVIEWS',bookletsStarted:1,min:1,max:1,total:1,average:1});
 assert.deepEqual((await sessions()).map(row=>row.bookletName),['ORACLE.BOOK.B']);
 check('a review initializes a saved Unit without answers or nonempty Test state; it accepts subsequent actual Unit logs');
 const report=async(type,group,newVersion=false,accept='application/json')=>request('GET',
  root+'/report/'+type+'?dataIds='+encodeURIComponent(group)+'&useNewVersion='+newVersion,{token:ro,accept});
 const responseRows=(await report('response','ORACLE.GROUP')).value;
 assert.equal(responseRows.length,2);
 assert.deepEqual(responseRows.map(row=>row.unitname),['ORACLE.UNIT','ORACLE.UNIT2']);
 assert.deepEqual(responseRows[0].responses.map(row=>({id:row.id,content:row.content,responseType:row.responseType})),
  [{id:'owned',content:'Exact retained answer Ω',responseType:'owned'}]);
 assert.deepEqual(responseRows[1].responses,[]);
 assert.deepEqual(JSON.parse(responseRows[1].laststate),{PRESENTATION_PROGRESS:'some'});
 const reviewResponses=(await report('response','ORACLE.REVIEWS')).value;
 assert.equal(reviewResponses.length,1);assert.deepEqual(reviewResponses[0].responses,[]);
 assert.equal(reviewResponses[0].laststate,null);
 check('response exports include initialized state-only and review-only Units with empty response arrays');
 const legacy=(await report('review','ORACLE.REVIEWS')).value;
 const enhanced=(await report('review','ORACLE.REVIEWS',true)).value;
 assert.equal(legacy.length,2);assert.equal(enhanced.length,2);
 assert.ok(legacy.every(row=>row.groupname==='ORACLE.REVIEWS' && !Object.hasOwn(row,'reviewer') && !Object.hasOwn(row,'unitlabel')));
 assert.ok(legacy.every(row=>row['category: accuracy']==='X'));
 const newUnit=enhanced.find(row=>row.unitname==='ORACLE.UNIT2');assert.ok(newUnit);
 assert.equal(newUnit.category_accuracy,true);assert.equal(newUnit.category_quality,true);
 assert.equal(newUnit.reviewer,'Owned Reviewer Ω');assert.equal(newUnit.unitlabel,'Owned second unit');
 assert.equal(newUnit.bookletlabel,'Owned booklet B');assert.equal(newUnit.entry,'Owned Unit review Ω\n"; exact');
 const newBook=enhanced.find(row=>row.unitname==='');assert.ok(newBook);
 assert.equal(newBook.category_quality,false);assert.equal(newBook.unitlabel,'');
 check('legacy and enhanced review exports retain distinct category, reviewer and authored label contracts');
 const reportDirectory=process.env.SOURCE_ORACLE_ARTIFACT_DIR;await mkdir(reportDirectory,{recursive:true});
 for(const [type,newVersion,name,group]of [
  ['response',false,'responses','ORACLE.GROUP'],['log',false,'logs','ORACLE.GROUP'],
  ['review',false,'reviews-legacy','ORACLE.REVIEWS'],['review',true,'reviews-enhanced','ORACLE.REVIEWS']]){
  const json=(await report(type,group,newVersion)).value;
  assert.ok(Array.isArray(json) && json.length>0 && json.every(row=>row.groupname===group));
  const csv=await report(type,group,newVersion,'text/csv');assert.ok(csv.bytes.subarray(0,3).equals(Buffer.from([239,187,191])));
  assert.match(csv.headers.get('content-type'),/^text\/csv/);
  const text=csv.bytes.toString('utf8');assert.ok(text.includes('"groupname";"loginname";"code";"bookletname"'));
  const absent=await report(type,'OWNED.NO.SUCH.GROUP',newVersion,'text/csv');assert.equal(absent.bytes.length,0);
  if(type==='review')assert.equal(text.includes('"reviewer"'),newVersion);
  await writeFile(join(reportDirectory,name+'.csv'),csv.bytes);
  await writeFile(join(reportDirectory,name+'.json'),JSON.stringify(json,null,2)+'\n');
  check('actual selected '+name+' CSV and JSON contracts',{rows:json.length,csvSha256:createHash('sha256').update(csv.bytes).digest('hex'),
   header:text.slice(1).split('\n')[0],unknownGroupBytes:absent.bytes.length});
 }

 const reviewUnitsBefore=(await report('response','ORACLE.REVIEWS')).value;
 const reviewGroupsBefore=groupProjection(await groups());
 const ownedReviews=(await request('GET',`/test/${reviewTest}/unit/ORACLE.UNIT2/reviews`,{token:reviewToken})).value;
 assert.equal(ownedReviews.length,1);assert.ok(ownedReviews[0].id>0);
 await request('DELETE',`/test/${reviewTest}/unit/ORACLE.UNIT2/review/${ownedReviews[0].id}`,{token:reviewToken,status:204});
 assert.deepEqual((await report('response','ORACLE.REVIEWS')).value,reviewUnitsBefore);
 assert.deepEqual(groupProjection(await groups()),reviewGroupsBefore);
 assert.equal((await report('review','ORACLE.REVIEWS',true)).value.length,1);
 check('deleting a Unit review retains the saved unanswered Unit, its response export and group counts');


 {
 // Group labels freeze at credential login, even before a person code exists.
 const groupRoster=(groupName,label,loginName,code='')=>`<Group id="${groupName}" label="${label}"><Login name="${loginName}" pw="owned-group-secret" mode="run-hot-return"><Booklet${code?' codes="'+code+'"':''}>ORACLE.BOOK.A</Booklet></Login></Group>`;
 const uploadGroups=async(body,file)=>{
  const form=new FormData();form.append('fileforvo[]',new Blob([xml('Testtakers','testcenter-testtaker-xml','18.0','<Metadata/>'+body)],{type:'application/xml'}),file);
  await request('POST',root+'/file',{token:users.RW.token,body:form,status:201});
 };
 const groupLogin=async name=>(await request('PUT','/session/login',{body:{name,password:'owned-group-secret'}})).value;
 const openGroupTest=async person=>{
  const testId=Number((await request('PUT','/test',{token:person.token,body:{bookletName:'ORACLE.BOOK.A'},status:201})).value);
  await request('GET','/test/'+testId,{token:person.token});return testId;
 };
 await uploadGroups(groupRoster('ORACLE.SNAPSHOT','Before code','owned-source-coded-group','abc'),'snapshot.xml');
 const codeLogin=await groupLogin('owned-source-coded-group');assert.ok(codeLogin.flags.includes('codeRequired'));
 assert.ok(!(await groups()).some(row=>row.groupName==='ORACLE.SNAPSHOT'));
 await uploadGroups(groupRoster('ORACLE.SNAPSHOT','After roster import','owned-source-coded-group','abc'),'snapshot.xml');
 const codedPerson=(await request('PUT','/session/person',{token:codeLogin.token,body:{code:'abc'}})).value;
 await openGroupTest(codedPerson);
 const frozen=(await groups()).find(row=>row.groupName==='ORACLE.SNAPSHOT');
 assert.equal(frozen.groupLabel,'Before code');assert.equal(frozen.bookletsStarted,1);
 check('credential login freezes group label before person code; later roster import does not rewrite the snapshot', {groupName:frozen.groupName,groupLabel:frozen.groupLabel,codeRequired:true,reimportedLabel:'After roster import'});
 const collations=[['ORACLE.COLL.Caf\u00e9','Case first','owned-source-coll-a'],['ORACLE.COLL.CAF\u00c9','Case later','owned-source-coll-b'],['ORACLE.COLL.Cafe\u0301','Composed later','owned-source-coll-c'],['ORACLE.COLL.Cafe','Accent distinct','owned-source-coll-d']].map(row=>row.map(value=>value.replace(/\\u([0-9a-f]{4})/gi,(_,hex)=>String.fromCharCode(parseInt(hex,16)))));
 await uploadGroups(collations.map(([name,label,login])=>groupRoster(name,label,login)).join(''),'collation.xml');
 for(const [, ,name]of collations)await openGroupTest(await groupLogin(name));
 const collated=(await groups()).filter(row=>row.groupName.startsWith('ORACLE.COLL.'));
 assert.equal(collated.length,2);
 assert.deepEqual(collated.map(row=>[row.groupLabel,row.bookletsStarted]).sort(),[['Accent distinct',1],['Case first',3]]);
 check('production german2_ci merges case and Unicode composition, retains first group label and distinguishes accents',{groups:collated.map(row=>({groupName:row.groupName,groupLabel:row.groupLabel,bookletsStarted:row.bookletsStarted}))});
 await request('DELETE',root+'/responses',{token:users.RW.token,body:{groups:['ORACLE.SNAPSHOT']},status:200});
 assert.ok(!(await groups()).some(row=>row.groupName==='ORACLE.SNAPSHOT'));
 const freshCodeLogin=await groupLogin('owned-source-coded-group');assert.ok(freshCodeLogin.flags.includes('codeRequired'));
 const freshPerson=(await request('PUT','/session/person',{token:freshCodeLogin.token,body:{code:'abc'}})).value;
 await openGroupTest(freshPerson);
 const recreated=(await groups()).find(row=>row.groupName==='ORACLE.SNAPSHOT');
 assert.equal(recreated.groupLabel,'After roster import');assert.equal(recreated.bookletsStarted,1);
 check('whole-group result deletion removes the snapshot and next login captures the current authored label',{groupName:recreated.groupName,groupLabel:recreated.groupLabel});


 // Actual XML attribute semantics, including values that are empty or only whitespace.
 const labelCases=[
  {id:'PAD',attribute:'  Padded Ω  ',expected:'  Padded Ω  '},
  {id:'WHITE',attribute:'   ',expected:'   '},
  {id:'EMPTY',attribute:'',expected:''},
  {id:'ENTITIES',attribute:'A &amp; B &quot;Q&quot; &apos;S&apos; &lt;tag&gt;',expected:'A & B "Q" \'S\' <tag>'},
  {id:'NUMERIC',attribute:'A&#10;B&#9;C&#13;D &#x1F680;',expected:'A\nB\tC\rD 🚀'},
  {id:'LITERAL',attribute:'A\r\nB\tC\rD\nE',expected:'A B C D E'},
  {id:'GREATER',attribute:'  A > B &lt;C&gt;  ',expected:'  A > B <C>  '},
  {id:'ONCE',attribute:'&amp;lt; &amp;#10; &amp;amp;',expected:'&lt; &#10; &amp;'}
 ];
 for(const row of labelCases){
  const group='ORACLE.LABEL.'+row.id,loginName='owned-label-'+row.id.toLowerCase();
  await uploadGroups(groupRoster(group,row.attribute,loginName),'label-'+row.id.toLowerCase()+'.xml');
  if(row.id==='EMPTY'){
   await request('PUT','/session/login',{body:{name:loginName,password:'owned-group-secret'},status:500});
   await request('PUT','/session/login',{body:{name:loginName,password:'wrong'},status:500});
   await uploadGroups(groupRoster(group,'  Recovered empty Ω  ',loginName),'label-empty.xml');
   await openGroupTest(await groupLogin(loginName));
   const repaired=(await groups()).find(value=>value.groupName===group);
   assert.equal(repaired.groupLabel,'  Recovered empty Ω  ');
   check('native empty XML group label fails login before password validation and captures no snapshot',{groupName:group,rawAttribute:row.attribute,validPasswordStatus:500,wrongPasswordStatus:500,recoveredLabel:repaired.groupLabel});
  }else{
   await openGroupTest(await groupLogin(loginName));
   const observed=(await groups()).find(value=>value.groupName===group);assert.ok(observed);
   assert.equal(observed.groupLabel,row.expected);
   check('native XML group label preserves '+row.id.toLowerCase(),{groupName:group,rawAttribute:row.attribute,groupLabel:observed.groupLabel});
  }
 }
 const monitorGroup='ORACLE.MONITOR-FIRST';
 const monitorRoster=label=>`<Group id="${monitorGroup}" label="${label}"><Login name="owned-monitor-first" pw="owned-group-secret" mode="monitor-group"/><Login name="owned-monitor-person" pw="owned-group-secret" mode="run-hot-return"><Booklet codes="abc">ORACLE.BOOK.A</Booklet></Login></Group>`;
 await uploadGroups(monitorRoster('  Monitor first Ω  '),'monitor-first.xml');
 const firstMonitor=await groupLogin('owned-monitor-first');assert.ok(firstMonitor.token);
 assert.ok(!(await groups()).some(row=>row.groupName===monitorGroup));
 await uploadGroups(monitorRoster('After monitor import'),'monitor-first.xml');
 const monitorPersonLogin=await groupLogin('owned-monitor-person');assert.ok(monitorPersonLogin.flags.includes('codeRequired'));
 const monitorPerson=(await request('PUT','/session/person',{token:monitorPersonLogin.token,body:{code:'abc'}})).value;
 await openGroupTest(monitorPerson);
 const monitorSnapshot=(await groups()).find(row=>row.groupName===monitorGroup);
 assert.equal(monitorSnapshot.groupLabel,'  Monitor first Ω  ');
 check('native monitor credential login captures the group before any participant person exists',{groupName:monitorGroup,groupLabel:monitorSnapshot.groupLabel,reimportedLabel:'After monitor import'});


 // Separate the mutable Login->Group binding from the immutable group label snapshot.
 const identityLogin='owned-native-identity',identityGroup='ORACLE.IDENTITY';
 const uploadIdentity=(group,label)=>uploadGroups(groupRoster(group,label,identityLogin),'native-identity.xml');
 await uploadIdentity(identityGroup,'  Identity original Ω  ');
 const identityPerson=await groupLogin(identityLogin),identityTest=await openGroupTest(identityPerson);
 await request('PATCH',`/test/${identityTest}/state`,{token:identityPerson.token,body:[{key:'CURRENT_UNIT_ID',content:'ORACLE.UNIT',timeStamp:Date.now()}]});
 await request('PATCH',`/test/${identityTest}/unit/ORACLE.UNIT/state`,{token:identityPerson.token,body:{newState:[{key:'PRESENTATION_PROGRESS',content:'some',timeStamp:Date.now()}],originalUnitId:'ORACLE.UNIT'}});
 const repeatedTest=Number((await request('PUT','/test',{token:identityPerson.token,body:{bookletName:'ORACLE.BOOK.A'},status:201})).value);
 const caseTest=Number((await request('PUT','/test',{token:identityPerson.token,body:{bookletName:'oracle.book.a'},status:201})).value);
 assert.equal(repeatedTest,identityTest);assert.equal(caseTest,identityTest);
 assert.equal((await request('GET','/test/'+identityTest,{token:identityPerson.token})).value.firstStart,false);
 let identityStats=(await groups()).find(row=>row.groupName===identityGroup);
 assert.equal(identityStats.bookletsStarted,1);assert.equal(identityStats.numUnitsTotal,1);
 check('repeated and case-equivalent Booklet creation returns the same native Test identity',{firstTest:identityTest,repeatedTest,caseTest,group:identityStats});
 // Current live file metadata changes, but Test.label is the first stored label.
 const replacementBooklet=xml('Booklet','testcenter-booklet-xml','18.0','<Metadata><Id>ORACLE.BOOK.A</Id><Label>Replaced live booklet Ω</Label></Metadata><Units><Unit id="ORACLE.UNIT" label="Owned unit"/></Units>');
 const bookForm=new FormData();bookForm.append('fileforvo[]',new Blob([replacementBooklet],{type:'application/xml'}),'booklet-one.xml');
 await request('POST',root+'/file',{token:users.RW.token,body:bookForm,status:201});
 await request('GET','/test/'+identityTest,{token:identityPerson.token});
 let identitySession=(await sessions()).find(row=>row.loginName===identityLogin);
 assert.equal(identitySession.bookletName,'ORACLE.BOOK.A');assert.equal(identitySession.bookletLabel,'Owned booklet A');
 await uploadGroups(groupRoster('ORACLE.NEW-LABEL','New label group','owned-new-booklet-label'),'new-booklet-label.xml');
 const laterPerson=await groupLogin('owned-new-booklet-label'),laterTest=await openGroupTest(laterPerson);
 await request('PATCH',`/test/${laterTest}/state`,{token:laterPerson.token,body:[{key:'CURRENT_UNIT_ID',content:'ORACLE.UNIT',timeStamp:Date.now()}]});
 const laterSession=(await sessions()).find(row=>row.loginName==='owned-new-booklet-label');
 assert.equal(laterSession.bookletLabel,'Replaced live booklet Ω');
 check('Test listing retains its first stored Booklet label after live file replacement while new Tests use the current label',{existing:identitySession,newTest:laterSession});
 // A roster replacement alone does not update an already-created Login session.
 await uploadIdentity('oracle.identity','Replacement group label');
 identityStats=(await groups()).find(row=>row.groupName===identityGroup);assert.ok(identityStats);
 const casePerson=await groupLogin(identityLogin);assert.ok(casePerson.token!==identityPerson.token,'A successful person reentry rotates its bearer token');
 const casePersonTest=Number((await request('PUT','/test',{token:casePerson.token,body:{bookletName:'ORACLE.BOOK.A'},status:201})).value);assert.equal(casePersonTest,identityTest);
 identityStats=(await groups()).find(row=>row.groupName.toLowerCase()===identityGroup.toLowerCase());
 identitySession=(await sessions()).find(row=>row.loginName===identityLogin);
 assert.equal(identityStats.groupName,'oracle.identity');assert.equal(identityStats.groupLabel,'  Identity original Ω  ');
 assert.equal(identitySession.groupName,identityGroup);assert.equal(identitySession.groupLabel,'  Identity original Ω  ');
 check('case-equivalent group reentry updates result group spelling but Test listing retains snapshot spelling',{personIdentityRetained:true,personTokenRotated:true,testId:casePersonTest,result:identityStats,testSession:identitySession});
 await uploadIdentity('ORACLE.MOVED','  Moved current Ω  ');
 assert.ok((await groups()).some(row=>row.groupName.toLowerCase()===identityGroup.toLowerCase()));
 const movedPerson=await groupLogin(identityLogin);assert.ok(movedPerson.token!==casePerson.token,'A successful moved-group reentry rotates its bearer token');
 const movedPersonTest=Number((await request('PUT','/test',{token:movedPerson.token,body:{bookletName:'ORACLE.BOOK.A'},status:201})).value);assert.equal(movedPersonTest,identityTest);
 const movedGroups=await groups();assert.ok(!movedGroups.some(row=>row.groupName.toLowerCase()===identityGroup.toLowerCase()));
 const moved=movedGroups.find(row=>row.groupName==='ORACLE.MOVED');assert.equal(moved.groupLabel,'  Moved current Ω  ');assert.equal(moved.bookletsStarted,1);assert.equal(moved.numUnitsTotal,1);
 identitySession=(await sessions()).find(row=>row.loginName===identityLogin);assert.equal(identitySession.groupName,'ORACLE.MOVED');assert.equal(identitySession.bookletLabel,'Owned booklet A');
 check('successful reentry moves existing person Tests to the current Login group without recreating person or Test',{personIdentityRetained:true,personTokenRotated:true,testId:movedPersonTest,result:moved,testSession:identitySession});
 await request('DELETE',root+'/responses',{token:users.RW.token,body:{groups:[identityGroup]},status:200});
 await request('GET','/test/'+identityTest,{token:movedPerson.token});
 assert.equal((await groups()).find(row=>row.groupName==='ORACLE.MOVED').numUnitsTotal,1);
 check('deleting a former group snapshot retains the person and Test already moved to another group');
 await request('DELETE',root+'/responses',{token:users.RO.token,body:{groups:['ORACLE.MOVED']},status:403});
 await request('GET','/test/'+identityTest,{token:movedPerson.token});
 await request('DELETE',root+'/responses',{token:users.RW.token,body:{groups:['ORACLE.MOVED']},status:200});
 await request('GET','/test/'+identityTest,{token:movedPerson.token,status:403});
 assert.ok(!(await groups()).some(row=>row.groupName==='ORACLE.MOVED'));
 check('native whole-group deletion requires RW and invalidates the moved person token and all its Tests',{readOnlyDeleteStatus:403,deletedPersonTestStatus:403});

 // Additional production observations for native Test labels and person suffixes.
 const stateful=async(person,testId)=>request('PATCH',`/test/${testId}/state`,{token:person.token,body:[{key:'CURRENT_UNIT_ID',content:'ORACLE.UNIT',timeStamp:Date.now()}]});
 for(const [kind,label]of [['padded','  Padded Ω\n  '],['empty','']]){
  const document=xml('Booklet','testcenter-booklet-xml','18.0',`<Metadata><Id>ORACLE.BOOK.A</Id><Label>${label}</Label></Metadata><Units><Unit id="ORACLE.UNIT" label="Owned unit"/></Units>`);
  const form=new FormData();form.append('fileforvo[]',new Blob([document],{type:'application/xml'}),'booklet-one.xml');
  await request('POST',root+'/file',{token:users.RW.token,body:form,status:201});
  const name='owned-booklet-label-'+kind;await uploadGroups(groupRoster('ORACLE.BOOKLET-LABEL.'+kind,'Owned label probe',name),'booklet-label-'+kind+'.xml');
  const person=await groupLogin(name),testId=await openGroupTest(person);await stateful(person,testId);
  const row=(await sessions()).find(row=>row.loginName===name);assert.ok(row);assert.equal(row.bookletName,'ORACLE.BOOK.A');assert.equal(row.bookletLabel,label);
  check('native Booklet Test snapshot preserves '+kind+' physical XML Label text',{rawLabel:label,testSession:row});
 }
 const caseLoginName='owned-native-code-case';
 await uploadGroups(groupRoster('ORACLE.CODE-CASE','Owned code case',caseLoginName,'AbC'),'code-case.xml');
 const caseLogin=await groupLogin(caseLoginName);assert.ok(caseLogin.flags.includes('codeRequired'));
 const firstCodePerson=(await request('PUT','/session/person',{token:caseLogin.token,body:{code:'abc'}})).value;
 const firstCodeTest=await openGroupTest(firstCodePerson);await stateful(firstCodePerson,firstCodeTest);
 let codeRows=(await sessions()).filter(row=>row.loginName===caseLoginName);assert.equal(codeRows.length,1);assert.equal(codeRows[0].code,'abc');assert.equal(codeRows[0].nameSuffix,'abc');
 const againLogin=await groupLogin(caseLoginName);assert.ok(againLogin.token===caseLogin.token,'Repeated credentials retain the Login token');
 const secondCodePerson=(await request('PUT','/session/person',{token:againLogin.token,body:{code:'ABC'}})).value;
 assert.ok(secondCodePerson.token!==firstCodePerson.token,'Person credential reentry rotates the bearer');
 const secondCodeTest=await openGroupTest(secondCodePerson);await stateful(secondCodePerson,secondCodeTest);
 codeRows=(await sessions()).filter(row=>row.loginName===caseLoginName);
 const caseRetained=firstCodeTest===secondCodeTest;
 assert.equal(codeRows.length,caseRetained?1:2);assert.ok(codeRows.some(row=>row.code==='abc'&&row.nameSuffix==='abc'));
 if(!caseRetained)assert.ok(codeRows.some(row=>row.code==='ABC'&&row.nameSuffix==='ABC'));
 check('native code casing records first stored code and actual reentry identity',{assignedCode:'AbC',firstRequestedCode:'abc',secondRequestedCode:'ABC',personIdentityRetained:caseRetained,firstTestId:firstCodeTest,secondTestId:secondCodeTest,testSessions:codeRows,loginTokenRetained:true,personTokenRotated:true});
 for(const code of ['', 'abc']){
  const coded=Boolean(code),name='owned-native-restart-'+(coded?'coded':'plain');
  await uploadGroups(groupRoster('ORACLE.RESTART.'+(coded?'CODED':'PLAIN'),'Owned restart',name,coded?'AbC':'').replace('mode="run-hot-return"','mode="run-hot-restart"'),'restart-'+(coded?'coded':'plain')+'.xml');
  const ids=[];
  for(let index=0;index<2;index++){
   const login=await groupLogin(name),person=coded?(await request('PUT','/session/person',{token:login.token,body:{code}})).value:login;
   const testId=await openGroupTest(person);ids.push(testId);await stateful(person,testId);
  }
  assert.notEqual(ids[0],ids[1]);const rows=(await sessions()).filter(row=>row.loginName===name);assert.equal(rows.length,2);
  for(const row of rows){assert.equal(row.code,code);assert.match(row.nameSuffix,coded?/^abc\/[a-z0-9_-]{8}$/:/^[a-z0-9_-]{8}$/);}
  assert.notEqual(rows[0].nameSuffix,rows[1].nameSuffix);
  check('native always-new person persists '+(coded?'code-prefixed':'plain')+' eight-character suffix',{mode:'run-hot-restart',assignedCode:coded?'AbC':'',requestedCode:code,testIds:ids,testSessions:rows});
 }
 const phaseName='owned-native-password-phase',phaseRoster=groupRoster('ORACLE.AUTH-PHASE','Owned phase',phaseName,'AbC');
 await uploadGroups(phaseRoster,'password-phase.xml');const beforeRotation=await groupLogin(phaseName);assert.ok(beforeRotation.flags.includes('codeRequired'));
 await uploadGroups(phaseRoster.replace('pw="owned-group-secret"','pw="owned-new-group-secret"'),'password-phase.xml');
 const phasePerson=(await request('PUT','/session/person',{token:beforeRotation.token,body:{code:'abc'}})).value;
 const phaseTest=await openGroupTest(phasePerson);await stateful(phasePerson,phaseTest);
 const currentLogin=(await request('PUT','/session/login',{body:{name:phaseName,password:'owned-new-group-secret'}})).value;
 assert.ok(currentLogin.token===beforeRotation.token,'A valid existing Login token survives password reimport');
 const phaseRow=(await sessions()).find(row=>row.loginName===phaseName);assert.equal(phaseRow.code,'abc');assert.equal(phaseRow.nameSuffix,'abc');
 check('native person-code phase uses existing Login token after intervening password replacement',{loginTokenRetained:true,passwordUpdatedBetweenPhases:true,testId:phaseTest,testSession:phaseRow});

 }
 await request('PATCH','/user/'+users.RO.id+'/workspaces',{token,body:{ws:[{id:ownedId,role:''}]}});
 await request('GET',overview,{token:ro,status:404});
 check('revocation is enforced against the existing signed-in token');
 assert.equal(receipt.checks.length,53);
 receipt.success=true;
}finally{
 const directory=process.env.SOURCE_ORACLE_ARTIFACT_DIR;assert.ok(directory);await mkdir(directory,{recursive:true});
 await writeFile(join(directory,'receipt.json'),JSON.stringify(receipt,null,2)+'\n');
 await writeFile(join(directory,'groups-history.json'),JSON.stringify(nativeGroupHistory,null,2)+'\n');
 await writeFile(join(directory,'test-sessions-history.json'),JSON.stringify(nativeTestSessionHistory,null,2)+'\n');
}
