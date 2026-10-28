import assert from 'node:assert/strict';
import test from 'node:test';
import {spawnSync} from 'node:child_process';
import {mkdtemp, mkdir, readFile, readdir, rm, writeFile} from 'node:fs/promises';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const project = fileURLToPath(new URL('..', import.meta.url));
const scripts = JSON.parse(await readFile(join(project, 'package.json'), 'utf8')).scripts;
const compilerPackage = fileURLToPath(import.meta.resolve('@angular/compiler-cli/package.json'));
const compiler = JSON.parse(await readFile(compilerPackage, 'utf8'));
const executable = resolve(dirname(compilerPackage), compiler.bin.ngc);
const arguments_ = scripts['typecheck:web'].split(' ');
assert.deepEqual(arguments_, ['ngc', '-p', 'apps/web/tsconfig.app.json', '--noEmit']);

for (const [name, body, template, diagnostic] of [
  ['valid', "readonly label = 'owned';", '{{ label }}', null],
  ['typescript', "readonly label: number = 'owned';", '{{ label }}', /not assignable to type 'number'/],
  ['template', "readonly label = 'owned';", '{{ missingTemplateMember }}', /missingTemplateMember.*does not exist/],
  ['injection', "readonly label = 'owned'; constructor(value: string) {}", '{{ label }}', /No suitable injection token/]
]) test(`the real no-emit Angular compiler checks ${name} without replacing output`, async t => {
  // Inside the project only to resolve the actual locked node_modules. The
  // fixture inherits the app's real strict TypeScript/template/DI settings.
  const scratch = await mkdtemp(join(project, '.typecheck-control-'));
  t.after(() => rm(scratch, {recursive:true, force:true}));
  await mkdir(join(scratch, 'out'));
  const sentinel = 'owned production output must survive\n';
  await writeFile(join(scratch, 'out/keep.js'), sentinel);
  await writeFile(join(scratch, 'case.ts'), `import {Component} from '@angular/core';
    @Component({selector:'owned-probe', standalone:true, template:${JSON.stringify(template)}})
    export class Probe { ${body} }`);
  const config = join(scratch, 'tsconfig.json');
  await writeFile(config, JSON.stringify({extends:join(project, 'apps/web/tsconfig.json'),
    compilerOptions:{outDir:join(scratch, 'out')}, files:['case.ts'], include:[]}));
  const args = [...arguments_.slice(1)]; args[1] = config;
  const result = spawnSync(process.execPath, [executable, ...args], {
    cwd:project, encoding:'utf8', timeout:45_000, maxBuffer:4*1024*1024
  });
  assert.equal(result.error, undefined, String(result.error));
  assert.equal(result.signal, null);
  const output = result.stdout + result.stderr;
  if (diagnostic) { assert.equal(result.status, 1, output); assert.match(output, diagnostic); }
  else assert.equal(result.status, 0, output);
  assert.equal(await readFile(join(scratch, 'out/keep.js'), 'utf8'), sentinel);
  assert.deepEqual((await readdir(scratch, {recursive:true})).sort(),
    ['case.ts', 'out', 'out/keep.js', 'tsconfig.json']);
});
