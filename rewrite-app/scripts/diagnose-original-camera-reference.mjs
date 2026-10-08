import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,writeFile,mkdir,mkdtemp} from 'node:fs/promises';
import {extname,resolve,relative,join} from 'node:path';
import {tmpdir} from 'node:os';
import {chromium} from 'playwright';
import QRCode from 'qrcode';
// Read-only failure diagnostic, not a passing capture gate. A reproduced
// Source startup failure exits 2; it must never count as camera acceptance.
assert.ok(process.env.ORIGINAL_CAMERA_REFERENCE_ROOT,'Set ORIGINAL_CAMERA_REFERENCE_ROOT to the built, unmodified current Source assets');
const root=resolve(process.env.ORIGINAL_CAMERA_REFERENCE_ROOT);
const artifacts=process.env.UI_SMOKE_ARTIFACT_DIR||await mkdtemp(join(tmpdir(),'testcenter-source-camera-failure-'));
await mkdir(artifacts,{recursive:true});
const code='1:Own Unit:own-image';
const {modules}=QRCode.create(code,{errorCorrectionLevel:'L'});
const width=640,height=480,scale=2,left=33,top=33;
const luminance=Buffer.alloc(width*height,235);
for(let row=0;row<modules.size;row++)for(let col=0;col<modules.size;col++)if(modules.data[row*modules.size+col])
  for(let y=0;y<scale;y++)luminance.fill(16,(top+row*scale+y)*width+left+col*scale,(top+row*scale+y)*width+left+(col+1)*scale);
const cameraFile=`${artifacts}/owned-camera.y4m`;
await writeFile(cameraFile,Buffer.concat([Buffer.from(`YUV4MPEG2 W640 H480 F5:1 Ip A1:1 C420jpeg\nFRAME\n`),luminance,Buffer.alloc(width*height/2,128)]));
const server=createServer(async(req,res)=>{
  try {
    const path=new URL(req.url,'http://localhost').pathname;
    const file=resolve(root,!extname(path)?'index.html':'.'+path);
    if(relative(root,file).startsWith('..')) {res.writeHead(404).end();return;}
    res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.woff2':'font/woff2'})[extname(file)]||'application/octet-stream');
    res.end(await readFile(file));
  }catch{res.writeHead(404).end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream',`--use-file-for-fake-video-capture=${cameraFile}`]});
const evidence=[];
try {
  for(const theme of ['Primar','Sekundar','Erwachsene'])for(const viewportWidth of [1280,390]) {
    const context=await browser.newContext({viewport:{width:viewportWidth,height:viewportWidth===1280?720:844},locale:'de-DE'});
    await context.grantPermissions(['camera'],{origin:base});
    const page=await context.newPage();
    const unknown=[];
    let metadataRequests=0;
    const auth={token:'owned-reference-monitor',displayName:'Own Operator',loginName:'own-operator',groupLabel:'Own Group',customTexts:{},flags:[],claims:{testGroupMonitor:[{id:'own-group',label:'Own Group',workspaceId:'1',type:'testGroupMonitor',flags:{mode:'rw'}}]},groupToken:'owned-reference-group',viewSettings:{theme}};
    await page.route(`${base}/api/**`,async route=>{
      const path=decodeURIComponent(new URL(route.request().url()).pathname);
      let body;
      if(path==='/api/system/config')body={version:'19.0.0',customTexts:{},appConfig:{themeName:theme},veronaPlayerApiVersionMin:2,veronaPlayerApiVersionMax:6,iqbStandardResponseTypeMin:1,iqbStandardResponseTypeMax:5,xmlSchemaVersions:{},bruteForceProtection:[],broadcastingServiceUri:'',fileServiceUri:'',passwordMinLength:0,passwordPattern:''};
      else if(path==='/api/sys-check-mode')body=false;
      else if(path==='/api/session'||path==='/api/session/login')body=auth;
      else if(path===`/api/attachment/${code}/data`) {
        assert.equal(route.request().headers().authorization,'Bearer '+auth.token);
        metadataRequests++;
        body={attachmentId:code,personLabel:'Own Person',bookletLabel:'Own Booklet',variableId:'own-image',attachmentType:'capture-image',dataType:'missing',files:[]};
      }else if(path==='/api/asset-assignments')body={};
      else {
        unknown.push({method:route.request().method(),path});
        await route.fulfill({status:404,contentType:'application/json',body:'{"error":"unexpected_owned_reference_request"}'});
        return;
      }
      await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
    });
    await page.goto(base+'/#/r/login');
    const login=page.locator('input').first();
    // The floating Material label covers the input's center on mobile.
    // Its real container click focuses the associated control normally.
    await page.getByText('Anmeldename',{exact:true}).click();
    assert.equal(await login.evaluate(input=>document.activeElement===input),true);
    await login.pressSequentially('own-operator');
    await page.getByRole('button',{name:'Weiter',exact:true}).click();
    await page.goto(base+'/#/am/own-group/capture-image');
    for(const phase of ['entry','native-reload-and-route-reentry']) {
      let recoveryLanding;
      if(phase==='native-reload-and-route-reentry') {
        await Promise.all([page.waitForEvent('load'),page.getByRole('button',{name:'Schließen und neu laden',exact:true}).click()]);
        recoveryLanding=page.url();
        assert.equal(new URL(recoveryLanding).pathname,'/','The Source recovery button returns to its actual root');
        // Source reload deliberately returns to '/', rather than staying on
        // the capture route. Re-enter its ordinary URL with the same session.
        await page.goto(base+'/#/am/own-group/capture-image');
      }
      await page.getByRole('heading',{name:'Programmfehler: TypeError',exact:true}).waitFor({state:'visible'});
      await page.getByText('Fehlerdetails',{exact:true}).click();
      await page.getByText("Cannot read properties of undefined (reading 'nativeElement')",{exact:true}).waitFor({state:'visible'});
      await page.evaluate(()=>document.fonts.ready);
      await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
      const text=await page.locator('body').innerText();
      assert.ok(text.includes('Own Group'),'Intended monitor group must be rendered');
      assert.ok(text.includes('Halten Sie die Seite so in die Kamera'),'Intended capture page must be rendered');
      const media=await page.locator('#video').evaluate(video=>({width:video.videoWidth,height:video.videoHeight,stream:video.srcObject!==null}));
      assert.deepEqual(media,{width:0,height:0,stream:false});
      assert.equal(await page.locator('#canvas').isVisible(),false);
      assert.equal(await page.getByRole('button',{name:'Neue Aufnahme',exact:true}).isVisible(),false);
      assert.deepEqual(unknown,[],'Unknown API calls cannot silently produce a valid reference');
      await page.screenshot({path:`${artifacts}/${theme}-${viewportWidth}-${phase}.png`});
      await writeFile(`${artifacts}/${theme}-${viewportWidth}-${phase}.txt`,text);
      const row={theme,width:viewportWidth,phase,recoveryLanding,url:page.url(),error:"Cannot read properties of undefined (reading 'nativeElement')",media,metadataRequests,unknownRequests:unknown.length};
      evidence.push(row);console.log(JSON.stringify(row));
    }
    await context.close();
  }
  await writeFile(`${artifacts}/evidence.json`,JSON.stringify(evidence,null,2));
  console.log(JSON.stringify({result:'negative reference reproduced',states:evidence.length,scope:'Actual unmodified Source frontend startup and native reload both fail; zero successful camera states; own fixtures only, not Source backend or physical acceptance'}));
  process.exitCode=2;
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
