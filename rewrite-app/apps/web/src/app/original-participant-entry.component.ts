import { Component, inject } from "@angular/core";
import { OriginalParticipantLoginComponent } from "./original-participant-login.component";
import { OriginalParticipantStarterComponent } from "./original-participant-starter.component";
import { ParticipantViewFacade } from "./participant-view.facade";
import { OriginalEntrySurfaceStylesComponent } from "./original-entry-surface-styles.component";

@Component({
  selector: "app-original-participant-entry",
  standalone: true,
  imports: [OriginalParticipantLoginComponent, OriginalParticipantStarterComponent, OriginalEntrySurfaceStylesComponent],
  template: `
    <app-original-entry-surface-styles />
    @if (view.isParticipantLogin && !view.participantCodeRequired) {
      <app-original-participant-login />
    } @else if (view.isParticipantStarter) {
      <app-original-participant-starter />
    }
  `
})
export class OriginalParticipantEntryComponent {
  readonly view = inject(ParticipantViewFacade);
}
