import assert from "node:assert/strict";
import { completenessPlayer } from "./exit-completeness-fixture.mjs";

// Both frontends receive the same owned Player. Notifications originate in its
// real frame and use its actual Verona session; the controllers stay untouched.
export function runtimeErrorPlayer(html, notification = {}) {
  const code = Object.hasOwn(notification, "code") ? notification.code : "runtime-error";
  const message = notification.message ?? "Owned incomplete runtime Ω";
  assert.ok(code === undefined || typeof code === "string");
  assert.equal(typeof message, "string");
  html = completenessPlayer(html);
  const replacements = [
    ['<textarea id="demoPlayerAnswer"', '<button id="ownedRuntimeError">Owned runtime error</button><textarea id="demoPlayerAnswer"'],
    ['answer.addEventListener("input", () => {', `document.querySelector("#ownedRuntimeError").addEventListener("click", event => {
          parent.postMessage({type: "vopRuntimeErrorNotification",
            sessionId: event.target.dataset.wrongSession ? "wrong-session" : sessionId,
            ...(${JSON.stringify(code ?? null)} === null ? {} : {code: ${JSON.stringify(code ?? null)}}),
            message: event.target.dataset.message ?? ${JSON.stringify(message)}}, "*");
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
