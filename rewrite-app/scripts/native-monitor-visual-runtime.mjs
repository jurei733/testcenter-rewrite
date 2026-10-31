import assert from 'node:assert/strict';
import {validateRuntimeMaterial} from './ci-browser-material-contract.mjs';

// The runtime action authenticates and restores the entire bundle first.
// Read its rendering reference without rewriting a certified oracle's context.
export function monitorVisualRuntimeMaterial(bundle) {
  assert.ok(bundle?.version===3||bundle?.version===4,'A verified native rendering bundle is required');
  return validateRuntimeMaterial(bundle.version===4?bundle.nativeOracle?.runtimeMaterial:bundle.runtimeMaterial);
}
