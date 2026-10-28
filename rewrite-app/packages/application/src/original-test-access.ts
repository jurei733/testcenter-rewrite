import type {FirstSliceRepository} from './index.js';
import type {OriginalAuthenticationPort} from './original-authentication.js';
import {FirstSliceError} from './first-slice-error.js';
export function parseOriginalNativeTestNumber(raw:string):string{
 if(typeof raw!=='string'||!/^0*[1-9][0-9]*$/.test(raw)||raw.length>256||BigInt(raw)>9223372036854775807n)throw new FirstSliceError(400,'original_test_number_invalid','No valid test-Id: '+raw);return BigInt(raw).toString();
}
export async function readOriginalPerson(auth:OriginalAuthenticationPort,token:string){
 const state=await auth.read({token});if(state.kind!=='person')throw new FirstSliceError(403,'original_token_type_forbidden','The supplied token cannot perform that operation.');return state.participantSession;
}
export async function resolveOriginalOwnedTestScope(input:{auth:OriginalAuthenticationPort;repository:FirstSliceRepository},token:string,raw:string){
 const person=await readOriginalPerson(input.auth,token),testNumber=parseOriginalNativeTestNumber(raw),mapping=await input.repository.findOriginalTestNumber({...person,testNumber});
 if(!mapping)throw new FirstSliceError(403,'original_test_forbidden',`Access to test ${raw} is not provided.`);return{person,scope:mapping,testNumber};
}
export async function resolveOriginalOwnedTest(input:{auth:OriginalAuthenticationPort;repository:FirstSliceRepository},token:string,raw:string){
 const{person,scope:mapping,testNumber}=await resolveOriginalOwnedTestScope(input,token,raw),run=await input.repository.getTestRunById(mapping.testRunId);
 const denied=()=>new FirstSliceError(403,'original_test_forbidden',`Access to test ${raw} is not provided.`);
 if(!run||(['testRunId','participantSessionId','tenantId','workspaceId','contentReleaseId'] as const).some(key=>run[key]!==mapping[key]))throw denied();return{person,run,testNumber};
}
