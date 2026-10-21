import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {sampleStableViewport} from './stable-viewport-capture.mjs';
import {repaintNativeViewport} from './native-viewport-repaint.mjs';

/** Separate evidence only: never supplies pixels to a baseline comparison. */
export async function captureViewportRepaintDiagnostic(page, measure, path) {
  const refresh=await repaintNativeViewport(page,measure,path+'.hidden.png');
  const capture=await sampleStableViewport(page,measure,path+'.png',refresh.geometry);
  return{...capture,hiddenFrame:refresh.hiddenFrame,rootStyleRestored:refresh.rootStyleRestored};
}

/** Read complete paint styles before an isolated diagnostic; no DOM writes. */
export async function readHeadingPaintEvidence(page) {
  return page.evaluate(()=>{
    const style=element=>{
      const computed=getComputedStyle(element);
      return Object.fromEntries([...computed].map(key=>[key,computed.getPropertyValue(key)]));
    };
    const headings=[...document.querySelectorAll('h2,h4')].filter(element=>{
      const r=element.getBoundingClientRect();return r.bottom>0&&r.top<innerHeight;
    });
    return{viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio},
      fonts:[...document.fonts].map(face=>({family:face.family,style:face.style,weight:face.weight,
        stretch:face.stretch,status:face.status,display:face.display,featureSettings:face.featureSettings})),
      headings:headings.map(element=>{
        const chain=[];let current=element;
        while(current){chain.push({tag:current.tagName,id:current.id,classes:current.className,
          rect:current.getBoundingClientRect().toJSON(),styles:style(current)});current=current.parentElement;}
        return{text:element.textContent,textNodes:[...element.childNodes].map(node=>({type:node.nodeType,value:node.nodeValue})),chain};
      })};
  });
}

/** A/B/A evidence for the actual Source background owner; never a new baseline. */
export async function captureSurfaceBackgroundDiagnostic(page,measure,selector,color,path){
  const geometry=await measure();
  const initial=await page.evaluate(selector=>{
    const element=document.querySelector(selector);if(!element)throw Error('Owned surface is missing.');
    return{style:element.getAttribute('style'),color:getComputedStyle(element).backgroundColor};
  },selector);
  let changed;
  try{
    await page.evaluate(({selector,color,style})=>document.querySelector(selector).setAttribute('style',
      (style===null?'':style+';')+'background-color:'+color+'!important'),{selector,color,style:initial.style});
    changed=await sampleStableViewport(page,measure,path+'.source-background.png',geometry);
  }finally{
    await page.evaluate(({selector,style})=>{const element=document.querySelector(selector);
      if(style===null)element.removeAttribute('style');else element.setAttribute('style',style);
    },{selector,style:initial.style});
  }
  assert.equal(await page.evaluate(selector=>document.querySelector(selector).getAttribute('style'),selector),initial.style);
  assert.deepEqual(await measure(),geometry,'A/B/A background diagnostics must preserve the actual baseline layout.');
  const restored=await sampleStableViewport(page,measure,path+'.restored-background.png',geometry);
  return{initialBackground:initial.color,sourceBackground:color,changed,restored};
}
