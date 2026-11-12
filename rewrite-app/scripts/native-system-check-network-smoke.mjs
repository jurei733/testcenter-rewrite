import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {systemCheckXml} from './native-system-check-fixture.mjs';
import {raceWithSmokeDeadline} from './smoke-deadline.mjs';
import {waitForFiniteDocumentAnimations} from './finite-animation-ready.mjs';
const fixture = new URL('../test-fixtures/original-testcenter/source-workspace-results/native-syscheck-network-ui/', import.meta.url);
const manifest = JSON.parse(await readFile(new URL('manifest.json', fixture)));
for (const [path, hash] of Object.entries(manifest.files)) {
  assert.match(path, /^[a-z.-]+$/); assert.equal(createHash('sha256').update(await readFile(new URL(path, fixture))).digest('hex'), hash);
}
export const sourceNetwork = JSON.parse(await readFile(new URL('observations.json', fixture)));
assert.equal(sourceNetwork.actualSourceBackend, true); assert.equal(sourceNetwork.actualSourceFrontend, true);
assert.equal(sourceNetwork.networkCases.length, 7);
export async function prepareNativeNetworkChecks(setup) {
  for (const row of sourceNetwork.networkCases) await setup.upload('network-' + row.id.toLowerCase() + '.xml', systemCheckXml('SysCheck',
    '<Metadata><Id>R102.' + row.id + '</Id><Label>Owned network ' + row.id + '</Label></Metadata><Config savekey="owned-key">' + row.definition.speed + '<Q id="feedback" type="string" prompt="Owned feedback"/></Config>'));
}
export async function runNativeNetworkChecks({page, base, server, mark, reportBodies}) {
  let requestId = 0;
  const requests = [];
  const observe = request => {const path = new URL(request.url()).pathname; if (path.startsWith('/speed-test/')) requests.push({method: request.method(), path, bodyBytes: request.postDataBuffer()?.length ?? 0});};
  page.on('request', observe);
  const normalize = rows => rows.map(value => ({method: value.method, path: value.path.replace(/^\/api/, '').replace(/&uid=\d+$/, '&uid=[cache-buster]'), bodyBytes: value.bodyBytes}));
  const configure = async fault => {
    const id = ++requestId;
    let listener;
    try {
      await raceWithSmokeDeadline(new Promise(resolve => {
        listener = message => {if (message?.configured && message.id === id) resolve();};
        server.on('message', listener); server.send({nativeNetworkFault: fault, id});
      }), 5000, () => {throw Error('Owned transport fault configuration timed out.');});
    } finally {server.off('message', listener);}
  };
  try {
    for (const row of sourceNetwork.networkCases) {
      const firstRequest = requests.length;
      await configure(row.definition.fault ?? '');
      await page.goto(base + '/app/native-start');
      await page.locator('[data-cy="syscheck-R102.' + row.id + '"]').click();
      await page.locator('#syscheck-next-step:not([disabled])').waitFor();
      await page.locator('#syscheck-next-step').click(); await page.waitForURL(/\/n$/);
      if (row.outcome === 'dialog') {
        const dialog = page.locator('mat-dialog-container'); await dialog.waitFor(); await waitForFiniteDocumentAnimations(page);
        assert.equal(await page.locator('#syscheck-next-step').isEnabled(), row.networkState.canContinue);
        assert.equal((await dialog.innerText()).replace(/\s+/g, ' ').trim(), row.networkState.dialog.replace(/\s+/g, ' ').trim());
        await dialog.locator('[data-cy="close"]').click(); await page.waitForURL(/\/native-start$/);
      } else {
        await page.locator('#systemCheckNetworkStatus').filter({hasText: 'Die folgenden Netzwerkeigenschaften wurden festgestellt:'}).waitFor();
        assert.equal(await page.locator('#syscheck-next-step').isEnabled(), row.networkState.canContinue);
        await page.locator('#syscheck-next-step').click(); await page.waitForURL(/\/q$/); await page.locator('#feedback').fill('Owned network feedback');
        await page.locator('#syscheck-next-step').click(); await page.waitForURL(/\/r$/);
        const before = reportBodies.length;
        await page.locator('#saveSystemCheckReportButton').click(); await page.locator('#globalConfirmationTitle').waitFor();
        const actual = reportBodies[before].network.slice(0, 7), expected = row.network.slice(0, 7);
        assert.deepEqual(actual.map(({value, ...entry}) => entry), expected.map(({value, ...entry}) => entry));
        for (let index = 0; index < expected.length; index++) {
          const reference = expected[index];
          const liveRate = ['nw-download', 'nw-upload'].includes(reference.id) && !['0/s', '204.80 bit/s', '51.20 bit/s'].includes(reference.value);
          if (liveRate) assert.match(actual[index].value, /^\d+\.\d{2} (?:bit|kbit|Mbit|Gbit|Tbit)\/s$/);
          else assert.equal(actual[index].value, reference.value);
        }
        await page.locator('#globalConfirmationCancelButton').click(); await page.waitForURL(/\/native-start$/);
      }
      assert.deepEqual(normalize(requests.slice(firstRequest)), normalize(row.requests.filter(value => value.path.startsWith('/api/speed-test/'))));
      mark('native-system-check-source-network-' + row.id.toLowerCase());
    }
  } finally {page.off('request', observe); await configure('');}
}
