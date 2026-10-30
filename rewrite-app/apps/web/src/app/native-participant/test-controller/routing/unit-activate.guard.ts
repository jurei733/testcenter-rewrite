import { Injectable,inject } from '@angular/core';
import {NATIVE_RUN_TEST_ID} from '../../native-tokens';
import {
  ActivatedRouteSnapshot, type CanActivate, RedirectCommand, Router, UrlTree
} from '@angular/router';
import { TestControllerService } from '../services/test-controller.service';
import { MessageService } from '../../shared/services/message.service';
import { type Unit } from '../interfaces/test-controller.interfaces';

@Injectable()
export class UnitActivateGuard implements CanActivate {
  private readonly ownedTestId=inject(NATIVE_RUN_TEST_ID);
  constructor(
    private tcs: TestControllerService,
    private router: Router,
    private messageService: MessageService
  ) {}

  async canActivate(route: ActivatedRouteSnapshot) {
    if(route.parent?.params.t!==this.ownedTestId)return this.router.parseUrl('/native-test');
    // unit-route got called before test is loaded. This happens on page-reload (F5).
    const booklet = this.tcs.booklet;
    if (!booklet) {
      const testId = route.parent?.params.t;
      if (!testId || testId !== this.ownedTestId) {
        return this.router.parseUrl('/native-test');
      }
      // ignore unit-id from route, because test will get last opened unit ID from testStatus.CURRENT_UNIT_ID
      return this.router.parseUrl(`/native-test/${testId}`);
    }

    let targetUnit: Unit | undefined;
    const targetUnitSequenceId: number = Number(route.params.u);

    try {
      targetUnit = this.tcs.getUnit(targetUnitSequenceId);
    } catch (e) {
      // a unit-nr was entered in the URL which does not exist
      if (this.tcs.shouldShowConfirmationUI()) {
        this.messageService.showSnackbar(`Navigation zu Aufgabe ${targetUnitSequenceId} nicht möglich`);
      }
      // looking for alternatives where to go
      const currentNavigation = await this.tcs.closeAllBuffers('canActivate');
      if (this.tcs.currentUnit && !TestControllerService.unitIsInaccessible(this.tcs.currentUnit)) {
        // current unit is accessible, so we just stay here
        return false;
      }
      if (currentNavigation.targets.previous) {
        // a previous unit is accessible, so we can go there
        return this.router.parseUrl(`/native-test/${this.tcs.testId}/u/${currentNavigation.targets.previous}`);
      }
      // we stay anyway (undefined behaviour on what happens on that unit)
      return false;
    }

    if (targetUnit && TestControllerService.unitIsInaccessible(targetUnit)) {
      // we navigate to a locked unit. example: we leave timed block to status and return.
      const navigation = this.tcs.getNavigationState(targetUnitSequenceId);
      if (navigation.targets.next) {
        // a later unit is accessible, so we go there
        return this.router.parseUrl(`/native-test/${this.tcs.testId}/u/${navigation.targets.next}`);
      }
    }

    // new unit is accessible, or we didn't have a good alternative where to go
    return true;
  }
}
