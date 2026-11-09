import {mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {runNativeParticipantSmoke} from './smoke-native-participant.mjs';
import {fileURLToPath} from 'node:url';
import {isSupervisedSmokeChild,runSupervisedSmoke} from './supervised-smoke.mjs';
const root=process.env.UI_SMOKE_ARTIFACT_DIR?resolve(process.env.UI_SMOKE_ARTIFACT_DIR):await mkdtemp(join(tmpdir(),'owned-native-participant-ui-'));
if(!isSupervisedSmokeChild(import.meta.url))process.exitCode=await runSupervisedSmoke({entry:fileURLToPath(import.meta.url),artifactDirectory:join(root,'native-participant-supervision'),env:{...process.env,UI_SMOKE_ARTIFACT_DIR:root},phaseTimeoutMs:60000,totalTimeoutMs:480000});
else await runNativeParticipantSmoke(root);
