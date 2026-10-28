import type {ParticipantViewSettings} from '@testcenter-rewrite-app/domain';

export const originalSessionPaths = {
  session: '/session', login: '/session/login', person: '/session/person',
  challenge: '/session/challenge', personChallenge: '/session/person/challenge'
} as const;
export type OriginalTestAccess = {id: string; type: 'test'; label: string; flags: {locked: boolean; running: boolean}};
export type OriginalTestGroupMonitorAccess = {id:string;type:'testGroupMonitor';label:string;flags:[]};
export type OriginalAccessSet = {
  token: string; displayName: string; loginName: string; groupLabel: string; id: null; pwSetByAdmin: null;
  customTexts: Record<string, string>; flags: string[];
  claims: {test?: OriginalTestAccess[]; review?: []; testGroupMonitor?:OriginalTestGroupMonitorAccess[]}; groupToken: string;
  viewSettings: ParticipantViewSettings | []; access: {test?: string[]; review?: []; testGroupMonitor?:string[]};
};
export type OriginalWorkChallenge = {algorithm: 'SHA-256'; challenge: string; maxNumber: number; salt: string; signature: string};
export type OriginalWorkSolution = Omit<OriginalWorkChallenge, 'maxNumber'> & {number: number};
