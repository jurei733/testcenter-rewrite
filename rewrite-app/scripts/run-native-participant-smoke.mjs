import {mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {runNativeParticipantSmoke} from './smoke-native-participant.mjs';
const root=process.env.UI_SMOKE_ARTIFACT_DIR?resolve(process.env.UI_SMOKE_ARTIFACT_DIR):await mkdtemp(join(tmpdir(),'owned-native-participant-ui-'));
await runNativeParticipantSmoke(root);
