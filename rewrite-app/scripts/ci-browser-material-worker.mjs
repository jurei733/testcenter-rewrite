import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {isSupervisedSmokeChild,reportSmokePhase} from './supervised-smoke.mjs';
assert.ok(isSupervisedSmokeChild(import.meta.url),'Runtime material capture requires its owned process supervisor.');
try{
 reportSmokePhase('material-capture');
 execFileSync('/usr/bin/xvfb-run',['--auto-servernum',process.execPath,fileURLToPath(new URL('./ci-browser-material-profile.mjs',import.meta.url)),'measure'],{stdio:'inherit'});
 reportSmokePhase('material-capture-complete');
}catch{console.error('Owned runtime material capture failed.');process.exitCode=1;}
