import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

const exports={};
new Function('exports',ts.transpileModule(readFileSync(new URL('../apps/web/src/app/original-workspace-notice-text.ts',import.meta.url),'utf8'),{
 compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}
}).outputText)(exports);
const parts=exports.originalWorkspaceNoticeText;

test('Original notice ticks delimit spans while surrounding text, Unicode and newlines remain exact',()=>{
 assert.deepEqual(parts('Non-Standard-Filename: `renamed-player-1.0.html` expected.'),[
  {text:'Non-Standard-Filename: ',highlight:false},{text:'renamed-player-1.0.html',highlight:true},{text:' expected.',highlight:false}
 ]);
 assert.deepEqual(parts('`Ä/β\n😀` and `2`–`6`'),[
  {text:'Ä/β\n😀',highlight:true},{text:' and ',highlight:false},{text:'2',highlight:true},
  {text:'–',highlight:false},{text:'6',highlight:true}
 ]);
});

test('empty and unmatched ticks retain the Original pairing boundary',()=>{
 assert.deepEqual(parts(''),[]);
 for(const value of ['plain **text** [link](url)','`unmatched','unmatched`','``'])assert.deepEqual(parts(value),[{text:value,highlight:false}]);
 assert.deepEqual(parts('``A``'),[{text:'`',highlight:false},{text:'A',highlight:true},{text:'`',highlight:false}]);
 assert.deepEqual(parts('`one``two`'),[{text:'one',highlight:true},{text:'two',highlight:true}]);
});

test('HTML-shaped filename/validator values remain literal data inside both kinds of segment',()=>{
 const literal='<img src=x onerror="window.ownedInjected=true">';
 assert.deepEqual(parts(literal+' `'+literal+'`'),[{text:literal+' ',highlight:false},{text:literal,highlight:true}]);
 assert.deepEqual(parts('Schema `https://w3id.org/iqb/spec/unit-xml/<version>`'),[
  {text:'Schema ',highlight:false},{text:'https://w3id.org/iqb/spec/unit-xml/<version>',highlight:true}
 ]);
});

// Execute the production row/aggregate methods without the unrelated Angular
// injections. The catalog's 1000-file dependency threshold is tested in the
// application layer; these checks cover the resulting UI phase distinction.
const source=ts.createSourceFile('files.ts',readFileSync(new URL('../apps/web/src/app/original-workspace-files.component.ts',import.meta.url),'utf8'),ts.ScriptTarget.Latest,true);
const declaration=source.statements.find(node=>ts.isClassDeclaration(node)&&node.name?.text==='OriginalWorkspaceFilesComponent');
const names=['fileErrors','errors','rowErrors','invalid'];
const methods=declaration.members.filter(node=>ts.isMethodDeclaration(node)&&names.includes(node.name?.getText(source))).map(node=>node.getText(source)).join('\n');
const executable=ts.transpileModule('class FileChecks {'+methods+'}',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
const FileChecks=new Function(executable+';return FileChecks;')();
const oldPlayer={fileType:'Resource',metadata:{veronaVersion:'1.0'},validationDiagnostics:[],unresolvedReferences:[]};

for(const dependencySizesCalculated of [true,false])test('Original row compatibility follows the dependency phase while the aggregate stays invalid: '+dependencySizesCalculated,()=>{
 const view=new FileChecks();view.controller={files:[oldPlayer],dependencySizesCalculated};
 assert.equal(view.errors(oldPlayer).length,1);assert.equal(view.rowErrors(oldPlayer).length,dependencySizesCalculated?0:1);
 assert.equal(view.invalid(),1);assert.equal(view.invalid('Resource'),1);assert.equal(view.invalid('Unit'),0);
 const invalid={...oldPlayer,validationDiagnostics:[{severity:'error',message:'Owned file validation error'},{severity:'warning',message:'Owned warning'}],unresolvedReferences:[{reference:'OWNED.MISSING'}]};
 const diagnosticSnapshot=structuredClone(invalid);
 assert.deepEqual(view.rowErrors(invalid).slice(0,2),['Owned file validation error','Fehlende oder mehrdeutige Abhängigkeit: OWNED.MISSING']);
 view.rowErrors(invalid);view.errors(invalid);assert.deepEqual(invalid,diagnosticSnapshot,'Rendering must never edit catalog diagnostics or suppress a persisted file error.');
});
