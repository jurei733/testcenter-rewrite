export type NativeSaveRecord = {bucket:string;kind:'unit'|'test';actor:string;testId:string;revision:number;sealed:boolean;pending:number;document:any;preferredUnitAlias?:string;receipts?:Record<string,string>};
export type NativeSaveRuntime = {
 authorize(token:string):Promise<string>;
 retire(token:string):Promise<void>;
 actorHash(token:string):Promise<string>;
 entryFingerprint(entry:unknown):Promise<string>;
 putSnapshot(bucket:string,text:string,sealed?:boolean,preferredUnitAlias?:string):Promise<void>;
 readRecord(bucket:string):Promise<NativeSaveRecord|undefined>;
 pending():Promise<NativeSaveRecord[]>;
 drain(options?:Record<string,unknown>):Promise<void>;
 yieldUnits(actor:string,testId:string):void;
 runRecovery<T>(actor:string,testId:string,signal:AbortSignal,operation:()=>Promise<T>):Promise<T>;
};
export function createRuntime(env:{indexedDB:IDBFactory;crypto:Crypto;locks:LockManager;fetch:typeof fetch;origin:string}):NativeSaveRuntime;
export const SYNC_TAG:string;
export function runLock(actor:string,testId:string):string;
export function unitLock(actor:string,testId:string):string;
export function snapshot(bucket:string,text:string):Pick<NativeSaveRecord,'bucket'|'kind'|'actor'|'testId'|'revision'|'document'>;
