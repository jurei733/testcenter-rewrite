import {HttpErrorResponse} from '@angular/common/http';
import {AppError,isTestModeName,type AppErrorType} from './app.interfaces';

// Pinned Original retry.interceptor.ts's test policy. Each logical request
// additionally retains the existing finite20s native deadline.
export const nativeTestRetryDelays=[50,500,1000,2000] as const;
export const nativeRetryExcludedStatus=[401,403] as const;

/** Original ErrorInterceptor's production status mapping, with fetch transport. */
export function nativeRequestError(error:unknown):AppError {
 if(error instanceof AppError)return error;
 if(!(error instanceof HttpErrorResponse))return new AppError({
  label:'Netzwerkfehler',description:error instanceof Error?error.message:String(error),code:0,type:'network'
 });
 const names:Record<number,string>={202:'Fehlerhafte Daten',204:'Fehlerhafte Daten',207:'Fehlerhafte Daten',400:'Fehlerhafte Daten',
  401:'Bitte für diese Aktion erst anmelden!',403:'Sitzung nicht mehr gültig.',404:'Daten/Objekt nicht gefunden.',
  410:'Anmeldung abgelaufen oder noch nicht gültig. Bitte erneut anmelden!',409:'Konflikt mit vorhandenen Daten.',
  423:'Test ist gesperrt!',429:'Login ist gesperrt!',500:'Allgemeines Server-Problem.',
  502:'Der Server ist augenblicklich nicht erreichbar',503:'Der Server ist augenblicklich nicht erreichbar',504:'Der Server ist augenblicklich überlastet!'};
 const type:AppErrorType=[401,403,410,429].includes(error.status)?'session':[502,503].includes(error.status)?'network_temporally':names[error.status]?'backend':'network';
 const payload=error.error;
 const description=typeof payload==='string'?payload:payload&&typeof payload==='object'&&'text' in payload&&'error' in payload?`${payload.error}: ${payload.text}`:error.statusText;
 const mode=error.headers.get('test-mode');
 return new AppError({code:error.status,label:names[error.status]??'Unbekanntes Verbindungsproblem',type,description,
  details:error.message,errorId:error.headers.get('error-id')?.toLowerCase(),testMode:mode&&isTestModeName(mode)?mode:null});
}
