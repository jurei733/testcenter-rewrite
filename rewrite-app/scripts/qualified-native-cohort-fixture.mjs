import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {cohortDigest} from './ci-browser-cohort-certificates.mjs';

function fixtureBindings(record){
 const bindings=Object.fromEntries(['lockSha256','collectorSha256','nodeVersionFileSha256','nodeNormalizerSha256','originalFrontendCommit'].map(key=>[key,record.bindings[key]]));
 bindings.nodeVersion=record.nativeOracle.runtimeMaterial.material.nodeVersion;
 return Object.freeze(bindings);
}

/** Immutable actual run40571016364 fixtures, not current-input admission. */
export async function qualifiedNativeCohortFixture(){
 const bytes=await readFile(new URL('./fixtures/ci-browser-native-cohorts.json',import.meta.url));
 assert.equal(cohortDigest(bytes),'566c6c86c10a04fd111e3e008d64c35138b5c230054a7ec1d211c913d445965b',
  'Historical native qualification bytes must remain unchanged');
 const registry=JSON.parse(bytes.toString('utf8'));
 return {registry,bindings:fixtureBindings(registry.records[0])};
}

/** Immutable qualified84 run41113160664 and its actual input bytes. This is a
 * historical positive fixture, never admission of a later working-tree lock. */
export async function qualifiedLockCohortFixture(){
 const lock='84a86833d8703b3b830024dcb04fb0b5ca138fe90af3361a9906180fbcc8ac30';
 const name='ci-browser-native-cohorts-'+lock+'.json';
 const bytes=await readFile(new URL('./fixtures/'+name,import.meta.url));
 assert.equal(cohortDigest(bytes),'9613edb155ee830daf338d7f6f9251f09a77adb8fca3a390c138687f18a32159');
 const lockBytes=await readFile(new URL('./fixtures/ci-browser-qualified-lock-'+lock+'.json',import.meta.url));assert.equal(cohortDigest(lockBytes),lock);
 const registry=JSON.parse(bytes);
 return{registry,bindings:fixtureBindings(registry.records[0]),name,bytes,lockBytes};
}

/** Positive evidence for the November 360 and 114 captures with their measured lock. */
export async function qualifiedNovemberCohortFixture(){
 const lock='20f914213a99024d838032f412219b5e1bf0e4c1a4726789c8f7010767c196ea';
 const bytes=await readFile(new URL('./fixtures/ci-browser-native-cohorts-'+lock+'.json',import.meta.url));
 assert.equal(cohortDigest(bytes),'093f6c006c51542d0c761f8757b215e6faba836ce420577ec7c34577f257956c');
 const registry=JSON.parse(bytes);
 const bindings=fixtureBindings(registry.records[0]);
 assert.equal(bindings.lockSha256,lock);
 return {registry,bindings};
}
