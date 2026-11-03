import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {monitorVisualRuntimeMaterial} from './native-monitor-visual-runtime.mjs';

const registry=JSON.parse(await readFile(new URL('./fixtures/ci-browser-native-cohorts-faacd429b74eae7024b0c01716c6cdb8b45fb09b5bcf4aa70d53dd93862b8a20.json',import.meta.url),'utf8'));
const oracle=registry.records[0].nativeOracle;
for(const version of [3,4])test('Monitor rendering uses the authenticated format'+version+' reference without relabeling its native context',()=>{
  const bundle=version===3?oracle:{version:4,nativeOracle:oracle};
  const before=JSON.stringify(bundle),material=monitorVisualRuntimeMaterial(bundle);
  assert.equal(material,oracle.runtimeMaterial);assert.equal(material.material.browserVersion,'147.0.7727.15');
  assert.equal(JSON.stringify(bundle),before);
});
for(const version of [3,4])test('Monitor rendering rejects changed material in format'+version,()=>{
  const changed=structuredClone(oracle);changed.runtimeMaterial.material.browserVersion='999.0.0.0';
  assert.throws(()=>monitorVisualRuntimeMaterial(version===3?changed:{version:4,nativeOracle:changed}));
});
for(const bundle of [undefined,{version:2,runtimeMaterial:oracle.runtimeMaterial},{version:3},{version:4,runtimeMaterial:oracle.runtimeMaterial}])
  test('Monitor rendering rejects missing or unqualified references: '+JSON.stringify(bundle?.version),()=>assert.throws(()=>monitorVisualRuntimeMaterial(bundle)));
