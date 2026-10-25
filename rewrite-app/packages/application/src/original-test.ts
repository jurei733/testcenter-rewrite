import type {ContentReleaseBookletEntry, ParticipantSession, TestRun} from '@testcenter-rewrite-app/domain';
import type {FirstSliceRepository} from './index.js';
import type {OriginalAuthenticationPort} from './original-authentication.js';
import {originalParticipantGroupKeysEqual} from './original-participant-group.js';
import {FirstSliceError} from './first-slice-error.js';

/** PHP TestName preserves first key position while duplicate values replace it. */
export function parseOriginalTestName(input: string): {name: string; fileId: string; states: Record<string, string>} {
  const source = input.replace(/[ \t\n\r\v\f]/g, ''), separator = source.indexOf('#');
  const fileId = separator < 0 ? source : source.slice(0, separator), parameters = separator < 0 ? '' : source.slice(separator + 1);
  const states = new Map<string, string>();
  // PHP treats the literal string "0" as an empty parameter section.
  if (parameters && parameters !== '0') for (const tuple of parameters.split(';')) {
    const split = tuple.indexOf(':');
    states.set(split < 0 ? tuple : tuple.slice(0, split), split < 0 ? '' : tuple.slice(split + 1));
  }
  return {fileId, name: fileId + (states.size ? '#' + [...states].map(([key, value]) => `${key}:${value}`).join(';') : ''), states: Object.fromEntries(states)};
}
export type OriginalTestPort = {
  requirePerson(input: {token: string}): Promise<void>;
  create(input: {token: string; bookletName: string}): Promise<string>;
};
const unavailable = () => new FirstSliceError(409, 'original_test_history_unknown', 'The Original Test identity is unavailable.');

/** Creation does not enter a controller, open a Test, save state or start timers. */
export function createOriginalTestPort(input: {
  auth: OriginalAuthenticationPort; repository: FirstSliceRepository; now: () => string; id: () => string;
  currentBooklet: (person: ParticipantSession, fileId: string) => Promise<{contentReleaseId: string; booklet: ContentReleaseBookletEntry}>;
}): OriginalTestPort {
  return {async requirePerson({token}) {
    if ((await input.auth.read({token})).kind !== 'person') throw new FirstSliceError(403, 'original_token_type_forbidden', 'The supplied token cannot perform that operation.');
  }, async create(request) {
    const state = await input.auth.read({token: request.token});
    if (state.kind !== 'person') throw new FirstSliceError(403, 'original_token_type_forbidden', 'The supplied token cannot perform that operation.');
    if (typeof request.bookletName !== 'string') throw new FirstSliceError(400, 'original_request_invalid', 'Required body-parameter is missing: `bookletName`');
    const person = state.participantSession;
    const runs = (await input.repository.listTestRunsByParticipantSessionId(person.participantSessionId)).filter(run =>
      run.participantSessionId === person.participantSessionId && run.tenantId === person.tenantId && run.workspaceId === person.workspaceId);
    const select = (name: string): TestRun | undefined => {
      const found = runs.filter(run => originalParticipantGroupKeysEqual(run.originalResultState?.bookletName ?? run.bookletAssignmentKey ?? run.bookletKey, name));
      if (found.length > 1) throw new FirstSliceError(409, 'original_test_history_ambiguous', 'The Original Test identity is ambiguous.');
      if (found[0] && (typeof found[0].originalResultState?.bookletName !== 'string' || typeof found[0].originalResultState.bookletLabel !== 'string')) throw unavailable();
      return found[0];
    };
    const finish = async (run: TestRun, consumeSequence: boolean) => {
      if (typeof run.originalResultState?.bookletName !== 'string' || typeof run.originalResultState.bookletLabel !== 'string') throw unavailable();
      const number = await input.repository.getOrCreateOriginalTestNumber({...run, consumeSequence});
      if (run.locked) throw new FirstSliceError(423, 'original_test_locked', `Test #${number} \`${run.originalResultState!.bookletLabel}\` is locked.`);
      return number;
    };
    // Source reads the raw name first: normalization misses still require a
    // current physical file, even when the normalized Test already exists.
    const previous = select(request.bookletName);
    if (previous) return finish(previous, false);
    const name = parseOriginalTestName(request.bookletName);
    const current = await input.currentBooklet(person, name.fileId);
    select(name.name); // Fail closed for unknown legacy identity before reservation.
    const timestamp = input.now();
    const candidate: TestRun = {testRunId: input.id(), participantSessionId: person.participantSessionId,
      tenantId: person.tenantId, workspaceId: person.workspaceId, contentReleaseId: current.contentReleaseId,
      bookletKey: current.booklet.bookletKey, bookletAssignmentKey: name.name, presetBookletStates: name.states,
      executionMode: person.executionMode, status: 'created', locked: false, currentUnitKey: null, unitResponses: {},
      originalResultState: {bookletName: name.name, bookletLabel: current.booklet.originalBookletLabel ?? current.booklet.displayLabel,
        lastOpenedAt: null, lastTestStateAt: null, lastTestModifiedAt: timestamp, hasTestState: false},
      createdAt: timestamp, updatedAt: timestamp, completedAt: null};
    const reservation = await input.repository.getOrCreateTestRunForAssignment(candidate, undefined, true);
    if (!reservation.originalTestNumber) throw new Error('Native Test creation did not commit its numeric identity.');
    if (reservation.testRun.locked) throw new FirstSliceError(423, 'original_test_locked', `Test #${reservation.originalTestNumber} \`${reservation.testRun.originalResultState!.bookletLabel}\` is locked.`);
    return reservation.originalTestNumber;
  }};
}
