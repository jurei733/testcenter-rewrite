import { Component, ViewEncapsulation } from "@angular/core";

// These unchanged global selectors belong only to the lazy participant route.
// Keep their specificity while avoiding a download on unrelated entry pages.
@Component({
  selector: "app-participant-status-styles",
  standalone: true,
  template: "",
  host: { style: "display: none" },
  encapsulation: ViewEncapsulation.None,
  styleUrl: "./participant-status-styles.component.css"
})
export class ParticipantStatusStylesComponent {}
