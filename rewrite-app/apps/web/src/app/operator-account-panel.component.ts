import {Component,inject} from '@angular/core';
import {AppShellFacade} from './app-shell.facade';
/** Account details are needed only after an operator signs in. */
@Component({selector:'app-operator-account-panel',standalone:true,
 templateUrl:'./operator-account-panel.component.html',styleUrl:'./operator-account-panel.component.css',styles:[':host{display:contents}']})
export class OperatorAccountPanelComponent {
 readonly app=inject(AppShellFacade);
 trackOperatorAccountAccess(_index:number,access:{role:string;scope:string}){return `${access.role}\u0000${access.scope}`;}
}
