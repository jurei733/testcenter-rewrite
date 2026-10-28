import {originalTestLogIdPrefix} from '@testcenter-rewrite-app/domain';
import type {FirstSliceRepository} from './index.js';
import type {OriginalAuthenticationPort} from './original-authentication.js';
import type {OriginalCommandActor} from './original-command-queue.js';
import {parseOriginalCommandFields,prepareOriginalCommandInsert,readOriginalLastCommandId,formatOriginalCommandsJson,originalCommandInteger} from './original-command-codec.js';
import {resolveOriginalOwnedTestScope} from './original-test-access.js';
import {FirstSliceError} from './first-slice-error.js';
export type OriginalCommandPort={
 requireMonitor(input:{token:string}):Promise<void>;
 requireOwner(input:{token:string;testNumber:string}):Promise<void>;
 send(input:{token:string;body:unknown}):Promise<void>;
 poll(input:{token:string;testNumber:string;body:unknown}):Promise<string>;
 acknowledge(input:{token:string;testNumber:string;commandNumber:string}):Promise<'OK'|'OK, was already marked as executed'>;
};
export function createOriginalCommandPort(input:{auth:OriginalAuthenticationPort;repository:FirstSliceRepository;now:()=>string;id:()=>string}):OriginalCommandPort{
 const monitor=async(token:string):Promise<OriginalCommandActor>=>{const state=await input.auth.read({token});if(state.kind!=='person'||state.participantSession.originalOperationalMode!=='monitor-group'||state.participantSession.originalLoginKey===undefined)throw new FirstSliceError(403,'original_monitor_forbidden','A current native group monitor is required.');const person=state.participantSession;return{tenantId:person.tenantId,workspaceId:person.workspaceId,participantSessionId:person.participantSessionId,originalLoginKey:person.originalLoginKey!,groupKey:person.groupKey};};
 return{
  async requireMonitor({token}){await monitor(token);},
  async requireOwner(request){await resolveOriginalOwnedTestScope(input,request.token,request.testNumber);},
  async send({token,body}){
   const actor=await monitor(token),fields=parseOriginalCommandFields(body),targets=[];
   for(const number of fields.testNumbers){const target=await input.repository.findOriginalCommandTarget(actor,number);if(!target)throw new FirstSliceError(404,'original_command_target_missing',`Test \`${number}\` not found. \`${fields.keyword}\` not committed.`);targets.push(target);}
   if(!targets.length)return;
   // Source nextval commits independently. Neither validation nor a failed
   // all-recipient INSERT may refund this globally reserved ID.
   const id=await input.repository.reserveOriginalCommandNumber(),stored=prepareOriginalCommandInsert(fields);
   await input.repository.appendOriginalCommand(actor,{id,...stored},targets);
  },
  async poll({token,testNumber,body}){
   const {scope}=await resolveOriginalOwnedTestScope(input,token,testNumber),last=readOriginalLastCommandId(body);
   const commands=await input.repository.listOriginalCommands(scope,last),wire=formatOriginalCommandsJson(commands);
   // Source reads/converts commands first: an unreadable command date or bad
   // body must fail before writing the conditional zero-clock POLLING event.
   if(await input.repository.touchOriginalCommandPolling(scope,input.now()))await input.repository.appendOriginalTestLogs(scope,[{
    participantTestLogId:originalTestLogIdPrefix+input.id(),tenantId:scope.tenantId,workspaceId:scope.workspaceId,participantSessionId:scope.participantSessionId,testRunId:scope.testRunId,
    unitKey:null,originalUnitId:null,logKey:'"CONNECTION"',logContent:'POLLING',timestamp:0,recordedAt:input.now()
   }]);
   return wire;
  },
  async acknowledge({token,testNumber,commandNumber}){
   const {scope}=await resolveOriginalOwnedTestScope(input,token,testNumber),number=originalCommandInteger(commandNumber).toString();
   const outcome=await input.repository.acknowledgeOriginalCommand(scope,number);
   if(outcome===null)throw new FirstSliceError(404,'original_command_missing',`Command \`${number}\` not found on test \`${scope.testNumber}\``);
   return outcome==='executed'?'OK':'OK, was already marked as executed';
  }
 };
}
