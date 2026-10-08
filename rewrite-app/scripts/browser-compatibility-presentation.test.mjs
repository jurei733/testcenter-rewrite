import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import ts from "typescript";

const dataModule = source => `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
// Stub only Angular's decorator/signal storage. The production service and
// actual browser policy/custom-text contracts execute unchanged.
const angular = dataModule(`
  export const Injectable = () => target => target;
  export const signal = initial => {
    let value = initial; const read = () => value;
    read.set = next => { value = next; }; return read;
  };
`);
const source = ts.transpileModule(readFileSync(new URL(
  "../apps/web/src/app/browser-compatibility.service.ts", import.meta.url), "utf8"), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, experimentalDecorators: true }
}).outputText.replace('"@angular/core"', JSON.stringify(angular))
  .replace('"@testcenter-rewrite-app/contracts"', JSON.stringify(import.meta.resolve("@testcenter-rewrite-app/contracts")));
const { BrowserCompatibilityService } = await import(dataModule(source));
const serviceFor = userAgent => {
  const navigator = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  try {
    Object.defineProperty(globalThis, "navigator", { configurable: true, value: { userAgent } });
    return new BrowserCompatibilityService();
  } finally {
    if (navigator) Object.defineProperty(globalThis, "navigator", navigator);
    else delete globalThis.navigator;
  }
};

test("Original browser label uses three-part semver without changing Rewrite's raw identity", () => {
  const service = serviceFor("Mozilla/5.0 Chrome/147.0.0.0 Safari/537.36");
  const native = service.warning;
  assert.equal(native.version, "147.0.0.0");
  assert.match(native.message, /Chrome 147\.0\.0\.0/u);
  assert.equal(service.originalWarning.version, "147.0.0");
  assert.match(service.originalWarning.message, /Chrome 147\.0\.0 ist/u);
  assert.deepEqual(service.warning, native);
});

test("Original browser presentation pads short versions and preserves unknown identities", () => {
  for (const [ua, version] of [["Firefox/1", "1.0.0"], ["Version/1.2 Safari/1", "1.2.0"], ["unidentified", "unknown"]]) {
    const service = serviceFor(ua);
    assert.equal(service.originalWarning.version, version);
    assert.equal(service.originalWarning.browser, service.warning.browser);
  }
});

test("custom warning text updates both presentations with their respective version", () => {
  const service = serviceFor("Chrome/147.1.2.3");
  service.setCustomTexts({ login_unsupportedBrowser: "Browser: %s / Version: %s" });
  assert.equal(service.warning.message, "Browser: Chrome / Version: 147.1.2.3");
  assert.equal(service.originalWarning.message, "Browser: Chrome / Version: 147.1.2");
  service.setCustomTexts({});
  assert.match(service.originalWarning.message, /Ihr Browser Chrome 147\.1\.2 ist/u);
});

test("presentation never introduces warnings for supported browsers or absent user agents", () => {
  for (const ua of ["Chrome/999.0.0.0", ""]) {
    const service = serviceFor(ua);
    assert.equal(service.warning, null);
    assert.equal(service.originalWarning, null);
  }
});
