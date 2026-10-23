import assert from 'node:assert/strict';
import {readFile,writeFile,unlink} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const sourceURL=new URL('./smoke-ui.mjs',import.meta.url);
const source=await readFile(sourceURL,'utf8');
const digest=value=>createHash('sha256').update(value).digest('hex');
assert.equal(digest(source),"3e7013202716cb0dee80a6f69578fd3b1cf557a5a3abb674dd8a866949178cf2","The diagnostic must use the exact published smoke source.");
const edits=[["window.ownedSharedParameterClicks = [];", "window.ownedSharedParameterClicks = [];\n          window.ownedSharedParameterInputs=[];\n          for(const type of ['pointerdown','pointerup','click'])document.addEventListener(type,event=>{\n            window.ownedSharedParameterInputs.push({type,trusted:event.isTrusted,target:event.target.id,definition:activeDefinition,x:event.clientX,y:event.clientY,time:performance.now()});\n          },true);"], ["    const button=sharedParameterFrame.locator(\"#sharedParameterPublish\");\n    await button.click();", "    const button=sharedParameterFrame.locator(\"#sharedParameterPublish\");\n    const parentState=()=>page.locator(\"app-verona-player-host .verona-player-content\").evaluate(element=>({\n      inert:element.inert,rect:element.getBoundingClientRect().toJSON(),scrollY,activeTag:document.activeElement?.tagName,activeId:document.activeElement?.id}));\n    console.log('full_native_before_parent='+JSON.stringify(await parentState()));\n    console.log('full_native_before_button='+JSON.stringify(await button.evaluate(element=>({definition:element.ownerDocument.querySelector('#sharedParameterDefinition').textContent,\n      events:element.ownerDocument.defaultView.ownedSharedParameterInputs,rect:element.getBoundingClientRect().toJSON()}))));\n    await button.click();\n    console.log('full_native_after_parent='+JSON.stringify(await parentState()));\n    console.log('full_native_after_button='+JSON.stringify(await button.evaluate(element=>({definition:element.ownerDocument.querySelector('#sharedParameterDefinition').textContent,\n      events:element.ownerDocument.defaultView.ownedSharedParameterInputs,rect:element.getBoundingClientRect().toJSON()}))));"]];
let instrumented=source;
for(const [before,after]of edits){assert.equal(instrumented.split(before).length-1,1,'Each diagnostic injection must match exactly once.');instrumented=instrumented.replace(before,after);}
const target=new URL('./.owned-native-verona-diagnostic.mjs',import.meta.url);let created=false;
try{
 await writeFile(target,instrumented,{flag:'wx'});created=true;
 console.log('unchanged_smoke_source_sha256='+digest(source));
 const child=spawn(process.execPath,[fileURLToPath(target)],{stdio:'inherit',env:{...process.env,
  UI_SMOKE_STOP_AFTER_STEP:'participant-verona-player',UI_SMOKE_HEADFUL:'true',
  FIRST_SLICE_STORE:'sqlite',FIRST_SLICE_SQLITE_FILE:'./.data/owned-full-native-verona.sqlite'}});
 for(const signal of ['SIGTERM','SIGINT'])process.once(signal,()=>child.kill(signal));
 process.exitCode=await new Promise((done,reject)=>{child.once('error',reject);child.once('exit',code=>done(code??1));});
}finally{
 assert.equal(await readFile(sourceURL,'utf8'),source,'The published smoke must remain unchanged.');
 if(created)await unlink(target);
 console.log('owned_full_native_verona_diagnostic_retired=true');
}
