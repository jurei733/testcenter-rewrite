import {Component,Input} from '@angular/core';
import {OriginalWorkspaceFileIconComponent} from './original-workspace-file-icon.component';
import {originalWorkspaceNoticeText,type OriginalWorkspaceNoticeTextPart} from './original-workspace-notice-text';

@Component({selector:'app-original-workspace-file-notice',standalone:true,imports:[OriginalWorkspaceFileIconComponent],
  template:`<div class="alert"><div class="vertical-align-middle">
    <mat-icon originalWorkspaceFileIcon [name]="level" [class]="'alert-'+level" />
    <span>@for (part of parts; track $index) {@if (part.highlight) {<span class="highlight">{{part.text}}</span>} @else {<ng-container>{{part.text}}</ng-container>}}</span></div></div>`,
  styles:[`.alert { margin-bottom:2px; } .vertical-align-middle { display:inline-flex; vertical-align:middle; align-items:center; }
    mat-icon { margin-right:0.2em; overflow:visible!important; flex-shrink:1; } .alert-error { color:#821324; } .alert-warning { color:goldenrod; }
    .alert-info { color:blue; } .alert-success { color:green; } .alert,.vertical-align-middle,span { box-sizing:content-box; }`]
})
export class OriginalWorkspaceFileNoticeComponent {
  @Input() level:'error'|'warning'|'info'|'success'='info';
  // The pinned Original inserts .highlight through innerHTML, outside its
  // emulated CSS scope. The real renderer inherits normal text styling there.
  // Preserve that behavior; adding a scoped italic/color rule would diverge.
  parts:OriginalWorkspaceNoticeTextPart[]=[];
  @Input() set text(value:string){this.parts=originalWorkspaceNoticeText(value||'');}
}
