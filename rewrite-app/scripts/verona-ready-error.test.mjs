import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import { resolveVeronaPlayerApiVersion, isSupportedVeronaPlayerApiVersion,
  SUPPORTED_VERONA_PLAYER_API_MAJOR_MIN, SUPPORTED_VERONA_PLAYER_API_MAJOR_MAX } from "@testcenter-rewrite-app/contracts";

// Execute the actual ready/runtime-error/fail methods and once-per-frame output.
// The real iframe, dialog, persistence and reload are covered by the browser gate.
const source = readFileSync(new URL("../apps/web/src/app/verona-player-host.component.ts", import.meta.url), "utf8");
const ast = ts.createSourceFile("verona-player-host.component.ts", source, ts.ScriptTarget.ES2022, true);
const declaration = ast.statements.find(node => ts.isClassDeclaration(node) && node.name?.text === "VeronaPlayerHostComponent");
const methods = ["handleReady", "fail", "handleRuntimeError", "normalizeRuntimeError"].map(name => {
  const method = declaration?.members.find(node => ts.isMethodDeclaration(node) && node.name.getText(ast) === name);
  assert.ok(method, `Production ${name} must exist.`); return method.getText(ast);
});
const constants = ast.statements.flatMap(node => ts.isVariableStatement(node) ? [...node.declarationList.declarations] : []);
const recoveryKey = constants.find(node => node.name.getText(ast) === "controllerRecoveryStorageKey");
assert.ok(recoveryKey);
const { outputText } = ts.transpileModule(`export const createReadyHost = (resolveVeronaPlayerApiVersion, isSupportedVeronaPlayerApiVersion,
  SUPPORTED_VERONA_PLAYER_API_MAJOR_MIN, SUPPORTED_VERONA_PLAYER_API_MAJOR_MAX) => {
  const ${recoveryKey.getText(ast)};
  return class ReadyHost { ${methods.join("\n")} };
};`, { compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext} });
const {createReadyHost} = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);
const Host = createReadyHost(resolveVeronaPlayerApiVersion,isSupportedVeronaPlayerApiVersion,
  SUPPORTED_VERONA_PLAYER_API_MAJOR_MIN,SUPPORTED_VERONA_PLAYER_API_MAJOR_MAX);
const fixture = () => {
  const errors=[], logs=[], playerLogs=[];
  const calls={clearedReady:0,clearedFrames:0};
  const host = Object.assign(new Host(), {status:"loading",startPlayerRequest:null,playerHtml:"<html>Owned frame</html>",
    frameTestRunId:"selected-run",frameUnitKey:"selected-unit",controllerErrorLoggedForFrame:false,
    controllerError:{emit:value=>errors.push(value)},testLogEntries:{emit:value=>logs.push(...value)},
    persistHostLog:value=>playerLogs.push(value),clearReadyTimeout:()=>calls.clearedReady++,clearScheduledFrames:()=>calls.clearedFrames++});
  return {host,errors,logs,playerLogs,calls};
};

for (const notification of [{}, {metadata:{}}, {metadata:{specVersion:6}}, {apiVersion:9}]) {
  test(`missing string ready version rejects startup: ${JSON.stringify(notification)}`, () => {
    const {host,errors,logs,calls}=fixture();host.handleReady(notification);
    assert.equal(host.status,"error");assert.equal(host.apiVersion,undefined);assert.equal(host.startPlayerRequest,null);
    assert.equal(errors.length,1);assert.equal(errors[0].title,"Unbekannte Verona-Version");
    assert.equal(errors[0].description,"Player did not report its Verona version (apiVersion or metadata.specVersion)");
    assert.equal(errors[0].testRunId,"selected-run");assert.equal(errors[0].unitKey,"selected-unit");
    assert.equal(errors[0].message,"The player ready notification does not declare a Verona API version.");
    assert.ok(errors[0].details.includes(errors[0].message));assert.ok(Number.isFinite(errors[0].timestamp));
    assert.deepEqual(logs.map(l=>[l.key,l.content]),[["CONTROLLER","ERROR"]]);
    assert.deepEqual(calls,{clearedReady:1,clearedFrames:1});
  });
}
for (const version of ["1.0","9.0"]) {
  test(`unsupported ${version} preserves generic message and exposes the Original version report`, () => {
    const {host,errors,logs}=fixture();host.handleReady({metadata:{specVersion:version}});
    assert.equal(host.status,"error");assert.equal(host.apiVersion,undefined);assert.equal(host.startPlayerRequest,null);
    assert.equal(errors[0].title,"Unpassende Verona-Version");
    assert.equal(errors[0].description,`Player uses Verona ${version}, but this testcenter only support \n              2 to 6`);
    assert.equal(errors[0].message,`Player uses Verona ${version}; supported major versions are 2–6.`);
    host.handleReady({metadata:{specVersion:"6.0"}});
    host.fail("A later failure","A later description","A later title");
    assert.equal(errors.length,1);assert.equal(logs.length,1);
  });
}
for (const version of ["2.0","6.0"]) {
  test(`supported ${version} accepts ready without an error dialog or controller error`, () => {
    const {host,errors,logs,calls}=fixture();host.handleReady({metadata:{specVersion:version}});
    assert.equal(host.status,"loading");assert.equal(host.loadingPhase,"complete");assert.equal(host.apiVersion,version);
    assert.equal(host.apiVersionLabel,`API ${version}`);assert.deepEqual(errors,[]);assert.deepEqual(logs,[]);
    assert.deepEqual(calls,{clearedReady:1,clearedFrames:0});
  });
}
test("the existing legacy module-version correction remains accepted before Original error presentation", () => {
  const {host,errors,playerLogs}=fixture();
  host.playerHtml='<meta name="application-name" content="iqb-player" data-version="1.2.3" data-api-version="6.0">';
  host.handleReady({apiVersion:"1.2.3"});
  assert.equal(host.apiVersion,"6.0");assert.deepEqual(errors,[]);
  assert.deepEqual(playerLogs.map(l=>[l.key,l.content]),[["PLAYER","LEGACY_API_VERSION_CORRECTED 6.0"]]);
});
test("a pending or already finished startup cannot emit another ready failure", () => {
  for(const state of [{status:"loading",startPlayerRequest:12},{status:"running",startPlayerRequest:null}]) {
    const {host,errors,logs,calls}=fixture();Object.assign(host,state);host.handleReady({metadata:{}});
    assert.deepEqual(errors,[]);assert.deepEqual(logs,[]);assert.deepEqual(calls,{clearedReady:0,clearedFrames:0});
  }
});

for (const code of ["session-id-missing", "unit-definition-missing", "wrong-session-id",
  "unit-definition-type-unsupported", "unit-state-type-unsupported", "runtime-error", "future-error-code"]) {
  test(`runtime ${code} preserves the exact Original description and log content`, () => {
    const {host,errors,logs,playerLogs}=fixture();
    const message=" \n  <b>Owned rich error</b><br>Second line Ω  \n ";
    host.handleRuntimeError(code,message);
    assert.equal(errors[0].description,message);
    assert.equal(playerLogs[0].content,message);
    assert.equal(playerLogs[0].key,`Runtime Error: ${code}`);
    assert.deepEqual(logs.map(entry=>[entry.key,entry.content]),[["CONTROLLER","ERROR"]]);
  });
}
test("a missing runtime code retains the Original log key while the generic error keeps its default", () => {
  const {host,errors,playerLogs}=fixture();
  host.handleRuntimeError(undefined,"Owned missing code Ω");
  assert.equal(playerLogs[0].key,"Runtime Error: undefined");
  assert.equal(errors[0].description,"Owned missing code Ω");
  assert.equal(errors[0].message,"runtime-error: Owned missing code Ω");
});
test("an empty runtime description stays empty and existing diagnostic bounds still apply", () => {
  const empty=fixture();empty.host.handleRuntimeError("runtime-error","");
  assert.equal(empty.errors[0].description,"");assert.equal(empty.playerLogs[0].content,"");
  const bounded=fixture();bounded.host.handleRuntimeError("x".repeat(201),"Ω".repeat(32_769));
  assert.equal(bounded.playerLogs[0].key.length,195);
  assert.equal(bounded.playerLogs[0].content.length,32_768);
});
