import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {encodeOriginalReportJson, formatOriginalResponseReport, formatOriginalLogReport,
  formatOriginalReviewReport, formatOriginalReviewTimestamp}
  from '../packages/application/dist/packages/application/src/original-workspace-report-wire.js';

const evidence=new URL('../test-fixtures/original-testcenter/source-workspace-results/',import.meta.url);
test('Source28 actual production Unit and report history retains its complete guarded provenance and eight raw bodies',async t => {
  const root=new URL('native-unit-reports/',evidence);
  const read=name=>readFile(new URL(name,root));
  const manifest=JSON.parse(await read('manifest.json')),receipt=JSON.parse(await read('receipt.json'));
  const old=JSON.parse(await readFile(new URL('native-group-deletion/receipt.json',evidence)));
  await t.test('immutable actual Source, public artifact, probe and every preceding control',async () => {
    assert.equal(manifest.sourceCommit,'eedae41840cbe90e5547c0211da818bdf620f5aa');
    assert.equal(manifest.probeCommit,'5010312460a7dfb0b569028099a03b8d10e29e0c');
    assert.equal(manifest.probeTree,'056eab5f7a8649c7b010e31201a4dc4324c0da5f');
    assert.equal(manifest.runId,40208546516);assert.equal(manifest.jobId,121214629849);
    assert.equal(manifest.artifactId,12604982552);assert.equal(manifest.artifactZipBytes,17980);
    assert.equal(manifest.artifactZipSha256,'e18bf955637a77773f22a6d8fb353fbe8a3f7f003f8d35f32526c758706ee719');
    assert.equal(manifest.files['probe.mjs'],'bdd9a980527370aefd1e512f6beab128c7962e689da77e6cc93189ebaab3ab75');
    assert.equal(Object.keys(manifest.files).length,15);
    for(const [name,sha]of Object.entries(manifest.files)) {
      assert.match(name,/^[a-z][a-z0-9.-]*$/);assert.equal(createHash('sha256').update(await read(name)).digest('hex'),sha,name);
    }
    assert.equal(receipt.success,true);assert.equal(receipt.testMode,false);assert.equal(receipt.checks.length,28);
    assert.equal(receipt.sourceCommit,manifest.sourceCommit);assert.deepEqual(receipt.sourceFiles,manifest.sourceFiles);
    assert.equal(Object.keys(receipt.sourceFiles).length,21);
    assert.deepEqual(receipt.checks.slice(0,21).map(row=>row.name),old.checks.map(row=>row.name));
    for(const [path,sha]of Object.entries(old.sourceFiles))assert.equal(receipt.sourceFiles[path],sha,path);
    assert.equal(JSON.parse(await read('php-runtime.json')).php,'8.3.36');
  });
  await t.test('native history is actual HTTP data and public receipts omit registered capabilities',async () => {
    const observations=JSON.parse(await read('http-observations.json'));
    assert.equal(observations.length,159);assert.deepEqual(receipt.protectedScopes,['login','person']);
    const typed=receipt.checks.find(row=>row.name.startsWith('response parts retain independent'));
    assert.deepEqual(typed.parts.map(part=>[part.id,part.ts,part.responseType]),[
      ['part-a',1792929600010,'first/Ω'],['part-c',1792929600010,'third/γ'],
      ['part-default',1792929600040,'unknown'],['part-z',1792929600020,'second/β']]);
    const state=receipt.checks.find(row=>row.name.startsWith('Unit field clocks'));
    assert.equal(state.originalUnitId,'FIRST.PERSISTED.ID');
    assert.deepEqual(JSON.parse(state.laststate),{PRESENTATION_PROGRESS:'complete',RESPONSE_PROGRESS:'none','CUSTOM_Ω':'  Exact Ä/β\n";  '});
    assert.ok(observations.some(row=>row.method==='PUT'&&row.path.endsWith('/unit/OWNED.UNIT.ALIAS/response')&&row.status===404));
    const empty=observations.filter(row=>row.method==='GET'&&row.path.includes('/report/')&&row.path.includes('dataIds=ORACLE.UNKNOWN'));
    assert.equal(empty.length,8);assert.ok(empty.every(row=>row.status===200&&row.value===null&&row.wireSha256==='e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'));
    const inspect=value=>{
      if(!value||typeof value!=='object')return;
      for(const [key,item]of Object.entries(value)) {
        if(/^(token|groupToken|salt|challenge|signature)$/i.test(key)&&typeof item==='string')assert.match(item,/^\[redacted-owned-/);
        else inspect(item);
      }
    };
    inspect(receipt);inspect(observations);
    const probe=(await read('probe.mjs')).toString(),workflow=(await read('workflow.yml')).toString(),compose=(await read('compose.yml')).toString();
    assert.ok(probe.includes("privateValue(adminPassword, 'password')"));
    assert.ok(probe.includes("Raw public reports must omit every registered private value"));
    assert.ok(workflow.includes('ref: eedae41840cbe90e5547c0211da818bdf620f5aa'));
    assert.ok(workflow.includes('git -C original-reference diff --exit-code'));
    assert.ok(!/sed -i|git -C original-reference (?:apply|checkout)|docker exec.*psql/.test(workflow+probe));
    assert.ok(compose.includes("BRUTE_FORCE_PROTECTION: 'login person'"));assert.ok(compose.includes("ALLOW_TEST_MODE: 'false'"));
  });
  const enhanced=JSON.parse(await read('unit-parts-reviews-enhanced.json'));
  const prefix='Owned report review Ω\n"; ';
  // Preserve the exact authored categories from this HTTP fixture, including
  // internal spaces and numeric spellings lost by transformed boolean columns.
  const reviews=enhanced.map(row=>{
    assert.ok(row.entry.startsWith(prefix));
    return {...row,categories:row.entry.slice(prefix.length)};
  });
  const labels=new Map(enhanced.map(row=>[JSON.stringify([row.bookletname,row.unitname]),
    {unitlabel:row.unitlabel,bookletlabel:row.bookletlabel}]));
  for(const name of ['responses','logs','reviews-legacy','reviews-enhanced'])await t.test(name+' raw CSV and raw JSON bytes',async () => {
    const rawJson=await read('unit-parts-'+name+'.json'),rows=JSON.parse(rawJson);
    const render=format=>name==='responses'?formatOriginalResponseReport(rows,format):name==='logs'?formatOriginalLogReport(rows,format):
      formatOriginalReviewReport({rows:reviews,format,useNewVersion:name==='reviews-enhanced',labels:(booklet,unit)=>labels.get(JSON.stringify([booklet,unit]))});
    assert.deepEqual(Buffer.from(render('json'),'utf8'),rawJson,'Use actual original HTTP JSON bytes, including PHP escaping/key order');
    assert.deepEqual(Buffer.from(render('csv'),'utf8'),await read('unit-parts-'+name+'.csv'));
  });
});

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
