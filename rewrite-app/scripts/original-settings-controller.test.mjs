import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import ts from 'typescript';
import {productionApiRoutes} from '@testcenter-rewrite-app/contracts';
import {defaultApplicationSettings} from '@testcenter-rewrite-app/domain';
const load=(file,bindings={})=>{
 const ast=ts.createSourceFile(file,readFileSync(new URL('../apps/web/src/app/'+file,import.meta.url),'utf8'),ts.ScriptTarget.Latest,true);
 const source=ast.statements.filter(n=>!ts.isImportDeclaration(n)).map(n=>n.getText(ast)).join('\n');const exports={};
 new Function('exports',...Object.keys(bindings),ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(exports,...Object.values(bindings));return exports;
};
const {originalSettingsCustomTextCatalog:catalog}=load('original-settings-catalog.ts');
const {OriginalApplicationSettingsController:Controller,originalWarningExpiration,originalWarningDay}=load('original-application-settings-controller.ts',{
 productionApiRoutes,defaultApplicationSettings,originalSettingsCustomTextCatalog:catalog
});
const clone=v=>structuredClone(v),defer=()=>{let resolve;const promise=new Promise(done=>resolve=done);return{resolve,promise};};
const fixture=(handler)=>{
 const session={token:'owned'},calls=[],accepted=[],server={...clone(defaultApplicationSettings),customTexts:{gm_headline:'Stored title',unknown:'  retained  '},globalWarningText:'warning',globalWarningExpiresAt:'2099-12-23T14:00:00.000Z'};
 const controller=new Controller(async(method,path,body,token)=>{
  const call={method,path,body,token};calls.push(call);if(handler)return handler(call,server);
  if(method==='PATCH'){Object.assign(server,body);return{applicationSettings:clone(server)};}
  return path===productionApiRoutes.admin.applicationAssets?{items:[]}:{applicationSettings:clone(server)};
 },()=>session.token,value=>accepted.push(value),()=>{});return{controller,session,calls,accepted,server};
};
test('all 102 labels/defaults and the insertion order come from the actual pinned Source catalog',()=>{
 const reference=JSON.parse(readFileSync(new URL('../test-fixtures/original-testcenter/current-monitor-text-reference.json',import.meta.url),'utf8'));
 assert.equal(reference.originalCommit,'eedae41840cbe90e5547c0211da818bdf620f5aa');
 const source=JSON.parse(reference.files.find(file=>file.path==='definitions/testtaker/custom-texts.json').source);
 assert.equal(catalog.length,102);assert.deepEqual(catalog,Object.entries(source).map(([key,value])=>({key,label:value.label,defaultValue:value.defaultvalue,group:key.split('_')[0]})));
});
test('separate custom-text save preserves the latest title, warning, unknown overrides and unsaved general fields',async()=>{
 const f=fixture();await f.controller.connect('owned');f.controller.general.appTitle='Unsaved local';
 f.server.appTitle='Changed elsewhere';f.server.customTexts.newer='Newer override';
 f.controller.setCustomText('gm_headline','  Authored\n title ');assert.equal(await f.controller.saveCustomTexts(),true);
 assert.equal(f.server.appTitle,'Changed elsewhere');assert.equal(f.server.globalWarningText,'warning');assert.equal(f.server.globalWarningExpiresAt,'2099-12-23T14:00:00.000Z');
 assert.deepEqual(f.server.customTexts,{gm_headline:'  Authored\n title ',unknown:'  retained  ',newer:'Newer override'});
 assert.equal(f.controller.general.appTitle,'Unsaved local');assert.equal(f.controller.generalDirty,true);assert.equal(f.controller.customTextChanges.size,0);
});
test('the Source editor turns an empty edit into its default while keeping whitespace authored',async()=>{
 const f=fixture();await f.controller.connect('owned');f.controller.setCustomText('gm_headline','');
 assert.equal(f.controller.customTextValues.gm_headline,catalog.find(item=>item.key==='gm_headline').defaultValue);
 f.controller.setCustomText('gm_headline',' \t ');assert.equal(f.controller.customTextChanges.get('gm_headline'),' \t ');
 f.controller.setCustomText('gm_headline','Stored title');assert.equal(f.controller.customTextChanges.size,0);
});
test('general reset never discards a separately edited custom text or asset assignment',async()=>{
 const f=fixture();await f.controller.connect('owned');f.controller.setCustomText('gm_headline','Pending');f.controller.setAssignment('logo','owned.png');
 f.controller.general.appTitle='changed';f.controller.resetGeneral();assert.equal(f.controller.generalDirty,false);
 assert.equal(f.controller.customTextChanges.get('gm_headline'),'Pending');assert.equal(f.controller.assignments.logo,'owned.png');
});
test('general and assignment writes leave the other editor maps out of their replacement payload',async()=>{
 const f=fixture();await f.controller.connect('owned');f.controller.general.appTitle='Saved';assert.equal(await f.controller.saveGeneral(),true);
 const general=f.calls.find(c=>c.method==='PATCH').body;assert.equal(Object.hasOwn(general,'customTexts'),false);assert.equal(Object.hasOwn(general,'assetAssignments'),false);
 f.controller.setAssignment('logo','owned.png');await f.controller.saveAssignments();const body=f.calls.filter(c=>c.method==='PATCH').at(-1).body;
 assert.deepEqual(body.assetAssignments,{logo:'owned.png'});assert.equal(Object.hasOwn(body,'customTexts'),false);assert.equal(body.globalWarningText,'warning');
});
test('a retired read cannot apply settings or dispatch the next mutation',async()=>{
 const held=defer();let hold=false;const f=fixture((call,server)=>call.method==='GET'&&hold?held.promise:call.path===productionApiRoutes.admin.applicationAssets?{items:[]}:{applicationSettings:clone(server)});
 await f.controller.connect('owned');f.controller.general.appTitle='changed';hold=true;const save=f.controller.saveGeneral();f.session.token='replacement';f.controller.destroy();held.resolve({applicationSettings:clone(f.server)});
 assert.equal(await save,false);assert.equal(f.calls.some(c=>c.method==='PATCH'),false);assert.equal(f.accepted.length,1);
});
test('a file read owns its original session and cannot upload under a replacement login',async()=>{
 const held=defer(),f=fixture();await f.controller.connect('owned');const upload=f.controller.uploadAsset(()=>held.promise);
 f.session.token='replacement';f.controller.destroy();held.resolve({originalName:'owned.png',mediaType:'image/png',dataBase64:'owned'});
 assert.equal(await upload,false);assert.equal(f.calls.some(c=>c.method==='POST'),false);assert.deepEqual(f.controller.assets,[]);
});
test('a failed settings response retains the exact pending custom edit for an explicit retry',async()=>{
 let fail=true;const f=fixture((call,server)=>{if(call.method==='PATCH'){if(fail)throw{error:'owned'};return{applicationSettings:{...clone(server),...call.body}};}return call.path===productionApiRoutes.admin.applicationAssets?{items:[]}:{applicationSettings:clone(server)};});
 await f.controller.connect('owned');f.controller.setCustomText('gm_headline','Pending');assert.equal(await f.controller.saveCustomTexts(),false);
 assert.equal(f.controller.customTextChanges.get('gm_headline'),'Pending');fail=false;assert.equal(await f.controller.saveCustomTexts(),true);assert.equal(f.controller.customTextChanges.size,0);
});
test('local calendar day/hour conversion uses the selected local date and validates real days',()=>{
 const stamp=originalWarningExpiration('2099-07-12','13'),date=new Date(stamp);assert.equal(originalWarningDay(date),'2099-07-12');assert.equal(date.getHours(),13);
 assert.equal(new Date(originalWarningExpiration('2099-07-12','')).getHours(),0);assert.equal(originalWarningExpiration('','13'),null);
 assert.throws(()=>originalWarningExpiration('2099-02-31','13'));
});
