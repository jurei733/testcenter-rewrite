import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parseParticipantRosterText } from "./index.js";

describe("parseParticipantRosterText", () => {
  it("parses CSV, TSV, and semicolon roster rows", () => {
    assert.deepEqual(
      parseParticipantRosterText(
        [
          "loginKey,groupKey,bookletKey,displayName",
          "student-a,group:a,booklet:a,Ada CSV",
          "student-b\tgroup:b\tbooklet:b\tBen TSV",
          "student-c;group:c;;Cara Semicolon"
        ].join("\n")
      ),
      [
        {
          loginKey: "student-a",
          groupKey: "group:a",
          bookletKey: "booklet:a",
          displayName: "Ada CSV"
        },
        {
          loginKey: "student-b",
          groupKey: "group:b",
          bookletKey: "booklet:b",
          displayName: "Ben TSV"
        },
        {
          loginKey: "student-c",
          groupKey: "group:c",
          bookletKey: null,
          displayName: "Cara Semicolon"
        }
      ]
    );
  });

  it("parses Testtaker and participant XML roster entries", () => {
    assert.deepEqual(
      parseParticipantRosterText(
        [
          "<Testtakers>",
          "  <Testtaker login=\"xml-a\" group=\"group:attr\" booklet=\"booklet:attr\" name=\"Xml Attr\" />",
          "  <participant>",
          "    <login>xml-b</login>",
          "    <group id=\"group:child\" />",
          "    <booklet ref=\"booklet:child\" />",
          "    <firstName>Xml</firstName>",
          "    <lastName>Child</lastName>",
          "  </participant>",
          "</Testtakers>"
        ].join("\n")
      ),
      [
        {
          loginKey: "xml-a",
          groupKey: "group:attr",
          bookletKey: "booklet:attr",
          displayName: "Xml Attr"
        },
        {
          loginKey: "xml-b",
          groupKey: "group:child",
          bookletKey: "booklet:child",
          displayName: "Xml Child"
        }
      ]
    );
  });

  it("defaults missing groups from login keys", () => {
    assert.deepEqual(parseParticipantRosterText("solo-login"), [
      {
        loginKey: "solo-login",
        groupKey: "group:solo-login",
        bookletKey: null,
        displayName: null
      }
    ]);
  });
});
