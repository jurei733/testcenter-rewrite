import assert from 'node:assert/strict';
import test from 'node:test';
import {administrationModule} from './original-administration-test-loader.mjs';
import {originalWorkspaceStoredName,originalWorkspaceNameParameter} from '../packages/application/dist/packages/application/src/original-workspace-directory-name.js';
const {exceedsOriginalAdministrationNameLimit:nameTooLong,exceedsOriginalAdministrationPasswordBytes:passwordTooLong,
 originalAdministrationModificationDate:date}=administrationModule('original-administration-input');

for(const kind of ['create-user','create-workspace','rename-workspace'])test(kind+': native names count Unicode code points, preserving valid astral characters',()=>{
 for(const letter of ['a','ä','😀']){
  assert.equal(nameTooLong(letter.repeat(50),kind),false);
  assert.equal(nameTooLong(letter.repeat(51),kind),true);
 }
});
test('workspace name validation preserves Source PDO truncation and its accepted excess ASCII spaces',()=>{
 for(const kind of ['create-workspace','rename-workspace']){
  assert.equal(nameTooLong('😀'.repeat(50)+' '.repeat(150),kind),false);
  assert.equal(nameTooLong('a'.repeat(50)+'\t',kind),true);
  assert.equal(nameTooLong('a'.repeat(50)+'\u00a0',kind),true);
  assert.equal(nameTooLong('a'.repeat(50)+'\0'+'x'.repeat(100),kind),false);
 }
 assert.equal(nameTooLong('a'.repeat(50)+' ','create-user'),true);
});
test('workspace UI maximum agrees with the actual native storage contract',()=>{
 for(const value of ['a'.repeat(49),'ä'.repeat(50),'😀'.repeat(50),'😀'.repeat(51),
  'a'.repeat(50)+' '.repeat(100),'a'.repeat(50)+'\t','a'.repeat(50)+'\0'+'x'.repeat(100)]){
  let accepted=true;try{originalWorkspaceStoredName(originalWorkspaceNameParameter(value).parameter);}catch{accepted=false;}
  for(const kind of ['create-workspace','rename-workspace'])assert.equal(nameTooLong(value,kind),!accepted);
 }
});
test('password byte boundaries include multibyte characters and preserve authored whitespace',()=>{
 for(const value of ['a'.repeat(60),'ä'.repeat(30),'😀'.repeat(15),' '.repeat(60)])assert.equal(passwordTooLong(value),false);
 for(const value of ['a'.repeat(61),'ä'.repeat(31),'😀'.repeat(16),' '.repeat(61)])assert.equal(passwordTooLong(value),true);
 assert.equal(passwordTooLong('A'.repeat(58)+'ä'),false);
 assert.equal(passwordTooLong('A'.repeat(59)+'ä'),true);
});
test('native SQL timestamps work when the runtime rejects nonstandard space-separated date strings',()=>{
 const ActualDate=globalThis.Date;
 class IsoOnlyDate extends ActualDate {
  constructor(value){super(typeof value==='string'&&/^\d{4}-\d{2}-\d{2} /.test(value)?NaN:value);}
 }
 try{
  globalThis.Date=IsoOnlyDate;
  assert.ok(Number.isNaN(new Date('2026-10-30 13:30:00').getTime()),'Negative control: the old SQL parsing has no portable result.');
  const actual=date('2026-10-30 13:30:00');assert.ok(actual);
  assert.deepEqual([actual.getFullYear(),actual.getMonth()+1,actual.getDate(),actual.getHours(),actual.getMinutes()],[2026,10,30,13,30]);
  assert.equal(date('2026-10-30T13:30:00Z').toISOString(),'2026-10-30T13:30:00.000Z');
  assert.equal(date(null),null);assert.equal(date(''),null);assert.equal(date('invalid'),null);
 }finally{globalThis.Date=ActualDate;}
});
