import assert from 'node:assert/strict';
import {mkdir,mkdtemp,rm} from 'node:fs/promises';
import{tmpdir}from'node:os';import{join,resolve}from'node:path';
import test from 'node:test';
import {chromium} from 'playwright';
import {captureOriginalMaterialViews} from './ci-browser-material-profile.mjs';

test('current unchanged Original player, definition and resource reproduce all diagnostic viewports in independent fresh contexts',{skip:process.platform!=='linux'?'Native Ubuntu browser material diagnostic; macOS native range pixels are not a Linux qualification.':false},async()=>{
 assert.equal(process.env.UI_SMOKE_HEADFUL,'true');
 const output=process.env.CI_MATERIAL_CAPTURE_ARTIFACT_DIR??await mkdtemp(join(tmpdir(),'owned-original-material-'));let browser;
 await mkdir(output,{recursive:true});
 try{
  browser=await chromium.launch({headless:false});
  const result=await captureOriginalMaterialViews(browser,resolve('.'),output);
  assert.deepEqual(result.views.map(view=>view.name),['desktop-empty','desktop-input','mobile-empty','mobile-input']);
  assert.notEqual(result.views[0].pixelSha256,result.views[1].pixelSha256);
  assert.notEqual(result.views[2].pixelSha256,result.views[3].pixelSha256);
 }finally{await browser?.close();if(!process.env.CI_MATERIAL_CAPTURE_ARTIFACT_DIR)await rm(output,{recursive:true,force:true});}
});
