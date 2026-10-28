import {mkdir,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {raceWithSmokeDeadline} from './smoke-deadline.mjs';

// Only for the owned completeness smoke document. Observe actual native input;
// never redispatch a click, read form values, or alter a product event handler.
export function observeExitCompletenessInput() {
  const events=[];window.__ownedExitCompletenessEvents=events;
  const ids=new WeakMap();let serial=0;
  const classify=element=>element?.closest?.('#participantApplicationLogoButton')?'logo':
    element?.closest?.('[data-cy="close-deny-navigation-message"]')?'deny-close':
    element?.closest?.('#participantConfirmationContinueButton')?'continue':'other';
  for(const type of ['pointerdown','pointerup','click'])document.addEventListener(type,event=>{
    const target=event.target instanceof Element?event.target:null;
    const owner=target?.closest('#participantApplicationLogoButton,[data-cy="close-deny-navigation-message"],#participantConfirmationContinueButton')??target;
    if(owner&&!ids.has(owner))ids.set(owner,++serial);
    const row={type,at:Date.now(),trusted:event.isTrusted,target:classify(target),node:owner?ids.get(owner):null,
      connected:owner?.isConnected??false,defaultPrevented:event.defaultPrevented};
    events.push(row);if(events.length>100)events.shift();
    queueMicrotask(()=>{row.after={connected:owner?.isConnected??false,defaultPrevented:event.defaultPrevented,
      dialogs:document.querySelectorAll('mat-dialog-container').length};});
  },true);
}

export function readExitCompletenessDocument() {
  const button=document.querySelector('#participantApplicationLogoButton');
  const rect=button?.getBoundingClientRect();
  const center=rect?document.elementFromPoint(rect.x+rect.width/2,rect.y+rect.height/2):null;
  const finite=document.getAnimations().filter(animation=>animation.effect?.getComputedTiming().iterations!==Infinity);
  return {events:window.__ownedExitCompletenessEvents??[],viewport:{width:innerWidth,height:innerHeight},
    state:{starter:!!document.querySelector('#originalParticipantStarter mat-card'),player:!!document.querySelector('iframe'),
      paused:!!document.querySelector('#participantRoutePausedState'),toastCount:document.querySelectorAll('[data-cy^="toast-text-"]').length},
    logo:button?{disabled:button.hasAttribute('disabled'),connected:button.isConnected,
      rect:{x:rect.x,y:rect.y,width:rect.width,height:rect.height},centerHitsLogo:center===button||!!center&&button.contains(center)}:null,
    dialogs:[...document.querySelectorAll('mat-dialog-container')].map(dialog=>({classes:[...dialog.classList],
      denial:!!dialog.querySelector('[data-cy="deny-navigation-message"]'),confirmation:!!dialog.querySelector('#participantConfirmationContinueButton')})),
    finiteAnimations:finite.map(animation=>({pending:animation.pending,state:animation.playState})).slice(0,30)};
}
const phases=new Set(['navigation','sign-in','player-ready','save-incomplete','assert-denied','denial-open','denial-visuals',
  'escape-and-focus','denial-reopen','denial-close','save-complete','complete-logo','complete-dialog','return-starter','context-close']);
const errorCategory=error=>['Error','TimeoutError','AssertionError','TargetClosedError'].includes(error?.name)?error.name:'Error';
export function createExitCompletenessDiagnostics({page,key,artifactRoot}) {
  if(!/^[A-Za-z0-9-]{1,120}$/.test(key))throw Error('Expected an owned completeness case key.');
  if(typeof artifactRoot!=='string'||!artifactRoot.trim())throw Error('Expected an owned diagnostic directory.');
  let phase='navigation';const history=[];
  return {
    async install(){await page.addInitScript(observeExitCompletenessInput);},
    mark(value){if(!phases.has(value))throw Error('Unknown completeness phase.');phase=value;history.push({phase,at:Date.now()});
      console.log('exit_completeness_phase='+JSON.stringify({key,phase}));},
    async capture(error){
      const directory=join(resolve(artifactRoot),'exit-completeness');await mkdir(directory,{recursive:true});
      let document,documentError,screenshotError;
      try {document=await raceWithSmokeDeadline(page.evaluate(readExitCompletenessDocument),5000,()=>{throw Error('Owned diagnostic snapshot timed out.');});}
      catch(failure){documentError=errorCategory(failure);}
      try {await page.screenshot({path:join(directory,key+'.png'),fullPage:false,timeout:5000});}
      catch(failure){screenshotError=errorCategory(failure);}
      // No exception message/stack, URL/query, HTTP fields, environment, HTML,
      // answer packets, input values or storage can enter this public receipt.
      await writeFile(join(directory,key+'.json'),JSON.stringify({version:1,key,phase,history,error:errorCategory(error),
        document,documentError,screenshotError},null,2)+'\n');
    }
  };
}
