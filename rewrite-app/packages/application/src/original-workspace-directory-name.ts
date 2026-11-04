import {FirstSliceError} from './first-slice-error.js';
import {OriginalPhpNumber,OriginalPhpObject} from './original-test-log-json.js';
import {originalCommandFloatString} from './original-command-codec.js';

const invalid=()=>new FirstSliceError(500,'original_workspace_name_invalid','Internal error.');

/** Source checks presence/PHP truthiness before looking up a rename target.
 * Scalar conversion and SQL varchar validation happen later, in that order. */
export function readOriginalWorkspaceName(body:unknown,operation:'create'|'rename'):unknown {
 const value=body instanceof OriginalPhpObject?body.fields.get('name'):
  body&&typeof body==='object'&&!Array.isArray(body)&&Object.hasOwn(body,'name')?(body as Record<string,unknown>).name:undefined;
 const empty=value===undefined||value===null||value===false||value===0||value===''||value==='0'||
  Array.isArray(value)&&value.length===0||value instanceof OriginalPhpNumber&&value.value===0;
 if(value===undefined||value===null||operation==='rename'&&empty)throw new FirstSliceError(400,'original_workspace_name_missing',
  operation==='create'?'New workspace name missing':'New name (name) is missing');
 return value;
}

/** PHP/PDO converts arrays to "Array", preserves int64 lexical values and
 * truncates a string parameter at its first NUL. Error messages retain source. */
export function originalWorkspaceNameParameter(value:unknown):{source:string;parameter:string} {
 let source:string;
 if(value instanceof OriginalPhpNumber)source=value.integer?.toString()??originalCommandFloatString(value.value);
 else if(value===false||value===null||value===undefined)source='';
 else if(value===true)source='1';
 else if(typeof value==='string')source=value;
 else if(typeof value==='number')source=Number.isSafeInteger(value)?String(value):originalCommandFloatString(value);
 else if(Array.isArray(value))source='Array';
 else throw invalid();
 for(const letter of source)if(letter.length===1&&letter.charCodeAt(0)>=0xd800&&letter.charCodeAt(0)<=0xdfff)throw invalid();
 return{source,parameter:source.split('\0',1)[0]!};
}

/** Apply only after Source's duplicate lookup with the unbounded parameter.
 * PostgreSQL varchar(50) discards excess U+0020, but rejects other excess text.
 * Do not trim valid leading/trailing whitespace or use JS UTF-16 length. */
export function originalWorkspaceStoredName(parameter:string):string {
 const letters=[...parameter];
 if(letters.length<=50)return parameter;
 if(letters.slice(50).some(letter=>letter!==' '))throw invalid();
 return letters.slice(0,50).join('');
}
