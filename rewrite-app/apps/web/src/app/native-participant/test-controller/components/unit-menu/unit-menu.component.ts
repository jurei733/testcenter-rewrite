import {AsyncPipe,NgIf,NgForOf,NgTemplateOutlet,KeyValuePipe,NgClass} from '@angular/common';
import {UnitInaccessiblePipe} from '../../pipes/unit-inaccessible.pipe';
import {MatFormField,MatLabel} from '@angular/material/form-field';
import {MatSelect} from '@angular/material/select';
import {MatOption} from '@angular/material/core';
import {MatAnchor} from '@angular/material/button';
import {MatTooltip} from '@angular/material/tooltip';
import {NativeMonitorIconComponent} from '../../../../native-monitor/native-monitor-icon.component';
import {CustomtextPipe} from '../../../shared/pipes/customtext/customtext.pipe';
import {
  Component, EventEmitter, Output
} from '@angular/core';
import { TestControllerService } from '../../services/test-controller.service';
import { type Testlet, isTestlet } from '../../interfaces/test-controller.interfaces';
import { CustomtextService } from '../../../shared/services/customtext/customtext.service';

@Component({
    selector: 'tc-unit-menu',
    templateUrl: './unit-menu.component.html',
    styleUrls: ['./unit-menu.component.css'],
    standalone: true,
    imports:[AsyncPipe,NgIf,NgForOf,NgTemplateOutlet,KeyValuePipe,NgClass,UnitInaccessiblePipe,MatFormField,MatLabel,MatSelect,MatOption,MatAnchor,MatTooltip,NativeMonitorIconComponent,CustomtextPipe]
})
export class UnitMenuComponent {
  @Output() close = new EventEmitter<void>();

  testletContext?: { testlet: Testlet, level: number };

  constructor(
    public tcs: TestControllerService,
    private cts: CustomtextService
  ) { }

  protected readonly isTestlet = isTestlet;

  terminateTest(): void {
    this.tcs.terminateTest('BOOKLETLOCKEDbyTESTEE', false, this.tcs.booklet?.config.lock_test_on_termination === 'ON');
    this.cts.restoreDefault(false);
  }

  goto(target: string): void {
    this.close.emit();
    this.tcs.setUnitNavigationRequest(target);
  }
}
