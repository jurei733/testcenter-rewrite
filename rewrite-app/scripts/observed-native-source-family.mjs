import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {nativeContext,validateManifest} from './ci-browser-system.mjs';
import {validateRuntimeMaterial} from './ci-browser-material-contract.mjs';
import {cohortDigest,validateCohortFamily,readCohortBindings} from './ci-browser-cohort-certificates.mjs';
import {qualifiedNativeCohortFixture,qualifiedLockCohortFixture} from './qualified-native-cohort-fixture.mjs';

/** A new OS inventory needs its own measured oracle, with the same Source inputs. */
export function validateObservedSourceFamily(observed,qualified){
  validateRuntimeMaterial(observed);validateRuntimeMaterial(qualified);
  const comparable=profile=>{
    const material=profile.material;
    return {source:material.source,collector:material.scriptSha256,node:material.nodeVersion,
      browser:material.browserVersion,fonts:material.fontCatalogSha256,screen:material.screen,views:material.views};
  };
  assert.deepEqual(comparable(observed),comparable(qualified),'Observed cohort changed qualified Source pixels, fonts or browser inputs');
  return observed;
}

/** A measured new lock may differ only in the lock binding. It receives no
 * production certificate or loader admission from this comparison. */
export function validateObservedNativeBindings(observed,qualified){
  assert.deepEqual(Object.keys(observed).sort(),Object.keys(qualified).sort());
  assert.match(observed.lockSha256,/^[a-f0-9]{64}$/);
  for(const key of Object.keys(qualified))if(key!=='lockSha256')
    assert.equal(observed[key],qualified[key],'Observed '+key+' changed the immutable qualified Source measurement input');
  return observed;
}

export async function verifyObservedNativeSourceFamily(root){
  const context=await nativeContext(root),bindings=await readCohortBindings(root);
  const historical=await qualifiedNativeCohortFixture(),qualified=await qualifiedLockCohortFixture();
  const records=validateCohortFamily(historical.registry,qualified.registry,qualified.bindings);
  validateObservedNativeBindings(bindings,qualified.bindings);
  const manifest=JSON.parse(await readFile(join(process.env.RUNNER_TEMP,'native-browser-system/manifest.json'),'utf8'));
  assert.equal(context.lockSha256,bindings.lockSha256);
  validateManifest(manifest,context,manifest.beforeInventory,{format:3,
    collectorSha256:bindings.collectorSha256,materialSha256:manifest.runtimeMaterial?.materialSha256});
  for(const record of records)validateObservedSourceFamily(manifest.runtimeMaterial,record.nativeOracle.runtimeMaterial);
  const previous=records.find(record=>record.id===context.imageVersion);
  if(previous){
    assert.equal(manifest.beforeInventory,previous.nativeOracle.beforeInventory,'A previously qualified cohort changed its base inventory');
    assert.deepEqual(manifest.runtimeMaterial.material,previous.nativeOracle.runtimeMaterial.material,'A previously qualified cohort changed its full material');
  }
  return {measurementOnly:true,productionAdmission:false,newCertificatePrepared:false,
    context,beforeInventorySha256:cohortDigest(manifest.beforeInventory),afterInventorySha256:cohortDigest(manifest.afterInventory),
    sourceFamilyEqual:true,previouslyQualifiedImage:!!previous,materialFiles:manifest.runtimeMaterial.material.files.length,
    materialSha256:manifest.runtimeMaterial.materialSha256,packages:manifest.packages.length};
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{console.log(JSON.stringify(await verifyObservedNativeSourceFamily(process.cwd())));}
  catch(error){console.error(error.message);process.exitCode=1;}
}
