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
import {defaultParticipantExecutionMode,participantExecutionModeDefinitions,type OriginalNativeTestletTimer,type ParticipantExecutionMode} from '@testcenter-rewrite-app/domain';
import {originalTestDelivery,prepareOriginalNativeDelivery} from './original-native-delivery.js';
import type {OriginalNativeStateWriteBase, OriginalNativeStateWriteResult} from '@testcenter-rewrite-app/domain';
import {parseOriginalNativeStateWriteBase, prepareOriginalNativeStateWrite} from './original-native-write-state.js';
import {stopOriginalNativeTimer} from './original-command-queue.js';

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
export type OriginalTestRead=OriginalBookletFiles&{mode:ParticipantExecutionMode|NonNullable<ParticipantSession['originalOperationalMode']>;laststate:Record<string,unknown>;firstStart:boolean;workspaceId:string;presetBookletStates:Map<string,string>;nativeStateBase?:OriginalNativeStateWriteBase;nativeResumePending?:true;nativeGotoPending?:{unitAlias:string;minutes?:number}};
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
  enterTimer(input:{token:string;testNumber:string;body:unknown}):Promise<{
    testletKey:string;status:OriginalNativeTestletTimer['status'];startedAt:string;expiresAt:string|null;remainingMilliseconds:number;
    displayCeilingSeconds?:number;
  }>;
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
  timedBlock: (booklet: ContentReleaseBookletEntry, unitAlias: string) => {key:string;minutes:number;leave:'forbidden'|'confirm'|'allowed'}|null;
  unitAfterTimerExpiry: (booklet: ContentReleaseBookletEntry, run: TestRun, fromUnitAlias: string,
    timers: Record<string,OriginalNativeTestletTimer>, timestamp: string) => string|null;
}): OriginalTestPort {
  const personFor=(token:string)=>readOriginalTestPerson(input.auth,token);
  const number=parseOriginalNativeTestNumber;
  const forbidden=(raw:string)=>new FirstSliceError(403,'original_test_forbidden',`Access to test ${raw} is not provided.`);
  const owned=(token:string,raw:string)=>resolveOriginalOwnedTest(input,token,raw);
  const unlocked=(run:TestRun,testNumber:string)=>{if(run.locked)throw new FirstSliceError(423,'original_test_locked',`Test #${testNumber} \`${run.originalResultState?.bookletLabel??''}\` is locked.`);};
  const savedState=(run:TestRun)=>{if(run.originalTestState!==undefined){assertOriginalTestState(run.originalTestState);return structuredClone(run.originalTestState);}if(run.originalResultState?.hasTestState===false)return{};throw new FirstSliceError(409,'original_test_state_unknown','The historical saved Test state is unavailable.');};
  return {
    async enterTimer({token,testNumber:raw,body}){
      const{person,run,testNumber}=await owned(token,raw);
      if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).some(key=>!['unitAlias','action','previousStartedAt','gotoCommandId','pausedDisplay'].includes(key))||
        !('unitAlias' in body)||typeof body.unitAlias!=='string'||!body.unitAlias||body.unitAlias.length>255){
        throw new FirstSliceError(400,'native_timer_entry_invalid','A native timer entry requires a Unit alias.');
      }
      const action='action' in body?body.action:'enter';
      const previousStartedAt='previousStartedAt' in body?body.previousStartedAt:undefined;
      const gotoCommandId='gotoCommandId' in body?body.gotoCommandId:undefined;
      const rawPausedDisplay='pausedDisplay' in body?body.pausedDisplay:undefined;
      if(typeof action!=='string'||!['enter','cancel','interrupt','expire','reenter'].includes(action)||
        (action==='reenter'?typeof previousStartedAt!=='string'||previousStartedAt.length>32:previousStartedAt!==undefined)||
        gotoCommandId!==undefined&&(action!=='enter'||typeof gotoCommandId!=='string'||
          !/^[1-9][0-9]{0,18}$/.test(gotoCommandId)||BigInt(gotoCommandId)>9223372036854775807n)){
        throw new FirstSliceError(400,'native_timer_entry_invalid','Invalid native timer action.');
      }
      let pausedDisplay:{startedAt:string;expiresAt:string;displayedSeconds:number}|undefined;
      if(rawPausedDisplay!==undefined){
        if(action!=='enter'||!rawPausedDisplay||typeof rawPausedDisplay!=='object'||
          Array.isArray(rawPausedDisplay)||Object.keys(rawPausedDisplay).length!==3||
          !('startedAt' in rawPausedDisplay)||typeof rawPausedDisplay.startedAt!=='string'||rawPausedDisplay.startedAt.length>32||
          !('expiresAt' in rawPausedDisplay)||typeof rawPausedDisplay.expiresAt!=='string'||rawPausedDisplay.expiresAt.length>32||
          !('displayedSeconds' in rawPausedDisplay)||typeof rawPausedDisplay.displayedSeconds!=='number'||
          !Number.isSafeInteger(rawPausedDisplay.displayedSeconds)||rawPausedDisplay.displayedSeconds<0){
          throw new FirstSliceError(400,'native_timer_entry_invalid','Invalid paused timer display.');
        }
        pausedDisplay={startedAt:rawPausedDisplay.startedAt,expiresAt:rawPausedDisplay.expiresAt,displayedSeconds:rawPausedDisplay.displayedSeconds};
      }
      const unitAlias=body.unitAlias;
      unlocked(run,testNumber);
      const identity=run.originalResultState;
      if(typeof identity?.bookletName!=='string'||!identity.lastOpenedAt)throw unavailable();
      const{booklet}=await input.currentBooklet(person,orderedName(identity.bookletName).fileId);
      const block=input.timedBlock(booklet,unitAlias);
      const durationMilliseconds=block?Math.round(block.minutes*60000):0;
      if(!block||!Number.isSafeInteger(durationMilliseconds)||durationMilliseconds<=0){
        throw new FirstSliceError(409,'native_timer_unavailable','The Unit has no authored time limit.');
      }
      let remainingMilliseconds=0;
      const result=await input.repository.mutateParticipantRun(run,({testRun})=>{
        unlocked(testRun,testNumber);
        const timestamp=input.now(),now=Date.parse(timestamp);
        const timers=testRun.originalResultState?.nativeTestletTimers??{};
        const current=Object.hasOwn(timers,block.key)?timers[block.key]:undefined;
        const control=testRun.originalResultState?.nativeTimerControl;
        const mode=participantExecutionModeDefinitions[testRun.executionMode??defaultParticipantExecutionMode]
          ??participantExecutionModeDefinitions[defaultParticipantExecutionMode];
        if(mode.forceTimeRestrictions&&(action==='interrupt'||action==='reenter'||action==='cancel'&&block.leave==='forbidden')){
          throw new FirstSliceError(409,'native_timer_exit_forbidden','The authored timer cannot be interrupted by the participant.');
        }
        const closed=!current||current.status==='cancelled'||current.status==='expired'||
          current.status==='running'&&current.expiresAt!==null&&Date.parse(current.expiresAt)<=now;
        const grant=control?.reopen;
        const reopen=action==='enter'&&closed&&grant&&current?.reopenCommandId!==control?.commandId&&
          (grant.timerKey===undefined||grant.timerKey===block.key)&&
          originalParticipantGroupKeysEqual(grant.unitAlias,unitAlias)?grant:undefined;
        const grantedMilliseconds=reopen?.minutes!=null?Math.min(durationMilliseconds,reopen.minutes*60000):durationMilliseconds;
        const running=testRun.originalTestState?.CONTROLLER==='RUNNING'&&!control?.paused;
        const activeAlias=testRun.originalTestState?.CURRENT_UNIT_ID;
        // Command receipts can arrive in reverse order. Only an acknowledged
        // jump to this still-parked balance may enter behind a newer jump.
        const lateGoto=action==='enter'&&current?.status==='paused'&&current.parkedByGoto&&
          current.remainingSeconds>0&&control?.gotoRecovery&&gotoCommandId!==undefined&&
          BigInt(gotoCommandId)<BigInt(control.commandId)&&
          !['TERMINATED','TERMINATED_PAUSED','ERROR'].includes(String(testRun.originalTestState?.CONTROLLER))&&
          current.pendingGotoEntries?.some(entry=>entry.commandId===gotoCommandId&&
            originalParticipantGroupKeysEqual(entry.unitAlias,unitAlias));
        let timer:OriginalNativeTestletTimer;
        let resumedFrom:OriginalNativeTestletTimer|undefined;
        if(action!=='enter'&&!current){
          throw new FirstSliceError(409,'native_timer_unavailable','The Unit has no active server timer.');
        }
        if(control?.paused&&!current){
          throw new FirstSliceError(409,'native_timer_unavailable','The test is paused.');
        }
        if(current){
          const parkedTarget=control?.resumeParkedTimer;
          const monitorResume=parkedTarget?.timerKey===block.key&&originalParticipantGroupKeysEqual(parkedTarget.unitAlias,unitAlias);
          if(action==='enter'&&current.status==='paused'&&current.parkedByGoto&&running&&mode.forceTimeRestrictions&&!monitorResume&&
            typeof activeAlias==='string'&&
            !Object.values(timers).some(clock=>clock.status==='running')){
            resumedFrom=Object.values(timers).find(clock=>{
              const successor=clock.expirySuccessor;
              if(clock.status!=='expired'||!successor||successor.commandId!==control?.commandId||
                successor.parkedStartedAt!==current.startedAt||!originalParticipantGroupKeysEqual(successor.unitAlias,unitAlias)||
                ![successor.fromUnitAlias,successor.unitAlias].some(alias=>originalParticipantGroupKeysEqual(alias,activeAlias)))return false;
              return input.unitAfterTimerExpiry(booklet,testRun,successor.fromUnitAlias,timers,timestamp)===successor.unitAlias;
            });
          }
          const resume=current.status==='paused'&&!control?.paused&&(!current.parkedByGoto||
            monitorResume||lateGoto||resumedFrom!==undefined);
          remainingMilliseconds=current.status==='running'&&current.expiresAt ?
            Math.max(0,Date.parse(current.expiresAt)-now) : Math.max(0,Math.round(current.remainingSeconds*1000));
          if(!Number.isSafeInteger(remainingMilliseconds)){
            throw new FirstSliceError(409,'native_timer_unavailable','The saved timer deadline is unavailable.');
          }
          if(current.status==='running'&&remainingMilliseconds===0&&!reopen){
            timer={...current,status:'expired',remainingSeconds:0,updatedAt:timestamp,endedAt:current.expiresAt??timestamp};
            if(running&&control&&mode.forceTimeRestrictions&&(action==='expire'||action==='enter')&&typeof activeAlias==='string'&&
              originalParticipantGroupKeysEqual(activeAlias,unitAlias)){
              const nextAlias=input.unitAfterTimerExpiry(booklet,testRun,activeAlias,{...timers,[block.key]:timer},timestamp);
              const nextBlock=nextAlias&&input.timedBlock(booklet,nextAlias);
              const nextClock=nextBlock&&Object.hasOwn(timers,nextBlock.key)?timers[nextBlock.key]:undefined;
              if(nextAlias&&nextClock?.status==='paused'&&nextClock.parkedByGoto&&nextClock.remainingSeconds>0){
                timer.expirySuccessor={fromUnitAlias:activeAlias,unitAlias:nextAlias,parkedStartedAt:nextClock.startedAt,commandId:control.commandId};
              }
            }
          }else if(current.status==='running'&&(action==='cancel'||action==='interrupt')){
            if(action==='cancel')remainingMilliseconds=0;
            const {displayCeilingSeconds: _,...stoppedClock}=current;
            timer={...stoppedClock,status:action==='cancel'?'cancelled':'paused',remainingSeconds:remainingMilliseconds/1000,
              expiresAt:null,updatedAt:timestamp,endedAt:action==='cancel'?timestamp:null,
              ...(action==='interrupt'&&current.expiresAt?{pausedFromExpiresAt:current.expiresAt}:{})};
          }else if(action==='reenter'&&!control?.paused&&current.startedAt===previousStartedAt&&
            (current.status==='expired'||current.status==='cancelled')){
            remainingMilliseconds=durationMilliseconds;
            const expires=new Date(now+remainingMilliseconds);
            if(!Number.isFinite(expires.getTime())){
              throw new FirstSliceError(409,'native_timer_unavailable','The authored time limit is outside the supported clock range.');
            }
            const {expirySuccessor: _,displayCeilingSeconds: _display,pausedFromExpiresAt: _pause,...previousClock}=current;
            timer={...previousClock,status:'running',durationSeconds:remainingMilliseconds/1000,remainingSeconds:remainingMilliseconds/1000,
              startedAt:timestamp,expiresAt:expires.toISOString(),updatedAt:timestamp,endedAt:null};
          }else if(action==='enter'&&(reopen||resume)){
            if(reopen)remainingMilliseconds=grantedMilliseconds;
            const {parkedByGoto: _,pendingGotoEntries: _entries,expirySuccessor: _successor,displayCeilingSeconds: _display,
              pausedFromExpiresAt,...runningTimer}=current;
            // The owner can report the last displayed pause value only when
            // entering that exact frozen clock. The server still owns its deadline.
            const displayCeilingSeconds=!reopen&&remainingMilliseconds>0&&pausedDisplay?.startedAt===current.startedAt&&
              pausedDisplay.expiresAt===pausedFromExpiresAt
              ?Math.min(pausedDisplay.displayedSeconds,Math.ceil(remainingMilliseconds/1000)):undefined;
            timer={...runningTimer,status:remainingMilliseconds===0?'expired':'running',remainingSeconds:remainingMilliseconds/1000,
              expiresAt:remainingMilliseconds===0?null:new Date(now+remainingMilliseconds).toISOString(),
              updatedAt:timestamp,endedAt:remainingMilliseconds===0?timestamp:null,
              ...(displayCeilingSeconds===undefined?{}:{displayCeilingSeconds}),
              ...(reopen?{startedAt:timestamp,reopenCommandId:control!.commandId}:{})};
          }else return null;
        }else{
          remainingMilliseconds=durationMilliseconds;
          const snapshot=savedState(testRun).TESTLETS_TIMELEFT;
          if(mode.saveResponses&&typeof snapshot==='string'){
            let old:unknown;
            try{old=JSON.parse(snapshot)?.[block.key];}catch{/* Older malformed snapshots cannot grant additional time. */}
            if(typeof old==='number'&&Number.isFinite(old)&&(old>0||old===0&&mode.forceTimeRestrictions)){
              remainingMilliseconds=Math.min(durationMilliseconds,Math.round(old*60000));
            }
          }
          if(reopen&&remainingMilliseconds===0)remainingMilliseconds=grantedMilliseconds;
          if(!Number.isFinite(new Date(now+remainingMilliseconds).getTime())){
            throw new FirstSliceError(409,'native_timer_unavailable','The authored time limit is outside the supported clock range.');
          }
          timer={
            testletKey:block.key,status:remainingMilliseconds>0?'running':'expired',
            durationSeconds:durationMilliseconds/1000,remainingSeconds:remainingMilliseconds/1000,startedAt:timestamp,
            expiresAt:remainingMilliseconds>0?new Date(now+remainingMilliseconds).toISOString():null,
            updatedAt:timestamp,endedAt:remainingMilliseconds>0?null:timestamp,
            ...(reopen?{reopenCommandId:control!.commandId}:{})
          };
        }
        const nextTimers={...timers,[block.key]:timer};
        if(lateGoto){
          for(const [key,clock] of Object.entries(timers)){
            if(key!==block.key&&clock.status==='running')nextTimers[key]=stopOriginalNativeTimer(clock,timestamp);
          }
        }
        if(resumedFrom){
          const {expirySuccessor: _,...expiredTimer}=resumedFrom;
          nextTimers[expiredTimer.testletKey]=expiredTimer;
        }
        return {testRun,originalNativeTestletTimers:nextTimers,testLogs:[],activityEvents:[]};
      });
      const timer=result?.testRun.originalResultState?.nativeTestletTimers?.[block.key];
      if(!timer)throw forbidden(raw);
      return {testletKey:timer.testletKey,status:timer.status,startedAt:timer.startedAt,expiresAt:timer.expiresAt,remainingMilliseconds,
        ...(action==='enter'&&timer.status==='running'&&timer.displayCeilingSeconds!==undefined
          ?{displayCeilingSeconds:timer.displayCeilingSeconds}:{})};
    },
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
      const evidence=result.testRun.originalResultState,guard=evidence?.nativeWriteGuard;
      const laststate=savedState(result.testRun),control=evidence?.nativeTimerControl;
      const nativeResumePending=nativeStateProtocol==='1'&&guard&&laststate.CONTROLLER==='PAUSED'&&
        control?.paused===false&&control.resumeFromControllerRevision===(guard.fields.CONTROLLER??0);
      const recovery=control?.gotoRecovery;
      const sameAlias=typeof laststate.CURRENT_UNIT_ID==='string'&&recovery&&
        originalParticipantGroupKeysEqual(laststate.CURRENT_UNIT_ID,recovery.unitAlias);
      // RUNNING may already have arrived while the destination Unit is still loading.
      // A newer Unit write, Pause or terminal state supersedes the unfinished jump.
      const nativeGotoPending=nativeStateProtocol==='1'&&guard&&control?.paused===false&&recovery&&
        recovery.unitAlias.length<=255&&recovery.unitRevision===(guard.fields.CURRENT_UNIT_ID??0)&&
        (laststate.CONTROLLER==='PAUSED'&&recovery.controllerRevision===(guard.fields.CONTROLLER??0)||
         laststate.CONTROLLER==='RUNNING'&&!sameAlias)
        ? {unitAlias:recovery.unitAlias,...(recovery.minutes===undefined?{}:{minutes:recovery.minutes})} : undefined;
      return{...files,workspaceId,mode:person.originalOperationalMode??entry?.executionMode??defaultParticipantExecutionMode,laststate,firstStart,presetBookletStates:orderedName(identity.bookletName).states,
        ...(nativeStateProtocol==='1'&&guard?{nativeStateBase:{version:1 as const,revision:guard.revision,controlEpoch:guard.controlEpoch}}:{}),
        ...(nativeResumePending?{nativeResumePending:true as const}:{}),...(nativeGotoPending?{nativeGotoPending}:{})};
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
