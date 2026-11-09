import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {DatabaseSync} from 'node:sqlite';
import {Client} from 'pg';
import {createPostgresFirstSliceStorage} from '@testcenter-rewrite-app/postgres-store';
import {createFirstSliceServices,OriginalReviewInteger,decodeOriginalTestLogJson,originalReportFormat,originalReportQuery,assertOriginalReportRowCount} from '@testcenter-rewrite-app/application';
const source=JSON.parse(await readFile(new URL('../test-fixtures/original-testcenter/source-workspace-results/native-workspace-administration-http/observations.json',import.meta.url),'utf8'));
const row=name=>source.rows.find(r=>r.label===name);
export async function verifyOriginalWorkspaceReports(t,{services,repository,scope:parentScope,ids:parentIds,xml,booklet,nativeRoles,nativeTokens,kind,file,connectionString}){
 const workspace=await services.platform.createWorkspace({tenantKey:parentScope.tenantKey,workspaceKey:'native-reports',displayName:'Owned native reports'});
 const scope={tenantKey:parentScope.tenantKey,workspaceKey:workspace.workspaceKey},ids={tenantId:parentIds.tenantId,workspaceId:workspace.workspaceId};
 const report=(type,extra={})=>services.originalWorkspaceReport.read({...scope,type,dataIds:'',accept:'application/json',useNewVersion:false,...extra});
 const upload=(fileName,sourceDocument,mediaType='application/xml')=>services.contentIntake.uploadWorkspaceFile({...scope,fileName,sourceDocument,mediaType});
 await upload('player.html','<html><script type="application/ld+json">'+JSON.stringify({$schema:'https://raw.githubusercontent.com/verona-interfaces/metadata/master/verona-module-metadata.json',id:'owned-admin-player',version:'1.0.0',specVersion:'6.0',metadataVersion:'2.0',type:'player',name:[{lang:'de',value:'Owned Player'}]})+'</script></html>','text/html');
 await upload('unit.xml',xml('Unit','<Metadata><Id>OWNED.ADM.UNIT</Id><Label>Owned administration Unit</Label></Metadata><Definition player="owned-admin-player@1.0.0">Owned definition</Definition>'));
 await upload('a.xml',booklet('OWNED.ADM.A','Report Booklet A Ω'));await upload('b.xml',booklet('OWNED.ADM.B','Report Booklet B Ä'));
 const ownerName='r57-'+randomUUID(),trialName='r57-'+randomUUID(),peerName='r57-'+randomUUID();
 const roster=group=>xml('Testtakers','<Metadata/><Group id="'+group+'" label="Owned report group"><Login name="'+ownerName+'" mode="run-hot-return"><Booklet codes="AbC">OWNED.ADM.A</Booklet><Booklet codes="AbC">OWNED.ADM.B</Booklet></Login><Login name="'+trialName+'" mode="run-trial"><Booklet>OWNED.ADM.A</Booklet></Login></Group><Group id="OWNED.REPORT.OTHER" label="Other report group"><Login name="'+peerName+'" mode="run-trial"><Booklet>OWNED.ADM.A</Booklet></Login></Group>');
 await services.workspaceAdminRead.importParticipantRoster({...scope,rosterText:roster('OWNED.ADM.ZULU')});
 const number=await repository.getOrCreateOriginalWorkspaceNumber(ids);
 for(const role of [nativeRoles.reader,nativeRoles.writer])await repository.saveAdminRoleAssignment({...role,roleAssignmentId:randomUUID(),workspaceId:ids.workspaceId});
 const credentials=await services.originalAuthentication.login({name:ownerName,password:''}),owner=await services.originalAuthentication.person({loginToken:credentials.token,code:'aBc'});
 let numbers=[],trial,peer,trialNumber,peerNumber,responseBaseline;
 await t.test('native downloads reproduce all27 actual Source197 empty Accept cases and preserve group/row caps',async()=>{
  for(const type of ['response','log','review'])for(let i=0;i<9;i++){
   const expected=row('empty-report-'+type+'-accept-'+i),actual=await report(type,{accept:expected.requestAccept});assert.equal(actual.body,expected.rawText);assert.equal(actual.contentType,expected.contentType);
  }
  for(const accept of ['','*/*','text/plain','text/csv;q=0,application/json','application/json,text/csv'])assert.equal(originalReportFormat(accept),accept.startsWith('text/csv')?'csv':'json');
  assert.equal(originalReportQuery(new URLSearchParams('dataIds%5B%5D=x'),'dataIds'),null);assert.equal(originalReportQuery(new URLSearchParams('dataIds%5B%5D=x&dataIds=y'),'dataIds'),'y');
  await assert.rejects(report('response',{dataIds:null}),e=>e.statusCode===500);
  await assert.rejects(report('response',{dataIds:Array.from({length:101},(_,i)=>'g'+i).join(',')}),e=>e.statusCode===400);
  assertOriginalReportRowCount(50000);assert.throws(()=>assertOriginalReportRowCount(50001),e=>e.statusCode===413);
 });
 await t.test('real native Unit writes reproduce Source197 response JSON/CSV and all literal dataIds filters',async()=>{
  const expected=row('retained-response-before-delete');
  for(const value of expected.value){const testNumber=await services.originalTest.create({token:owner.token,bookletName:value.bookletname});numbers.push(testNumber);
   const request={token:owner.token,testNumber,unitName:value.unitname},part=value.responses[0];
   await services.originalUnit.patchState({...request,body:{originalUnitId:value.originalUnitId,newState:[{key:'PRESENTATION_PROGRESS',content:'some',timeStamp:part.ts-1}]}});
   await services.originalUnit.putResponse({...request,body:{timeStamp:part.ts,dataParts:{[part.id]:part.content},responseType:part.responseType}});
  }
  const adapt=text=>text.replaceAll('owned-adm-r53-code',ownerName);
  responseBaseline=(await report('response')).body;assert.equal(responseBaseline,adapt(expected.rawText));
  for(const expected of source.rows.filter(r=>r.label.startsWith('response-dataIds-'))){
   const params=new URL(expected.path,'http://owned').searchParams,actual=await report('response',{dataIds:params.get('dataIds')??'',accept:expected.requestAccept});
   assert.equal(actual.body,adapt(expected.rawText),expected.label);assert.equal(actual.contentType,expected.contentType);
  }
 });
 await t.test('native logs retain unsafe integer tokens and the global Unit-before-Test branch',async()=>{
  await services.originalTest.putLog({token:owner.token,testNumber:numbers[0],body:decodeOriginalTestLogJson('[{"key":"R57","content":"unsafe Ω","timeStamp":9007199254740993}]')});
  const data=await report('log');assert.ok(data.body.includes('"timestamp":9007199254740993'));assert.ok(!data.body.includes('9007199254740992'));
  const rows=JSON.parse(data.body);assert.ok(rows.length>=3);assert.equal(rows.at(-1).unitname,'');assert.equal(rows.at(-1).logentry,'R57 : "unsafe \\u03a9"');assert.ok(rows.slice(0,-1).every(r=>r.unitname==='OWNED.ADM.UNIT'));
  const csv=(await report('log',{accept:'text/csv'})).body;assert.ok(csv.startsWith('\ufeff'));assert.ok(csv.includes('"9007199254740993"'));
 });
 await t.test('both native comment versions preserve raw pages/nulls and global Unit-before-Booklet order across people',async()=>{
  trial=await services.originalAuthentication.login({name:trialName,password:''});peer=await services.originalAuthentication.login({name:peerName,password:''});
  trialNumber=await services.originalTest.create({token:trial.token,bookletName:'OWNED.ADM.A'});peerNumber=await services.originalTest.create({token:peer.token,bookletName:'OWNED.ADM.A'});
  const body={entry:'Owned raw comment Ω',categories:'1 01 0 tech  tech ',priority:2,reviewer:null,userAgent:'Owned report agent',page:new OriginalReviewInteger('9007199254740993'),pagelabel:null,originalUnitId:'FIRST.REVIEW.ID'};
  await services.originalReview.create({token:trial.token,testNumber:trialNumber,unitName:null,body});
  await services.originalReview.create({token:peer.token,testNumber:peerNumber,unitName:'OWNED.ADM.UNIT',body});
  await services.originalReview.create({token:trial.token,testNumber:trialNumber,unitName:'OWNED.ADM.UNIT',body});
  const old=await report('review'),modern=await report('review',{useNewVersion:true});assert.ok(old.body.includes('"page":9007199254740993'));assert.ok(modern.body.includes('"page":9007199254740993'));
  const rows=JSON.parse(modern.body);assert.equal(rows.length,3);assert.deepEqual(rows.map(r=>r.unitname),['OWNED.ADM.UNIT','OWNED.ADM.UNIT','']);
  assert.ok(rows.every(r=>r.reviewer===null&&r.category_1===true&&!Object.hasOwn(r,'category_01')));assert.equal(rows[0].unitlabel,'Owned administration Unit');assert.equal(rows[0].bookletlabel,'Report Booklet A Ω');
  const native=JSON.parse((await services.originalReview.export({token:trial.token,format:'json'})).body);assert.deepEqual(rows.filter(r=>r.loginname===trialName),[...native.filter(r=>r.unitname),...native.filter(r=>!r.unitname)]);
  const legacy=JSON.parse(old.body);assert.ok(Object.hasOwn(legacy[0],'category: tech'));assert.ok(!Object.hasOwn(legacy[0],'unitlabel'));
  const csv=await report('review',{useNewVersion:true,accept:'text/csv'});assert.ok(csv.body.includes('"TRUE"'));assert.ok(csv.body.includes('"9007199254740993"'));
  await upload('a.xml',booklet('OWNED.ADM.A','Changed current report label β'));
  assert.ok((await report('review',{useNewVersion:true})).body.includes('Changed current report label'));assert.ok(!(await report('review')).body.includes('Changed current report label'));
  const units=JSON.parse((await report('response')).body);assert.ok(units.filter(r=>r.originalUnitId==='FIRST.REVIEW.ID').every(r=>r.laststate===null&&r.responses.length===0));
 });
 await t.test('SQL native downloads avoid full private Run decoding and log/comment reads avoid Unit payload decoding',async()=>{
  const privateRun='Owned private report Run '+randomUUID(),privateUnit='Owned private report Unit '+randomUUID();
  await services.originalTest.patchState({token:owner.token,testNumber:numbers[0],patch:[{key:'PRIVATE',content:privateRun,timeStamp:1793530200100}]});
  await services.originalUnit.patchState({token:owner.token,testNumber:numbers[0],unitName:'OWNED.ADM.UNIT',body:{newState:[{key:'PRIVATE',content:privateUnit,timeStamp:1793530200100}]}});
  const parse=JSON.parse;JSON.parse=(...args)=>{if(typeof args[0]==='string'&&(args[0].includes(privateRun)||args[0].includes(privateUnit)))throw Error('Owned report private decoder fence');return parse(...args);};
  try{
   const restricted=new Proxy(repository,{get(target,key){if(['listTestRunsByWorkspace','getTestRunById','listWorkspaceReviewsByWorkspace','listOriginalUnitsByWorkspace','listOriginalReviewsByPerson'].includes(key))return()=>{throw Error('Broad or cross-family read forbidden');};return Reflect.get(target,key);}});
   const scoped=createFirstSliceServices({repository:restricted});
   assert.ok((await scoped.originalWorkspaceReport.read({...scope,type:'log',dataIds:'',accept:'application/json',useNewVersion:false})).body);
   assert.ok((await scoped.originalWorkspaceReport.read({...scope,type:'review',dataIds:'',accept:'application/json',useNewVersion:false})).body);
  }finally{JSON.parse=parse;}
  responseBaseline=(await report('response')).body;
 });
 for(const type of ['response','log','review'])await t.test('one '+type+' snapshot survives an actual independent native writer after its first metadata read',async race=>{
  const request={...ids,type,groups:null},before=await repository.getOriginalWorkspaceReportSnapshot(request);
  const mutation=type==='response'?{port:'originalUnit',method:'putResponse',args:{token:owner.token,testNumber:numbers[0],unitName:'OWNED.ADM.UNIT',body:{timeStamp:1793530300000,dataParts:{snapshot:'Committed while report reads'},responseType:'OwnedSnapshot'}}}:
   type==='log'?{port:'originalTest',method:'putLog',args:{token:owner.token,testNumber:numbers[0],body:[{key:'SNAPSHOT',content:'Committed while report reads',timeStamp:1793530300001}]}}:
   {port:'originalReview',method:'create',args:{token:trial.token,testNumber:trialNumber,unitName:null,body:{entry:'Committed while report reads',categories:'1',priority:1,reviewer:null,userAgent:'Owned snapshot writer',page:null,pagelabel:null}}};
  let committed=false,interleaved=false,other,control,hook;
  const matches=sql=>typeof sql==='string'&&sql.startsWith('SELECT participant_session_id AS "participantSessionId",tenant_id AS "tenantId",workspace_id AS "workspaceId",content_release_id AS "contentReleaseId",group_key AS "groupKey"');
  const mutate=async runtime=>{await runtime[mutation.port][mutation.method](mutation.args);committed=true;};
  try{
   if(kind==='postgres'){
    other=await createPostgresFirstSliceStorage(connectionString);const runtime=createFirstSliceServices({repository:other.repository}),query=Client.prototype.query;
    hook=race.mock.method(Client.prototype,'query',function(...args){const result=query.apply(this,args);if(!interleaved&&matches(args[0])){interleaved=true;return result.then(async rows=>{await mutate(runtime);return rows;});}return result;});
   }else if(kind==='sqlite'){
    control=new DatabaseSync(file);assert.equal(control.prepare('PRAGMA journal_mode=WAL').get().journal_mode,'wal');
    const prepare=DatabaseSync.prototype.prepare;
    hook=race.mock.method(DatabaseSync.prototype,'prepare',function(sql){const statement=prepare.call(this,sql);if(!interleaved&&matches(sql))return new Proxy(statement,{get(target,key){if(key==='all')return(...args)=>{const rows=target.all(...args);interleaved=true;
     const code="import {createSqliteFirstSliceStorage} from '@testcenter-rewrite-app/sqlite-store';import {createFirstSliceServices} from '@testcenter-rewrite-app/application';let raw='';for await(const chunk of process.stdin)raw+=chunk;const {file,mutation}=JSON.parse(raw),storage=createSqliteFirstSliceStorage(file);try{const services=createFirstSliceServices({repository:storage.repository});await services[mutation.port][mutation.method](mutation.args);console.log('Owned native writer committed');}finally{await storage.shutdown();}";
     const result=spawnSync(process.execPath,['--input-type=module','-e',code],{cwd:new URL('..',import.meta.url),input:JSON.stringify({file,mutation}),encoding:'utf8',timeout:15000});assert.equal(result.status,0,result.stderr);assert.equal(result.stdout.trim(),'Owned native writer committed');committed=true;return rows;
    };const value=Reflect.get(target,key);return typeof value==='function'?value.bind(target):value;}});return statement;});
   }
   const snapshot=await repository.getOriginalWorkspaceReportSnapshot(request);
   if(kind==='memory'||kind==='file')await mutate(services);
   assert.equal(committed,true,'native write actually committed before the snapshot is compared');
   if(kind==='sqlite'||kind==='postgres')assert.equal(interleaved,true,'writer committed between actual SQL metadata and family reads');
   assert.deepEqual(snapshot,before,'one snapshot must contain the pre-write family');
   assert.notDeepEqual(await repository.getOriginalWorkspaceReportSnapshot(request),before,'a fresh snapshot must expose the committed native write');
  }finally{hook?.mock.restore();await other?.shutdown();control?.close();}
 });
 responseBaseline=(await report('response')).body;
 await t.test('unknown selected Review history blocks comments while valid response/log reports and unselected comments survive',async()=>{
  const own=await repository.findOriginalTestNumber({testNumber:trialNumber,...ids,participantSessionId:trial.participantSession.participantSessionId});
  await services.workspaceReview.createReview({...scope,participantSessionId:own.participantSessionId,testRunId:own.testRunId,unitKey:null,reviewerId:'Owned legacy import',category:'legacy',comment:'Raw native provenance unavailable'});
  await assert.rejects(report('review'),e=>e.statusCode===409);
  assert.equal((await report('response')).body,responseBaseline);assert.ok((await report('log')).body);
  assert.equal(JSON.parse((await report('review',{dataIds:'owned.report.other',useNewVersion:true})).body).length,1);
  for(const type of ['response','log','review'])assert.equal((await report(type,{dataIds:'missing-owned-group'})).body,'');
 });
 return {scope,ids,number,owner,ownerName,numbers,trial,trialName,trialNumber,peer,peerName,peerNumber,roster,report,responseBaseline,tokens:nativeTokens};
}

export async function verifyOriginalWorkspaceReportHttp(t,{base,proof,tokens}){
 const get=async(type,{token=tokens.reader,query='',accept='application/json'}={})=>{const r=await fetch(base+'/workspace/'+proof.number+'/report/'+type+query,{headers:{...(token===null?{}:{AuthToken:token}),Accept:accept},signal:AbortSignal.timeout(15000)});return {status:r.status,body:await r.text(),contentType:r.headers.get('content-type'),cache:r.headers.get('cache-control')};};
 await t.test('actual native report HTTP preserves explicit RO/RW grants, Source media and zero-byte selected empties',async()=>{
  for(const [token,status]of [[null,401],[tokens.reader,200],[tokens.writer,200],[tokens.root,404],[tokens.foreign,404],['invalid-owned-token',403],['',401],[proof.owner.token,403]]){
   const r=await get('response',{token});assert.equal(r.status,status);assert.equal(r.cache,'private, no-store');if(status===200)assert.equal(r.body,(await proof.report('response')).body);
  }
  for(const type of ['response','log','review'])for(const i of [0,1,2,3,4,5,6,7,8]){const expected=row('empty-report-'+type+'-accept-'+i),r=await get(type,{query:'?dataIds=missing-owned-group',accept:expected.requestAccept});assert.equal(r.status,200);assert.equal(r.body,expected.rawText);assert.equal(r.contentType,expected.contentType);}
  assert.equal((await get('review')).status,409);assert.equal((await get('review',{query:'?dataIds=OWNED.REPORT.OTHER&useNewVersion=true'})).status,200);
  assert.equal((await get('review',{query:'?dataIds=OWNED.REPORT.OTHER&useNewVersion=TRUE'})).body,(await proof.report('review',{dataIds:'OWNED.REPORT.OTHER'})).body);
  assert.equal((await get('unknown-owned')).status,404);assert.equal((await get('response',{query:'?dataIds%5B%5D=OWNED.ADM.ZULU'})).status,500);
  assert.equal((await get('response',{query:'?dataIds='+encodeURIComponent(Array.from({length:101},(_,i)=>'g'+i).join(','))})).status,400);
 });
}
