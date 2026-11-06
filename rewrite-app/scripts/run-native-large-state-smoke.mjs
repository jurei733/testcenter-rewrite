import {resolve} from 'node:path';
import {runNativeParticipantSmoke} from './smoke-native-participant.mjs';
await runNativeParticipantSmoke(resolve(process.env.UI_SMOKE_ARTIFACT_DIR||'.data/native-large-state'),{largeStateOnly:true});
