import { AsyncPipe } from '@angular/common';
import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { ApplicationSettingsService } from '../application-settings.service';
import type { CodeInputType } from './app.interfaces';
import { CodeInputComponent } from './shared/components/code-input/code-input.component';
import { CustomtextPipe } from './shared/pipes/customtext/customtext.pipe';

// Layout from the pinned IQB Testcenter CodeLoginComponent (MIT).
@Component({
  selector: 'app-native-code-login',
  imports: [AsyncPipe, CodeInputComponent, CustomtextPipe],
  template: `
    <div class="form" [class.full-width]="inputType === 'keypad-symbols-alt'">
      <tc-code-input [inputType]="inputType" [length]="length" [problemText]="problemText"
                     [disabled]="disabled" (submitCode)="submitCode.emit($event)">
        @if (inputType !== 'keypad-symbols-alt') {
          <div class="intro-text">
            <h2>{{ 'login_codeInputTitle' | customtext:'login_codeInputTitle' | async }}</h2>
            <p>{{ 'Welche Symbole stehen auf deinem Zettel?' | customtext:'login_codeInputPrompt' | async }}</p>
          </div>
        }
      </tc-code-input>
    </div>
    <div class="illustration" [class.hidden]="inputType === 'keypad-symbols-alt'">
      <img [src]="settings.assetUrl('codeInputIllustration')" alt="Code input illustration">
    </div>
  `,
  styleUrl: './native-code-login.component.scss',
  host: { '[class.alt-styling]': 'inputType === "keypad-symbols-alt"' }
})
export class NativeCodeLoginComponent {
  readonly settings = inject(ApplicationSettingsService);
  @Input() inputType: CodeInputType = 'text-field';
  @Input() length: number | undefined;
  @Input() problemText = '';
  @Input() disabled = false;
  @Output() submitCode = new EventEmitter<string>();
}
