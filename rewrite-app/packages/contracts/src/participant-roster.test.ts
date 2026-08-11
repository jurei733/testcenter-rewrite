import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  mapOriginalTestcenterOperationalLoginToAdminRole,
  mapOriginalTestcenterOperationalLoginToMonitorRole,
  parseOriginalTestcenterOperationalLogins,
  parseParticipantRosterText
} from "./index.js";

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
          "      <ViewSettings>",
          "        <theme>Sekundar</theme>",
          "        <codeInput><type>keypad-symbols-alt</type><length>3</length></codeInput>",
          "      </ViewSettings>",
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
          executionMode: "run-hot-return",
          groupKey: "sample_group",
          bookletKey: "BOOKLET.SAMPLE-1",
          bookletKeys: ["BOOKLET.SAMPLE-1", "BOOKLET.SAMPLE-2"],
          bookletAssignments: [
            {
              assignmentKey: "BOOKLET.SAMPLE-1",
              bookletKey: "BOOKLET.SAMPLE-1",
              statePreset: {},
              accessCodes: ["xxx", "yyy"]
            },
            {
              assignmentKey: "BOOKLET.SAMPLE-2",
              bookletKey: "BOOKLET.SAMPLE-2",
              statePreset: {}
            }
          ],
          viewSettings: {
            theme: "Sekundar",
            codeInput: { type: "keypad-symbols-alt", length: 3 }
          },
          displayName: null,
          password: "user123"
        },
        {
          loginKey: "test-review",
          executionMode: "run-review",
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

  it("parses Original Testcenter comma-separated booklet state presets", () => {
    const [entry] = parseParticipantRosterText(
      [
        "<Testtakers>",
        "  <Group id=\"adaptive\">",
        "    <Login mode=\"run-review\" name=\"adaptive-review\">",
        "      <Booklet state=\"level:advanced, bonus:yes\">BOOKLET.ADAPTIVE</Booklet>",
        "    </Login>",
        "  </Group>",
        "</Testtakers>"
      ].join("\n")
    );

    assert.deepEqual(entry?.bookletAssignments, [
      {
        assignmentKey: "BOOKLET.ADAPTIVE#level:advanced;bonus:yes",
        bookletKey: "BOOKLET.ADAPTIVE",
        statePreset: { level: "advanced", bonus: "yes" }
      }
    ]);
  });

  it("classifies operational Testtakers logins without exposing passwords", () => {
    const operationalLogins = parseOriginalTestcenterOperationalLogins(
      [
        "<Testtakers>",
        "  <CustomTexts><CustomText key=\"gm_headline\">Custom monitor</CustomText></CustomTexts>",
        "  <Profiles><GroupMonitor>",
        "    <Profile id=\"all\" label=\"All sessions\" view=\"full\" blockColumn=\"show\" unitColumn=\"show\" groupColumn=\"show\" bookletColumn=\"show\" bookletStatesColumns=\"level bonus\" autoselectNextBlock=\"no\" />",
        "    <Profile id=\"small\" label=\"Reduced\" view=\"small\" blockColumn=\"hide\" unitColumn=\"hide\" groupColumn=\"hide\" bookletColumn=\"hide\" filterLocked=\"yes\" filterPending=\"yes\"><Filter label=\"Reduced Booklet\" type=\"equal\" field=\"bookletLabel\" value=\"Reduced Booklet\" not=\"1\" /><Filter label=\"Operator group\" type=\"equal\" field=\"groupName\" value=\"operators\" not=\"0\" /></Profile>",
        "  </GroupMonitor></Profiles>",
        "  <Group id=\"scheduled-operators\" validFrom=\"1/6/2023 10:00\" validFor=\"45\">",
        "    <Login mode=\"monitor-group\" name=\"group-monitor\" pw=\"secret\">",
        "      <Profile id=\"all\" />",
        "      <Profile id=\"small\" />",
        "      <Profile id=\"all\" />",
        "      <Profile id=\"missing\" />",
        "      <ViewSettings><monitorBookletVisibility>collapsed</monitorBookletVisibility></ViewSettings>",
        "    </Login>",
        "    <Login mode=\"sys-check-login\" name=\"sys-check\" />",
        "    <Login mode=\"run-hot-return\" name=\"participant\"><Booklet>BOOKLET.A</Booklet></Login>",
        "  </Group>",
        "</Testtakers>"
      ].join("\n")
    );

    assert.deepEqual(operationalLogins, [
      {
        loginKey: "group-monitor",
        loginMode: "monitor-group",
        groupKey: "scheduled-operators",
        passwordRequired: true,
        profileIds: ["all", "small", "missing"],
        monitorProfiles: [
          {
            profileId: "all",
            label: "All sessions",
            settings: {
              blockColumn: "show",
              unitColumn: "show",
              view: "full",
              groupColumn: "show",
              bookletColumn: "show",
              bookletStatesColumns: "level bonus",
              autoselectNextBlock: "no"
            },
            filters: [],
            filtersEnabled: { pending: "no", locked: "no" }
          },
          {
            profileId: "small",
            label: "Reduced",
            settings: {
              blockColumn: "hide",
              unitColumn: "hide",
              view: "small",
              groupColumn: "hide",
              bookletColumn: "hide",
              bookletStatesColumns: "",
              autoselectNextBlock: "yes"
            },
            filters: [
              {
                target: "bookletLabel",
                value: "Reduced Booklet",
                subValue: null,
                label: "Reduced Booklet",
                type: "equal",
                not: true
              },
              {
                target: "groupName",
                value: "operators",
                subValue: null,
                label: "Operator group",
                type: "equal",
                not: false
              }
            ],
            filtersEnabled: { pending: "yes", locked: "yes" }
          }
        ],
        monitorBookletVisibility: "collapsed",
        customTexts: { gm_headline: "Custom monitor" },
        unresolvedProfileIds: ["missing"],
        validFrom: "1/6/2023 10:00",
        validForMinutes: 45
      },
      {
        loginKey: "sys-check",
        loginMode: "sys-check-login",
        groupKey: "scheduled-operators",
        passwordRequired: false,
        profileIds: [],
        monitorProfiles: [],
        monitorBookletVisibility: "visible",
        customTexts: { gm_headline: "Custom monitor" },
        unresolvedProfileIds: [],
        validFrom: "1/6/2023 10:00",
        validForMinutes: 45
      }
    ]);
    assert.equal(JSON.stringify(operationalLogins).includes("secret"), false);
    assert.deepEqual(
      mapOriginalTestcenterOperationalLoginToMonitorRole(operationalLogins[0]!),
      { role: "group_monitor", groupKey: "scheduled-operators" }
    );
    assert.equal(
      mapOriginalTestcenterOperationalLoginToMonitorRole(operationalLogins[1]!),
      null
    );
    assert.deepEqual(
      mapOriginalTestcenterOperationalLoginToAdminRole(operationalLogins[1]!),
      { role: "system_check", groupKey: null }
    );
    assert.deepEqual(
      mapOriginalTestcenterOperationalLoginToMonitorRole({
        loginKey: "study-monitor",
        loginMode: "monitor-study",
        groupKey: "ignored-study-group",
        passwordRequired: true,
        profileIds: [],
        monitorProfiles: [],
        monitorBookletVisibility: "visible",
        customTexts: {},
        unresolvedProfileIds: []
      }),
      { role: "study_monitor", groupKey: null }
    );
  });

  it("uses Original Testcenter monitor profile defaults", () => {
    const [candidate] = parseOriginalTestcenterOperationalLogins(
      [
        "<Testtakers>",
        "  <Profiles><GroupMonitor>",
        "    <Profile id=\"default\"><Filter field=\"personLabel\" value=\"Ada\" /></Profile>",
        "  </GroupMonitor></Profiles>",
        "  <Group id=\"operators\">",
        "    <Login mode=\"monitor-group\" name=\"monitor\"><Profile id=\"default\" /></Login>",
        "  </Group>",
        "</Testtakers>"
      ].join("\n")
    );

    assert.equal(candidate?.monitorProfiles[0]?.settings.view, "medium");
    assert.equal(candidate?.monitorProfiles[0]?.filters[0]?.type, "equal");
  });

  it("applies Original Testtakers custom texts to every participant login", () => {
    const entries = parseParticipantRosterText(
      [
        "<Testtakers>",
        "  <CustomTexts>",
        "    <CustomText key=\"login_subtitle\">Project &amp; Study</CustomText>",
        "    <CustomText key=\"login_testEndButtonLabel\">Submit answers</CustomText>",
        "  </CustomTexts>",
        "  <Group id=\"students\">",
        "    <Login mode=\"run-hot-return\" name=\"one\"><Booklet>BOOKLET.A</Booklet></Login>",
        "    <Login mode=\"run-hot-return\" name=\"two\"><Booklet>BOOKLET.B</Booklet></Login>",
        "  </Group>",
        "</Testtakers>"
      ].join("\n")
    );

    assert.equal(entries.length, 2);
    assert.deepEqual(entries[0]?.customTexts, {
      login_subtitle: "Project & Study",
      login_testEndButtonLabel: "Submit answers"
    });
    assert.deepEqual(entries[1]?.customTexts, entries[0]?.customTexts);
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
        executionMode: "run-hot-return",
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
              { login: "json-trial", executionMode: "run-trial" },
              { login: "json-monitor", mode: "monitor-group" },
              { login: "json-system-check", mode: "sys-check-login" }
            ]
          }
        ]
      }),
      [
        {
          loginKey: "json-run",
          executionMode: "run-hot-return",
          groupKey: "group:modes",
          bookletKey: null,
          displayName: null
        },
        {
          loginKey: "json-review",
          executionMode: "run-review",
          groupKey: "group:modes",
          bookletKey: null,
          displayName: null
        },
        {
          loginKey: "json-trial",
          executionMode: "run-trial",
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
        customTexts: {
          login_subtitle: "Native project selection",
          booklet_msgSoonTimeOver: { value: "%s native minutes remain" }
        },
        groups: [
          {
            id: "group:native",
            booklets: [
              {
                id: "booklet:native",
                participants: [
                  {
                    loginKey: "native-a",
                    displayName: "Native A",
                    customTexts: [
                      {
                        key: "login_subtitle",
                        text: "Participant project selection"
                      }
                    ]
                  },
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
          displayName: "Native A",
          customTexts: {
            login_subtitle: "Participant project selection",
            booklet_msgSoonTimeOver: "%s native minutes remain"
          }
        },
        {
          loginKey: "native-b",
          groupKey: "group:native",
          bookletKey: "booklet:native",
          displayName: "Native B",
          customTexts: {
            login_subtitle: "Native project selection",
            booklet_msgSoonTimeOver: "%s native minutes remain"
          }
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
