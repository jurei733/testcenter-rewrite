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

  it("inherits XML group and booklet context from parent blocks", () => {
    assert.deepEqual(
      parseParticipantRosterText(
        [
          "<Testtakers>",
          "  <Group id=\"group:parent\">",
          "    <Booklet id=\"booklet:parent\">",
          "      <Testtaker login=\"nested-a\" name=\"Nested A\" />",
          "      <Testtaker login=\"nested-b\" booklet=\"booklet:override\" name=\"Nested B\" />",
          "    </Booklet>",
          "  </Group>",
          "</Testtakers>"
        ].join("\n")
      ),
      [
        {
          loginKey: "nested-a",
          groupKey: "group:parent",
          bookletKey: "booklet:parent",
          displayName: "Nested A"
        },
        {
          loginKey: "nested-b",
          groupKey: "group:parent",
          bookletKey: "booklet:override",
          displayName: "Nested B"
        }
      ]
    );
  });

  it("parses JSON roster entries and inherited group/booklet contexts", () => {
    assert.deepEqual(
      parseParticipantRosterText(
        JSON.stringify({
          groups: [
            {
              groupKey: "group:json",
              booklets: [
                {
                  bookletKey: "booklet:json",
                  participants: [
                    {
                      loginKey: "json-a",
                      displayName: "Json A"
                    },
                    {
                      login: "json-b",
                      booklet: { id: "booklet:override" },
                      firstName: "Json",
                      lastName: "B"
                    }
                  ]
                }
              ]
            },
            {
              id: "group:second",
              testtakers: [{ username: "json-c" }]
            }
          ]
        })
      ),
      [
        {
          loginKey: "json-a",
          groupKey: "group:json",
          bookletKey: "booklet:json",
          displayName: "Json A"
        },
        {
          loginKey: "json-b",
          groupKey: "group:json",
          bookletKey: "booklet:override",
          displayName: "Json B"
        },
        {
          loginKey: "json-c",
          groupKey: "group:second",
          bookletKey: null,
          displayName: null
        }
      ]
    );
  });

  it("parses native JSON roster objects and arrays", () => {
    assert.deepEqual(
      parseParticipantRosterText({
        groups: [
          {
            id: "group:native",
            booklets: [
              {
                id: "booklet:native",
                participants: [
                  { loginKey: "native-a", displayName: "Native A" },
                  { username: "native-b", firstName: "Native", lastName: "B" }
                ]
              }
            ]
          }
        ]
      }),
      [
        {
          loginKey: "native-a",
          groupKey: "group:native",
          bookletKey: "booklet:native",
          displayName: "Native A"
        },
        {
          loginKey: "native-b",
          groupKey: "group:native",
          bookletKey: "booklet:native",
          displayName: "Native B"
        }
      ]
    );
    assert.deepEqual(parseParticipantRosterText([{ login: "native-c" }]), [
      {
        loginKey: "native-c",
        groupKey: "group:native-c",
        bookletKey: null,
        displayName: null
      }
    ]);
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
