import { NgTemplateOutlet } from "@angular/common";
import { ChangeDetectorRef, Component, EventEmitter, Input, Output, TemplateRef, inject, type OnChanges, type OnDestroy } from "@angular/core";
import { Router, RouterLink } from "@angular/router";
import { MatButton, MatFabButton, MatIconButton } from "@angular/material/button";
import { MatCheckbox } from "@angular/material/checkbox";
import { MatDialog, type MatDialogRef } from "@angular/material/dialog";
import { MatDivider } from "@angular/material/divider";
import { MatMenu, MatMenuTrigger } from "@angular/material/menu";
import { MatProgressBar } from "@angular/material/progress-bar";
import { MatSort, MatSortHeader, type Sort } from "@angular/material/sort";
import { MatTable, MatColumnDef, MatHeaderCellDef, MatHeaderCell, MatCellDef, MatCell,
  MatHeaderRowDef, MatHeaderRow, MatRowDef, MatRow } from "@angular/material/table";
import { MatTabNav, MatTabLink, MatTabNavPanel } from "@angular/material/tabs";
import { MatToolbar } from "@angular/material/toolbar";
import { MatTooltip } from "@angular/material/tooltip";
import { AppShellFacade } from "./app-shell.facade";
import { ApplicationSettingsService } from "./application-settings.service";
import { ConfirmationDialogService } from "./confirmation-dialog.service";
import { RewriteAppShellRequestService } from "./rewrite-app-shell-request.service";
import { RewriteAppUiStateService } from "./rewrite-app-ui-state.service";
import { OpsViewFacade } from "./ops-view.facade";
import type { AdministrationSection } from "./administration-nav.component";
import { OriginalOverlayStylesComponent } from "./original-overlay-styles.component";
import { OriginalAdministrationIconComponent } from "./original-administration-icon.component";
import { OriginalAdministrationController } from "./original-administration-controller";
import type { AdminUserDirectoryItem } from "@testcenter-rewrite-app/contracts";
import type { OriginalWorkspace } from "./original-administration-controller";
import { OriginalAdministrationSurfaceStylesComponent } from "./original-administration-surface-styles.component";
import { OriginalAdministrationEditorComponent, type OriginalAdministrationEditorData } from "./original-administration-editor.component";
import { OriginalParticipantLogoutDialogComponent } from "./original-participant-logout-dialog.component";
import { parseJsonDocument, readStringValue } from "./rewrite-app-shell.readers";

// IQB Testcenter 19 Superadmin tables and header (MIT), using the Rewrite's
// existing authorization, role-assignment and workspace aggregate APIs.
@Component({
  selector:"app-original-system-administration",standalone:true,
  imports:[NgTemplateOutlet,RouterLink,MatButton,MatFabButton,MatIconButton,MatCheckbox,MatDivider,
    MatMenu,MatMenuTrigger,MatProgressBar,MatSort,MatSortHeader,MatTable,MatColumnDef,MatHeaderCellDef,MatHeaderCell,
    MatCellDef,MatCell,MatHeaderRowDef,MatHeaderRow,MatRowDef,MatRow,MatTabNav,MatTabLink,MatTabNavPanel,
    MatToolbar,MatTooltip,OriginalOverlayStylesComponent,OriginalAdministrationIconComponent,OriginalAdministrationSurfaceStylesComponent],
  templateUrl:"./original-system-administration.component.html",
  styleUrls:["./original-login-theme.scss","./original-system-administration.component.css"]
})
export class OriginalSystemAdministrationComponent implements OnChanges, OnDestroy {
  @Input({required:true}) sessionToken = "";
  @Input() section: AdministrationSection = "users";
  @Input() settingsTemplate: TemplateRef<unknown> | null = null;
  @Output() sectionSelected = new EventEmitter<AdministrationSection>();
  readonly app = inject(AppShellFacade);
  readonly settings = inject(ApplicationSettingsService);
  private readonly view = inject(OpsViewFacade);
  private readonly request = inject(RewriteAppShellRequestService);
  private readonly state = inject(RewriteAppUiStateService);
  private readonly changed = inject(ChangeDetectorRef);
  private readonly dialogs = inject(MatDialog);
  private readonly confirmation = inject(ConfirmationDialogService);
  private readonly router = inject(Router);
  private editor: MatDialogRef<OriginalAdministrationEditorComponent> | null = null;
  private logout: MatDialogRef<OriginalParticipantLogoutDialogComponent> | null = null;
  private confirmationId: number | null = null;
  private destroyed = false;
  private userSort: Sort = {active:"name",direction:""};
  private workspaceSort: Sort = {active:"name",direction:""};
  private permissionSort: Sort = {active:"label",direction:""};
  private readonly modificationDate = new Intl.DateTimeFormat("de-DE",{
    day:"2-digit",month:"2-digit",year:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"
  });
  formatModification(value: string | null): string {
    if(!value)return "";
    const date=new Date(value);if(!Number.isFinite(date.getTime()))return "";
    const parts=Object.fromEntries(this.modificationDate.formatToParts(date).map(part=>[part.type,part.value]));
    return `${parts["day"]}.${parts["month"]}.${parts["year"]} ${parts["hour"]}:${parts["minute"]}`;
  }
  readonly sections: Array<{id:AdministrationSection;label:string}> = [
    {id:"users",label:"Admins"},{id:"workspaces",label:"Arbeitsbereiche"},{id:"settings",label:"Einstellungen"}
  ];
  readonly directory = new OriginalAdministrationController(
    (method,path,body,token)=>this.request.request("Systemverwaltung",method,path,body,{quiet:true,headers:{authorization:`Bearer ${token}`}}),
    ()=>({token:this.state.ops.adminSessionToken.trim(),adminUserId:this.view.currentAdminUserId}),
    ()=>{if(!this.destroyed)this.changed.markForCheck();}
  );

  ngOnChanges(): void {
    // The token is an input so a new administrator cannot inherit a mounted
    // old administrator's directory, pending permissions or password dialog.
    if (this.sessionToken.trim() !== this.connectedToken) {
      this.editor?.close(false); this.logout?.close(false); this.closeOwnedConfirmation();
      this.connectedToken = this.sessionToken.trim();
      void this.directory.connect(this.connectedToken);
    }
  }
  private connectedToken = "";
  get selfId(): string { return this.view.currentAdminUserId; }
  get version(): string {
    const commit=readStringValue(parseJsonDocument(this.app.ops.runtimeHealthView),["manifest","build","commitSha"]);
    return commit?`Rewrite (${commit.slice(0,12)})`:"Rewrite";
  }
  get showDirectoryProblem(): boolean { return !!this.directory.problem && !this.editor && this.confirmationId===null; }
  private consumeDialogProblem(): string {
    const problem=this.directory.problem||"Die Aktion konnte nicht abgeschlossen werden.";
    if(!this.destroyed){this.directory.problem="";this.directory.problemCode="";this.changed.markForCheck();}
    return problem;
  }
  get users() {
    const values=[...this.directory.admins];
    if(this.userSort.direction)values.sort((a,b)=>this.direction(this.userSort)*a.adminUser.username.localeCompare(b.adminUser.username));
    return values;
  }
  get workspaces() {
    const values=[...this.directory.workspaces];
    if(this.workspaceSort.direction)values.sort((a,b)=>this.direction(this.workspaceSort)*(this.workspaceSort.active==="modification_timestamp"
      ?(a.latestFileModificationAt??"").localeCompare(b.latestFileModificationAt??"")
      :a.displayName.localeCompare(b.displayName)));
    return values;
  }
  private direction(sort: Sort): number { return sort.direction==="desc"?-1:1; }
  readonly trackUser = (_index:number,row:AdminUserDirectoryItem): string => row.adminUser.adminUserId;
  readonly trackWorkspace = (_index:number,row:OriginalWorkspace): string => row.workspaceId;
  readonly trackPermission = (_index:number,row:{adminUserId:string;workspaceId:string}): string => JSON.stringify([row.adminUserId,row.workspaceId]);
  get permissionRows(): Array<{label:string;adminUserId:string;workspaceId:string}> {
    const rows = this.section==="users"
      ?this.directory.selectedAdmin?this.workspaces.map(workspace=>({label:workspace.displayName,workspaceId:workspace.workspaceId,adminUserId:this.directory.selectedAdminId})):[]
      :this.directory.selectedWorkspace?this.users.map(user=>({label:user.adminUser.username,adminUserId:user.adminUser.adminUserId,workspaceId:this.directory.selectedWorkspaceId})):[];
    if(this.permissionSort.direction)rows.sort((a,b)=>this.direction(this.permissionSort)*(this.permissionSort.active==="selectCheckbox"
      ?this.directory.access(a.adminUserId,a.workspaceId).localeCompare(this.directory.access(b.adminUserId,b.workspaceId)):a.label.localeCompare(b.label)));
    return rows;
  }
  sortUsers(sort: Sort): void { this.userSort=sort; }
  sortWorkspaces(sort: Sort): void { this.workspaceSort=sort; }
  sortPermissions(sort: Sort): void { this.permissionSort=sort; }
  choose(section: AdministrationSection): void {
    if(this.directory.busy)return;
    this.directory.clearSelection();this.section=section;this.sectionSelected.emit(section);
  }
  private openEditor(kind: OriginalAdministrationEditorData["kind"], name = ""): void {
    if(this.destroyed || this.directory.busy || this.editor)return;
    const userId=this.directory.selectedAdminId,workspaceId=this.directory.selectedWorkspaceId;
    const token=this.connectedToken;
    this.editor=this.dialogs.open(OriginalAdministrationEditorComponent,{
      width:"600px",panelClass:"original-administration-editor-dialog",
      data:{kind,name,submit:async value=>{
        if(this.destroyed || this.connectedToken!==token || this.sessionToken.trim()!==token)return "Die Anmeldung hat sich geändert. Bitte schließen Sie den Dialog.";
        const result=kind==="create-user"?await this.directory.createUser(value.name,value.password)
          :kind==="create-workspace"?await this.directory.createWorkspace(value.name)
          :kind==="rename-workspace"?await this.directory.renameWorkspace(workspaceId,value.name)
          :await this.directory.resetPassword(userId,value.password);
        return result?null:this.consumeDialogProblem();
      }} satisfies OriginalAdministrationEditorData
    });
    this.editor.afterClosed().subscribe(()=>{this.editor=null;});
  }
  addUser(): void { this.openEditor("create-user"); }
  addWorkspace(): void { this.openEditor("create-workspace"); }
  renameWorkspace(): void { if(this.directory.selectedWorkspace)this.openEditor("rename-workspace",this.directory.selectedWorkspace.displayName); }
  resetPassword(): void { if(this.directory.selectedAdmin)this.openEditor("reset-password",this.directory.selectedAdmin.adminUser.username); }

  async confirmAction(kind:"delete-user"|"delete-workspace"|"superadmin"): Promise<void> {
    const user=this.directory.selectedAdmin,workspace=this.directory.selectedWorkspace,token=this.connectedToken;
    if(this.destroyed || this.directory.busy || this.confirmationId!==null || (kind==="delete-workspace"?!workspace:!user))return;
    const title=kind==="delete-workspace"?"Löschen von Arbeitsbereichen"
      :kind==="delete-user"?"Löschen von Administrator:innen":"Superadmin-Status ändern";
    const confirmLabel=kind==="delete-workspace"?"Arbeitsbereich löschen":kind==="delete-user"?"Administrator:in löschen":"Bestätigen";
    const message=kind==="delete-workspace"?`Soll Arbeitsbereich "${workspace!.displayName}" gelöscht werden?`
      :kind==="delete-user"?`Soll Administrator:in "${user!.adminUser.username}" gelöscht werden?`
      :`Soll der Superadmin-Status von "${user!.adminUser.username}" geändert werden?`;
    const pending=this.confirmation.confirm({title,message,confirmLabel,cancelLabel:"Abbrechen",
      originalPasswordDialog:{title,message,confirmLabel},passwordSubmit:async password=>{
        if(this.destroyed || this.connectedToken!==token || this.sessionToken.trim()!==token)return "The administrator session changed. Cancel and review the operation again.";
        const result=kind==="delete-workspace"?await this.directory.deleteWorkspace(workspace!.workspaceId,password)
          :kind==="delete-user"?await this.directory.deleteUser(user!.adminUser.adminUserId,password)
          :await this.directory.changeSuperadmin(user!.adminUser.adminUserId,password);
        if(result)return null;
        const wrongPassword=this.directory.problemCode==="admin_password_confirmation_invalid";
        const problem=this.consumeDialogProblem();
        return wrongPassword?"Incorrect current administrator password. Please try again.":problem;
      }});
    this.confirmationId=this.confirmation.dialog()?.requestId??null;
    await pending;this.confirmationId=null;
  }
  private closeOwnedConfirmation(): void {
    if(this.confirmationId!==null && this.confirmation.dialog()?.requestId===this.confirmationId)this.confirmation.resolve(false);
    this.confirmationId=null;
  }
  confirmLogout(trigger: MatMenuTrigger): void {
    if(this.destroyed || this.directory.busy || this.logout)return;
    const token=this.connectedToken;trigger.closeMenu();
    this.logout=this.dialogs.open(OriginalParticipantLogoutDialogComponent,{
      panelClass:"original-participant-logout-dialog",data:{safeMode:this.settings.settings().themeName==="Primar"},
      autoFocus:"dialog",restoreFocus:true,ariaLabelledBy:"originalParticipantLogoutTitle",ariaDescribedBy:"originalParticipantLogoutMessage"
    });
    this.logout.afterClosed().subscribe(accepted=>{
      this.logout=null;
      if(accepted && !this.destroyed && this.connectedToken===token && this.sessionToken.trim()===token) {
        void this.app.signOutAdmin().finally(()=>this.router.navigateByUrl("/ops"));
      }
    });
  }
  ngOnDestroy(): void {
    this.destroyed=true;this.directory.destroy();this.editor?.close(false);this.logout?.close(false);this.closeOwnedConfirmation();
  }
}
