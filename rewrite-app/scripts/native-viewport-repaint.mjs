import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {writeFile} from 'node:fs/promises';

/** Clear retained native paint, then restore the exact viewport without an expected image. */
export async function repaintNativeViewport(page,measure,path){
  const geometry=await measure();
  const rootStyle=await page.evaluate(()=>document.documentElement.getAttribute('style'));
  let hidden;
  try {
    await page.evaluate(style=>document.documentElement.setAttribute('style',(style===null?'':style+';')+'opacity:0!important'),rootStyle);
    await page.evaluate(()=>new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done))));
    hidden=await page.screenshot({fullPage:false});
    await writeFile(path,hidden);
  } finally {
    await page.evaluate(style=>{
      if(style===null)document.documentElement.removeAttribute('style');else document.documentElement.setAttribute('style',style);
    },rootStyle);
  }
  assert.equal(await page.evaluate(()=>document.documentElement.getAttribute('style')),rootStyle,
    'Native repaint must restore the exact root style attribute.');
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
  return{geometry,hiddenFrame,rootStyleRestored:true,clearedPngSha256:createHash('sha256').update(hidden).digest('hex')};
}
