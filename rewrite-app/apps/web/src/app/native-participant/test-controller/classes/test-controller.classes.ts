/* eslint-disable max-classes-per-file */

import UAParser from 'ua-parser-js';
import { MaxTimerEvent } from '../interfaces/test-controller.interfaces';

export class EnvironmentData {
  browserVersion = '';
  browserName = '';

  osName = '';
  device = '';

  screenSizeWidth = 0;
  screenSizeHeight = 0;
  loadTime: number = 0;

  constructor() {
    const UserAgentParser = new UAParser();

    this.browserVersion = UserAgentParser.getBrowser().version ?? '--';
    this.browserName = UserAgentParser.getBrowser().name ?? '--';
    this.osName = `${UserAgentParser.getOS().name} ${UserAgentParser.getOS().version}`;
    this.device = Object.values(UserAgentParser.getDevice())
      .filter(elem => elem)
      .join(' ');

    this.screenSizeHeight = window.screen.height;
    this.screenSizeWidth = window.screen.width;
  }
}

export class TimerData {
  timeLeftSeconds: number; // seconds
  id: string;
  type: MaxTimerEvent;

  get displayedSeconds(): number {
    // The Original counts its first ticker update as the end of the first
    // displayed second. Keep that display convention separate from the clock.
    const elapsedDisplayTick = this.type === MaxTimerEvent.STEP ? 1 : 0;
    return Math.max(0, Math.round(this.timeLeftSeconds) - elapsedDisplayTick);
  }

  get timeLeftString(): string {
    const displaySeconds = this.displayedSeconds;
    const minutes = Math.floor(displaySeconds / 60);
    const seconds = String(displaySeconds % 60).padStart(2, '0');
    return `${minutes}:${seconds}`;
  }

  get timeLeftMinString(): string {
    return `${Math.round(this.timeLeftSeconds / 60).toString()} min`;
  }

  constructor(timeMinutes: number, timerId: string, type: MaxTimerEvent) {
    this.timeLeftSeconds = timeMinutes * 60;
    this.id = timerId;
    this.type = type;
  }
}
