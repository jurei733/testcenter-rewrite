import assert from "node:assert/strict";
import test from "node:test";
import { formatOriginalReportCsv, originalReportCsvCell, formatOriginalParticipantLogEntry } from "./original-report-csv.js";

test("Original 19 CSV quotes headers and non-null values, retaining null gaps", () => {
  assert.equal(formatOriginalReportCsv(["color", "form", "pattern"], [
    { color: "green", form: "circle" },
    { color: "blue", pattern: "dotted" }
  ]), '\uFEFF"color";"form";"pattern"\n"green";"circle";\n"blue";;"dotted"');
  assert.equal(originalReportCsvCell(null), "");
  assert.equal(originalReportCsvCell(undefined), "");
  assert.equal(originalReportCsvCell(""), '""');
  assert.equal(originalReportCsvCell(0), '"0"');
  assert.equal(originalReportCsvCell(true), '"1"');
  assert.equal(originalReportCsvCell(false), '""');
});

test("Original 19 server connection logs retain zero client epoch and exact quoted-key text", () => {
  for (const state of ["LOST", "POLLING"]) {
    const logentry = formatOriginalParticipantLogEntry({ unitKey: null, logKey: "CONNECTION",
      logContent: state, originalTimestamp: 0 });
    assert.equal(logentry, `"CONNECTION" : ${state}`);
    assert.equal(formatOriginalReportCsv(["timestamp", "logentry"], [{ timestamp: 0, logentry }]),
      `\uFEFF"timestamp";"logentry"\n"0";"""CONNECTION"" : ${state}"`);
  }
  assert.equal(formatOriginalParticipantLogEntry({ unitKey: null, logKey: "CONNECTION", logContent: "WEBSOCKET" }),
    'CONNECTION : "WEBSOCKET"');
  assert.equal(formatOriginalParticipantLogEntry({ unitKey: "unit", logKey: "CONNECTION", logContent: "unit log" }),
    'CONNECTION = "unit log"');
});

test("Original 19 CSV preserves delimiters, newlines and literal backslash quotes in logs", () => {
  const content = 'PLAYER_STATE_CHANGED = {"value":"A;B","quoted":"\\"answer\\""}\nsecond line';
  const csv = formatOriginalReportCsv(['log;"entry', 'unitname'], [{ 'log;"entry': content, unitname: 'A\r\nB' }]);
  assert.equal(csv, '\uFEFF"log;""entry";"unitname"\n"PLAYER_STATE_CHANGED = {""value"":""A;B"",""quoted"":""\\""answer\\""""}\nsecond line";"A\r\nB"');
  assert.equal(formatOriginalReportCsv(["logentry"], []), '\uFEFF"logentry"');
});

// Native UnitDAO receives encoded log content and raw state values. Canonical
// logs store plain strings, so provenance must not be guessed from JSON syntax.
test('native Unit logs retain one encoding layer for structured values and state',()=>{
  const base={unitKey:'G8-GEO',logKey:'BEHAVIOR',participantTestLogId:'original-unit-log:owned'};
  for(const content of ['{"synthetic":true,"answer":["A","C"]}','"Text \\"Ω\\""','[1,false,null]','true','""']) {
    assert.equal(formatOriginalParticipantLogEntry({...base,logContent:content}),`BEHAVIOR = ${content}`);
  }
  assert.equal(formatOriginalParticipantLogEntry({...base,logContent:'complete'}),'BEHAVIOR = complete');
  assert.equal(formatOriginalParticipantLogEntry({...base,logContent:'0'}),'BEHAVIOR');
  assert.equal(formatOriginalParticipantLogEntry({...base,logContent:''}),'BEHAVIOR');
  assert.equal(formatOriginalParticipantLogEntry({...base,participantTestLogId:'canonical-id',logContent:'{"value":1}'}),'BEHAVIOR = '+JSON.stringify('{"value":1}'));
});
