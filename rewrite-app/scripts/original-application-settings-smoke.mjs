import {waitForFiniteDocumentAnimations} from './finite-animation-ready.mjs';
import {waitForMaterialTabs} from './material-tab-ready.mjs';
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';

// Native Source-shaped controls with real protected settings/assets endpoints.
export async function runOriginalApplicationSettingsSmoke(page,api,{artifacts}){
 const before=(await api('/api/v1/system/application-settings')).applicationSettings;
 await page.locator('[data-cy="superadmin-tabs:settings"]').click();
 const root=page.locator('#originalApplicationSettings[aria-busy="false"]');await root.waitFor();
 const saveSettings=async button=>{
  await page.bringToFront();await page.evaluate(()=>new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done))));
  const response=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/v1/admin/original-interface/application-settings'&&response.request().method()==='PATCH');
  await button.click();assert.equal((await response).status(),200);await root.waitFor();
 };
 const captures={};
 for(const theme of ['Primar','Sekundar','Erwachsene']){
  await api('/api/v1/admin/application-settings',{...before,themeName:theme,privacyNotice:'Eigener Datenschutz aus dem Bestand',accessibilityNotice:'Bestand Barrierefreiheit',legalNoticeHtml:'Bestand Impressum'},'PATCH');await page.reload({waitUntil:'domcontentloaded'});await root.waitFor();
  for(const width of [1280,390]){
   await page.setViewportSize({width,height:844});await page.bringToFront();
   await page.reload({waitUntil:'domcontentloaded'});await root.waitFor();
   for(const tab of ['Allgemein','Bildersetzungen']){
    await root.getByRole('tab',{name:tab,exact:true}).click();await waitForMaterialTabs(page);await page.evaluate(()=>document.fonts.ready);
    await waitForFiniteDocumentAnimations(page);
    await page.evaluate(()=>new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done))));
    captures[theme+'-'+width+'-'+tab]=await root.evaluate(root=>{
     const measure=e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return{text:e.textContent.trim(),x:r.x,y:r.y,width:r.width,height:r.height,font:s.font,gap:s.gap,padding:s.padding,boxSizing:s.boxSizing}};
     return{tabs:[...document.querySelectorAll('[role="tab"]')].map(measure),grids:[...root.querySelectorAll('.form-grid')].map(measure),fields:[...root.querySelectorAll('mat-form-field')].map(measure),headings:[...root.querySelectorAll('h4')].map(measure)};
    });
    await page.locator('#originalAdministrationHeader h1').click();await page.mouse.move(0,0);
    await page.evaluate(()=>new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done))));
    await page.screenshot({path:join(artifacts,'settings-'+theme+'-'+width+'-'+tab+'.png'),fullPage:false});
   }
   await root.getByRole('tab',{name:'Allgemein',exact:true}).click();
  }
 }
 await writeFile(join(artifacts,'settings-measurements.json'),JSON.stringify(captures,null,2));
 await api('/api/v1/admin/application-settings',before,'PATCH');await page.setViewportSize({width:1280,height:844});await page.reload({waitUntil:'domcontentloaded'});await root.waitFor();
 assert.equal(await root.locator('[data-original-text-group]').count(),4);
 assert.equal(await root.locator('textarea[data-custom-text-key]').count(),102);
 assert.equal(await page.locator('#applicationSettingsCard').count(),0,'Original settings must render the German controls.');
 const save=page.locator('#originalGeneralSettingsSave'),reset=page.locator('#originalGeneralSettingsReset');
 const title=root.locator('[data-cy="admin-setting-app-name"]');assert.equal(await save.isDisabled(),true);
 await title.fill('Ungespeicherter Titel');assert.equal(await reset.isEnabled(),true);await reset.click();await page.waitForFunction(expected=>document.querySelector('[data-cy="admin-setting-app-name"]').value===expected,before.appTitle);
 await title.fill('Original Einstellungsprüfung');
 await root.locator('[data-cy="admin-setting-data-protect"]').fill('<p>Eigener Datenschutz</p>');
 await root.locator('[data-cy="admin-setting-accessibility"]').fill('<p>Eigene Barrierefreiheit</p>');
 await root.locator('[data-cy="admin-setting-imprint"]').fill('<p>Eigenes Impressum</p>');
 await root.locator('[data-cy="admin-setting-warningfield"]').fill('Owned future warning');
 await root.locator('[data-cy="admin-setting-set-date"]').fill('2099-07-12');await page.keyboard.press('Tab');
 await root.getByRole('combobox',{name:'Uhrzeit',exact:true}).click();await page.getByRole('option',{name:'13:00 Uhr',exact:true}).click();
 await root.locator('[data-cy="admin-setting-theme-Sekundar"] input').check();
 await saveSettings(save);await page.waitForFunction(()=>document.querySelector('#originalGeneralSettingsSave').disabled);
 let settings=(await api('/api/v1/system/application-settings')).applicationSettings;
 assert.equal(settings.appTitle,'Original Einstellungsprüfung');assert.equal(settings.themeName,'Sekundar');
 assert.equal(settings.privacyNotice,'<p>Eigener Datenschutz</p>');assert.equal(settings.accessibilityNotice,'<p>Eigene Barrierefreiheit</p>');assert.equal(settings.legalNoticeHtml,'<p>Eigenes Impressum</p>');
 assert.equal(settings.globalWarningText,'Owned future warning');assert.equal(new Date(settings.globalWarningExpiresAt).getFullYear(),2099);assert.equal(await page.evaluate(stamp=>new Date(stamp).getHours(),settings.globalWarningExpiresAt),13);
 assert.equal(await page.title(),'Original Einstellungsprüfung');assert.equal(await page.locator('html').getAttribute('data-application-theme'),'Sekundar');
 console.log('original_settings=general-reset-save-policy-local-expiration-and-live-theme:passed');
 await root.locator('[data-original-text-group="login"] mat-expansion-panel-header').click();
 const login=root.locator('[data-original-text-group="login"]'),field=login.locator('[data-custom-text-key="login_subtitle"]');
 await field.fill('  Eigene Auswahl  ');await saveSettings(login.getByRole('button',{name:'Speichern',exact:true}));
 settings=(await api('/api/v1/system/application-settings')).applicationSettings;assert.equal(settings.customTexts.login_subtitle,'  Eigene Auswahl  ');assert.equal(settings.globalWarningText,'Owned future warning');
 await field.fill('');assert.equal(await field.inputValue(),'Testauswahl');await saveSettings(login.getByRole('button',{name:'Speichern',exact:true}));
 assert.equal((await api('/api/v1/system/application-settings')).applicationSettings.customTexts.login_subtitle,'Testauswahl');
 console.log('original_settings=all-102-source-fields-authored-whitespace-empty-default-and-separate-save:passed');
 await root.getByRole('tab',{name:'Bildersetzungen',exact:true}).click();
 const filename='original-owned-settings.png',bytes=await readFile(resolve('dist/apps/web/browser/assets/images/bird-character.png'));
 await root.locator('#originalSettingsAssetFile').setInputFiles({name:filename,mimeType:'image/png',buffer:bytes});
 await root.locator('mat-card-title').filter({hasText:filename}).waitFor();await root.waitFor();
 const card=root.locator('mat-card').filter({has:page.locator('mat-card-title').filter({hasText:filename})});
 await page.waitForFunction(name=>[...document.images].some(image=>image.alt===name&&image.complete&&image.naturalWidth>0),filename);
 assert.equal(await card.locator('img').evaluate(image=>image.complete&&image.naturalWidth>0),true);
 const slots=root.locator('mat-select[data-asset-slot]');assert.equal(await slots.count(),8);
 await root.locator('mat-select[data-asset-slot="loginIllustration"]').click();await page.getByRole('option',{name:filename,exact:true}).click();
 await saveSettings(page.locator('#originalSettingsSaveAssignments'));
 settings=(await api('/api/v1/system/application-settings')).applicationSettings;assert.equal(settings.assetAssignments.loginIllustration,filename);assert.equal(settings.globalWarningText,'Owned future warning');
 await root.locator('mat-select[data-asset-slot="loginIllustration"]').click();await page.getByRole('option',{name:'Keines',exact:true}).click();
 await saveSettings(page.locator('#originalSettingsSaveAssignments'));
 assert.equal((await api('/api/v1/system/application-settings')).applicationSettings.assetAssignments.loginIllustration,undefined);
 await root.locator('mat-select[data-asset-slot="loginIllustration"]').click();await page.getByRole('option',{name:filename,exact:true}).click();
 await saveSettings(page.locator('#originalSettingsSaveAssignments'));
 const originalAsset=(await api('/api/v1/admin/application-assets')).items.find(asset=>asset.originalName===filename);
 const legacy=await api('/api/v1/admin/application-assets?applicationAssetId='+encodeURIComponent(originalAsset.applicationAssetId),undefined,'DELETE',409);
 assert.equal(legacy.error,'application_asset_in_use');
 const deletion=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/v1/admin/application-assets'&&response.request().method()==='DELETE');
 await card.getByRole('button',{name:'Bild entfernen',exact:true}).click();assert.equal((await deletion).status(),200);await card.waitFor({state:'detached'});await root.waitFor();
 settings=(await api('/api/v1/system/application-settings')).applicationSettings;assert.equal(settings.assetAssignments.loginIllustration,undefined);assert.equal(settings.globalWarningText,'Owned future warning');
 await root.locator('#originalSettingsAssetFile').setInputFiles({name:filename,mimeType:'image/png',buffer:bytes});await card.waitFor();await root.waitFor();
 const reuploaded=(await api('/api/v1/admin/application-assets')).items.find(asset=>asset.originalName===filename);assert.notEqual(reuploaded.applicationAssetId,originalAsset.applicationAssetId);
 assert.equal((await api('/api/v1/system/application-settings')).applicationSettings.assetAssignments.loginIllustration,undefined);
 assert.ok((await card.locator('img').getAttribute('src')).includes(encodeURIComponent(reuploaded.applicationAssetId+':'+reuploaded.updatedAt)));
 await card.getByRole('button',{name:'Bild entfernen',exact:true}).click();await card.waitFor({state:'detached'});
 assert.equal((await api('/api/v1/admin/application-assets')).items.some(asset=>asset.originalName===filename),false);
 console.log('original_settings=real-image-upload-eight-slots-legacy-guard-native-cascade-and-no-reupload-resurrection:passed');
 await api('/api/v1/admin/application-settings',before,'PATCH');await page.reload({waitUntil:'domcontentloaded'});await root.waitFor();
 await page.locator('[data-cy="superadmin-tabs:users"]').click();await page.locator('#originalSystemAdministration[aria-busy="false"]').waitFor();
}
