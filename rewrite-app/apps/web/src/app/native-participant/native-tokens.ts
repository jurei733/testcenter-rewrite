import {InjectionToken} from '@angular/core';
export const NATIVE_BACKEND_URL=new InjectionToken<string>('nativeBackendUrl');
export const NATIVE_FILE_SERVER_URL=new InjectionToken<string>('nativeFileServerUrl');
export const NATIVE_BROADCASTER_URL=new InjectionToken<string>('nativeBroadcasterUrl');
export const NATIVE_PRODUCTION=new InjectionToken<boolean>('nativeProduction');

/** Created once by the owned native run context, never from mutable controller state. */
export const NATIVE_RUN_TEST_ID=new InjectionToken<string>('Native participant test identity');
export const NATIVE_RENDER_NOTIFY=new InjectionToken<()=>void>('Native participant render notification');
export const NATIVE_ERROR_RECEIVER=new InjectionToken<(error:unknown)=>void>('Native participant error receiver');
