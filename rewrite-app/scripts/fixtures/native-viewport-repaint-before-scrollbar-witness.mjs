import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {writeFile} from 'node:fs/promises';

/** Clear retained native paint, then restore the exact viewport without an expected image. */
export async function repaintNativeViewport(page,measure,path){
  const geometry=await measure();
  const rootStyle=await page.evaluate(()=>document.documentElement.getAttribute('style'));
  const targets=await page.evaluateHandle(()=>{
    const hovered=[...document.querySelectorAll(':hover')].filter(element=>getComputedStyle(element).pointerEvents!=='none').at(-1);
    return [...new Set([document.activeElement,hovered].filter(element=>element&&element!==document.body&&element!==document.documentElement))];
  });
  const targetStyles=await targets.evaluate(elements=>elements.map(element=>element.getAttribute('style')));
  let hidden;
  try {
    try {
      // Visibility invalidates descendant raster, while opacity also clears
      // explicitly visible children. Keep actual focus and hover targets visible
      // under the transparent root; clearing cannot replay focus or mouse input.
      await page.evaluate(({elements,styles,style})=>{
        elements.forEach((element,index)=>element.setAttribute('style',(styles[index]===null?'':styles[index]+';')+'visibility:visible!important'));
        document.documentElement.setAttribute('style',(style===null?'':style+';')+'visibility:hidden!important;opacity:0!important');
      },{elements:targets,styles:targetStyles,style:rootStyle});
      await page.evaluate(()=>new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done))));
      hidden=await page.screenshot({fullPage:false});
      await writeFile(path,hidden);
    } finally {
      await page.evaluate(({elements,styles,style})=>{
        if(style===null)document.documentElement.removeAttribute('style');else document.documentElement.setAttribute('style',style);
        elements.forEach((element,index)=>{if(styles[index]===null)element.removeAttribute('style');else element.setAttribute('style',styles[index]);});
      },{elements:targets,styles:targetStyles,style:rootStyle});
    }
    assert.equal(await page.evaluate(()=>document.documentElement.getAttribute('style')),rootStyle,
      'Native repaint must restore the exact root style attribute.');
    assert.deepEqual(await targets.evaluate(elements=>elements.map(element=>element.getAttribute('style'))),targetStyles,
      'Native repaint must restore exact focused and hovered element style attributes.');
    assert.deepEqual(await measure(),geometry,'Native repaint must preserve the actual viewport and navigation layout.');
    const hiddenFrame=await page.evaluate(async png=>{
      const image=new Image();image.src='data:image/png;base64,'+png;await image.decode();
      const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
      const context=canvas.getContext('2d');context.drawImage(image,0,0);
      const data=context.getImageData(0,0,canvas.width,canvas.height).data;let nonWhitePixels=0;
      for(let i=0;i<data.length;i+=4)if(data[i]!==255||data[i+1]!==255||data[i+2]!==255||data[i+3]!==255)nonWhitePixels++;
      return{width:canvas.width,height:canvas.height,nonWhitePixels};
    },hidden.toString('base64'));
    assert.equal(hiddenFrame.nonWhitePixels,0,'Native repaint must witness a fully cleared viewport before restoring it.');
    return{geometry,hiddenFrame,rootStyleRestored:true,focusedStyleRestored:true,clearedPngSha256:createHash('sha256').update(hidden).digest('hex')};
  } finally {await targets.dispose();}
}
