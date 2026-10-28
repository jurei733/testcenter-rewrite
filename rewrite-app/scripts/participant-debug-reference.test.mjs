import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import ts from 'typescript';
import {DOMParser} from '@xmldom/xmldom';
import {parseParticipantDebugConditionElement as parse,evaluateParticipantDebugConditions as evaluate} from '@testcenter-rewrite-app/contracts/participant-debug-condition';
import {buildParticipantDebugSnapshot,participantDebugConditionText,participantDebugVariableValue} from '@testcenter-rewrite-app/contracts/participant-debug-runtime';
const fixture=JSON.parse(readFileSync(new URL('./fixtures/original-debug-reference.json',import.meta.url),'utf8'));
assert.equal(fixture.originalCommit,'ee2ab9ab64bd91209ef8534bbe6005838024e46d');
const referenceSource=Object.values(fixture.sources).map(source=>source.extracted).join('\n')+'\nexport { BookletParserService, IqbVariableUtil, ConditionUtil, BlockConditionPipe, DebugPaneComponent, BookletConfig, TestMode };';
const compiled=ts.transpileModule(referenceSource,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const original=await import('data:text/javascript;base64,'+Buffer.from(compiled).toString('base64'));
const parser=new original.BookletParserService(),pane=new original.DebugPaneComponent();
const xml=value=>new DOMParser({onError(level,message){throw new Error(`${level}: ${message}`);}}).parseFromString(value,'application/xml').documentElement;
const translated=condition=>({source:'variable' in condition.source?{type:condition.source.type,variableKey:condition.source.variable,unitKey:condition.source.unitAlias,defaultValue:condition.source.default}:
 'sources' in condition.source?{type:condition.source.type,sources:condition.source.sources.map(source=>({type:source.type,variableKey:source.variable,unitKey:source.unitAlias,defaultValue:source.default}))}:
 {type:condition.source.type,conditions:condition.source.conditions.map(translated)},expression:condition.expression});
const expressions=[
 '<If><Value of="x" from="unit"/><Is equal="2" notEqual="3" greaterThan="1" lowerThan="3"/></If>',
 '<If><Value of="ignore" from="unit"/><Score of="x" from="unit" or="9"/><Is equal="2"/><Is equal="7"/></If>',
 '<If><Value of=" x " from=" unit " or=" "/><Is equal=""/></If>',
 '<If><Unknown/><Is equal="0"/></If>',
 ...['Sum','Median','Mean'].map(type=>`<If><${type}><Value of="x" from="unit"/><Status of="x" from="unit"/><Unrecognized/><Score of="x" from="unit" or="4"/></${type}><Is greaterThan="0"/></If>`),
 '<If><Count><If><Value of="x" from="unit"/><Is equal="2"/></If><If><Count><If><Status of="x" from="unit"/><Is equal="VALUE_CHANGED"/></If></Count><Is equal="1"/></If></Count><Is equal="2"/></If>',
 '<If><Value/><Is/></If>', '<If><Is equal="0"/></If>', '<If><Value/></If>'
];
for(const expression of expressions)test(`native debug parser and formatter match pinned Source: ${expression}`,()=>{
 const root=xml(expression);let conditions;
 try{conditions=parser.parseIf(root);}catch(error){assert.throws(()=>parse(root),{message:error.message});return;}
 const actual=parse(root);assert.deepEqual(actual,conditions.map(translated));
 assert.deepEqual(actual.map(participantDebugConditionText),conditions.map(original.BlockConditionPipe.stringyfyCondition));
});
const standard=[null,undefined,true,false,0,-1,0.123456789,'01234567890','012345678901','0123456789012','01234567890123','Ä/β\n";',[],[null,true,'A',[1,2]],{owned:'value'}];
for(const value of standard)for(const shorten of [false,true])test(`variable display matches pinned Source (${String(value)}, short=${shorten})`,()=>{
 assert.equal(participantDebugVariableValue(value,shorten),pane.stringValue(value,shorten));
});
const conditions=expressions.filter(expression=>expression.includes('from="unit"')&&!expression.includes('ignore')).flatMap(expression=>parser.parseIf(xml(expression)));
for(const variable of [
 {id:'x',status:'UNSET',value:null},{id:'x',status:'VALUE_CHANGED',value:2},{id:'x',status:'CODING_COMPLETE',value:3,code:2,score:2},
 {id:'x',status:'VALUE_CHANGED',value:'2.0000001'},{id:'x',status:'VALUE_CHANGED',value:[2,1]},{id:'x',status:'DISPLAYED',value:false}
])test(`conditions match pinned Source for ${JSON.stringify(variable)}`,()=>{
 const snapshot={booklet:{unitEntries:[{unitKey:'unit'}]},variables:[{unitKey:'unit',variables:[structuredClone(variable)]}]};
 assert.deepEqual(evaluate(snapshot,conditions.map(translated)),conditions.map(condition=>original.ConditionUtil.isSatisfied(condition,()=>structuredClone(variable))));
});
test('condition tools reject unknown Unit aliases but preserve missing-variable Source results',()=>{
 const snapshot={booklet:{unitEntries:[{unitKey:'unit'}]},variables:[]};
 assert.deepEqual(evaluate(snapshot,parse(xml('<If><Value of="missing" from="unit"/><Is notEqual="1"/></If>'))),[false]);
 assert.throws(()=>evaluate(snapshot,parse(xml('<If><Value of="x" from="foreign"/><Is equal="1"/></If>'))),/Unknown Unit alias/);
 assert.throws(()=>parse(xml('<Else/>')),/Wrong root tag/);
 let nested='<If><Value of="x" from="unit"/><Is equal="1"/></If>';
 for(let depth=0;depth<34;depth++)nested=`<If><Count>${nested}</Count><Is equal="1"/></If>`;
 assert.throws(()=>parse(xml(nested)),/nesting/);
});
test('diagnostics project tracked variables and state conditions without changing Run or content',()=>{
 const booklet={bookletKey:'owned',displayLabel:'Owned',unitEntries:[{unitKey:'unit'}],stateEntries:[{stateKey:'level',displayLabel:'Level',options:[
  {optionKey:'high',displayLabel:'High',conditions:parse(xml('<If><Score of="x" from="unit"/><Is greaterThan="1"/></If>'))},
  {optionKey:'base',displayLabel:'Base',conditions:[]}]}]};
 const run={tenantId:'owned',workspaceId:'owned',participantSessionId:'owned-session',testRunId:'owned-run',contentReleaseId:'owned-release',bookletKey:'owned',
  unitResponses:{unit:JSON.stringify({kind:'verona_unit_state',version:1,unitState:{unitStateDataType:'iqb-standard@1.0',dataParts:{one:JSON.stringify([{id:'x',status:'CODING_COMPLETE',value:2,score:2},{id:'untracked',status:'VALUE_CHANGED',value:'private'}])}}})},bookletStateOverrides:{level:'base'}};
 const before=structuredClone({booklet,run}),snapshot=buildParticipantDebugSnapshot(booklet,run);
 assert.deepEqual(snapshot.variables[0].variables,[{id:'x',status:'CODING_COMPLETE',value:2,score:2}]);
 assert.deepEqual(snapshot.states[0].options[0].conditions.map(condition=>condition.satisfied),[true]);
 assert.equal(snapshot.states[0].options[0].firstUnsatisfiedCondition,-1);assert.equal(snapshot.states[0].defaultOptionKey,'base');
 assert.equal(snapshot.adaptiveStates[0].automaticOptionKey,'high');assert.equal(snapshot.adaptiveStates[0].optionKey,'base');
 assert.deepEqual({booklet,run},before);snapshot.booklet.unitEntries[0].unitKey='untrusted';assert.deepEqual({booklet,run},before);
});

const settingsSource=readFileSync(new URL('../apps/web/src/app/participant-debug-settings.ts',import.meta.url),'utf8');
const settings=await import('data:text/javascript;base64,'+Buffer.from(ts.transpileModule(settingsSource,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText).toString('base64'));
for(const config of [{},{loading_mode:'EAGER',unit_time_left_warnings:'3,1'},{unit_screenheader:'WITH_UNIT_TITLE',header_content:'NONE',unknown:'ignored'},{toolbar_show_time_left:'TRUE',unit_show_time_left:'OFF'}])test('configuration entries retain all 39 Source defaults, authored raw values and order',()=>{
 const originalConfig=new original.BookletConfig();originalConfig.setFromKeyValuePairs(config);assert.deepEqual(settings.participantDebugConfigEntries(config),originalConfig.toEntries());
});
const {participantExecutionModeDefinitions}=await import('@testcenter-rewrite-app/domain');
for(const mode of Object.values(participantExecutionModeDefinitions))test(`debug mode fields match the pinned Source constructor (${mode.mode})`,()=>{
 assert.deepEqual(settings.participantDebugModeEntries(mode),Object.entries(new original.TestMode(mode.mode)).map(([key,value])=>[key,String(value)]));
});
