import assert from 'node:assert/strict';
import {readFile,writeFile,rm,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import {join} from 'node:path';
const source='scripts/smoke-original-player-exit.mjs';
const expected='3e793afd93b817395f449bfabcb47dd439be208024487f92483a11457ffb1435';
const hash=value=>createHash('sha256').update(value).digest('hex');
const bytes=await readFile(source);assert.equal(hash(bytes),expected);
const temporary=`scripts/.owned-exit-fallback-probe-${process.pid}.mjs`;
let text=bytes.toString('utf8');
const replace=(before,after)=>{assert.equal(text.split(before).length,2,'Exact bounded diagnostic insertion');text=text.replace(before,after);};
replace('const events=[];window.__ownedExitInputEvents=events;',`const events=[];window.__ownedExitInputEvents=events;
    const all=[];window.__ownedExitAllNativeEvents=all;
    const record=event=>{
      const target=event.target instanceof Element?event.target:null;
      all.push({type:event.type,id:target?.id??'',tag:target?.tagName??'',trusted:event.isTrusted,
        x:event.clientX,y:event.clientY,at:performance.now(),focused:document.hasFocus(),visibility:document.visibilityState,
        active:document.activeElement?.id??'',targetText:target?.textContent?.trim().slice(0,100)??''});
      if(all.length>100)all.shift();
    };
    for(const type of ['pointerdown','pointerup','pointercancel','click','focus','blur'])window.addEventListener(type,record,true);
`);
replace('inputEvents:window.__ownedExitInputEvents??[],',
 'allNativeEvents:window.__ownedExitAllNativeEvents,inputEvents:window.__ownedExitInputEvents??[],');
const end=`    await page.locator("#originalParticipantStarter mat-card").first().waitFor();
    if(traceFailures)await context.tracing.stop();
    await context.close();activePage=activeContext=undefined;
    console.log("original_player_exit=missing-lazy-bundle:passed");`;
replace(end,`    await page.locator("#originalParticipantStarter mat-card").first().waitFor();
    await writeFile(join(artifacts,'fallback-native-events.json'),JSON.stringify(await page.evaluate(()=>({
      events:window.__ownedExitAllNativeEvents,observed:window.__ownedExitInputEvents})),null,2));
    if(traceFailures)await context.tracing.stop();
    await context.close();activePage=activeContext=undefined;
    console.log("original_player_exit=missing-lazy-bundle:passed");`);
if(process.argv[2]==='--validate'){
 console.log('validated_source_sha256='+expected+'; diagnostic_copy_sha256='+hash(text));
}else{
assert.ok(process.env.UI_SMOKE_ARTIFACT_DIR);await mkdir(process.env.UI_SMOKE_ARTIFACT_DIR,{recursive:true});
try{
 await writeFile(temporary,text,{flag:'wx'});
 const code=await new Promise((done,reject)=>{const child=spawn(process.execPath,[temporary],{stdio:'inherit',env:{...process.env,UI_SMOKE_HEADFUL:'true'}});
  child.once('error',reject);child.once('close',(code,signal)=>done(code??(signal?1:0)));});
 assert.equal(hash(await readFile(source)),expected,'Original test stays unchanged');
 process.exitCode=code;
}finally{
 await rm(temporary,{force:true});
 assert.equal(hash(await readFile(source)),expected);
 console.log('owned_exit_diagnostic_copy=retired; original_test_sha256='+expected);
}

}
