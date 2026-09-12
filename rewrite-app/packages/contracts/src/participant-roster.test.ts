import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  mapOriginalTestcenterOperationalLoginToAdminRole,
  mapOriginalTestcenterOperationalLoginToMonitorRole,
  parseOriginalTestcenterOperationalLogins,
  parseParticipantRosterText
} from "./participant-roster.js";

describe("parseParticipantRosterText", () => {
  it("parses the current canonical Testtakers JSON shape", () => {
    assert.deepEqual(
      parseParticipantRosterText(
        JSON.stringify({
          metadata: { description: "Current Testtakers JSON" },
          customTexts: { login_subtitle: "Current project selection" },
          groups: [
            {
              id: "current-group",
              label: "Current Group",
              validFrom: "1/9/2025 08:00",
              validFor: 45,
              assetAssignment: [
                { slot: "logo", value: "school-logo.png" },
                { slot: "starterCompanion", value: "school-bird.webp" }
              ],
              logins: [
                {
                  name: "current-student",
                  pw: "current-secret",
                  mode: "run-hot-return",
                  booklets: [
                    {
                      id: "BOOKLET.CURRENT-1",
                      codes: "abc def",
                      state: "language:de;layout:compact"
                    },
                    { id: "BOOKLET.CURRENT-2" }
                  ],
                  assetAssignment: [
                    { slot: "starterCompanion", value: "student-bird.jpg" },
                    { slot: "confirmDialog", value: "student-confirm.png" }
                  ],
                  viewSettings: {
                    theme: "Sekundar",
                    codeInput: { type: "keypad-numbers", length: 3 }
                  }
                },
                {
                  name: "current-monitor",
                  mode: "monitor-group",
                  profiles: [{ id: "all" }]
                }
              ]
            }
          ]
        })
      ),
      [
        {
          loginKey: "current-student",
          executionMode: "run-hot-return",
          groupKey: "current-group",
          groupLabel: "Current Group",
          bookletKey: "BOOKLET.CURRENT-1",
          bookletKeys: ["BOOKLET.CURRENT-1", "BOOKLET.CURRENT-2"],
          bookletAssignments: [
            {
              assignmentKey:
                "BOOKLET.CURRENT-1#language:de;layout:compact",
              bookletKey: "BOOKLET.CURRENT-1",
              statePreset: { language: "de", layout: "compact" },
              accessCodes: ["abc", "def"]
            },
            {
              assignmentKey: "BOOKLET.CURRENT-2",
              bookletKey: "BOOKLET.CURRENT-2",
              statePreset: {}
            }
          ],
          bookletStatePresets: {
            "BOOKLET.CURRENT-1": { language: "de", layout: "compact" }
          },
          displayName: null,
          password: "current-secret",
          validFrom: "1/9/2025 08:00",
          validForMinutes: 45,
          customTexts: { login_subtitle: "Current project selection" },
          viewSettings: {
            theme: "Sekundar",
            codeInput: { type: "keypad-numbers", length: 3 }
          },
          assetAssignments: {
            logo: "school-logo.png",
            starterCompanion: "student-bird.jpg",
            confirmDialog: "student-confirm.png"
          }
        }
      ]
    );
  });

  it("classifies operational logins from the current canonical Testtakers JSON shape", () => {
    const source = {
      customTexts: { gm_headline: "Current monitor" },
      profiles: {
        groupMonitor: [
          {
            id: "current-profile",
            label: "Current profile",
            view: "small",
            blockColumn: "hide",
            filterLocked: "yes",
            filters: [
              {
                field: "groupName",
                value: "current-group",
                label: "Current group",
                type: "equal",
                not: true
              }
            ]
          }
        ]
      },
      groups: [
        {
          id: "current-group",
          label: "Current Group",
          validFor: 30,
          assetAssignment: [{ slot: "logo", value: "group-logo.png" }],
          logins: [
            {
              name: "current-monitor",
              pw: "source-secret",
              mode: "monitor-group",
              profiles: [{ id: "current-profile" }, { id: "missing" }],
              assetAssignment: [
                { slot: "logo", value: "monitor-logo.webp" }
              ],
              viewSettings: { monitorBookletVisibility: "collapsed" }
            },
            {
              name: "current-participant",
              mode: "run-hot-return",
              booklets: [{ id: "BOOKLET.CURRENT" }]
            }
          ]
        }
      ]
    };

    const candidates = parseOriginalTestcenterOperationalLogins(source);
    assert.deepEqual(candidates, [
      {
        loginKey: "current-monitor",
        loginMode: "monitor-group",
        groupKey: "current-group",
        groupLabel: "Current Group",
        passwordRequired: true,
        profileIds: ["current-profile", "missing"],
        monitorProfiles: [
          {
            profileId: "current-profile",
            label: "Current profile",
            settings: {
              blockColumn: "hide",
              unitColumn: "show",
              view: "small",
              groupColumn: "hide",
              bookletColumn: "show",
              bookletStatesColumns: "",
              autoselectNextBlock: "yes"
            },
            filters: [
              {
                target: "groupName",
                value: "current-group",
                subValue: null,
                label: "Current group",
                type: "equal",
                not: true
              }
            ],
            filtersEnabled: { pending: "no", locked: "yes" }
          }
        ],
        monitorBookletVisibility: "collapsed",
        customTexts: { gm_headline: "Current monitor" },
        assetAssignments: { logo: "monitor-logo.webp" },
        unresolvedProfileIds: ["missing"],
        validForMinutes: 30
      }
    ]);
    assert.equal(JSON.stringify(candidates).includes("source-secret"), false);
  });

  it("inherits Testtakers 18.0 group assets and lets login assets override slots", () => {
    assert.deepEqual(
      parseParticipantRosterText(
        [
          '<Testtakers xmlns="https://w3id.org/iqb/spec/testcenter-testtaker-xml/18.0">',
          '  <Group id="group-a">',
          "    <AssetAssignments>",
          '      <Asset slot="logo">school.png</Asset>',
          '      <Asset slot="starterCompanion">group-start.webp</Asset>',
          "    </AssetAssignments>",
          '    <Login name="student-a" mode="run-hot-return">',
          '      <Booklet>booklet-a</Booklet>',
          "      <AssetAssignments>",
          '        <Asset slot="starterCompanion">student-start.jpg</Asset>',
          "      </AssetAssignments>",
          "    </Login>",
          "  </Group>",
          "</Testtakers>"
        ].join("\n")
      ),
      [
        {
          loginKey: "student-a",
          executionMode: "run-hot-return",
          groupKey: "group-a",
          bookletKey: "booklet-a",
          bookletAssignments: [
            {
              assignmentKey: "booklet-a",
              bookletKey: "booklet-a",
              statePreset: {}
            }
          ],
          displayName: null,
          assetAssignments: {
            logo: "school.png",
            starterCompanion: "student-start.jpg"
          }
        }
      ]
    );
  });

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
          groupLabel: "Primary Sample Group",
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
          groupLabel: "Primary Sample Group",
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

  it("normalizes leading-plus xs:integer code-input lengths", () => {
    const [participant] = parseParticipantRosterText(
      [
        "<Testtakers>",
        '  <Group id="signed-length" label="Signed Length">',
        '    <Login mode="run-hot-return" name="signed-length-user">',
        "      <Booklet>BOOKLET.SIGNED-LENGTH</Booklet>",
        "      <ViewSettings>",
        "        <codeInput><type>keypad-numbers</type><length>+4</length></codeInput>",
        "      </ViewSettings>",
        "    </Login>",
        "  </Group>",
        "</Testtakers>"
      ].join("\n")
    );

    assert.deepEqual(participant?.viewSettings?.codeInput, {
      type: "keypad-numbers",
      length: 4
    });
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
        "    <AssetAssignments><Asset slot=\"logo\">operator-logo.png</Asset></AssetAssignments>",
        "    <Login mode=\"monitor-group\" name=\"group-monitor\" pw=\"secret\">",
        "      <Profile id=\"all\" />",
        "      <Profile id=\"small\" />",
        "      <Profile id=\"all\" />",
        "      <Profile id=\"missing\" />",
        "      <AssetAssignments><Asset slot=\"logo\">monitor-logo.webp</Asset></AssetAssignments>",
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
        assetAssignments: { logo: "monitor-logo.webp" },
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
        assetAssignments: { logo: "operator-logo.png" },
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
        "login,group,groupLabel,valid-from,valid-to,valid-for\ncsv-window,csv-group,CSV Group,2026-01-01T08:00:00Z,2026-01-01T09:00:00Z,15"
      )[0],
      {
        loginKey: "csv-window",
        groupKey: "csv-group",
        groupLabel: "CSV Group",
        bookletKey: null,
        displayName: null,
        validFrom: "2026-01-01T08:00:00Z",
        validTo: "2026-01-01T09:00:00Z",
        validForMinutes: 15
      }
    );
  });

  it("normalizes signed Original xs:integer validFor values", () => {
    assert.deepEqual(
      parseParticipantRosterText(
        [
          "<Testtakers>",
          "  <Metadata />",
          '  <Group id="positive" label="Positive" validFor="+45">',
          '    <Login mode="run-hot-return" name="positive-login"><Booklet>booklet-a</Booklet></Login>',
          "  </Group>",
          '  <Group id="zero" label="Zero" validFor="0">',
          '    <Login mode="run-hot-return" name="zero-login"><Booklet>booklet-a</Booklet></Login>',
          "  </Group>",
          '  <Group id="negative" label="Negative" validFor="-15">',
          '    <Login mode="run-hot-return" name="negative-login"><Booklet>booklet-a</Booklet></Login>',
          "  </Group>",
          "</Testtakers>"
        ].join("\n")
      ).map(entry => ({
        loginKey: entry.loginKey,
        validForMinutes: entry.validForMinutes ?? null
      })),
      [
        { loginKey: "positive-login", validForMinutes: 45 },
        { loginKey: "zero-login", validForMinutes: null },
        { loginKey: "negative-login", validForMinutes: null }
      ]
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
