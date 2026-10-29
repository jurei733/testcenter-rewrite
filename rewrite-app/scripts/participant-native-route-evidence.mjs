import {mkdtemp, mkdir, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {nativeTabFailureEvidence} from './participant-native-tab-readiness.mjs';

export async function nativeRouteArtifactDirectory(destination = process.env.UI_SMOKE_ARTIFACT_DIR) {
  const directory = destination ? resolve(destination) : await mkdtemp(join(tmpdir(), 'testcenter-native-route-'));
  await mkdir(directory, {recursive: true, mode: 0o700});
  return directory;
}

/** Match the workflow's exact failure.json/png paths. Never collect scratch
 * stores, bearer headers, request bodies, error payloads or document text. */
export async function writeNativeRouteFailure({directory, page, error, checks, pending, origin}) {
  await page?.screenshot({path: join(directory, 'failure.png'), fullPage: true}).catch(() => {});
  await writeFile(join(directory, 'failure.json'), JSON.stringify(nativeTabFailureEvidence(error, checks, pending, origin), null, 2));
}

// Whitelist focus diagnostics separately from stores, bearer headers, request
// bodies and document text. Even unexpected page-provided keys are discarded.
export function nativeFocusEvidence(probe, events) {
  const version=value=>typeof value==='string'&&/^v?\d+(?:\.\d+){1,3}$/.test(value)?value:'unknown';
  const eventTypes=new Set(['initial','focus','blur','visibilitychange','player-focus']);
  return {
    platform:['linux','darwin','win32'].includes(probe.platform)?probe.platform:'unknown',
    arch:['x64','arm64'].includes(probe.arch)?probe.arch:'unknown',
    node:version(probe.node),browser:version(probe.browser),
    headless:typeof probe.headless==='boolean'?probe.headless:null,
    ...(typeof probe.playerEnabledAtVisibility==='boolean'?{playerEnabledAtVisibility:probe.playerEnabledAtVisibility}:{}),
    focusSaveContents:(Array.isArray(probe.focusSaveContents)?probe.focusSaveContents:[]).filter(value=>value==='HAS'||value==='HAS_NOT').slice(0,100),
    events:(Array.isArray(events)?events:[]).filter(event=>event&&eventTypes.has(event.type)&&Number.isFinite(event.at)&&event.at>=0&&typeof event.hasFocus==='boolean'&&typeof event.hidden==='boolean').slice(0,100).map(event=>({
      type:event.type,at:event.at,hasFocus:event.hasFocus,hidden:event.hidden,
      ...(typeof event.trusted==='boolean'?{trusted:event.trusted}:{}),
      ...(event.type==='player-focus'&&(typeof event.hasPlayerFocus==='boolean'||event.hasPlayerFocus===null)?{hasPlayerFocus:event.hasPlayerFocus}:{})
    }))
  };
}
