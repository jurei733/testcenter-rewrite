import {
  Component, EventEmitter, Input, type OnChanges, Output
} from '@angular/core';
import { MatIconButton } from '@angular/material/button';
import { MatTooltip } from '@angular/material/tooltip';
import {NativeMonitorIconComponent as MatIcon} from '../../../../native-monitor/native-monitor-icon.component';
import { type NavControlContext } from '../../interfaces/test-controller.interfaces';

@Component({
  selector: 'tc-navigation-control',
  imports: [
    MatIconButton,
    MatTooltip,
    MatIcon
  ],
  templateUrl: './navigation.component.html',
  styleUrl: './navigation.component.css'
})
export class NavigationComponent implements OnChanges {
  @Input() navContext!: NavControlContext;
  @Output() back: EventEmitter<void> = new EventEmitter<void>();
  @Output() forward: EventEmitter<void> = new EventEmitter<void>();
  @Input() dataCy?: string;

  maxListTabs?: number[];

  ngOnChanges() {
    this.maxListTabs = Array.from({ length: this.navContext.maxIndex }, (_, i) => i + 1);
  }
}
