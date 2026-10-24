import {Component,Input} from '@angular/core';
import {OriginalWorkspaceFileIconComponent} from './original-workspace-file-icon.component';

@Component({selector:'app-original-workspace-file-notice',standalone:true,imports:[OriginalWorkspaceFileIconComponent],
  template:`<div class="alert"><div class="vertical-align-middle">
    <mat-icon originalWorkspaceFileIcon [name]="level" [class]="'alert-'+level" />
    <span>{{text}}</span></div></div>`,
  styles:[`.alert { margin-bottom:2px; } .vertical-align-middle { display:inline-flex; vertical-align:middle; align-items:center; }
    mat-icon { margin-right:0.2em; overflow:visible!important; } .alert-error { color:#821324; } .alert-warning { color:goldenrod; }
    .alert-info { color:blue; } .alert-success { color:green; } .alert,.vertical-align-middle,span { box-sizing:content-box; }`]
})
export class OriginalWorkspaceFileNoticeComponent {
  @Input() level:'error'|'warning'|'info'|'success'='info';
  @Input() text='';
}
