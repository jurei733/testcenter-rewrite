import {raceWithSmokeDeadline} from './smoke-deadline.mjs';

/** Observe a fresh native intersection and its matching UI together. The Node
 * deadline also bounds an observer whose document stops delivering frames. */
export async function waitForStarterScrollReadiness(page,selector,{timeout=30_000}={}){
 let active=true,samples=0,last=null;
 try{
  return await raceWithSmokeDeadline((async()=>{
   while(active){
    const sample=await page.evaluate(async selector=>{
     const root=document.querySelector(selector),sentinel=root?.querySelector('.sentinel');
     if(!sentinel)return{sentinelPresent:false,consistent:false};
     const entry=await new Promise(done=>{
      const observer=new IntersectionObserver(([value])=>{observer.disconnect();done(value);});observer.observe(sentinel);
     });
     const buttonPresent=!!root.querySelector('.scroll-button'),box=sentinel.getBoundingClientRect();
     return{sentinelPresent:true,sentinelIntersecting:entry.isIntersecting,buttonPresent,
      consistent:sentinel.isConnected&&document.querySelector(selector)===root&&root.querySelector('.sentinel')===sentinel&&buttonPresent===!entry.isIntersecting,
      box:{top:box.top,bottom:box.bottom,left:box.left,right:box.right,width:box.width,height:box.height},
      viewport:[innerWidth,innerHeight],documentFocused:document.hasFocus(),visibility:document.visibilityState};
    },selector);
    if(!active)return;
    samples++;last=sample;if(sample.consistent)return sample;
   }
  })(),timeout,()=>{
   active=false;const error=Error('Starter scroll visibility did not agree with its current native intersection.');error.name='TimeoutError';throw error;
  });
 }catch(error){
  const current=await raceWithSmokeDeadline(page.evaluate(selector=>{
   const root=document.querySelector(selector),sentinel=root?.querySelector('.sentinel'),box=sentinel?.getBoundingClientRect();
   return{sentinelPresent:!!sentinel,buttonPresent:!!root?.querySelector('.scroll-button'),
    box:box?{top:box.top,bottom:box.bottom,left:box.left,right:box.right,width:box.width,height:box.height}:null,
    viewport:[innerWidth,innerHeight],documentFocused:document.hasFocus(),visibility:document.visibilityState};
  },selector),1000,()=>null).catch(()=>null);
  if(error&&typeof error==='object')error.starterScrollEvidence={observation:{samples,last},current};
  throw error;
 }finally{active=false;}
}
