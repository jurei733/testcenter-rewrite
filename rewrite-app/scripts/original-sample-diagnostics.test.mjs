import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createServer} from 'node:http';
import {mkdtemp,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {chromium} from 'playwright';
import {observeOriginalSample} from './original-sample-diagnostics.mjs';
import {waitForOriginalSampleResource} from './original-sample-readiness.mjs';

test('actual sample diagnostics distinguish the current frame and trusted input without exporting transport secrets',async()=>{
  assert.equal(process.env.UI_SMOKE_HEADFUL,'true');
  const directory=await mkdtemp(join(tmpdir(),'owned-sample-diagnostic-control-'));
  const server=createServer((request,response)=>{
    if(request.method==='POST'){
      request.resume();request.on('end',()=>{response.setHeader('content-type','application/json');
        response.end(JSON.stringify({sessionToken:'owned-ack-secret',testRun:{testRunId:'owned',stateRevision:2,
          currentUnitKey:'UNIT.SAMPLE',unitResponses:{'UNIT.SAMPLE':'owned-ack-response'},
          unitResponseFieldTimestamps:{'UNIT.SAMPLE':{unitStateDataParts:{answers:42}}},unrelatedSecret:'owned-run-secret'}}));});
    }else{response.setHeader('content-type','text/html');response.end('<!doctype html><iframe id="participantVeronaPlayerFrame" srcdoc="<input name=required-text-field>"></iframe><iframe id="imposter" srcdoc="<p>Other owned frame</p>"></iframe>');}
  });
  await new Promise(done=>server.listen(0,'127.0.0.1',done));
  let browser;
  try{
    browser=await chromium.launch({headless:false});const page=await browser.newPage();await page.bringToFront();
    const observer=await observeOriginalSample(page);
    await page.goto('http://127.0.0.1:'+server.address().port);
    const current=page.frameLocator('#participantVeronaPlayerFrame');
    await current.locator('input').pressSequentially('owned');
    await current.locator('input').evaluate(input=>parent.postMessage({type:'vopStateChangedNotification',sessionId:'owned-current',
      unitState:{dataParts:{answers:JSON.stringify([{id:input.name,value:input.value}])},sessionToken:'owned-unit-secret'},
      playerConfig:{directDownloadUrl:'owned-config-secret'}},'*'));
    await page.frameLocator('#imposter').locator('p').evaluate(()=>parent.postMessage({type:'vopStateChangedNotification',sessionId:'owned-imposter'},'*'));
    const result=await page.evaluate(async()=>{
      const response=await fetch('/api/v1/participant/test-runs/owned/save-progress?secret=owned-query-secret',{
        method:'POST',headers:{authorization:'Bearer owned-header-secret','content-type':'application/json'},
        body:JSON.stringify({deliveryId:'owned-delivery',currentUnitKey:'UNIT.SAMPLE',status:'running',
          unitResponse:'owned-request-response',sessionToken:'owned-body-secret',logs:['owned-log-secret']})});
      return response.status;
    });assert.equal(result,200);
    await page.waitForFunction(()=>document.querySelector('iframe'));
    await observer.write(directory);
    const bytes=await readFile(join(directory,'trace.json'),'utf8'),packet=JSON.parse(bytes);
    assert.ok(packet.events.some(event=>event.kind==='input'&&event.trusted&&event.value==='owned'));
    assert.ok(packet.events.some(event=>event.kind==='input'&&event.type==='input'&&event.inputType==='insertText'&&event.data==='d'));
    assert.equal(packet.acknowledgements[0].deliveryId,'owned-delivery');
    assert.ok(packet.events.some(event=>event.sessionId==='owned-current'&&event.fromCurrentFrame===true));
    assert.ok(packet.events.some(event=>event.sessionId==='owned-imposter'&&event.fromCurrentFrame===false));
    assert.equal(packet.requests.length,1);assert.equal(packet.acknowledgements.length,1);
    assert.equal(packet.requests[0].body.unitResponse,'owned-request-response');
    assert.equal(packet.acknowledgements[0].run.unitResponses['UNIT.SAMPLE'],'owned-ack-response');
    assert.equal(packet.acknowledgements[0].run.stateRevision,2);
    assert.equal(packet.acknowledgements[0].run.unitResponseFieldTimestamps['UNIT.SAMPLE'].unitStateDataParts.answers,42);
    for(const secret of ['owned-header-secret','owned-query-secret','owned-body-secret','owned-ack-secret',
      'owned-config-secret','owned-unit-secret','owned-run-secret','owned-log-secret'])assert.equal(bytes.includes(secret),false,secret);
    observer.stop();await page.close();
  }finally{await browser?.close();await new Promise(done=>server.close(done));}
});

test('unmodified Original sample replaces early typed inputs on external append; readiness waits for the real resource before one fill',async()=>{
  assert.equal(process.env.UI_SMOKE_HEADFUL,'true');
  const player=await readFile(new URL('../test-fixtures/original-testcenter/players/verona-player-simple-6.0.html',import.meta.url),'utf8');
  const definition=await readFile(new URL('../test-fixtures/original-testcenter/definitions/SAMPLE_UNITCONTENTS.HTM',import.meta.url),'utf8');
  const content='Owned external resource is fully appended.';
  let response,started,requestStarted;
  const escaped=player.replaceAll('&','&amp;').replaceAll('"','&quot;');
  const server=createServer((request,res)=>{
    res.setHeader('cache-control','no-store');
    if(request.url==='/resources/sample_resource_package/file.text'){
      res.setHeader('access-control-allow-origin','*');response=res;started();
    }else{res.setHeader('content-type','text/html');res.end(`<iframe id="participantVeronaPlayerFrame" width="1000" height="700" sandbox="allow-scripts allow-forms" srcdoc="${escaped}"></iframe>`);}
  });
  await new Promise(done=>server.listen(0,'127.0.0.1',done));
  let browser;
  try{
    browser=await chromium.launch({headless:false});const page=await browser.newPage();await page.bringToFront();
    await page.addInitScript(()=>{window.ownedStates=[];addEventListener('message',event=>{
      if(event.source===document.querySelector('iframe')?.contentWindow){window.ownedStates.push(event.data);if(window.ownedStates.length>100)window.ownedStates.shift();}
    });});
    const base='http://127.0.0.1:'+server.address().port;
    const open=async()=>{
      requestStarted=new Promise(done=>{started=done;});response=undefined;await page.goto(base);
      await page.waitForFunction(()=>window.ownedStates.some(packet=>packet.type==='vopReadyNotification'));
      await page.evaluate(({definition,base})=>document.querySelector('iframe').contentWindow.postMessage({type:'vopStartCommand',sessionId:'owned',
        unitDefinition:definition,playerConfig:{pagingMode:'concat-scroll',directDownloadUrl:base+'/resources'}},'*'),{definition,base});
      let deadline;
      try{await Promise.race([requestStarted,new Promise((_,reject)=>{deadline=setTimeout(()=>reject(Error('Original sample never requested its external resource.')),15_000);})]);}
      finally{clearTimeout(deadline);}
      return page.frameLocator('#participantVeronaPlayerFrame');
    };
    const observed=value=>page.waitForFunction(value=>window.ownedStates.some(packet=>{
      try{return JSON.parse(packet.unitState?.dataParts?.answers??'[]').some(answer=>answer.id==='required-text-field'&&answer.value===value);}
      catch{return false;}
    }),value);
    const selector='input[name="required-text-field"]';
    let frame=await open();await frame.locator(selector).fill('Early value');await frame.locator(selector).press('Tab');await observed('Early value');
    await frame.locator(selector).evaluate(input=>{globalThis.ownedBeforeAppend=input;});
    response.end(content);await waitForOriginalSampleResource(frame,content);
    assert.equal(await frame.locator(selector).inputValue(),'','The unchanged sample must reproduce the input reset.');
    assert.equal(await frame.locator(selector).evaluate(input=>input===globalThis.ownedBeforeAppend),false);
    frame=await open();await frame.locator(selector).waitFor();
    let settled=false;const ready=waitForOriginalSampleResource(frame,content).finally(()=>{settled=true;});
    await page.evaluate(()=>Promise.resolve());assert.equal(settled,false,'Visible inputs are insufficient while the actual external response is held.');
    response.end(content);await ready;
    await frame.locator(selector).fill('One value after real readiness');await frame.locator(selector).press('Tab');
    await observed('One value after real readiness');
    assert.equal(await frame.locator(selector).inputValue(),'One value after real readiness');
    await page.close();
  }finally{response?.end();await browser?.close();await new Promise(done=>server.close(done));}
});
