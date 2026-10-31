import assert from 'node:assert/strict';
import test from 'node:test';
import {qualifiedNativeCohortFixture} from './qualified-native-cohort-fixture.mjs';
import {canonicalMaterial} from './ci-browser-material-contract.mjs';
import {cohortDigest} from './ci-browser-cohort-certificates.mjs';
import {validateObservedSourceFamily,validateObservedNativeBindings} from './observed-native-source-family.mjs';
const {registry}=await qualifiedNativeCohortFixture();
const [older,newer]=registry.records.map(record=>record.nativeOracle.runtimeMaterial);
const seal=profile=>{profile.materialSha256=cohortDigest(canonicalMaterial(profile.material));return profile;};

test('actual historical OS cohorts have distinct material but retain the identical qualified Source family',()=>{
  assert.notEqual(older.materialSha256,newer.materialSha256);
  assert.equal(validateObservedSourceFamily(older,newer),older);
  assert.equal(validateObservedSourceFamily(newer,older),newer);
});
test('re-sealing altered Source views, font catalog, browser, Node, collector or screen cannot grant measurement qualification',()=>{
  for(const change of [p=>p.material.views[0].pixelSha256='e'.repeat(64),p=>p.material.fontCatalogSha256='e'.repeat(64),
    p=>p.material.browserVersion='999.0.0.0',p=>p.material.nodeVersion='v22.23.5',
    p=>p.material.scriptSha256='e'.repeat(64),p=>p.material.screen.width++]){
    const profile=structuredClone(newer);change(profile);seal(profile);
    assert.throws(()=>validateObservedSourceFamily(profile,newer),/Observed cohort changed qualified Source/);
  }
});
test('diagnostic profiles, changed material digests or incomplete required file sets cannot be measured as native production material',()=>{
  for(const change of [p=>p.qualification='diagnostic-only',p=>p.materialSha256='f'.repeat(64),
    p=>{p.material.files=p.material.files.filter(row=>row.name!=='chromium/chrome');seal(p);},
    p=>p.context.platform='darwin']){
    const profile=structuredClone(newer);change(profile);assert.throws(()=>validateObservedSourceFamily(profile,newer));
  }
});

test('only a genuinely measured new lock may differ from immutable measurement bindings; all Source inputs remain fixed',()=>{
 const qualified={lockSha256:'a'.repeat(64),collectorSha256:'b'.repeat(64),nodeVersionFileSha256:'c'.repeat(64),nodeNormalizerSha256:'d'.repeat(64),originalFrontendCommit:'e'.repeat(40),nodeVersion:'v22.23.4'};
 const measured={...qualified,lockSha256:'f'.repeat(64)};
 assert.equal(validateObservedNativeBindings(measured,qualified),measured);
 for(const key of Object.keys(qualified).filter(key=>key!=='lockSha256'))assert.throws(()=>validateObservedNativeBindings({...measured,[key]:'changed'},qualified),/changed the immutable qualified/);
 assert.throws(()=>validateObservedNativeBindings({...measured,lockSha256:'invalid'},qualified));
 assert.throws(()=>validateObservedNativeBindings({...measured,extra:'unqualified'},qualified));
});
