import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';
import {expectedSchemaVersion,readExpectedSchemaVersion} from './smoke-schema-version.mjs';

for(const [store,variable] of [['sqlite','sqliteMigrations'],['postgres','migrations']])test(store+': actual smoke expectation matches every migration independently parsed by TypeScript',async()=>{
  const url=new URL('../packages/'+store+'-store/src/index.ts',import.meta.url),source=await readFile(url,'utf8');
  const file=ts.createSourceFile('store.ts',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
  const declaration=file.statements.filter(ts.isVariableStatement).flatMap(s=>s.declarationList.declarations).find(d=>ts.isIdentifier(d.name)&&d.name.text===variable);
  assert.ok(declaration&&ts.isArrayLiteralExpression(declaration.initializer));
  const versions=declaration.initializer.elements.map(element=>{
    assert.ok(ts.isObjectLiteralExpression(element));
    const field=element.properties.find(p=>ts.isPropertyAssignment(p)&&p.name.getText(file)==='version');
    assert.ok(field&&ts.isNumericLiteral(field.initializer));return Number(field.initializer.text);
  });
  assert.ok(versions.length>1);assert.deepEqual(versions,Array.from({length:versions.length},(_,i)=>i+1));
  assert.equal(await readExpectedSchemaVersion(url),versions.at(-1));
  const compact=declaration.initializer.elements.map(element=>element.getText(file).replace(/\s+/g,' ')).join(',');
  assert.equal(expectedSchemaVersion(compact),versions.at(-1));
});
test('compact follow-up migration is included rather than returning the previous multiline version',()=>{
  const before='{\n version: 1,\n name: "first"\n}';
  assert.equal(expectedSchemaVersion(before),1);
  assert.equal(expectedSchemaVersion(before+', {version:2,name:"next"}'),2);
  assert.equal(expectedSchemaVersion('{ version:\r\n1, name:"first" },{version: 2,name:"next"}'),2);
});
test('missing, duplicate, skipped or reordered migration declarations fail closed',()=>{
  for(const source of ['', 'version: 0', 'version: 2', 'version: 1, version: 1', 'version: 1, version: 3', 'version: 2, version: 1'])assert.throws(()=>expectedSchemaVersion(source),/complete consecutive/);
});
