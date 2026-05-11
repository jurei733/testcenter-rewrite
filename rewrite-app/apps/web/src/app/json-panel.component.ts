import { Component, Input } from "@angular/core";

@Component({
  selector: "app-json-panel",
  standalone: true,
  template: `
    <div class="collection">
      <header><span>{{ title }}</span><span>{{ subtitle }}</span></header>
      <pre [id]="viewId">{{ content }}</pre>
    </div>
  `
})
export class JsonPanelComponent {
  @Input({ required: true }) title = "";
  @Input({ required: true }) subtitle = "";
  @Input({ required: true }) viewId = "";
  @Input({ required: true }) content = "";
}
