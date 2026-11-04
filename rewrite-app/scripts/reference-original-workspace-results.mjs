import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
assert.equal(process.env.UI_SMOKE_HEADFUL,'true');
assert.ok(!process.env.UI_SMOKE_BROWSER_CHANNEL,'The paired Source gate must use the lockfile Chromium.');
assert.equal(process.env.ORIGINAL_REFERENCE_CAPTURE_ONLY,'true');
assert.ok(process.env.ORIGINAL_PLAYER_REFERENCE_ROOT);
process.env.ORIGINAL_BROWSER_REFERENCE_ROOT=process.env.ORIGINAL_PLAYER_REFERENCE_ROOT;
await import('./smoke-original-workspace-results.mjs');
const output=resolve(process.env.UI_SMOKE_ARTIFACT_DIR),root=join(output,'original-workspace-results');
const functional=JSON.parse(await readFile(join(root,'results.json'),'utf8'));
const visual=JSON.parse(await readFile(join(root,'visual','visuals.json'),'utf8'));
assert.equal(visual.manifest.appCommit,process.env.GITHUB_SHA);
assert.equal(visual.results.length,48);
assert.ok(visual.results.every(row=>row.sourceSelfControl.differingPixels===0&&row.comparison.differingPixels===0));
await writeFile(join(output,'workspace-results.json'),JSON.stringify({...functional,visualProof:{manifest:visual.manifest,source:visual.source,provenance:visual.provenance,
 comparisons:visual.results.length,sourceSelfControls:visual.results.length,differingPixels:0,scope:visual.scope}},null,2));
