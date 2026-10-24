import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import ts from 'typescript';
const emit = source => 'data:text/javascript;base64,' + Buffer.from(ts.transpileModule(source, {
 compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}
}).outputText).toString('base64');
const {readParticipantDebugTestlets:read} = await import(emit(readFileSync(new URL('../apps/web/src/app/participant-debug-testlets.ts',import.meta.url),'utf8')));
const pinned = JSON.parse(readFileSync(new URL('./fixtures/original-debug-locks-reference.json',import.meta.url),'utf8'));
assert.equal(pinned.originalCommit,'ee2ab9ab64bd91209ef8534bbe6005838024e46d');
const original = await import(emit(Object.values(pinned.sources).map(item=>item.extracted).join('\n') + '\nexport {TestControllerService,TestLoaderService};'));
const now=Date.parse('2026-10-12T00:00:00.000Z');
const timer=(key,remainingSeconds,status='paused')=>({testletKey:key,status,durationSeconds:180,remainingSeconds,expiresAt:null});
const fixture=()=>{
 const booklet={bookletKey:'owned',displayLabel:'Owned',rootRestrictions:{timeMax:{minutes:3,leave:'confirm'}},unitEntries:[],testletEntries:[
  {testletKey:'outer',displayLabel:'Outer',parentTestletKey:null,restrictions:{codeToEnter:{code:'Private outer Ω',prompt:'Outer prompt'}}},
  {testletKey:'inner',displayLabel:'Inner',parentTestletKey:'outer',restrictions:{show:{stateKey:'level',optionKey:'high'},timeMax:{minutes:1,leave:'confirm'},codeToEnter:{code:'Private inner Ω',prompt:'Inner prompt'},lockAfterLeaving:{scope:'testlet',confirm:true}}},
  {testletKey:'leaf',displayLabel:'Leaf',parentTestletKey:'inner',restrictions:{}},
  {testletKey:'sibling',displayLabel:'Sibling',parentTestletKey:null,restrictions:{}},
  {testletKey:'empty-code',displayLabel:'Empty code',parentTestletKey:null,restrictions:{codeToEnter:{code:'',prompt:'No code required'}}}
 ]};
 const testRun={tenantId:'tenant',workspaceId:'workspace',participantSessionId:'participant',testRunId:'run',contentReleaseId:'release',bookletKey:'owned',
  executionMode:'run-hot-return',unitResponses:{},unlockedTestletKeys:[],lockedTestletKeys:[],lockedUnitKeys:[],testletTimers:{}};
 const state={testRun,booklet:{testlets:booklet.testletEntries.map(entry=>({testletKey:entry.testletKey,requiresCode:Boolean(entry.restrictions.codeToEnter?.code)}))}};
 const scope=Object.fromEntries(['tenantId','workspaceId','participantSessionId','testRunId','contentReleaseId','bookletKey'].map(key=>[key,testRun[key]]));
 const snapshot={scope,booklet:structuredClone(booklet),adaptiveStates:[{stateKey:'level',optionKey:'high'}]};
 for(const entry of snapshot.booklet.testletEntries)if(entry.restrictions.codeToEnter)entry.restrictions.codeToEnter.code='';
 return {booklet,state,snapshot};
};
const freeze=value=>{if(value&&typeof value==='object'){Object.freeze(value);for(const item of Object.values(value))freeze(item);}return value;};
const sourceProjection=f=>{
 const controller=new original.TestControllerService(),loader=new original.TestLoaderService();
 controller.updateNavigationState=()=>{};loader.tcs=controller;
 const root=loader.toTestlet({id:'[0]',label:'',restrictions:structuredClone(f.booklet.rootRestrictions),children:[]},null,{parents:[]});
 controller.testlets={'[0]':root};controller.units={};
 for(const entry of f.booklet.testletEntries){
  const parent=controller.testlets[entry.parentTestletKey??'[0]'];assert.ok(parent);
  const parents=[parent];let ancestor=entry.parentTestletKey;
  while(ancestor){const next=f.booklet.testletEntries.find(item=>item.testletKey===ancestor).parentTestletKey;parents.push(controller.testlets[next??'[0]']);ancestor=next;}
  const restrictions=structuredClone(entry.restrictions);
  if(restrictions.show)restrictions.show={if:restrictions.show.stateKey,is:restrictions.show.optionKey};
  const source=loader.toTestlet({id:entry.testletKey,label:entry.displayLabel,restrictions,children:[]},null,{parents});
  parent.children.push(source);controller.testlets[entry.testletKey]=source;
 }
 controller.booklet={units:root,states:Object.fromEntries(f.snapshot.adaptiveStates.map(entry=>[entry.stateKey,{current:entry.optionKey}]))};
 loader.restoreLastState({TESTLETS_TIMELEFT:JSON.stringify(Object.fromEntries(Object.entries(f.state.testRun.testletTimers).map(([key,value])=>[key,value.remainingSeconds/60]))),
  TESTLETS_CLEARED_CODE:JSON.stringify(f.state.testRun.unlockedTestletKeys),TESTLETS_LOCKED_AFTER_LEAVE:JSON.stringify(f.state.testRun.lockedTestletKeys)});
 controller.updateAllShowLocks();
 return new Map(Object.entries(controller.testlets).map(([key,value])=>[key,{testletKey:key,blockLabel:value.blockLabel,timerId:value.timerId,
  locks:value.locks,locked:value.locked?{by:value.locked.by,through:value.locked.through.id}:null}]));
};
const compare=f=>{
 const before=structuredClone(f);freeze(f.state);freeze(f.snapshot);
 const actual=read(f.state,f.snapshot,now);assert.deepEqual(actual,sourceProjection(f));assert.deepEqual(f,before);return actual;
};
for(let flags=0;flags<16;flags++)test(`effective Testlet locks match pinned Source precedence for all four overlapping causes (${flags})`,()=>{
 const f=fixture();f.state.testRun.unlockedTestletKeys=['outer',...(flags&4?[]:['inner'])];
 f.snapshot.adaptiveStates[0].optionKey=flags&1?'low':'high';
 if(flags&2)f.state.testRun.testletTimers.inner=timer('inner',0);
 if(flags&8)f.state.testRun.lockedTestletKeys=['inner'];
 compare(f);
});
test('an outer code lock precedes an inner show/time/leave lock and reports its actual ancestor',()=>{
 const f=fixture();f.snapshot.adaptiveStates[0].optionKey='low';f.state.testRun.testletTimers.inner=timer('inner',0);f.state.testRun.lockedTestletKeys=['inner'];
 const result=compare(f);assert.deepEqual(result.get('leaf').locked,{by:'code',through:'outer'});
 assert.equal(result.get('inner').locks.code,true);assert.equal(result.get('empty-code').locks.code,false);
});
test('root timer expiry dominates child locks; untimed siblings inherit the root timer and own block label',()=>{
 const f=fixture();f.state.testRun.testletTimers['[0]']=timer('[0]',0,'expired');
 const result=compare(f);assert.deepEqual(result.get('leaf').locked,{by:'time',through:'[0]'});
 assert.equal(result.get('leaf').timerId,'[0]');assert.equal(result.get('leaf').blockLabel,'Outer');assert.equal(result.get('sibling').blockLabel,'Sibling');
});
test('cleared codes, ended leave locks and changed local adaptive state remove only the affected lock',()=>{
 const f=fixture();const initial=read(f.state,f.snapshot,now);assert.equal(initial.get('leaf').locked.through,'outer');
 f.state.testRun.unlockedTestletKeys=['outer','inner'];f.snapshot.adaptiveStates[0].optionKey='low';f.state.testRun.lockedTestletKeys=['inner'];
 assert.deepEqual(read(f.state,f.snapshot,now).get('leaf').locked,{by:'show',through:'inner'});
 f.snapshot.adaptiveStates[0].optionKey='high';assert.deepEqual(read(f.state,f.snapshot,now).get('leaf').locked,{by:'afterLeave',through:'inner'});
 f.state.testRun.lockedTestletKeys=[];assert.equal(read(f.state,f.snapshot,now).get('leaf').locked,null);compare(f);
});
test('diagnostics follow the displayed local countdown without advancing a stored timer or ignoring a paused timer',()=>{
 const f=fixture();f.state.testRun.unlockedTestletKeys=['outer','inner'];f.state.testRun.testletTimers.inner={...timer('inner',30,'running'),expiresAt:new Date(now+500).toISOString()};
 const before=structuredClone(f);assert.equal(read(f.state,f.snapshot,now).get('inner').locks.time,false);
 assert.deepEqual(read(f.state,f.snapshot,now+501).get('leaf').locked,{by:'time',through:'inner'});assert.deepEqual(f,before);
 f.state.testRun.testletTimers.inner.status='paused';assert.equal(read(f.state,f.snapshot,now+501).get('inner').locks.time,false);
});
for(const key of ['tenantId','workspaceId','participantSessionId','testRunId','contentReleaseId','bookletKey'])test(`foreign or incomplete ${key} cannot enter a diagnostic lock projection`,()=>{
 const f=fixture();f.snapshot.scope[key]='foreign';assert.equal(read(f.state,f.snapshot,now).size,0);
 for(const invalid of [undefined,null,'']){const missing=fixture();missing.snapshot.scope[key]=invalid;missing.state.testRun[key]=invalid;assert.equal(read(missing.state,missing.snapshot,now).size,0);}
});
test('cyclic and unknown diagnostic parent references fail within the read-only projection',()=>{
 const f=fixture();f.snapshot.booklet.testletEntries[0].parentTestletKey='leaf';assert.throws(()=>read(f.state,f.snapshot,now),/cyclic/);
 f.snapshot.booklet.testletEntries[0].parentTestletKey='foreign';assert.throws(()=>read(f.state,f.snapshot,now),/unknown/);
});

const paneSource=readFileSync(new URL('../apps/web/src/app/participant-debug-pane.component.ts',import.meta.url),'utf8');
const ast=ts.createSourceFile('pane.ts',paneSource,ts.ScriptTarget.Latest,true);
const paneClass=ast.statements.find(ts.isClassDeclaration);
const methods=paneClass.members.filter(member=>['properties','text','badges','testletProperties'].includes(member.name?.getText(ast)));
const {Actual}=await import(emit('const participantDebugRootTestletKey="[0]"; export class Actual { '+methods.map(member=>member.getText(ast)).join('\n')+' }'));
test('actual pane properties show own and inherited lock causes without recovering a hidden code',()=>{
 const f=fixture(),pane=new Actual();Object.assign(pane,{state:f.state,source:f.snapshot,snapshot:()=>f.snapshot,now:()=>now,testletStates:read(f.state,f.snapshot,now)});
 const outer=f.snapshot.booklet.testletEntries[0],leaf=f.snapshot.booklet.testletEntries[2];
 const own=Object.fromEntries(pane.testletProperties({id:'outer',testlet:outer})),inherited=Object.fromEntries(pane.testletProperties({id:'leaf',testlet:leaf}));
 assert.equal(own.locked,'BY code THROUGH outer');assert.equal(inherited.locked,'BY code THROUGH outer');
 assert.equal(own['locks.show'],'false');assert.equal(own['locks.afterLeave'],'false');assert.ok(!JSON.stringify(own).includes('Private outer Ω'));
 assert.equal(pane.badges(outer).find(badge=>badge.label==='C').active,true);
 f.state.testRun.testletTimers['[0]']=timer('[0]',0,'expired');pane.testletStates=read(f.state,f.snapshot,now);
 assert.equal(pane.badges(outer).find(badge=>badge.label==='C').active,false);assert.equal(pane.badges(null).find(badge=>badge.label==='T').active,true);
 assert.equal(Object.fromEntries(pane.testletProperties({id:'[0]',testlet:null})).locked,'BY time THROUGH [0]');
});
