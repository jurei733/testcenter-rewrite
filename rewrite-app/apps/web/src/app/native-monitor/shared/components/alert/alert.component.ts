import { Component, Input, type OnChanges } from '@angular/core';
import {NativeMonitorIconComponent as MatIcon} from '../../../native-monitor-icon.component';
import { CustomtextPipe } from '../../pipes/customtext/customtext.pipe';
import { CustomtextService } from '../../services/customtext/customtext.service';
import type { AlertLevel } from '../../interfaces/alert.interfaces';

@Component({
  selector: 'tc-alert',
  templateUrl: 'alert.component.html',
  imports: [
    MatIcon,
  ],
  styleUrls: ['alert.component.css']
})
export class AlertComponent implements OnChanges {
  @Input() text: string = '';
  @Input() customtext: string = '';
  @Input() replacements: string[] = [];
  @Input() level: AlertLevel = 'info';

  icons: { [level in AlertLevel]: string } = {
    error: 'error',
    warning: 'warning',
    info: 'info',
    success: 'check_circle'
  };

  constructor(private cts: CustomtextService) {}
  ngOnChanges(): void {}
  get displayText(): string {
    return AlertComponent.highlightTicks(new CustomtextPipe(this.cts).transform(this.text,this.customtext,...this.replacements));
  }

  private static highlightTicks = (text: string): string => text.replace(
    /\u0060([^\u0060]+)\u0060/g,
    (match, match2) => `<span class='highlight'>${match2}</span>`
  );
}
