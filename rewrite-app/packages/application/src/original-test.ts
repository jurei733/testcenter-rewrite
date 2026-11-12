import {originalTestStateLogIdPrefix,originalTestLogIdPrefix,type ContentReleaseBookletEntry,type ParticipantSession,type TestRun} from '@testcenter-rewrite-app/domain';
import type {FirstSliceRepository} from './index.js';
import type {OriginalAuthenticationPort} from './original-authentication.js';
import {originalParticipantGroupKeysEqual} from './original-participant-group.js';
import {FirstSliceError} from './first-slice-error.js';
import {parseOriginalTestStatePatch,applyOriginalTestStatePatch,assertOriginalTestState,originalPhpMap} from './original-test-state.js';
import {encodeOriginalReportJson} from './original-workspace-report-wire.js';
import {readOriginalTestLockFields,parseOriginalTestLockLog,parseOriginalTestLogEntries} from './original-test-log-json.js';
import {hashOriginalSessionToken} from './original-session-token.js';
import type {OriginalBookletFiles} from './original-test-files.js';
import {parseOriginalNativeTestNumber,readOriginalTestPerson,resolveOriginalOwnedTest,resolveOriginalOwnedTestScope} from './original-test-access.js';
import {defaultParticipantExecutionMode,type ParticipantExecutionMode} from '@testcenter-rewrite-app/domain';
import {originalTestDelivery,prepareOriginalNativeDelivery} from './original-native-delivery.js';
import type {OriginalNativeStateWriteBase, OriginalNativeStateWriteResult} from '@testcenter-rewrite-app/domain';
import {parseOriginalNativeStateWriteBase, prepareOriginalNativeStateWrite} from './original-native-write-state.js';

/** PHP TestName preserves first key position while duplicate values replace it. */
function orderedName(input:string):{name:string;fileId:string;states:Map<string,string>}{
  const source = input.replace(/[ \t\n\r\v\f]/g, ''), separator = source.indexOf('#');
  const fileId = separator < 0 ? source : source.slice(0, separator), parameters = separator < 0 ? '' : source.slice(separator + 1);
  const states = new Map<string, string>();
  // PHP treats the literal string "0" as an empty parameter section.
  if (parameters && parameters !== '0') for (const tuple of parameters.split(';')) {
    const split = tuple.indexOf(':');
    states.set(split < 0 ? tuple : tuple.slice(0, split), split < 0 ? '' : tuple.slice(split + 1));
  }
  return {fileId, name: fileId + (states.size ? '#' + [...states].map(([key, value]) => `${key}:${value}`).join(';') : ''), states};
}
export function parseOriginalTestName(input:string):{name:string;fileId:string;states:Record<string,string>}{const parsed=orderedName(input);return{...parsed,states:Object.fromEntries(parsed.states)};}
export type OriginalTestRead=OriginalBookletFiles&{mode:ParticipantExecutionMode|NonNullable<ParticipantSession['originalOperationalMode']>;laststate:Record<string,unknown>;firstStart:boolean;workspaceId:string;presetBookletStates:Map<string,string>;nativeStateBase?:OriginalNativeStateWriteBase};
export function formatOriginalTestReadJson(value:OriginalTestRead):string{
 const resources=Object.entries(value.resources);
 const resourceJson=originalPhpMap(resources);
 if(!/^[1-9][0-9]{0,18}$/.test(value.workspaceId)||BigInt(value.workspaceId)>9223372036854775807n)throw Error('Invalid native workspace number.');
 return '{"mode":'+encodeOriginalReportJson(value.mode)+',"laststate":'+originalPhpMap(Object.entries(value.laststate))+',"xml":'+encodeOriginalReportJson(value.xml)+',"resources":'+resourceJson+',"firstStart":'+String(value.firstStart)+',"workspaceId":'+value.workspaceId+',"presetBookletStates":'+originalPhpMap([...value.presetBookletStates])+'}';
}
export type OriginalTestPort = {
  requirePerson(input: {token: string}): Promise<void>;
  requireOwner(input:{token:string;testNumber:string}):Promise<void>;
  putLog(input:{token:string;testNumber:string;body:unknown;deliveryId?:unknown}):Promise<void>;
  patchLock(input:{token:string;testNumber:string;body:unknown}):Promise<void>;
  create(input: {token: string; bookletName: string}): Promise<string>;
  read(input:{token:string;testNumber:string;nativeStateProtocol?:unknown}):Promise<OriginalTestRead>;
  patchState(input:{token:string;testNumber:string;patch:unknown;deliveryId?:unknown;stateBase?:unknown}):Promise<OriginalNativeStateWriteResult|void>;
  resource(input:{groupToken:string;workspaceNumber:string;path:string}):Promise<{bytes:Uint8Array;contentType:string}>;
};
const unavailable = () => new FirstSliceError(409, 'original_test_history_unknown', 'The Original Test identity is unavailable.');

/** Creation does not enter a controller, open a Test, save state or start timers. */
export type OriginalTestCreationContext={repository:FirstSliceRepository;now:()=>string;id:()=>string;
  currentBooklet:(person:ParticipantSession,fileId:string)=>Promise<{contentReleaseId:string;booklet:ContentReleaseBookletEntry}>};
/** Trusted native creation shared by participant PUT and monitor registration;
 * registration neither opens a Test nor rotates an existing person's bearer. */
export async function createOriginalPersonTest(input:OriginalTestCreationContext,person:ParticipantSession,bookletName:string,monitor=false):Promise<string>{
    const runs = (await input.repository.listOriginalPersonTestIdentities(person)).filter(run =>
      run.participantSessionId === person.participantSessionId && run.tenantId === person.tenantId && run.workspaceId === person.workspaceId);
    const select = (name: string): import('./original-person-tests.js').OriginalPersonTestIdentity | undefined => {
      const found = runs.filter(run => originalParticipantGroupKeysEqual(run.originalResultState?.bookletName ?? run.bookletAssignmentKey ?? run.bookletKey, name));
      if (found.length > 1) throw new FirstSliceError(409, 'original_test_history_ambiguous', 'The Original Test identity is ambiguous.');
      if (found[0] && (typeof found[0].originalResultState?.bookletName !== 'string' || typeof found[0].originalResultState.bookletLabel !== 'string')) throw unavailable();
      return found[0];
    };
    const finish = async (run: import('./original-person-tests.js').OriginalPersonTestIdentity, consumeSequence: boolean) => {
      if (typeof run.originalResultState?.bookletName !== 'string' || typeof run.originalResultState.bookletLabel !== 'string') throw unavailable();
      const number = await input.repository.getOrCreateOriginalTestNumber({...run, consumeSequence});
      if (!monitor && run.locked) throw new FirstSliceError(423, 'original_test_locked', `Test #${number} \`${run.originalResultState!.bookletLabel}\` is locked.`);
      return number;
    };
    // Source reads the raw name first: normalization misses still require a
    // current physical file, even when the normalized Test already exists.
    // Monitor registration always validates the current physical Booklet first,
    // then looks up its normalized Test name and retains an existing lock.
    const parsed=monitor?parseOriginalTestName(bookletName):undefined;
    let current=parsed?await input.currentBooklet(person,parsed.fileId):undefined;
    const previous = select(parsed?.name??bookletName);
    if (previous) return finish(previous, false);
    const name = parsed??parseOriginalTestName(bookletName);
    current??=await input.currentBooklet(person, name.fileId);
    select(name.name); // Fail closed for unknown legacy identity before reservation.
    const timestamp = input.now();
    const candidate: TestRun = {testRunId: input.id(), participantSessionId: person.participantSessionId,
      tenantId: person.tenantId, workspaceId: person.workspaceId, contentReleaseId: current.contentReleaseId,
      bookletKey: current.booklet.bookletKey, bookletAssignmentKey: name.name, presetBookletStates: name.states,
      executionMode: person.executionMode, status: 'created', locked: false, currentUnitKey: null, unitResponses: {}, originalTestState:{},
      originalResultState: {bookletName: name.name, bookletLabel: current.booklet.originalBookletLabel ?? current.booklet.displayLabel,
        lastOpenedAt: null, lastTestStateAt: null, lastTestModifiedAt: timestamp, hasTestState: false},
      createdAt: timestamp, updatedAt: timestamp, completedAt: null};
    const reservation = monitor?await input.repository.getOrCreateOriginalPersonTest(candidate):await input.repository.getOrCreateTestRunForAssignment(candidate, undefined, true);
    if (!reservation.originalTestNumber) throw new Error('Native Test creation did not commit its numeric identity.');
    if (!monitor && reservation.testRun.locked) throw new FirstSliceError(423, 'original_test_locked', `Test #${reservation.originalTestNumber} \`${reservation.testRun.originalResultState!.bookletLabel}\` is locked.`);
    return reservation.originalTestNumber;
}

export function createOriginalTestPort(input: {
  auth: OriginalAuthenticationPort; repository: FirstSliceRepository; now: () => string; id: () => string;
  readBooklet:(person:ParticipantSession,fileId:string)=>Promise<OriginalBookletFiles>;
  readResource:(scope:{tenantId:string;workspaceId:string},path:string)=>Promise<{bytes:Uint8Array;contentType:string}>;
  currentBooklet: (person: ParticipantSession, fileId: string) => Promise<{contentReleaseId: string; booklet: ContentReleaseBookletEntry}>;
}): OriginalTestPort {
  const personFor=(token:string)=>readOriginalTestPerson(input.auth,token);
  const number=parseOriginalNativeTestNumber;
  const forbidden=(raw:string)=>new FirstSliceError(403,'original_test_forbidden',`Access to test ${raw} is not provided.`);
  const owned=(token:string,raw:string)=>resolveOriginalOwnedTest(input,token,raw);
  const unlocked=(run:TestRun,testNumber:string)=>{if(run.locked)throw new FirstSliceError(423,'original_test_locked',`Test #${testNumber} \`${run.originalResultState?.bookletLabel??''}\` is locked.`);};
  const savedState=(run:TestRun)=>{if(run.originalTestState!==undefined){assertOriginalTestState(run.originalTestState);return structuredClone(run.originalTestState);}if(run.originalResultState?.hasTestState===false)return{};throw new FirstSliceError(409,'original_test_state_unknown','The historical saved Test state is unavailable.');};
  return {
    async read({token,testNumber:raw,nativeStateProtocol}){
      const{person,run,testNumber}=await owned(token,raw);unlocked(run,testNumber);
      if(nativeStateProtocol!==undefined&&nativeStateProtocol!=='1')throw new FirstSliceError(400,'original_state_protocol_invalid','Invalid native Test-state protocol.');
      const identity=run.originalResultState;if(typeof identity?.bookletName!=='string'||identity.lastOpenedAt===undefined)throw unavailable();savedState(run);
      const entry=(await input.repository.listParticipantRosterEntriesByWorkspace(person.tenantId,person.workspaceId)).find(row=>row.originalLoginIdentity===true&&row.loginKey===person.originalLoginKey);if(!entry&&person.originalOperationalMode===undefined)throw new FirstSliceError(410,'original_login_gone','The Original login is no longer available.');
      const workspaceId=await input.repository.getOrCreateOriginalWorkspaceNumber(person),fileId=orderedName(identity.bookletName).fileId;
      let files:OriginalBookletFiles;try{files=await input.readBooklet(person,fileId);}catch(error){if(error instanceof FirstSliceError&&error.statusCode===404)throw new FirstSliceError(404,'original_booklet_unavailable',`No Booklet with id \`${fileId}\` found on workspace \`${workspaceId}\`!`);throw error;}
      let firstStart=false;
      const result=await input.repository.mutateParticipantRun(run,context=>{unlocked(context.testRun,testNumber);savedState(context.testRun);
        if(context.testRun.originalResultState?.lastOpenedAt===undefined)throw unavailable();firstStart=context.testRun.originalResultState.lastOpenedAt===null;
        const initialize=nativeStateProtocol==='1'&&!context.testRun.originalResultState.nativeWriteGuard;
        if(!firstStart&&!initialize)return null;
        const timestamp=firstStart?input.now():undefined;
        return{testRun:timestamp?{...context.testRun,updatedAt:timestamp}:context.testRun,testLogs:[],activityEvents:[],
          ...(timestamp?{originalResultOpenedAt:timestamp}:{}),...(initialize?{initializeOriginalNativeWriteGuard:true as const}:{})};});
      if(!result)throw forbidden(raw);
      const guard=result.testRun.originalResultState?.nativeWriteGuard;
      return{...files,workspaceId,mode:person.originalOperationalMode??entry?.executionMode??defaultParticipantExecutionMode,laststate:savedState(result.testRun),firstStart,presetBookletStates:orderedName(identity.bookletName).states,
        ...(nativeStateProtocol==='1'&&guard?{nativeStateBase:{version:1 as const,revision:guard.revision,controlEpoch:guard.controlEpoch}}:{})};
    },
    async patchState({token,testNumber:raw,patch,deliveryId,stateBase}){
      const{run,testNumber}=await owned(token,raw);const entries=parseOriginalTestStatePatch(patch),base=parseOriginalNativeStateWriteBase(stateBase);
      if(base&&(deliveryId===undefined||base.previousDeliveryId===deliveryId))throw new FirstSliceError(400,'original_state_base_invalid','A causal state packet requires its own native delivery identity.');
      const delivery=originalTestDelivery({id:deliveryId,kind:'state',scope:{...run,testNumber},entries:base?{entries,base}:entries,now:input.now});
      let writeResult:OriginalNativeStateWriteResult|undefined;
      const result=await input.repository.mutateParticipantRun({...run,...(delivery?{deliveryId:delivery.deliveryId}:{}),
        ...(base?.previousDeliveryId?{precedingDeliveryId:'native-test-state:'+base.previousDeliveryId}:{})},context=>{
        const receipt=delivery?prepareOriginalNativeDelivery(run,delivery,context.progressDelivery??undefined,'test'):undefined;
        if(receipt===null){writeResult=context.progressDelivery?.nativeStateWriteResult;return null;}
        let applicable=entries;
        if(base){
          const guard=context.testRun.originalResultState?.nativeWriteGuard;
          if(!guard)throw new FirstSliceError(409,'original_state_protocol_required','Read the current native Test-state base before writing.');
          const prepared=prepareOriginalNativeStateWrite(guard,base,entries,context.precedingProgressDelivery?.nativeStateWriteResult);
          applicable=prepared.entries;writeResult=prepared.result;
          if(receipt)receipt.nativeStateWriteResult=writeResult;
        }
        const values=applyOriginalTestStatePatch(savedState(context.testRun),applicable),timestamp=input.now();
        const testLogs=entries.map(entry=>({participantTestLogId:originalTestStateLogIdPrefix+input.id(),tenantId:run.tenantId,workspaceId:run.workspaceId,participantSessionId:run.participantSessionId,testRunId:run.testRunId,unitKey:null,originalUnitId:null,logKey:entry.key,logContent:encodeOriginalReportJson(entry.content),timestamp:entry.timeStamp,recordedAt:timestamp,...(entry.timeStamp===0?{originalTimestamp:0 as const}:{})}));
        return{...(base&&!writeResult?.appliedKeys.length?{testRun:context.testRun}:{testRun:{...context.testRun,updatedAt:timestamp},originalTestState:values,originalResultModifiedAt:timestamp}),
          originalNativeStateKeys:applicable.filter(entry=>entry.timeStamp>0).map(entry=>entry.key),testLogs,activityEvents:[],...(receipt?{progressDelivery:receipt}:{})};});
      if(!result)throw forbidden(raw);
      return writeResult;
    },
    async requireOwner({token,testNumber}){await resolveOriginalOwnedTestScope(input,token,testNumber);},
    async patchLock({token,testNumber,body}){
      const {scope}=await resolveOriginalOwnedTestScope(input,token,testNumber);
      const fields=readOriginalTestLockFields(body);
      // Source57 proves a constructor/INSERT failure must leave this committed.
      await input.repository.lockOriginalTest(scope,input.now());
      const entry=parseOriginalTestLockLog(fields),recordedAt=input.now();
      await input.repository.appendOriginalTestLogs(scope,[{participantTestLogId:originalTestLogIdPrefix+input.id(),
        tenantId:scope.tenantId,workspaceId:scope.workspaceId,participantSessionId:scope.participantSessionId,testRunId:scope.testRunId,
        unitKey:null,originalUnitId:null,logKey:entry.key,logContent:entry.content,timestamp:entry.timeStamp,
        ...(entry.originalClientTimestamp===undefined?{}:{originalClientTimestamp:entry.originalClientTimestamp}),recordedAt}]);
    },
    async putLog({token,testNumber,body,deliveryId}){
      const {scope}=await resolveOriginalOwnedTestScope(input,token,testNumber);
      const entries=parseOriginalTestLogEntries(body),delivery=originalTestDelivery({id:deliveryId,kind:'log',scope,entries,now:input.now}),target={...scope,...(delivery?{delivery}:{})};
      if(!entries.length){await input.repository.appendOriginalTestLogs(target,[]);return;}
      const recordedAt=input.now();
      await input.repository.appendOriginalTestLogs(target,entries.map(entry=>({participantTestLogId:originalTestLogIdPrefix+input.id(),
        tenantId:scope.tenantId,workspaceId:scope.workspaceId,participantSessionId:scope.participantSessionId,testRunId:scope.testRunId,
        unitKey:null,originalUnitId:null,logKey:entry.key,logContent:entry.content,timestamp:entry.timeStamp,...(entry.originalClientTimestamp===undefined?{}:{originalClientTimestamp:entry.originalClientTimestamp}),recordedAt})));
    },
    async resource({groupToken,workspaceNumber,path}){
      if(typeof groupToken!=='string'||!groupToken)throw new FirstSliceError(401,'original_group_token_missing','No Token given');
      const group=groupToken.length<=256?await input.repository.findOriginalSessionTokenByHash(hashOriginalSessionToken(groupToken)):null;
      let canonical:string;try{canonical=number(workspaceNumber);}catch{throw new FirstSliceError(403,'original_group_token_invalid','Group-Token not valid');}
      if(group?.kind!=='group'||!await input.repository.matchesOriginalWorkspaceNumber({...group,workspaceNumber:canonical}))throw new FirstSliceError(403,'original_group_token_invalid','Group-Token not valid');
      return input.readResource(group,path);
    },async requirePerson({token}) {
    await personFor(token);
  }, async create(request) {
    const person = await personFor(request.token);
    if (typeof request.bookletName !== 'string') throw new FirstSliceError(400, 'original_request_invalid', 'Required body-parameter is missing: `bookletName`');
    return createOriginalPersonTest(input,person,request.bookletName);
  }};
}
