import assert from "node:assert/strict";

// Owned synthetic Verona Player controls. Keep both frontend references on the
// same HTML; never change the Original frontend or inject into its controller.
export const completenessCases = {
  presentation: { presentation: "some", response: "complete", reasons: ["presentation_incomplete"] },
  response: { presentation: "complete", response: "none", reasons: ["response_incomplete"] },
  both: { presentation: "some", response: "none", reasons: ["presentation_incomplete", "response_incomplete"] }
};
export const legacyCompletenessCase = { presentation: "complete-and-valid", response: "complete-and-valid", reasons: ["presentation_incomplete"] };
export function completenessPlayer(html) {
  const replacements = [
    ['<textarea id="demoPlayerAnswer"', `<select id="exitPresentation" aria-label="Owned presentation progress"><option value="complete">complete</option><option value="some">some</option><option value="complete-and-valid">complete-and-valid</option></select>
        <select id="exitResponse" aria-label="Owned response progress"><option value="complete">complete</option><option value="none">none</option><option value="some">some</option><option value="complete-and-valid">complete-and-valid</option></select>
        <textarea id="demoPlayerAnswer"`],
    ['presentationProgress: "complete",', 'presentationProgress: document.querySelector("#exitPresentation").value,'],
    ['responseProgress: hasAnswer ? "complete" : "none"', 'responseProgress: document.querySelector("#exitResponse").value'],
    ['answer.addEventListener("input", () => {', `for (const id of ["exitPresentation", "exitResponse"]) {
          document.querySelector("#" + id).addEventListener("change", reportState);
        }
        answer.addEventListener("input", () => {`]
  ];
  for (const [before, after] of replacements) {
    assert.equal(html.split(before).length, 2, `Owned Player fixture anchor must be unique: ${before}`);
    html = html.replace(before, after);
  }
  return html;
}

export function closeIconMetrics(button) {
  const read = element => {
    const box=element.getBoundingClientRect(),style=getComputedStyle(element);
    return {tag:element.tagName,x:box.x,y:box.y,width:box.width,height:box.height,font:style.font,display:style.display,verticalAlign:style.verticalAlign,overflow:style.overflow,position:style.position};
  };
  return {button:read(button),icon:read(button.querySelector(".mat-icon")),svg:read(button.querySelector("svg"))};
}
