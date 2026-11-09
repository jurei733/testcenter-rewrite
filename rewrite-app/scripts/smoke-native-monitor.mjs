import {mkdir,mkdtemp,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {isSupervisedSmokeChild,runSupervisedSmoke,reportSmokePhase} from './supervised-smoke.mjs';
const artifactRoot=process.env.UI_SMOKE_ARTIFACT_DIR?resolve(process.env.UI_SMOKE_ARTIFACT_DIR):await mkdtemp(join(tmpdir(),'owned-native-monitor-ui-'));
if(!isSupervisedSmokeChild(import.meta.url)){
 process.exitCode=await runSupervisedSmoke({entry:fileURLToPath(import.meta.url),artifactDirectory:join(artifactRoot,'native-monitor-supervision'),env:{...process.env,UI_SMOKE_ARTIFACT_DIR:artifactRoot},phaseTimeoutMs:60000,totalTimeoutMs:480000});
}else{
 await mkdir(artifactRoot,{recursive:true});reportSmokePhase('launch-all-required-native-suites');
 const suites=[
  {name:'monitor',entry:'run-native-monitor-ui-smoke.mjs',output:artifactRoot,supervision:'native-monitor-ui-supervision'},
  {name:'participant',entry:'run-native-participant-smoke.mjs',output:artifactRoot,supervision:'native-participant-supervision'},
  {name:'websocket',entry:'smoke-native-websocket.mjs',output:join(artifactRoot,'native-websocket'),supervision:'native-websocket-supervision'}
 ];
 // Separate API stores and browser contexts; every suite remains mandatory.
 // Each watchdog catches its own stalled phase, even while siblings progress.
 const settled=await Promise.allSettled(suites.map(async suite=>({
  name:suite.name,exitCode:await runSupervisedSmoke({entry:resolve('scripts',suite.entry),
   artifactDirectory:join(artifactRoot,suite.supervision),env:{...process.env,UI_SMOKE_ARTIFACT_DIR:suite.output},
   phaseTimeoutMs:60000,totalTimeoutMs:480000,forwardPhases:suite.name})
 })));
 const results=settled.map((result,index)=>result.status==='fulfilled'?result.value:{name:suites[index].name,exitCode:1,supervisionFailed:true});
 const success=results.every(result=>result.exitCode===0);
 await writeFile(join(artifactRoot,'native-suite-results.json'),JSON.stringify({success,requiredSuites:results,allSuitesRequired:true,
  phaseTimeoutMs:60000,totalTimeoutMs:480000,visualParityProven:false},null,2)+'\n');
 process.exitCode=success?0:1;if(success)reportSmokePhase('all-required-native-suites-passed');
}
