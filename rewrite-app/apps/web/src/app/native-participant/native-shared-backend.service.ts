import {Injectable} from '@angular/core';import {of} from 'rxjs';
@Injectable()
export class NativeSharedBackendService {clearCache(_which:string){return of(undefined);}}
