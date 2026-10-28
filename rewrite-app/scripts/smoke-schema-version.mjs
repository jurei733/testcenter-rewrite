import {readFile} from 'node:fs/promises';

// Run on the dependency-free Docker host. Both stores declare consecutive
// numeric migration versions; whitespace and object layout are not a contract.
export function expectedSchemaVersion(source) {
  const versions=Array.from(source.matchAll(/\bversion:\s*(\d+)\b/g),match=>Number(match[1]));
  if(!versions.length||versions.some((version,index)=>version!==index+1)) {
    throw new Error('Could not resolve the complete consecutive store migration inventory.');
  }
  return versions.at(-1);
}

export async function readExpectedSchemaVersion(url) {
  return expectedSchemaVersion(await readFile(url,'utf8'));
}
