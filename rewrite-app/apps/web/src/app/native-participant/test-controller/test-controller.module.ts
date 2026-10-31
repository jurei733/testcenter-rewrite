import {NgModule} from '@angular/core';
import {TestControllerComponent} from './components/test-controller/test-controller.component';
export {TestControllerService} from './services/test-controller.service';
@NgModule({imports:[TestControllerComponent],exports:[TestControllerComponent]})
export class TestControllerModule{}
