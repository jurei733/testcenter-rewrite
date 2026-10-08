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
