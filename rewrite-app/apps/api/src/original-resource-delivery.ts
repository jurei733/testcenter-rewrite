import {createHash} from 'node:crypto';

const bootstrapSha256 = '59d5c0d479f30f75a586df86fb76449ec96e68079cf352803c910fc86b1d8e2b';
const gwtCacheSha256 = '440cd572322de7876a1a6eb4b140d3b47b5335e77f9afc72ec623098df6304a9';
const legacyDocument = 'function v(){if(t){return}var a=o.createElement(Q);a.id=L;a.style.cssText=R+S;a.tabIndex=-1;o.body.appendChild(a);t=a.contentWindow.document;if(navigator.userAgent.indexOf(T)==-1){t.open();var b=document.compatMode==U?V:W;t.write(b+X);t.close()}}';

/** GeoGebra5.4.934's GWT linker uses a same-origin hidden iframe as an
 * execution container. Run that exact bootstrap in the already isolated
 * Player document instead. No application/ancestor document is exposed.
 * Ordinary downloads and stored archive bytes retain the upstream content. */
export function originalResourceDelivery(path: string, bytes: Uint8Array, destination: unknown): {
  bytes: Uint8Array; varyByDestination?: true; adapter?: string;
} {
  const bootstrap = path.endsWith('/GeoGebra/HTML5/5.0/web3d/web3d.nocache.js');
  const cache = path.endsWith('/GeoGebra/HTML5/5.0/web3d/89EAAC7096ECFDF6F8E851E8D8B0340A.cache.js');
  if (!bootstrap && !cache) return {bytes};
  if (createHash('sha256').update(bytes).digest('hex') !== (bootstrap ? bootstrapSha256 : gwtCacheSha256)) return {bytes};
  if (destination !== 'script') return {bytes, varyByDestination: true};
  const source = Buffer.from(bytes).toString('utf8');
  let adapted: string;
  if (bootstrap) {
    if (source.split(legacyDocument).length !== 2) throw Error('Pinned GeoGebra bootstrap does not match its delivery adapter');
    adapted = 'var $wnd=window;\n'+source.replace(legacyDocument, 'function v(){if(t){return}t=o}');
  } else {
    // GWT's cookie helper assumes every document can read cookies. The opaque
    // Player cannot. Replace only these three pinned GWT references with an
    // empty, non-persistent value; document.cookie itself stays inaccessible.
    const cookie = '(uqd(),qqd).cookie';
    if (source.split(cookie).length !== 4) throw Error('Pinned GeoGebra cookie helper does not match its delivery adapter');
    adapted = "var __testcenterOpaqueGeoGebraCookie=Object.defineProperty({},'value',{get:function(){return ''},set:function(){}});\n"+
      source.split(cookie).join('(uqd(),__testcenterOpaqueGeoGebraCookie).value');
  }
  return {bytes: Buffer.from(adapted),
    varyByDestination: true, adapter: 'geogebra-gwt-opaque-v1'};
}
