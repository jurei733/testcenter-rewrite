import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
import {sourceNetwork} from './native-system-check-network-smoke.mjs';
const path = new URL('../apps/web/src/app/native-system-check/native-system-check-network.ts', import.meta.url);
const source = await readFile(path, 'utf8');
const {outputText} = ts.transpileModule(source, {compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022}});
const {runNativeNetwork, nativeNetworkBytes} = await import('data:text/javascript;base64,' + Buffer.from(outputText).toString('base64'));
for (const row of sourceNetwork.networkCases) test('actual Source UI network outcome: ' + row.id, async () => {
  const progress = [], calls = [], owner = new AbortController();
  const measure = async (direction, size) => {
    calls.push({direction, size});
    const failure = ['INVALID', 'SMALL'].includes(row.id) && direction === 'download';
    const disconnect = row.definition.fault === direction;
    return {size, duration: disconnect ? direction === 'download' ? 5000 : 10000 : 1000, error: failure || disconnect ? 'captured Source error outcome' : null};
  };
  if (row.outcome === 'dialog') {
    await assert.rejects(runNativeNetwork(row.configuration, owner.signal, value => progress.push(value), undefined, measure), TypeError);
    assert.deepEqual(calls, []); return;
  }
  const result = await runNativeNetwork(row.configuration, owner.signal, value => progress.push(value), undefined, measure);
  const expected = row.network.slice(0, 7);
  assert.deepEqual(result.entries.slice(0, 7).map(({value, ...entry}) => entry), expected.map(({value, ...entry}) => entry));
  for (const reference of expected) {
    if (!['nw-download', 'nw-upload'].includes(reference.id) || ['0/s', '204.80 bit/s', '51.20 bit/s'].includes(reference.value)) {
      assert.equal(result.entries.find(value => value.id === reference.id).value, reference.value);
    }
  }
  const packets = row.requests.filter(value => value.path.startsWith('/api/speed-test/')).map(value => value.method === 'GET'
    ? {direction: 'download', size: value.path.split('/').at(-1).split('&uid=')[0]} : {direction: 'upload', size: String(value.bodyBytes)});
  assert.deepEqual(calls, packets);
  if (row.id === 'DEFAULT') assert.ok(progress.every(value => Number.isNaN(value.average)));
});
test('retired native network work cannot publish a late sequence or continue uploading', async () => {
  const config = sourceNetwork.networkCases.find(row => row.id === 'ZERO.UP').configuration;
  const owner = new AbortController(); const progress = [], calls = [];
  await assert.rejects(runNativeNetwork(config, owner.signal, value => progress.push(value), undefined, async (direction, size) => {
    calls.push(direction); owner.abort(); return {size, duration: 1000, error: null};
  }), {name: 'AbortError'});
  assert.deepEqual(calls, ['download']); assert.equal(progress.filter(value => value.direction).length, 0);
});
test('Source report formatting keeps nonfinite averages and zero thresholds as0/s', () => {
  assert.equal(nativeNetworkBytes(Number.NaN, true) + '/s', '0/s');
  assert.equal(nativeNetworkBytes(0, true) + '/s', '0/s');
  assert.equal(nativeNetworkBytes(25.6, true) + '/s', '204.80 bit/s');
});
