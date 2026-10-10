import assert from "node:assert/strict";
import { completenessPlayer } from "./exit-completeness-fixture.mjs";

// Both frontends receive the same owned Player. Notifications originate in its
// real frame and use its actual Verona session; the controllers stay untouched.
export function runtimeErrorPlayer(html) {
  html = completenessPlayer(html);
  const replacements = [
    ['<textarea id="demoPlayerAnswer"', '<button id="ownedRuntimeError">Owned runtime error</button><textarea id="demoPlayerAnswer"'],
    ['answer.addEventListener("input", () => {', `document.querySelector("#ownedRuntimeError").addEventListener("click", event => {
          parent.postMessage({type: "vopRuntimeErrorNotification",
            sessionId: event.target.dataset.wrongSession ? "wrong-session" : sessionId,
            code: "runtime-error", message: event.target.dataset.message || "Owned incomplete runtime Ω"}, "*");
        });
        answer.addEventListener("input", () => {`],
    ['answer.value = String(event.data.unitState?.dataParts?.answer || "");', `answer.value = String(event.data.unitState?.dataParts?.answer || "");
          for (const [id, field] of [["exitPresentation", "presentationProgress"], ["exitResponse", "responseProgress"]]) {
            const control = document.querySelector("#" + id);
            const value = event.data.unitState?.[field];
            if ([...control.options].some(option => option.value === value)) control.value = value;
          }`]
  ];
  for (const [before, after] of replacements) {
    assert.equal(html.split(before).length, 2, `Owned runtime Player anchor must be unique: ${before}`);
    html = html.replace(before, after);
  }
  return html;
}
