import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {cohortDigest} from './ci-browser-cohort-certificates.mjs';

/** Immutable actual run40571016364 fixtures, not current-input admission. */
export async function qualifiedNativeCohortFixture(){
 const bytes=await readFile(new URL('./fixtures/ci-browser-native-cohorts.json',import.meta.url));
 assert.equal(cohortDigest(bytes),'566c6c86c10a04fd111e3e008d64c35138b5c230054a7ec1d211c913d445965b',
  'Historical native qualification bytes must remain unchanged');
 const registry=JSON.parse(bytes.toString('utf8')),record=registry.records[0];
 const bindings=Object.fromEntries(['lockSha256','collectorSha256','nodeVersionFileSha256','nodeNormalizerSha256','originalFrontendCommit'].map(key=>[key,record.bindings[key]]));
 bindings.nodeVersion=record.nativeOracle.runtimeMaterial.material.nodeVersion;
 return {registry,bindings:Object.freeze(bindings)};
}
