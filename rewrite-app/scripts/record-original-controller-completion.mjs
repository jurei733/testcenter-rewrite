import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import ts from 'typescript';

const repository = resolve(process.argv[2] ?? '../../testcenter');
const originalCommit = 'ee2ab9ab64bd91209ef8534bbe6005838024e46d';
const definitions = {
  service: {
    path: 'frontend/src/app/test-controller/services/test-controller.service.ts',
    className: 'TestControllerService',
    members: ['bufferClosed$', 'unitDataPartsBuffer$', 'unitStateBuffer$', 'testStateBuffer$',
      'bufferFlushEventsOnClose$', 'subscriptions', 'setupUnitDataPartsBuffer', 'setupUnitStateBuffer',
      'setupTestStateBuffer', 'createClosingSignal', 'closeAllBuffers', 'destroySubscription',
      'addToTestStateBuffer', 'terminateTest', 'canDeactivateUnit']
  },
  state: {
    path: 'frontend/src/app/test-controller/util/test-state.util.ts',
    className: 'TestStateUtil', members: ['sort', 'sortDataParts']
  },
  controller: {
    path: 'frontend/src/app/test-controller/components/test-controller/test-controller.component.ts',
    className: 'TestControllerComponent', members: ['handleCommand']
  },
  command: {
    path: 'frontend/src/app/test-controller/services/command.service.ts',
    className: 'CommandService', members: ['commandToString']
  }
};
const sources = {};
let commandSubscription, stateSubscription;
for (const [name, definition] of Object.entries(definitions)) {
  const source = execFileSync('git', ['-C', repository, 'show', `${originalCommit}:${definition.path}`], { encoding: 'utf8' });
  const ast = ts.createSourceFile(definition.path, source, ts.ScriptTarget.Latest, true);
  const declaration = ast.statements.find(node => ts.isClassDeclaration(node) && node.name?.text === definition.className);
  assert.ok(declaration, definition.className);
  const members = definition.members.map(name => {
    const member = declaration.members.find(node => node.name?.getText(ast) === name);
    assert.ok(member, name);
    return member.getText(ast);
  });
  sources[name] = { path: definition.path, fileSha256: createHash('sha256').update(source).digest('hex'),
    extracted: `class ${definition.className} {\n${members.join('\n')}\n}` };
  if (name === 'controller') {
    const commands = [], statuses = [];
    const visit = node => {
      if (ts.isCallExpression(node) && node.expression.getText(ast).endsWith('.subscribe') &&
          node.arguments.length === 1 && ts.isArrowFunction(node.arguments[0]) &&
          node.arguments[0].getText(ast).includes('this.handleCommand(')) commands.push(node.arguments[0].getText(ast));
      if (ts.isBinaryExpression(node) && node.left.getText(ast) === 'this.subscriptions.testStatus') statuses.push(node.getText(ast));
      ts.forEachChild(node, visit);
    };
    visit(declaration);
    assert.equal(commands.length, 1); assert.equal(statuses.length, 1);
    [commandSubscription] = commands; [stateSubscription] = statuses;
  }
}
const interfacePath = 'frontend/src/app/test-controller/interfaces/test-controller.interfaces.ts';
const interfaceSource = execFileSync('git', ['-C', repository, 'show', `${originalCommit}:${interfacePath}`], { encoding: 'utf8' });
const interfaceAst = ts.createSourceFile(interfacePath, interfaceSource, ts.ScriptTarget.Latest, true);
const bufferTypes = interfaceAst.statements.filter(ts.isVariableStatement).flatMap(node => [...node.declarationList.declarations])
  .find(node => node.name.getText(interfaceAst) === 'bufferTypes');
assert.ok(bufferTypes);
sources.interfaces = { path: interfacePath, fileSha256: createHash('sha256').update(interfaceSource).digest('hex'),
  extracted: `const ${bufferTypes.getText(interfaceAst)};` };
writeFileSync(new URL('./fixtures/original-controller-completion.json', import.meta.url), JSON.stringify({
  originalCommit, scope: 'Actual three buffers, aggregation, saved-event barrier, termination, controller subscription and command-completion callback; controlled backend, router and non-adaptive Unit.',
  sources, commandSubscription, stateSubscription
}, null, 2) + '\n');
console.log('Recorded pinned Original buffers and controller command completion.');
