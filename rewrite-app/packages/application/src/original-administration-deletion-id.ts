import {FirstSliceError} from './first-slice-error.js';
import {OriginalPhpNumber} from './original-test-log-json.js';
import {originalCommandFloatString} from './original-command-codec.js';

/** Body IDs pass through PDO to PostgreSQL bigint, unlike PHP(int) path IDs.
 * Prefixes/fractions/overflow fail; NULL matches no row; NUL ends a string. */
export function originalAdministrationDeletionId(value:unknown):string|null {
 if(value===null)return null;
 let parameter:string;
 if(value instanceof OriginalPhpNumber)parameter=value.integer?.toString()??originalCommandFloatString(value.value);
 else if(typeof value==='string')parameter=value.split('\0',1)[0]!;
 else if(typeof value==='number')parameter=Number.isSafeInteger(value)?String(value):originalCommandFloatString(value);
 else if(value===true)parameter='1';else parameter='';
 parameter=parameter.replace(/^[\t\n\v\f\r ]+|[\t\n\v\f\r ]+$/g,'');
 if(!/^[+-]?\d+$/.test(parameter))throw new FirstSliceError(500,'original_deletion_id_invalid','Internal error.');
 const id=BigInt(parameter);
 if(id< -9223372036854775808n||id>9223372036854775807n)throw new FirstSliceError(500,'original_deletion_id_invalid','Internal error.');
 return id.toString();
}
