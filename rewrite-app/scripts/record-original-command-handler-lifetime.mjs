import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import ts from 'typescript';

const repository=resolve(process.argv[2]??'../../testcenter'),revision='ee2ab9ab64bd91209ef8534bbe6005838024e46d';
const definitions={
 command:{path:'frontend/src/app/test-controller/services/command.service.ts',className:'CommandService',methods:['commandToString','subscribeReceivedCommands']},
 service:{path:'frontend/src/app/test-controller/services/test-controller.service.ts',className:'TestControllerService',methods:['pause','resume','errorOut','terminateTest','canDeactivateUnit']},
 controller:{path:'frontend/src/app/test-controller/components/test-controller/test-controller.component.ts',className:'TestControllerComponent',methods:['handleCommand','goto']}
};
const sources={};let callback;
for(const [key,definition] of Object.entries(definitions)){
 const source=execFileSync('git',['-C',repository,'show',revision+':'+definition.path],{encoding:'utf8'}),ast=ts.createSourceFile(definition.path,source,ts.ScriptTarget.Latest,true);
 const declaration=ast.statements.find(node=>ts.isClassDeclaration(node)&&node.name?.text===definition.className);assert.ok(declaration);
 const methods=definition.methods.map(name=>{const method=declaration.members.find(node=>ts.isMethodDeclaration(node)&&node.name.getText(ast)===name);assert.ok(method,name);return method.getText(ast);});
 sources[key]={path:definition.path,fileSha256:createHash('sha256').update(source).digest('hex'),extracted:`class ${definition.className} {\n${methods.join('\n')}\n}`};
 if(key==='controller'){
  const candidates=[];const visit=node=>{if(ts.isCallExpression(node)&&node.expression.getText(ast).endsWith('.subscribe')&&node.arguments.length===1&&ts.isArrowFunction(node.arguments[0])&&node.arguments[0].getText(ast).includes('this.handleCommand('))candidates.push(node.arguments[0].getText(ast));ts.forEachChild(node,visit);};
  visit(declaration);assert.equal(candidates.length,1);callback=candidates[0];
 }
}
const native=JSON.parse(readFileSync(new URL('./fixtures/original-native-command-reference.json',import.meta.url),'utf8'));assert.equal(native.originalCommit,revision);
writeFileSync(new URL('./fixtures/original-command-handler-lifetime.json',import.meta.url),JSON.stringify({originalCommit:revision,sources,callback,interfaces:native.sources.interfaces.extracted},null,2)+'\n');
console.log('Recorded actual Original ACK pipeline, handler subscription and controller phase methods.');
