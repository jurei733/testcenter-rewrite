import { Component, Input } from "@angular/core";
import { NgFor, NgIf, NgSwitch, NgSwitchCase, NgSwitchDefault } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { CdkTextareaAutosize } from "@angular/cdk/text-field";
import { MatCard, MatCardContent, MatCardHeader, MatCardSubtitle, MatCardTitle } from "@angular/material/card";
import { MatFormField, MatLabel } from "@angular/material/form-field";
import { MatInput } from "@angular/material/input";
import { MatSelect, MatOption } from "@angular/material/select";
import { MatCheckbox } from "@angular/material/checkbox";
import { MatRadioButton, MatRadioGroup } from "@angular/material/radio";
import type { SystemCheckViewComponent } from "./system-check-view.component";

// Adapted from IQB Testcenter 19 sys-check/questionnaire (MIT).
// See assets/ORIGINAL-UI-LICENSE.txt. Answers and required-field report warnings
// belong to the shared controller; this view has no independent form state.
@Component({
  selector: "app-original-system-check-questionnaire",
  standalone: true,
  imports: [
    NgFor, NgIf, NgSwitch, NgSwitchCase, NgSwitchDefault, FormsModule,
    CdkTextareaAutosize, MatCard, MatCardContent, MatCardHeader, MatCardTitle,
    MatCardSubtitle, MatFormField, MatLabel, MatInput, MatSelect, MatOption,
    MatCheckbox, MatRadioButton, MatRadioGroup
  ],
  template: `
    <div class="sys-check-body flex-row-center" *ngIf="view.systemCheck as check" id="originalSystemCheckQuestionnaire">
      <mat-card appearance="raised">
        <mat-card-header>
          <mat-card-title>Fragen</mat-card-title>
          <mat-card-subtitle id="systemCheckQuestionsIntro">{{ view.customText('syscheck_questionsintro', 'Bitte bearbeiten Sie die nachfolgenden Fragen.') }}</mat-card-subtitle>
        </mat-card-header>
        <mat-card-content>
          <div class="formList">
            <div *ngFor="let question of check.questions">
              <div [ngSwitch]="question.type" class="formEntry">
                <h3 *ngSwitchCase="'header'" [id]="'systemCheckQuestionHeader-' + question.id">{{ question.options.length > 0 ? question.options : question.prompt }}</h3>
                <mat-form-field *ngSwitchCase="'text'" appearance="outline">
                  <mat-label>{{ question.prompt }}</mat-label>
                  <textarea matInput data-cy="textarea" [id]="question.id" [(ngModel)]="view.answers[question.id]"
                    cdkTextareaAutosize cdkAutosizeMinRows="4" class="formEntry"></textarea>
                </mat-form-field>
                <mat-form-field *ngSwitchCase="'string'" appearance="outline">
                  <mat-label>{{ question.prompt }}</mat-label>
                  <input matInput data-cy="input-name" [id]="question.id" [(ngModel)]="view.answers[question.id]" class="formEntry" />
                </mat-form-field>
                <mat-form-field *ngSwitchCase="'select'" appearance="outline">
                  <mat-label>{{ question.prompt }}</mat-label>
                  <mat-select [id]="question.id" [(ngModel)]="view.answers[question.id]" class="formEntry">
                    <mat-option *ngFor="let option of question.options" [value]="option">{{ option }}</mat-option>
                  </mat-select>
                </mat-form-field>
                <div *ngSwitchCase="'check'">
                  <mat-label *ngIf="question.prompt.length > 0">{{ question.prompt }}</mat-label>
                  <mat-checkbox data-cy="checkbox" [id]="question.id" [aria-label]="question.prompt"
                    [(ngModel)]="view.answers[question.id]"></mat-checkbox>
                </div>
                <div *ngSwitchCase="'radio'">
                  <p>{{ question.prompt }}</p>
                  <mat-radio-group [id]="question.id" [name]="question.id" [attr.aria-label]="question.prompt" [(ngModel)]="view.answers[question.id]">
                    <mat-radio-button *ngFor="let option of question.options" [value]="option" [attr.data-cy]="option" class="formEntry">{{ option }}</mat-radio-button>
                  </mat-radio-group>
                </div>
                <p *ngSwitchDefault>Unbekannter Control-Typ: {{ question.type }} für Element-ID {{ question.id }}</p>
              </div>
            </div>
          </div>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [`
    :host { display: block; min-width: 0; }
    .sys-check-body { padding: 5px; }
    .flex-row-center { display: flex; flex-direction: row; justify-content: center; }
    mat-card { width: 810px; min-width: 0; max-width: 100%; }
    .mat-mdc-form-field { display: block; }
    textarea { min-height: 0; }
    mat-radio-group { display: flex; flex-direction: column; }
    :host ::ng-deep .mdc-label { display: inline; font: inherit; color: inherit; }
  `],
  styleUrl: "./original-login-theme.scss"
})
export class OriginalSystemCheckQuestionnaireComponent {
  @Input({ required: true }) view!: SystemCheckViewComponent;
}
