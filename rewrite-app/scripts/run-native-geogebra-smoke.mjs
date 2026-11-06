import {runNativeParticipantSmoke} from './smoke-native-participant.mjs';
import {resolve} from 'node:path';
await runNativeParticipantSmoke(resolve(process.env.UI_SMOKE_ARTIFACT_DIR||'.data/native-geogebra-smoke'),{geoGebraOnly:true});
