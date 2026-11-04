import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import ts from 'typescript';
const cache=new Map();
export function administrationModule(name){
 const url=new URL('../apps/web/src/app/'+name+'.ts',import.meta.url),path=fileURLToPath(url);
 if(cache.has(path))return cache.get(path).exports;
 const module={exports:{}};cache.set(path,module);
 const require=createRequire(url),local=id=>id.startsWith('./')?administrationModule(id.slice(2)):require(id);
 new Function('require','exports','module',ts.transpileModule(readFileSync(url,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText)(local,module.exports,module);
 return module.exports;
}
