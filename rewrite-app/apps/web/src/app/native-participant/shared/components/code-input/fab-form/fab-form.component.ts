import {
  Component, computed, EventEmitter, Input, type OnInit, Output, type Signal, signal, type WritableSignal
} from '@angular/core';
import {KeyValuePipe} from '@angular/common';
import {NativeMonitorIconComponent as MatIconModule} from '../../../../../native-monitor/native-monitor-icon.component';
import {MatFabButton} from '@angular/material/button';
import { type CodeInputType } from '../../../../app.interfaces';

@Component({
  selector: 'tc-code-keypad-form',
  imports: [KeyValuePipe, MatIconModule, MatFabButton],
  templateUrl: './fab-form.component.html',
  styleUrl: './fab-form.component.scss'
})
export class FabFormComponent implements OnInit {
  @Input() visualMode: CodeInputType = 'keypad-symbols-alt';
  @Input() length: number | undefined = 5;
  @Input() disabled: boolean = false;
  @Output() submitCode = new EventEmitter<string>();
  @Output() clearInput = new EventEmitter<void>();

  readonly buttonIcons: { [key: number]: string } = {
    1: 'star',
    2: 'favorite',
    3: 'crop_square',
    4: 'bedtime',
    5: 'sentiment_satisfied',
    6: 'cloud',
    7: 'filter_vintage',
    8: 'wb_sunny',
    9: 'change_history'
  };

  readonly altButtonIcons: { [key: number]: string } = {
    1: 'assets/icons/code_input_alt/apple.png',
    2: 'assets/icons/code_input_alt/house.png',
    3: 'assets/icons/code_input_alt/cup.png',
    4: 'assets/icons/code_input_alt/sun.png',
    5: 'assets/icons/code_input_alt/book.png',
    6: 'assets/icons/code_input_alt/eye.png'
  };

  activeIconSet: { [key: number]: string } = this.buttonIcons;

  selectedValues: WritableSignal<(number | null)[]> = signal<(number | null)[]>([]);
  activeValueIndex: Signal<number> = computed(() => this.selectedValues().indexOf(null));


  ngOnInit(): void {
    this.activeIconSet = this.visualMode === 'keypad-symbols-alt' ? this.altButtonIcons : this.buttonIcons;
    this.selectedValues = signal<(number | null)[]>(Array(this.length).fill(null));
  }

  onSelect(selectedValue: string): void {
    if (this.selectedValues().every(val => val === null)) {
      this.clearInput.emit();
    }
    this.selectedValues.update(selectedValues => {
      const copy = [...selectedValues];
      copy[this.activeValueIndex()] = parseInt(selectedValue, 10);
      return copy;
    });
    // Auto-submit when all values are selected
    if (this.selectedValues().every(icon => icon !== null)) {
      this.submitCode.emit(this.selectedValues().join(''));
    }
  }

  removeLastInput(): void {
    this.selectedValues.update(selectedValues => {
      const copy = [...selectedValues];
      const lastIndex = copy.indexOf(null);
      if (lastIndex === -1) {
        copy[copy.length - 1] = null;
      } else if (lastIndex > 0) {
        copy[lastIndex - 1] = null;
      }
      return copy;
    });
  }

  clear(): void {
    this.selectedValues.set(Array(this.length).fill(null));
  }
}
