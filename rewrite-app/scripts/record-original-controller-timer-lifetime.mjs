import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import ts from 'typescript';

const repository=resolve(process.argv[2]??'../../testcenter');
const originalCommit='ee2ab9ab64bd91209ef8534bbe6005838024e46d';
const definitions={
 service:{path:'frontend/src/app/test-controller/services/test-controller.service.ts',className:'TestControllerService',methods:['pause','resume','terminateTest','canDeactivateUnit','setUnitNavigationRequest','startTimer','finishTimer','interruptTimer','cancelTimer','getUnit','unitIsInaccessible','getNavigationState','checkCompleteness','updateSingleLock','updateAllLocks','updateNavigationState','clearCodeLock']},
 controller:{path:'frontend/src/app/test-controller/components/test-controller/test-controller.component.ts',className:'TestControllerComponent',methods:['handleCommand','handleTimer','goto']},
 timer:{path:'frontend/src/app/test-controller/classes/test-controller.classes.ts',declarations:['TimerData']},
 interfaces:{path:'frontend/src/app/test-controller/interfaces/test-controller.interfaces.ts',declarations:['UnitNavigationTarget','MaxTimerEvent','TestletLockTypes','isUnit','isTestlet']},
 ticker:{path:'frontend/src/app/test-controller/util/worker.util.ts',declarations:['createTicker']},
 guard:{path:'frontend/src/app/test-controller/routing/unit-activate.guard.ts',className:'UnitActivateGuard',methods:['canActivate']},
 unitHost:{path:'frontend/src/app/test-controller/components/unithost/unithost.component.ts',className:'UnithostComponent',methods:['runUnit','startTimerIfNecessary','onSubmitCode','isValidCode']}
};
const sources={};
for(const [key,definition] of Object.entries(definitions)){
 const source=execFileSync('git',['-C',repository,'show',originalCommit+':'+definition.path],{encoding:'utf8'});
 const ast=ts.createSourceFile(definition.path,source,ts.ScriptTarget.Latest,true);
 let extracted;
 if(definition.className){
  const declaration=ast.statements.find(node=>ts.isClassDeclaration(node)&&node.name?.text===definition.className);assert.ok(declaration);
  const methods=definition.methods.map(name=>{
   const method=declaration.members.find(node=>ts.isMethodDeclaration(node)&&node.name.getText(ast)===name);assert.ok(method,name);return method.getText(ast);
  });
  extracted=`class ${definition.className} {\n${methods.join('\n')}\n}`;
 }else{
  extracted=definition.declarations.map(name=>{
   const node=ast.statements.find(node=>node.name?.text===name || ts.isVariableStatement(node)&&node.declarationList.declarations.some(item=>item.name.getText(ast)===name));assert.ok(node,name);return node.getText(ast).replace(/^export /,'');
  }).join('\n');
 }
 sources[key]={path:definition.path,fileSha256:createHash('sha256').update(source).digest('hex'),extracted};
}
writeFileSync(new URL('./fixtures/original-controller-timer-lifetime.json',import.meta.url),JSON.stringify({originalCommit,sources},null,2)+'\n');
console.log('Recorded actual Original timer interruption, timer events, forced guard and worker ticker.');
