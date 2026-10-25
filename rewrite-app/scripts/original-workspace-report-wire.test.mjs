import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {encodeOriginalReportJson, formatOriginalResponseReport, formatOriginalLogReport,
  formatOriginalReviewReport, formatOriginalReviewTimestamp}
  from '../packages/application/dist/packages/application/src/original-workspace-report-wire.js';

const evidence=new URL('../test-fixtures/original-testcenter/source-workspace-results/',import.meta.url);
for (const family of ['', 'group-labels', 'lock-clock', 'native-person-lifecycle', 'native-person-labels']) {
  test(`${family || 'Source27'}: native report renderer retains all four actual Source CSV bodies and JSON values`,async t => {
    const root=new URL(family ? family+'/' : './',evidence);
    const manifest=JSON.parse(await readFile(new URL('manifest.json',root),'utf8'));
    assert.equal(manifest.sourceCommit,'eedae41840cbe90e5547c0211da818bdf620f5aa');
    const read=async name => {
      const bytes=await readFile(new URL(name,root));
      assert.equal(createHash('sha256').update(bytes).digest('hex'),manifest.files[name],name);
      return bytes;
    };
    const enhanced=JSON.parse(await read('reviews-enhanced.json'));
    // These are DAO-shaped inputs reconstructed from the production evidence,
    // not proof of native repository projection or current-file label intake.
    const reviews=enhanced.map(row => ({groupname:row.groupname,loginname:row.loginname,code:row.code,
      bookletname:row.bookletname,unitname:row.unitname,priority:row.priority,
      categories:Object.entries(row).filter(([key,value]) => key.startsWith('category_') && value).map(([key]) => key.slice(9)).join(' '),
      reviewtime:row.reviewtime,entry:row.entry,page:row.page,pagelabel:row.pagelabel,
      originalUnitId:row.originalUnitId,userAgent:row.userAgent,reviewer:row.reviewer}));
    const labels=new Map(enhanced.map(row => [JSON.stringify([row.bookletname,row.unitname]),
      {unitlabel:row.unitlabel,bookletlabel:row.bookletlabel}]));
    for (const name of ['responses','logs','reviews-legacy','reviews-enhanced']) await t.test(name,async () => {
      const rows=JSON.parse(await read(name+'.json'));
      const render=format => name==='responses' ? formatOriginalResponseReport(rows,format)
        : name==='logs' ? formatOriginalLogReport(rows,format)
        : formatOriginalReviewReport({rows:reviews,format,useNewVersion:name==='reviews-enhanced',
          labels:(booklet,unit) => labels.get(JSON.stringify([booklet,unit]))});
      assert.deepEqual(Buffer.from(render('csv'),'utf8'),await read(name+'.csv'),'Compare original bytes, including BOM, quoting, Unicode and final byte');
      assert.deepEqual(JSON.parse(render('json')),rows);
      assert.equal(render('json').endsWith('\n'),false);
    });
  });
}

test('native JSON uses PHP Unicode/slash escaping at both nested and outer report boundaries', () => {
  const answer='Ä/β 😀\n"; \\u03a9\u2028\u2029';
  assert.equal(encodeOriginalReportJson({answer}),'{"answer":"\\u00c4\\/\\u03b2 \\ud83d\\ude00\\n\\\"; \\\\u03a9\\u2028\\u2029"}');
  const rows=[{groupname:'G',loginname:'L',code:'AbC/suffix',bookletname:'B',unitname:'U',laststate:null,originalUnitId:'I',
    responses:[{id:'answer',content:answer,ts:17,responseType:'type/Ω'}]}];
  const json=formatOriginalResponseReport(rows,'json');
  assert.equal(json.includes('AbC\\/suffix'),true);assert.equal(json.includes('\\u03a9'),true);
  assert.equal(json.includes('😀'),false);assert.deepEqual(JSON.parse(json),rows);
  const csv=formatOriginalResponseReport(rows,'csv');
  assert.ok(csv.includes('"AbC/suffix"'),'Outer CSV strings retain actual UTF-8 and slashes');
  assert.ok(csv.includes('type\\/\\u03a9'),'The nested responses cell uses PHP JSON escaping');
  assert.equal(csv.endsWith('\n'),false);
});

test('invalid Unicode and non-finite persisted values cannot become a plausible successful JSON report', () => {
  for (const answer of ['\ud800','\udc00','a\ud800b','\ud800😀','😀\udc00']) {
    assert.throws(() => encodeOriginalReportJson({answer}),/valid Unicode/);
  }
  for (const value of [Infinity,-Infinity,NaN]) assert.throws(() => encodeOriginalReportJson({value}),/finite/);
  assert.throws(() => encodeOriginalReportJson(undefined),/JSON data/);
  assert.throws(() => encodeOriginalReportJson({['\ud800']:'value'}),/valid Unicode/);
  assert.equal(encodeOriginalReportJson({answer:'😀'}),'{"answer":"\\ud83d\\ude00"}');
});

const review={groupname:'G',loginname:'L',code:'first/requested/suffix',bookletname:'B#STATE:x',unitname:'U',priority:2,
  categories:'quality',reviewtime:'2026-10-25 02:01:00',entry:'exact Ω\n";',page:0,pagelabel:'',originalUnitId:'first-authored-id',userAgent:null,reviewer:null};
test('legacy/enhanced reviews retain field order, nulls, stored suffix and the explicit current-label boundary', () => {
  const rows=[review,{...review,unitname:'',categories:'accuracy',priority:0,page:null,pagelabel:null}];
  const calls=[];
  const labels=(booklet,unit) => {calls.push([booklet,unit]);return {unitlabel:unit ? '  current Ω\n  ' : '',bookletlabel:'  Current Booklet  '};};
  const old=JSON.parse(formatOriginalReviewReport({rows,format:'json',useNewVersion:false,labels}));
  assert.deepEqual(calls,[],'Legacy reports do not inspect current files');
  assert.deepEqual(Object.keys(old[0]),['groupname','loginname','code','bookletname','unitname','priority','category: accuracy','category: quality',
    'reviewtime','entry','page','pagelabel','originalUnitId','userAgent']);
  assert.equal(old[0].code,review.code);assert.equal(old[0]['category: accuracy'],null);assert.equal(old[0]['category: quality'],'X');
  const fresh=JSON.parse(formatOriginalReviewReport({rows,format:'json',useNewVersion:true,labels}));
  assert.deepEqual(calls,[['B#STATE:x','U'],['B#STATE:x','']]);
  assert.deepEqual(Object.keys(fresh[0]),['groupname','loginname','code','bookletname','unitname','priority','category_accuracy','category_quality',
    'reviewtime','page','pagelabel','originalUnitId','userAgent','reviewer','entry','unitlabel','bookletlabel']);
  assert.equal(fresh[0].reviewer,null);assert.equal(fresh[0].category_accuracy,false);assert.equal(fresh[0].category_quality,true);
  assert.equal(fresh[0].unitlabel,'  current Ω\n  ');assert.equal(fresh[0].bookletlabel,'  Current Booklet  ');
  const missing=JSON.parse(formatOriginalReviewReport({rows,format:'json',useNewVersion:true}));
  assert.equal(missing[0].unitlabel,'');assert.equal(missing[0].bookletlabel,'','Missing current files never fall back to frozen labels');
  const csv=formatOriginalReviewReport({rows,format:'csv',useNewVersion:true,labels});
  assert.ok(csv.includes('"FALSE";"TRUE"'));assert.ok(csv.includes('"0";"";"first-authored-id";;'));
});

test('review category collection retains PHP numeric comparisons, first spelling, strict membership and empty-token behavior', () => {
  const rows=[{...review,categories:'10 02'}, {...review,categories:'2  1'}, {...review,categories:'0'}];
  const output=JSON.parse(formatOriginalReviewReport({rows,format:'json',useNewVersion:true}));
  const keys=Object.keys(output[0]).filter(key => key.startsWith('category_'));
  assert.deepEqual(keys,['category_','category_1','category_02','category_10']);
  assert.equal(output[0].category_02,true);assert.equal(output[1].category_02,false,'Loose collection does not change strict selected-category membership');
  assert.equal(output[1].category_,true);assert.equal(output[2].category_10,false);
  const zero=JSON.parse(formatOriginalReviewReport({rows:[{...review,categories:'0'}],format:'json',useNewVersion:true}));
  assert.equal(Object.keys(zero[0]).some(key => key.startsWith('category_')),false);
  const high=JSON.parse(formatOriginalReviewReport({rows:[{...review,categories:'9007199254740993 9007199254740992'}],format:'json',useNewVersion:false}));
  assert.deepEqual(Object.keys(high[0]).filter(key => key.startsWith('category: ')),['category: 9007199254740992','category: 9007199254740993']);
  const overflowing=JSON.parse(formatOriginalReviewReport({rows:[{...review,categories:'9223372036854775809 9223372036854775808 9223372036854775807 1e999 2e999'}],format:'json',useNewVersion:false}));
  const overflowKeys=Object.keys(overflowing[0]).filter(key => key.startsWith('category: '));
  assert.equal(overflowKeys.length,5,'Zend byte fallback must not merge distinct integer/infinite numeric spellings');
  assert.ok(overflowKeys.indexOf('category: 9223372036854775807') < overflowKeys.indexOf('category: 9223372036854775808'));
  assert.ok(overflowKeys.indexOf('category: 9223372036854775808') < overflowKeys.indexOf('category: 9223372036854775809'));
  const prefix=JSON.parse(formatOriginalReviewReport({rows:[{...review,categories:'100000000000000000000e-30 1'}],format:'json',useNewVersion:false}));
  assert.deepEqual(Object.keys(prefix[0]).filter(key => key.startsWith('category: ')),['category: 1','category: 100000000000000000000e-30']);
});

test('every empty native report is zero bytes with either format and either review version', () => {
  for (const format of ['csv','json']) {
    assert.equal(formatOriginalResponseReport([],format),'');assert.equal(formatOriginalLogReport([],format),'');
    for (const useNewVersion of [false,true]) assert.equal(formatOriginalReviewReport({rows:[],format,useNewVersion,labels:() => {throw Error('No files should be read');}}),'');
  }
});

test('CSV rejects malformed persisted Unicode as well, including dynamic category column names', () => {
  assert.throws(() => formatOriginalReviewReport({rows:[{...review,entry:'\ud800'}],format:'csv',useNewVersion:false}),/valid Unicode/);
  assert.throws(() => formatOriginalReviewReport({rows:[{...review,categories:'\ud800'}],format:'csv',useNewVersion:true}),/valid Unicode/);
});

test('review display uses its stored instant and explicit system timezone across DST, without a Run clock or UTC fallback', () => {
  assert.equal(formatOriginalReviewTimestamp('2026-10-25T00:59:30.999Z','Europe/Berlin'),'2026-10-25 02:59:30');
  assert.equal(formatOriginalReviewTimestamp('2026-10-25T01:01:30.999Z','Europe/Berlin'),'2026-10-25 02:01:30');
  assert.equal(formatOriginalReviewTimestamp('2026-10-25T01:01:30Z','UTC'),'2026-10-25 01:01:30');
  assert.equal(formatOriginalReviewTimestamp(null,'Europe/Berlin'),null);
  assert.equal(formatOriginalReviewTimestamp('1970-01-01T00:00:00.999Z','Europe/Berlin'),null);
  assert.equal(formatOriginalReviewTimestamp('1969-12-31T23:59:59Z','Europe/Berlin'),null);
  assert.throws(() => formatOriginalReviewTimestamp('not-a-time','Europe/Berlin'),/stored timestamp/);
  assert.throws(() => formatOriginalReviewTimestamp('2026-10-25T01:01:30Z','not-a-timezone'),RangeError);
});
