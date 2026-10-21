import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {captureStableViewport} from './stable-viewport-capture.mjs';

/** Separate evidence only: never supplies pixels to a baseline comparison. */
export async function captureViewportRepaintDiagnostic(page, measure, path) {
  const geometry=await measure();
  const rootStyle=await page.evaluate(()=>document.documentElement.getAttribute('style'));
  let hidden;
  try {
    await page.evaluate(style=>document.documentElement.setAttribute('style',(style===null?'':style+';')+'opacity:0!important'),rootStyle);
    await page.evaluate(()=>new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done))));
    hidden=await page.screenshot({fullPage:false});
    await writeFile(path+'.hidden.png',hidden);
  } finally {
    await page.evaluate(style=>{
      if(style===null)document.documentElement.removeAttribute('style');else document.documentElement.setAttribute('style',style);
    },rootStyle);
  }
  assert.equal(await page.evaluate(()=>document.documentElement.getAttribute('style')),rootStyle,
    'Diagnostic repaint must restore the exact root style attribute.');
  assert.deepEqual(await measure(),geometry,'Diagnostic repaint must restore the actual baseline geometry.');
  const hiddenFrame=await page.evaluate(async png=>{
    const image=new Image();image.src='data:image/png;base64,'+png;await image.decode();
    const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
    const context=canvas.getContext('2d');context.drawImage(image,0,0);
    const data=context.getImageData(0,0,canvas.width,canvas.height).data;let nonWhitePixels=0;
    for(let i=0;i<data.length;i+=4)if(data[i]!==255||data[i+1]!==255||data[i+2]!==255||data[i+3]!==255)nonWhitePixels++;
    return{width:canvas.width,height:canvas.height,nonWhitePixels};
  },hidden.toString('base64'));
  assert.equal(hiddenFrame.nonWhitePixels,0,'The diagnostic must witness a fully cleared native viewport before restoring it.');
  const capture=await captureStableViewport(page,measure,path+'.png');
  return{...capture,hiddenFrame,rootStyleRestored:true};
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
    changed=await captureStableViewport(page,measure,path+'.source-background.png');
  }finally{
    await page.evaluate(({selector,style})=>{const element=document.querySelector(selector);
      if(style===null)element.removeAttribute('style');else element.setAttribute('style',style);
    },{selector,style:initial.style});
  }
  assert.equal(await page.evaluate(selector=>document.querySelector(selector).getAttribute('style'),selector),initial.style);
  assert.deepEqual(await measure(),geometry,'A/B/A background diagnostics must preserve the actual baseline layout.');
  const restored=await captureStableViewport(page,measure,path+'.restored-background.png');
  return{initialBackground:initial.color,sourceBackground:color,changed,restored};
}
