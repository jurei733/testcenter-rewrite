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
