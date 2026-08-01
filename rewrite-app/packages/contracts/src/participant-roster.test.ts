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

  it("maps delimited roster headers with common alias names", () => {
    assert.deepEqual(
      parseParticipantRosterText(
        [
          "login,booklet,group,name,pw",
          "alias-a,booklet:alias-a,group:alias-a,Ada Alias,secret-a",
          "alias-b\tbooklet:alias-b\tgroup:alias-b\tBen Alias\tsecret-b",
          "alias-c;booklet:alias-c;group:alias-c;Cara Alias"
        ].join("\n")
      ),
      [
        {
          loginKey: "alias-a",
          groupKey: "group:alias-a",
          bookletKey: "booklet:alias-a",
          displayName: "Ada Alias",
          password: "secret-a"
        },
        {
          loginKey: "alias-b",
          groupKey: "group:alias-b",
          bookletKey: "booklet:alias-b",
          displayName: "Ben Alias",
          password: "secret-b"
        },
        {
          loginKey: "alias-c",
          groupKey: "group:alias-c",
          bookletKey: "booklet:alias-c",
          displayName: "Cara Alias"
        }
      ]
    );
  });

  it("keeps positional delimited roster rows without a header", () => {
    assert.deepEqual(
      parseParticipantRosterText("pos-a,group:pos-a,booklet:pos-a,Position A"),
      [
        {
          loginKey: "pos-a",
          groupKey: "group:pos-a",
          bookletKey: "booklet:pos-a",
          displayName: "Position A"
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

  it("parses participant Testcenter Login entries and excludes operational modes", () => {
    assert.deepEqual(
      parseParticipantRosterText(
        [
          "<Testtakers>",
          "  <Group id=\"sample_group\" label=\"Primary Sample Group\">",
          "    <Login mode=\"run-hot-return\" name=\"test\" pw=\"user123\">",
          "      <Booklet codes=\"xxx yyy\">BOOKLET.SAMPLE-1</Booklet>",
          "      <Booklet>BOOKLET.SAMPLE-2</Booklet>",
          "    </Login>",
          "    <Login mode=\"monitor-group\" name=\"test-group-monitor\" pw=\"user123\" />",
          "    <Login mode=\"monitor-study\" name=\"test-study-monitor\" pw=\"user123\" />",
          "    <Login mode=\"sys-check-login\" name=\"test-sys-check\" />",
          "    <Login mode=\"run-review\" name=\"test-review\" pw=\"user123\"><Booklet>BOOKLET.REVIEW</Booklet></Login>",
          "  </Group>",
          "</Testtakers>"
        ].join("\n")
      ),
      [
        {
          loginKey: "test",
          groupKey: "sample_group",
          bookletKey: "BOOKLET.SAMPLE-1",
          bookletKeys: ["BOOKLET.SAMPLE-1", "BOOKLET.SAMPLE-2"],
          bookletAssignments: [
            {
              assignmentKey: "BOOKLET.SAMPLE-1",
              bookletKey: "BOOKLET.SAMPLE-1",
              statePreset: {}
            },
            {
              assignmentKey: "BOOKLET.SAMPLE-2",
              bookletKey: "BOOKLET.SAMPLE-2",
              statePreset: {}
            }
          ],
          displayName: null,
          password: "user123"
        },
        {
          loginKey: "test-review",
          groupKey: "sample_group",
          bookletKey: "BOOKLET.REVIEW",
          bookletAssignments: [
            {
              assignmentKey: "BOOKLET.REVIEW",
              bookletKey: "BOOKLET.REVIEW",
              statePreset: {}
            }
          ],
          displayName: null,
          password: "user123"
        }
      ]
    );
  });

  it("inherits Original Testcenter access windows and accepts JSON/CSV aliases", () => {
    assert.deepEqual(
      parseParticipantRosterText(
        [
          "<Testtakers>",
          "  <Group id=\"scheduled\" validFrom=\"1/6/2023 10:00\" validTo=\"2/6/2023 10:00\" validFor=\"45\">",
          "    <Login mode=\"run-hot-return\" name=\"xml-window\"><Booklet>BOOKLET.A</Booklet></Login>",
          "  </Group>",
          "</Testtakers>"
        ].join("\n")
      )[0],
      {
        loginKey: "xml-window",
        groupKey: "scheduled",
        bookletKey: "BOOKLET.A",
        bookletAssignments: [
          {
            assignmentKey: "BOOKLET.A",
            bookletKey: "BOOKLET.A",
            statePreset: {}
          }
        ],
        displayName: null,
        validFrom: "1/6/2023 10:00",
        validTo: "2/6/2023 10:00",
        validForMinutes: 45
      }
    );

    assert.deepEqual(
      parseParticipantRosterText({
        groups: [
          {
            id: "json-window",
            validFrom: "2026-01-01T08:00:00Z",
            validForMinutes: 30,
            participants: [{ login: "json-window" }]
          }
        ]
      })[0],
      {
        loginKey: "json-window",
        groupKey: "json-window",
        bookletKey: null,
        displayName: null,
        validFrom: "2026-01-01T08:00:00Z",
        validForMinutes: 30
      }
    );

    assert.deepEqual(
      parseParticipantRosterText(
        "login,group,valid-from,valid-to,valid-for\ncsv-window,csv-group,2026-01-01T08:00:00Z,2026-01-01T09:00:00Z,15"
      )[0],
      {
        loginKey: "csv-window",
        groupKey: "csv-group",
        bookletKey: null,
        displayName: null,
        validFrom: "2026-01-01T08:00:00Z",
        validTo: "2026-01-01T09:00:00Z",
        validForMinutes: 15
      }
    );
  });

  it("applies Testcenter login modes to JSON roster entries", () => {
    assert.deepEqual(
      parseParticipantRosterText({
        groups: [
          {
            id: "group:modes",
            participants: [
              { login: "json-run", mode: "run-hot-return" },
              { login: "json-review", mode: "run-review" },
              { login: "json-monitor", mode: "monitor-group" },
              { login: "json-system-check", mode: "sys-check-login" }
            ]
          }
        ]
      }),
      [
        {
          loginKey: "json-run",
          groupKey: "group:modes",
          bookletKey: null,
          displayName: null
        },
        {
          loginKey: "json-review",
          groupKey: "group:modes",
          bookletKey: null,
          displayName: null
        }
      ]
    );
  });

  it("does not reinterpret participant-free XML or JSON documents as delimited rows", () => {
    assert.deepEqual(
      parseParticipantRosterText(
        '<Testtakers><Group id="operators"><Login mode="monitor-study" name="study-monitor" /></Group></Testtakers>'
      ),
      []
    );
    assert.deepEqual(parseParticipantRosterText({ participants: [] }), []);
    assert.deepEqual(parseParticipantRosterText('{"participants":[]}'), []);
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
                    lastName: "B",
                    password: "json-secret"
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
          displayName: "Json B",
          password: "json-secret"
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
