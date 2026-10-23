import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
const base=process.env.SOURCE_ORACLE_URL;
assert.ok(/^http:\/\/127\.0\.0\.1:\d+$/.test(base??''));
const receipt={sourceCommit:'eedae41840cbe90e5547c0211da818bdf620f5aa',testMode:false,transport:'production Apache HTTP',checks:[]};
const check=(name,details={})=>{receipt.checks.push({name,...details});console.log('source_oracle='+name);};
const request=async(method,path,{token,body,status=200,accept='application/json'}={})=>{
 const response=await fetch(base+path,{method,headers:{accept,...(token?{AuthToken:token}:{}),...(body!==undefined&&!(body instanceof FormData)?{'content-type':'application/json'}:{})},
  ...(body===undefined?{}:{body:body instanceof FormData?body:JSON.stringify(body)}),signal:AbortSignal.timeout(20000)});
 const bytes=Buffer.from(await response.arrayBuffer());
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
 await request('PATCH','/user/'+users.RO.id+'/workspaces',{token,body:{ws:[{id:ownedId,role:''}]}});
 await request('GET',overview,{token:ro,status:404});
 check('revocation is enforced against the existing signed-in token');
 receipt.success=true;
}finally{
 const directory=process.env.SOURCE_ORACLE_ARTIFACT_DIR;assert.ok(directory);await mkdir(directory,{recursive:true});
 await writeFile(join(directory,'receipt.json'),JSON.stringify(receipt,null,2)+'\n');
}
