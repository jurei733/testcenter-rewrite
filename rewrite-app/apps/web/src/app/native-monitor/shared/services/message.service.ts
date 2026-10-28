import {Injectable,inject,type TemplateRef} from '@angular/core';
import {MatDialog} from '@angular/material/dialog';
import {ConfirmDialogComponent} from '../components/dialog/confirm-dialog.component';
export type ConfirmDialogData={title:string;content?:string;contentTemplate?:TemplateRef<unknown>;confirmText?:string;cancelText?:string;safeMode?:boolean};
@Injectable({providedIn:'root'})
export class MessageService {private dialog=inject(MatDialog);showConfirmDialog(data:ConfirmDialogData){return this.dialog.open(ConfirmDialogComponent,{data:{...data,safeMode:false},autoFocus:'dialog'}).afterClosed();}}
