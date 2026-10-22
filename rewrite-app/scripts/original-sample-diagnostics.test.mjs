import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createServer} from 'node:http';
import {mkdtemp,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {chromium} from 'playwright';
import {observeOriginalSample} from './original-sample-diagnostics.mjs';

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
