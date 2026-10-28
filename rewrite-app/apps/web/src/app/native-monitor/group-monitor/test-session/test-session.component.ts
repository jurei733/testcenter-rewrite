import {CustomtextService} from '../../shared/services/customtext/customtext.service';
import {NativeMonitorEntriesView} from '../../native-monitor-entries.pipe';
import {inject,LOCALE_ID} from '@angular/core';
import {formatNativeMonitorMinutes} from '../../native-monitor-number';
import { NgTemplateOutlet } from '@angular/common';
import {NativeMonitorIconComponent as MatIcon} from '../../native-monitor-icon.component';
import {MatBadge} from '@angular/material/badge';
import {MatTooltip} from '@angular/material/tooltip';
import {MatCheckbox} from '@angular/material/checkbox';
import {CustomtextPipe} from '../../shared/shared.module';
import {TemplateContextDirective} from '../../shared/directives/template-context.directive';
import {IsCodeClearPipe} from './is-code-clear.pipe';
import {TimeLeftPipe} from './timeleft.pipe';
import {PositionPipe} from './position.pipe';
import {TestletvisiblePipe} from './testletvisible.pipe';
import {
  Component, EventEmitter, Input, Output
} from '@angular/core';
import { MatCheckboxChange } from '@angular/material/checkbox';
import {
  type Testlet, type TestViewDisplayOptions, type Selected, type TestSession, isBooklet, isTestlet, type TestSessionSuperState
} from '../group-monitor.interfaces';
import { TestSessionUtil } from './test-session.util';
import { type IconData, superStates } from './super-states';
import type { UnitDef } from '../../shared/interfaces/booklet.interfaces';

interface TestletContext {
  $implicit: Testlet,
  recursionLevel: number
}

@Component({
  selector: 'tc-test-session',
  templateUrl: './test-session.component.html',
  styleUrls: ['./test-session.component.css'],
  standalone: true,
  imports: [NgTemplateOutlet, MatIcon, MatBadge, MatTooltip, MatCheckbox, TemplateContextDirective]
})
export class TestSessionComponent {
  readonly entries = new NativeMonitorEntriesView().transform;
  private readonly nativeText = new CustomtextPipe(inject(CustomtextService));
  readonly customtext = this.nativeText.transform.bind(this.nativeText);
  readonly timeLeftView = new TimeLeftPipe().transform;
  readonly position = new PositionPipe().transform;
  readonly isCodeClear = new IsCodeClearPipe().transform;
  readonly testletVisible = new TestletvisiblePipe().transform;

  private readonly locale=inject(LOCALE_ID);
  formatRemainingTime(value:number):string{return formatNativeMonitorMinutes(value,this.locale);}
  @Input() testSession!: TestSession;
  @Input() displayOptions!: TestViewDisplayOptions;
  @Input() marked: Selected | null = null;
  @Input() selected: Selected | null = null;
  @Input() checked: boolean = false;
  @Input() bookletStates: { [p: string]: string } = {};

  @Output() markedElement$ = new EventEmitter<Selected>();
  @Output() selectedElement$ = new EventEmitter<Selected>();
  @Output() checked$ = new EventEmitter<boolean>();

  superStateIcons: Partial<Record<TestSessionSuperState, IconData>> = superStates;

  // TODO use pipes for the following functions
  stateString = TestSessionUtil.stateString;
  bookletStateLabel = TestSessionUtil.bookletStateLabel;
  hasState = TestSessionUtil.hasState;
  isBooklet = isBooklet;
  isTestlet = isTestlet;
  // eslint-disable-next-line class-methods-use-this
  trackUnits = (index: number, testlet: Testlet | UnitDef): string => testlet.id || index.toString();

  testletContext?: TestletContext;

  mark(testletOrNull: Testlet | null = null): void {
    if ((testletOrNull != null) && !testletOrNull.blockId) {
      return;
    }
    if (['pending', 'locked'].includes(this.testSession.state)) {
      return;
    }
    this.marked = this.returnAsSelected(testletOrNull);
    this.markedElement$.emit(this.marked);
  }

  isSelectionTheSameBlockAsParentSelection(testletOrNull: Testlet | null = null): boolean {
    return !!testletOrNull && //  is something Nowselected?
      (this.selected?.element?.blockId === testletOrNull?.blockId) && // is nowselected already in parentselection?
      // is nowselected same species as parentselection (is it the same block 1? == same col)
      (this.selected?.originSession.booklet.species === this.testSession.booklet.species);
  }

  returnClicks(testletOrNull: Testlet | null = null): 'first' | 'second' | 'third' {
    const isSelectionInSameSession = this.isSelectionTheSameBlockAsParentSelection(testletOrNull) &&
      // is the nowSelection the same Session (row in Table)
      (this.selected?.originSession.data.testId === this.testSession.data.testId);

    if (isSelectionInSameSession && this.selected?.nthClick === 'first') {
      return 'second';
    }
    if (isSelectionInSameSession && this.selected?.nthClick === 'second') {
      return 'third';
    }
    return 'first';
  }

  isMarked(testletOrNull: Testlet | null = null): boolean {
    return !!testletOrNull &&
      (!['pending', 'locked'].includes(this.testSession.state)) &&
      (this.marked?.element?.blockId === testletOrNull.blockId) &&
      (this.marked?.originSession.booklet.species === this.testSession.booklet.species);
  }

  select(testletOrNull: Testlet | null): void {
    if ((testletOrNull != null) && !testletOrNull.blockId) {
      return;
    }
    this.applySelection(testletOrNull);
  }

  deselect($event: MouseEvent | null): void {
    if ($event && ($event.currentTarget === $event.target)) {
      this.applySelection();
    }
  }

  deselectForce($event: Event): boolean {
    this.applySelection();
    $event.stopImmediatePropagation();
    $event.stopPropagation();
    $event.preventDefault();
    return false;
  }

  invertSelection(): boolean {
    this.applySelection(this.selected?.element, true);
    return false;
  }

  toggleCheckbox($event: MatCheckboxChange): void {
    this.checked$.emit($event.checked);
  }

  private applySelection(testletOrNull: Testlet | null = null, inversion = false): void {
    if (['pending', 'locked'].includes(this.testSession.state)) {
      return;
    }
    this.selected = this.returnAsSelected(testletOrNull, inversion);
    this.selectedElement$.emit(this.selected);
  }

  private returnAsSelected(testletOrNull: Testlet | null = null, inversion = false): Selected {
    return {
      element: testletOrNull,
      originSession: this.testSession,
      nthClick: this.returnClicks(testletOrNull),
      inversion
    };
  }
}
