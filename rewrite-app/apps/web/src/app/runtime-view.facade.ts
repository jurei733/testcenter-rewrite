import { ApplicationRef, Injectable, inject } from "@angular/core";

import { parseParticipantRosterText } from "@testcenter-rewrite-app/contracts";
import type {
  GetParticipantSessionResponse,
  ListDetailedResponsesResponse,
  ListReviewsResponse,
  ListParticipantRosterResponse,
  ListParticipantSessionsResponse,
  ListWorkspaceActivityEventsResponse,
  MonitorOpenRunsResponse,
  ParsedParticipantRosterEntry,
  ParticipantCurrentRunStateResponse,
  ParticipantRuntimeStateResponse
} from "@testcenter-rewrite-app/contracts";
import {
  participantSessionStatuses,
  testRunStatuses
} from "@testcenter-rewrite-app/domain";

import type { RecordCollectionItem } from "./record-collection.component";
import type { SummaryCard } from "./rewrite-app-shell.types";
import {
  parseJsonDocument,
  readStringValue,
  readUnknownValue
} from "./rewrite-app-shell.readers";
import { downloadTextFile } from "./download-text-file";
import { RewriteAppUiStateService } from "./rewrite-app-ui-state.service";
import { RewriteAppRuntimeService } from "./rewrite-app-runtime.service";
import { RewriteAppShellFeedbackService } from "./rewrite-app-shell-feedback.service";
import { RewriteAppViewStateService } from "./rewrite-app-view-state.service";
import {
  buildParticipantEntryUrl,
  participantSessionLinkRows
} from "./participant-session-links";

type RuntimePlayerPreview = {
  hasRun: boolean;
  bookletLabel: string;
  unitLabel: string;
  unitKey: string;
  unitResponse: string;
  runStatus: string;
  runId: string;
  availableActions: string[];
  hint: string;
  canSaveProgress: boolean;
  canResume: boolean;
  canComplete: boolean;
  saveProgressLabel: string;
};

type RuntimeEntryLink = {
  loginKey: string;
  groupKey: string;
  bookletKey: string;
  displayName?: string;
  url: string;
};

@Injectable({ providedIn: "root" })
export class RuntimeViewFacade {
  private readonly applicationRef = inject(ApplicationRef);
  private readonly uiState = inject(RewriteAppUiStateService);
  private readonly runtimeService = inject(RewriteAppRuntimeService);
  private readonly feedback = inject(RewriteAppShellFeedbackService);
  private readonly viewState = inject(RewriteAppViewStateService);

  readonly runtime = this.uiState.runtime;
  readonly participantSessionStatusOptions = participantSessionStatuses;
  readonly testRunStatusOptions = testRunStatuses;

  get participantSessionsView(): string {
    return this.uiState.runtime.participantSessionsView;
  }

  get participantSessionItems(): RecordCollectionItem[] {
    const payload = parseJsonDocument<ListParticipantSessionsResponse>(
      this.runtime.participantSessionsView
    );
    if (!payload) {
      return [];
    }

    const activeFilters = [
      this.runtime.participantSessionStatusFilter.trim() ? "status" : "",
      this.runtime.participantSessionGroupFilter.trim() ? "group" : "",
      this.runtime.participantSessionLoginFilter.trim() ? "login" : "",
      this.runtime.participantSessionBookletFilter.trim() ? "booklet" : "",
      this.runtime.participantSessionReleaseFilter.trim() ? "release" : ""
    ].filter(Boolean);

    return [
      {
        headline: "Participant session window",
        subline: `${payload.items.length} session row(s) loaded for the current filters`,
        badges: [
          `${activeFilters.length} active filter(s)`,
          `limit ${this.runtime.participantSessionLimit}`
        ],
        rows: [
          { label: "Loaded Sessions", value: String(payload.items.length) },
          { label: "Limit", value: this.runtime.participantSessionLimit },
          {
            label: "Active Filters",
            value: activeFilters.length > 0 ? activeFilters.join(", ") : "none"
          }
        ]
      },
      ...payload.items.map(item => {
        const displayName = item.participantRosterEntry?.displayName;
        return {
          headline: displayName ?? item.participantSession.loginKey,
          subline: displayName
            ? item.participantSession.loginKey
            : item.participantSession.participantSessionId,
          badges: [
            item.participantSession.status,
            item.latestTestRun?.status ?? "no run",
            item.participantRosterEntry ? "roster" : "ad hoc"
          ],
          rows: [
            {
              label: "Session",
              value: item.participantSession.participantSessionId
            },
            ...participantSessionLinkRows(
              item.participantSession.participantSessionId,
              {
                tenantKey: this.uiState.workspace.tenantKey,
                workspaceKey: this.uiState.workspace.workspaceKey,
                loginKey: item.participantSession.loginKey,
                groupKey: item.participantSession.groupKey,
                bookletKey:
                  item.participantRosterEntry?.bookletKey ??
                  item.latestTestRun?.bookletKey
              }
            ),
            {
              label: "Group",
              value: item.participantSession.groupKey
            },
            {
              label: "Roster Booklet",
              value: item.participantRosterEntry?.bookletKey ?? "none"
            },
            {
              label: "Release",
              value:
                item.contentRelease?.releaseLabel ??
                item.participantSession.contentReleaseId
            },
            {
              label: "Created",
              value: this.formatDateTime(item.participantSession.createdAt)
            }
          ],
          selected:
            this.runtime.participantSessionId.trim() ===
            item.participantSession.participantSessionId,
          actionLabel: "Select + Load",
          actionPayload: {
            participantSessionId: item.participantSession.participantSessionId,
            loginKey: item.participantSession.loginKey,
            groupKey: item.participantSession.groupKey,
            bookletKey:
              item.participantRosterEntry?.bookletKey ??
              item.latestTestRun?.bookletKey ??
              "",
            displayName: displayName ?? ""
          }
        };
      })
    ];
  }

  get participantSessionDetailItems(): RecordCollectionItem[] {
    const payload = parseJsonDocument<GetParticipantSessionResponse>(
      this.runtime.participantSessionDetailView
    );
    const detail = payload?.participantSessionDetail;
    if (!detail) {
      return [];
    }

    return [
      {
        headline:
          detail.participantRosterEntry?.displayName ??
          detail.participantSession.loginKey,
        subline: detail.participantRosterEntry?.displayName
          ? detail.participantSession.loginKey
          : detail.participantSession.participantSessionId,
        badges: [
          detail.participantSession.status,
          detail.contentRelease?.status ?? "no release",
          `${detail.reviewCount ?? 0} review(s)`,
          detail.participantRosterEntry ? "roster" : "ad hoc"
        ],
        rows: [
          {
            label: "Session",
            value: detail.participantSession.participantSessionId
          },
          ...participantSessionLinkRows(
            detail.participantSession.participantSessionId,
            {
              tenantKey: this.uiState.workspace.tenantKey,
              workspaceKey: this.uiState.workspace.workspaceKey,
              loginKey: detail.participantSession.loginKey,
              groupKey: detail.participantSession.groupKey,
              bookletKey:
                detail.participantRosterEntry?.bookletKey ??
                detail.testRuns[0]?.bookletKey
            }
          ),
          {
            label: "Group",
            value: detail.participantSession.groupKey
          },
          {
            label: "Roster Booklet",
            value: detail.participantRosterEntry?.bookletKey ?? "none"
          },
          {
            label: "Release",
            value: detail.contentRelease?.releaseLabel ?? "none"
          },
          {
            label: "Runs",
            value: String(detail.testRuns.length)
          },
          {
            label: "Responses",
            value: String(detail.responseCount ?? 0)
          },
          {
            label: "Reviews",
            value: String(detail.reviewCount ?? 0)
          },
          {
            label: "Created",
            value: this.formatDateTime(detail.participantSession.createdAt)
          }
        ],
        selected:
          this.runtime.participantSessionId.trim() ===
          detail.participantSession.participantSessionId,
        actionLabel: "Select + Load",
        actionPayload: {
          participantSessionId: detail.participantSession.participantSessionId,
          loginKey: detail.participantSession.loginKey,
          groupKey: detail.participantSession.groupKey,
          bookletKey:
            detail.participantRosterEntry?.bookletKey ??
            detail.testRuns[0]?.bookletKey ??
            "",
          displayName: detail.participantRosterEntry?.displayName ?? ""
        }
      }
    ];
  }

  get entryLinkItems(): RecordCollectionItem[] {
    return this.parseEntryLinksView().map(link => ({
      headline: link.displayName || link.loginKey,
      subline: link.displayName ? link.loginKey : link.url,
      badges: [link.groupKey, link.bookletKey || "default booklet"],
      rows: [
        { label: "Login", value: link.loginKey },
        { label: "Group", value: link.groupKey },
        { label: "Booklet", value: link.bookletKey || "active release default" },
        { label: "Display Name", value: link.displayName || "none" },
        { label: "URL", value: link.url, href: link.url }
      ],
      selected: this.runtime.loginKey.trim() === link.loginKey,
      actionLabel: "Use Entry Link",
      actionPayload: {
        loginKey: link.loginKey,
        groupKey: link.groupKey,
        bookletKey: link.bookletKey,
        displayName: link.displayName ?? ""
      },
      actions: [
        {
          label: "Open Participant Entry",
          payload: {
            loginKey: link.loginKey,
            groupKey: link.groupKey,
            bookletKey: link.bookletKey,
            displayName: link.displayName ?? "",
            url: link.url
          }
        }
      ]
    }));
  }

  get entryLinkCards(): SummaryCard[] {
    const links = this.parseEntryLinksView();
    const explicitBookletCount = links.filter(link => link.bookletKey.trim()).length;
    const defaultBookletCount = Math.max(links.length - explicitBookletCount, 0);
    const tenantKey = this.uiState.workspace.tenantKey.trim();
    const workspaceKey = this.uiState.workspace.workspaceKey.trim();

    return [
      {
        label: "Entry Links",
        headline: String(links.length),
        detail:
          links.length > 0
            ? "Participant start links are generated for this workspace."
            : "Generate links from roster rows or saved roster entries."
      },
      {
        label: "Scope",
        headline: workspaceKey || "No workspace",
        detail: tenantKey || "No tenant selected"
      },
      {
        label: "Booklets",
        headline: `${explicitBookletCount} explicit`,
        detail:
          defaultBookletCount > 0
            ? `${defaultBookletCount} use the active release default.`
            : "Every link carries an explicit booklet key."
      },
      {
        label: "CSV",
        headline: links.length > 0 ? "Ready" : "Not ready",
        detail:
          links.length > 0
            ? "Preview and download contain the current link set."
            : "CSV export will be populated after link generation."
      }
    ];
  }

  get participantLaunchpadCards(): SummaryCard[] {
    const rosterEntries = this.parseParticipantRosterView();
    const links = this.parseEntryLinksView();
    const inputEntries = this.parseEntryRosterRowsPreview();
    const sessions = this.parseParticipantSessionListView();
    const linkLogins = new Set(links.map(link => link.loginKey));
    const startedLinkedSessions = sessions.filter(item =>
      linkLogins.has(item.participantSession.loginKey)
    ).length;
    const notStartedLinks = Math.max(links.length - startedLinkedSessions, 0);

    return [
      {
        label: "Roster Entries",
        headline: String(rosterEntries.length),
        detail:
          rosterEntries.length > 0
            ? "Saved participants are available for entry-link generation."
            : "Load or import a roster before handing out links."
      },
      {
        label: "Input Preview",
        headline: String(inputEntries.length),
        detail:
          inputEntries.length > 0
            ? "Current roster text parses locally before import."
            : "Paste roster rows to preview parsed participants."
      },
      {
        label: "Generated Links",
        headline: String(links.length),
        detail:
          links.length > 0
            ? "Entry links are ready to open or export."
            : "Generate links from pasted rows or the saved roster."
      },
      {
        label: "Started Sessions",
        headline: String(startedLinkedSessions),
        detail:
          links.length > 0
            ? `${notStartedLinks} generated link(s) have no loaded session yet.`
            : "Refresh sessions after participants start."
      },
      {
        label: "Link CSV",
        headline: links.length > 0 ? "Ready" : "Pending",
        detail:
          links.length > 0
            ? "Download the current link set for distribution."
            : "CSV becomes available once links are generated."
      }
    ];
  }

  get participantLaunchpadActionItems(): RecordCollectionItem[] {
    const rosterEntries = this.parseParticipantRosterView();
    const inputEntries = this.parseEntryRosterRowsPreview();
    const links = this.parseEntryLinksView();
    const sessions = this.parseParticipantSessionListView();
    const items: RecordCollectionItem[] = [];

    if (inputEntries.length > 0 && rosterEntries.length === 0) {
      items.push({
        headline: "Import current roster input",
        subline: `${inputEntries.length} parsed input row${inputEntries.length === 1 ? "" : "s"}`,
        badges: ["roster", "import"],
        rows: [
          {
            label: "Expected Result",
            value: "Parsed participants are persisted before link handoff"
          }
        ],
        actionLabel: "Apply Suggestion",
        actionPayload: { launchpadCommand: "importRosterInput" }
      });
    }

    if (rosterEntries.length === 0) {
      items.push({
        headline: "Load saved participant roster",
        subline: "Use persisted roster rows for this workspace",
        badges: ["roster", "read"],
        rows: [
          {
            label: "Expected Result",
            value: "Saved participants appear and can be turned into entry links"
          }
        ],
        actionLabel: "Apply Suggestion",
        actionPayload: { launchpadCommand: "loadRoster" }
      });
    }

    if (rosterEntries.length > 0 && links.length !== rosterEntries.length) {
      items.push({
        headline: "Generate links from saved roster",
        subline: `${rosterEntries.length} roster entr${rosterEntries.length === 1 ? "y" : "ies"}`,
        badges: ["entry links", "generate"],
        rows: [
          {
            label: "Expected Result",
            value: "Every saved participant receives a direct start URL"
          }
        ],
        actionLabel: "Apply Suggestion",
        actionPayload: { launchpadCommand: "generateSavedRosterLinks" }
      });
    }

    if (links.length > 0) {
      items.push({
        headline: "Download participant entry links",
        subline: `${links.length} generated link${links.length === 1 ? "" : "s"}`,
        badges: ["csv", "handoff"],
        rows: [
          {
            label: "Expected Result",
            value: "Download a CSV that can be distributed to participants"
          }
        ],
        actionLabel: "Apply Suggestion",
        actionPayload: { launchpadCommand: "downloadEntryLinks" }
      });
    }

    items.push({
      headline: "Refresh participant sessions",
      subline: `${sessions.length} loaded session${sessions.length === 1 ? "" : "s"}`,
      badges: ["sessions", "read"],
      rows: [
        {
          label: "Expected Result",
          value: "Started participants are reflected in the launchpad"
        }
      ],
      actionLabel: "Apply Suggestion",
      actionPayload: { launchpadCommand: "refreshSessions" }
    });

    return items;
  }

  get entryRosterPreviewItems(): RecordCollectionItem[] {
    const rosterText = this.runtime.entryRosterText.trim();
    if (rosterText.length === 0) {
      return [];
    }

    let entries: ParsedParticipantRosterEntry[];
    try {
      entries = parseParticipantRosterText(rosterText);
    } catch (error) {
      return [
        {
          headline: "Roster input could not be parsed",
          subline: error instanceof Error ? error.message : "Unknown parser error",
          badges: ["local preview", "invalid"],
          rows: [
            {
              label: "Accepted Formats",
              value:
                "CSV/TSV/semicolon rows with alias headers, positional rows, XML, or JSON"
            }
          ]
        }
      ];
    }

    if (entries.length === 0) {
      return [
        {
          headline: "No participant rows detected",
          subline: "The current text parsed successfully but did not contain participants.",
          badges: ["local preview", "empty"],
          rows: [
            {
              label: "Hint",
              value: "Add at least login and group columns or a Testtaker/JSON participant."
            }
          ]
        }
      ];
    }

    const previewEntries = entries.slice(0, 5);
    const remainingCount = Math.max(entries.length - previewEntries.length, 0);
    const items: RecordCollectionItem[] = [
      {
        headline: `${entries.length} participant row${entries.length === 1 ? "" : "s"} parsed`,
        subline: "Alias headers and canonical columns are normalized before import.",
        badges: ["local preview", "ready"],
        rows: [
          {
            label: "Header Aliases",
            value: "login, group, booklet, name"
          },
          {
            label: "Canonical Columns",
            value: "loginKey, groupKey, bookletKey, displayName"
          }
        ]
      },
      ...previewEntries.map(entry => ({
        headline: entry.displayName ?? entry.loginKey,
        subline: entry.loginKey,
        badges: [entry.groupKey, entry.bookletKey ?? "default booklet"],
        rows: [
          { label: "Login", value: entry.loginKey },
          { label: "Group", value: entry.groupKey },
          { label: "Booklet", value: entry.bookletKey ?? "active release default" },
          { label: "Display Name", value: entry.displayName ?? "none" }
        ]
      }))
    ];

    if (remainingCount > 0) {
      items.push({
        headline: `${remainingCount} more row${remainingCount === 1 ? "" : "s"}`,
        subline: "Import or generate links to process the full roster input.",
        badges: ["local preview", "truncated"],
        rows: [
          {
            label: "Preview Limit",
            value: "Showing the first 5 parsed participants."
          }
        ]
      });
    }

    return items;
  }

  get participantLaunchStatusItems(): RecordCollectionItem[] {
    const links = this.parseEntryLinksView();
    if (links.length === 0) {
      return [];
    }

    const sessionsByLogin = new Map(
      this.parseParticipantSessionListView().map(item => [
        item.participantSession.loginKey,
        item
      ])
    );

    return links.map(link => {
      const sessionItem = sessionsByLogin.get(link.loginKey);
      const session = sessionItem?.participantSession;
      const latestRun = sessionItem?.latestTestRun;
      const launchStatus = session ? session.status : "not_started";

      return {
        headline: link.displayName || link.loginKey,
        subline: link.displayName ? link.loginKey : link.groupKey,
        badges: [
          launchStatus,
          latestRun?.status ?? "no run",
          link.bookletKey || "default booklet"
        ],
        rows: [
          { label: "Login", value: link.loginKey },
          { label: "Group", value: link.groupKey },
          { label: "Session", value: session?.participantSessionId ?? "not started" },
          { label: "Latest Run", value: latestRun?.testRunId ?? "none" },
          ...participantSessionLinkRows(session?.participantSessionId, {
            tenantKey: this.uiState.workspace.tenantKey.trim(),
            workspaceKey: this.uiState.workspace.workspaceKey.trim(),
            loginKey: link.loginKey,
            groupKey: link.groupKey,
            bookletKey: link.bookletKey
          }),
          {
            label: "Entry URL",
            value: link.url,
            href: link.url
          }
        ],
        selected:
          this.runtime.loginKey.trim() === link.loginKey ||
          (session?.participantSessionId != null &&
            this.runtime.participantSessionId.trim() === session.participantSessionId),
        actionLabel: session ? "Select + Load" : "Open Participant Entry",
        actionPayload: {
          loginKey: link.loginKey,
          groupKey: link.groupKey,
          bookletKey: link.bookletKey,
          url: link.url,
          participantSessionId: session?.participantSessionId ?? "",
          testRunId: latestRun?.testRunId ?? "",
          currentUnitKey: latestRun?.currentUnitKey ?? "",
          displayName: link.displayName ?? ""
        }
      };
    });
  }

  get participantRosterItems(): RecordCollectionItem[] {
    const payload = parseJsonDocument<ListParticipantRosterResponse>(
      this.runtime.participantRosterView
    );
    return (
      payload?.items.map(entry => {
        const validationWarnings = entry.validationWarnings ?? [];
        const link = {
          loginKey: entry.loginKey,
          groupKey: entry.groupKey,
          bookletKey: entry.bookletKey ?? ""
        };
        const selectionBookletKey = entry.bookletKey ?? this.runtime.bookletKey.trim();
        const entryUrl = this.buildParticipantEntryUrl(
          this.uiState.workspace.tenantKey.trim(),
          this.uiState.workspace.workspaceKey.trim(),
          link
        );
        return {
          headline: entry.loginKey,
          subline: entry.displayName ?? entry.participantRosterEntryId,
          badges: [
            entry.groupKey,
            entry.bookletKey ?? "default booklet",
            validationWarnings.length > 0
              ? `${validationWarnings.length} warning${validationWarnings.length === 1 ? "" : "s"}`
              : "validated"
          ],
          rows: [
            { label: "Display Name", value: entry.displayName ?? "none" },
            { label: "Group", value: entry.groupKey },
            { label: "Booklet", value: entry.bookletKey ?? "active release default" },
            {
              label: "Validation",
              value:
                validationWarnings.length > 0
                  ? validationWarnings
                      .map(warning => `${warning.code}: ${warning.message}`)
                      .join(" | ")
                  : "No roster warnings"
            },
            { label: "Imported", value: this.formatDateTime(entry.importedAt) },
            {
              label: "Entry URL",
              value: entryUrl,
              href: entryUrl
            }
          ],
          selected: this.runtime.loginKey.trim() === entry.loginKey,
          actionLabel: "Use Roster Entry",
          actionPayload: {
            loginKey: entry.loginKey,
            groupKey: entry.groupKey,
            bookletKey: selectionBookletKey,
            displayName: entry.displayName ?? ""
          },
          actions: [
            {
              label: "Open Participant Entry",
              payload: {
                loginKey: entry.loginKey,
                groupKey: entry.groupKey,
                bookletKey: entry.bookletKey ?? "",
                displayName: entry.displayName ?? "",
                url: entryUrl
              }
            }
          ]
        };
      }) ?? []
    );
  }

  get entryLinksCsvPreview(): string {
    const links = this.parseEntryLinksView();
    if (links.length === 0) {
      return "Generate entry links to preview CSV.";
    }
    return this.createEntryLinksCsv(links);
  }

  get participantRunHistoryItems(): RecordCollectionItem[] {
    const payload = parseJsonDocument<GetParticipantSessionResponse>(
      this.runtime.participantSessionDetailView
    );
    const detail = payload?.participantSessionDetail;
    if (!detail) {
      return [];
    }

    const runSummaries =
      detail.runSummaries ??
      detail.testRuns.map(testRun => ({
        testRun,
        responseCount: Object.keys(testRun.unitResponses ?? {}).length,
        reviewCount: 0
      }));

    return runSummaries.map(summary => {
      const testRun = summary.testRun;
      return {
        headline: testRun.testRunId,
        subline: testRun.status,
        badges: [
          testRun.bookletKey,
          `${summary.responseCount} response(s)`,
          `${summary.reviewCount} review(s)`
        ],
        rows: [
          {
            label: "Current Unit",
            value: testRun.currentUnitKey ?? "none"
          },
          {
            label: "Unit Responses",
            value: String(summary.responseCount)
          },
          {
            label: "Reviews",
            value: String(summary.reviewCount)
          },
          {
            label: "Created",
            value: this.formatDateTime(testRun.createdAt)
          },
          {
            label: "Updated",
            value: this.formatDateTime(testRun.updatedAt)
          },
          {
            label: "Completed",
            value: testRun.completedAt
              ? this.formatDateTime(testRun.completedAt)
              : "not completed"
          }
        ],
        selected: this.runtime.testRunId.trim() === testRun.testRunId,
        actionLabel: "Select + Sync",
        actionPayload: {
          testRunId: testRun.testRunId,
          currentUnitKey: testRun.currentUnitKey ?? "",
          participantSessionId: detail.participantSession.participantSessionId,
          loginKey: detail.participantSession.loginKey,
          groupKey: detail.participantSession.groupKey,
          bookletKey: testRun.bookletKey
        }
      };
    });
  }

  get runtimeStateItems(): RecordCollectionItem[] {
    const payload = parseJsonDocument<ParticipantRuntimeStateResponse>(
      this.runtime.runtimeStateView
    );
    const detail = payload?.runtimeState;
    if (!detail) {
      return [];
    }

    return [
      {
        headline: detail.runtimeStatus,
        subline: detail.participantSession.loginKey,
        badges: [detail.availableAction],
        rows: [
          {
            label: "Session",
            value: detail.participantSession.participantSessionId
          },
          ...participantSessionLinkRows(
            detail.participantSession.participantSessionId,
            {
              tenantKey: this.uiState.workspace.tenantKey.trim(),
              workspaceKey: this.uiState.workspace.workspaceKey.trim(),
              loginKey: detail.participantSession.loginKey,
              groupKey: detail.participantSession.groupKey,
              bookletKey: detail.latestTestRun?.bookletKey
            }
          ),
          {
            label: "Latest Run",
            value: detail.latestTestRun?.testRunId ?? "none"
          },
          {
            label: "Latest Run Status",
            value: detail.latestTestRun?.status ?? "n/a"
          }
        ],
        selected:
          this.runtime.participantSessionId.trim() ===
          detail.participantSession.participantSessionId,
        actionLabel: "Select + Load",
        actionPayload: {
          participantSessionId: detail.participantSession.participantSessionId,
          loginKey: detail.participantSession.loginKey,
          groupKey: detail.participantSession.groupKey,
          bookletKey: detail.latestTestRun?.bookletKey ?? ""
        }
      }
    ];
  }

  get currentRunStateItems(): RecordCollectionItem[] {
    const payload = parseJsonDocument<ParticipantCurrentRunStateResponse>(
      this.runtime.currentRunStateView
    );
    const detail = payload?.currentRunState;
    if (!detail) {
      return [];
    }

    const currentUnitKey = detail.currentUnit.unitKey ?? "";
    const unitResponses = detail.testRun.unitResponses ?? {};

    return [
      {
        headline: detail.booklet.displayLabel,
        subline: detail.testRun.testRunId,
        badges: [detail.testRun.status, ...detail.availableActions],
        rows: [
          {
            label: "Session",
            value: detail.participantSession.participantSessionId
          },
          ...participantSessionLinkRows(
            detail.participantSession.participantSessionId,
            {
              tenantKey: this.uiState.workspace.tenantKey.trim(),
              workspaceKey: this.uiState.workspace.workspaceKey.trim(),
              loginKey: detail.participantSession.loginKey,
              groupKey: detail.participantSession.groupKey,
              bookletKey: detail.testRun.bookletKey
            }
          ),
          {
            label: "Current Unit",
            value: detail.currentUnit.displayLabel ?? detail.currentUnit.unitKey ?? "none"
          },
          {
            label: "Current Response",
            value: currentUnitKey
              ? this.formatResponsePreview(unitResponses[currentUnitKey] ?? "")
              : "none"
          },
          {
            label: "Responses",
            value: String(Object.keys(unitResponses).length)
          },
          {
            label: "Booklet Key",
            value: detail.booklet.bookletKey
          },
          {
            label: "Created",
            value: this.formatDateTime(detail.testRun.createdAt)
          }
        ],
        selected: this.runtime.testRunId.trim() === detail.testRun.testRunId,
        actionLabel: "Select + Sync",
        actionPayload: {
          participantSessionId: detail.participantSession.participantSessionId,
          loginKey: detail.participantSession.loginKey,
          groupKey: detail.participantSession.groupKey,
          bookletKey: detail.testRun.bookletKey,
          testRunId: detail.testRun.testRunId,
          currentUnitKey: detail.testRun.currentUnitKey ?? ""
        }
      }
    ];
  }

  get unitResponseItems(): RecordCollectionItem[] {
    const currentRunState = parseJsonDocument<ParticipantCurrentRunStateResponse>(
      this.runtime.currentRunStateView
    )?.currentRunState;
    if (currentRunState) {
      return this.createUnitResponseItems({
        testRunId: currentRunState.testRun.testRunId,
        status: currentRunState.testRun.status,
        currentUnitKey: currentRunState.testRun.currentUnitKey,
        unitResponses: currentRunState.testRun.unitResponses ?? {}
      });
    }

    const sessionDetail = parseJsonDocument<GetParticipantSessionResponse>(
      this.runtime.participantSessionDetailView
    )?.participantSessionDetail;
    const selectedRun =
      sessionDetail?.testRuns.find(
        testRun => testRun.testRunId === this.runtime.testRunId.trim()
      ) ?? sessionDetail?.testRuns[0];

    if (!selectedRun) {
      return [];
    }

    return this.createUnitResponseItems({
      testRunId: selectedRun.testRunId,
      status: selectedRun.status,
      currentUnitKey: selectedRun.currentUnitKey,
      unitResponses: selectedRun.unitResponses ?? {}
    });
  }

  get reviewReadinessItems(): RecordCollectionItem[] {
    const currentRunState = parseJsonDocument<ParticipantCurrentRunStateResponse>(
      this.runtime.currentRunStateView
    )?.currentRunState;
    const sessionDetail = parseJsonDocument<GetParticipantSessionResponse>(
      this.runtime.participantSessionDetailView
    )?.participantSessionDetail;
    const selectedRunId =
      this.runtime.testRunId.trim() || currentRunState?.testRun.testRunId || "";
    const selectedRun =
      currentRunState?.testRun.testRunId === selectedRunId
        ? currentRunState.testRun
        : sessionDetail?.testRuns.find(testRun => testRun.testRunId === selectedRunId) ??
          sessionDetail?.testRuns[0] ??
          currentRunState?.testRun;

    if (!selectedRun) {
      return [];
    }

    const reviewItems = parseJsonDocument<ListReviewsResponse>(
      this.runtime.reviewsView
    )?.items ?? [];
    const reviewsById = new Map(
      [
        ...(sessionDetail?.reviews ?? []),
        ...reviewItems.map(item => item.review)
      ]
        .filter(review => review.testRunId === selectedRun.testRunId)
        .map(review => [review.reviewId, review])
    );
    const reviews = [...reviewsById.values()];
    const runReviews = reviews.filter(review => review.unitKey === null);
    const bookletUnits =
      currentRunState?.testRun.testRunId === selectedRun.testRunId
        ? currentRunState.bookletUnits
        : [];
    const responseEntries = Object.entries(selectedRun.unitResponses ?? {});
    const unitKeys = [
      ...bookletUnits.map(unit => unit.unitKey),
      ...responseEntries.map(([unitKey]) => unitKey)
    ].filter((unitKey, index, all) => unitKey && all.indexOf(unitKey) === index);
    const answeredCount = unitKeys.filter(
      unitKey => (selectedRun.unitResponses?.[unitKey] ?? "").trim().length > 0
    ).length;
    const expectedCount = unitKeys.length;
    const missingCount = Math.max(expectedCount - answeredCount, 0);
    const unitReviewCount = reviews.filter(review => review.unitKey !== null).length;
    const participantLabel =
      sessionDetail?.participantRosterEntry?.displayName ??
      currentRunState?.participantSession.loginKey ??
      sessionDetail?.participantSession.loginKey ??
      (this.runtime.loginKey.trim() || "selected participant");
    const selectedParticipantSession =
      currentRunState?.testRun.testRunId === selectedRun.testRunId
        ? currentRunState.participantSession
        : sessionDetail?.participantSession ?? null;
    const latestReview = reviews
      .slice()
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0];

    const items: RecordCollectionItem[] = [
      {
        headline: "Review readiness",
        subline: `${participantLabel} · ${selectedRun.testRunId}`,
        badges: [
          selectedRun.status,
          `${answeredCount} / ${expectedCount} answered`,
          `${reviews.length} review(s)`
        ],
        rows: [
          { label: "Run", value: selectedRun.testRunId },
          { label: "Booklet", value: selectedRun.bookletKey },
          {
            label: "Missing Responses",
            value: missingCount === 0 ? "none" : String(missingCount)
          },
          { label: "Unit Reviews", value: String(unitReviewCount) },
          { label: "Whole Run Reviews", value: String(runReviews.length) },
          {
            label: "Latest Review",
            value: latestReview
              ? `${latestReview.category} by ${latestReview.reviewerId}`
              : "none"
          }
        ],
        selected: this.runtime.testRunId.trim() === selectedRun.testRunId,
        actionLabel: "Select Run",
        actionPayload: {
          testRunId: selectedRun.testRunId,
          currentUnitKey: selectedRun.currentUnitKey ?? "",
          participantSessionId: selectedRun.participantSessionId,
          loginKey: selectedParticipantSession?.loginKey ?? "",
          groupKey: selectedParticipantSession?.groupKey ?? "",
          bookletKey: selectedRun.bookletKey,
          displayName: sessionDetail?.participantRosterEntry?.displayName ?? ""
        }
      }
    ];

    items.push(
      ...unitKeys.map((unitKey, index) => {
        const unit = bookletUnits.find(entry => entry.unitKey === unitKey);
        const response = selectedRun.unitResponses?.[unitKey] ?? "";
        const unitReviews = reviews.filter(review => review.unitKey === unitKey);
        const latestUnitReview = unitReviews
          .slice()
          .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0];

        return {
          headline: unit?.displayLabel || unitKey,
          subline: `${index + 1} / ${unitKeys.length} · ${unitKey}`,
          badges: [
            response.trim() ? "answered" : "missing response",
            unitReviews.length > 0 ? "reviewed" : "needs review",
            `${response.length} char(s)`
          ],
          rows: [
            { label: "Response", value: this.formatResponsePreview(response) },
            { label: "Reviews", value: String(unitReviews.length) },
            {
              label: "Latest Review",
              value: latestUnitReview
                ? `${latestUnitReview.category}: ${this.formatResponsePreview(
                    latestUnitReview.comment
                  )}`
                : "none"
            },
            {
              label: "Updated",
              value: latestUnitReview
                ? this.formatDateTime(latestUnitReview.updatedAt)
                : this.formatDateTime(selectedRun.updatedAt)
            }
          ],
          selected:
            this.runtime.testRunId.trim() === selectedRun.testRunId &&
            this.runtime.currentUnitKey.trim() === unitKey,
          actionLabel: "Select Review Scope",
          actionPayload: {
            testRunId: selectedRun.testRunId,
            currentUnitKey: unitKey,
            participantSessionId: selectedRun.participantSessionId,
            loginKey: selectedParticipantSession?.loginKey ?? "",
            groupKey: selectedParticipantSession?.groupKey ?? "",
            bookletKey: selectedRun.bookletKey,
            reviewId: latestUnitReview?.reviewId ?? "",
            reviewerId: latestUnitReview?.reviewerId ?? "",
            reviewCategory: latestUnitReview?.category ?? "",
            reviewComment: latestUnitReview?.comment ?? ""
          }
        };
      })
    );

    if (runReviews.length > 0) {
      items.push(
        ...runReviews.map(review => ({
          headline: `Whole run · ${review.category}`,
          subline: review.reviewId,
          badges: [review.reviewerId, "whole run"],
          rows: [
            { label: "Comment", value: this.formatResponsePreview(review.comment) },
            { label: "Run", value: review.testRunId },
            { label: "Updated", value: this.formatDateTime(review.updatedAt) }
          ],
          selected: this.runtime.reviewId.trim() === review.reviewId,
          actionLabel: "Select Review",
          actionPayload: {
            reviewId: review.reviewId,
            testRunId: review.testRunId,
            currentUnitKey: "",
            participantSessionId: review.participantSessionId,
            loginKey: selectedParticipantSession?.loginKey ?? "",
            groupKey: selectedParticipantSession?.groupKey ?? "",
            bookletKey: selectedRun.bookletKey,
            reviewerId: review.reviewerId,
            reviewCategory: review.category,
            reviewComment: review.comment
          }
        }))
      );
    }

    return items;
  }

  get detailedResponseItems(): RecordCollectionItem[] {
    const payload = parseJsonDocument<ListDetailedResponsesResponse>(
      this.runtime.detailedResponsesView
    );
    if (!payload) {
      return [];
    }

    const activeFilters = [
      this.runtime.detailedResponseLoginFilter.trim() ? "login" : "",
      this.runtime.detailedResponseGroupFilter.trim() ? "group" : "",
      this.runtime.detailedResponseBookletFilter.trim() ? "booklet" : "",
      this.runtime.detailedResponseSessionFilter.trim() ? "session" : "",
      this.runtime.detailedResponseRunFilter.trim() ? "run" : "",
      this.runtime.detailedResponseUnitFilter.trim() ? "unit" : "",
      this.runtime.detailedResponseStatusFilter.trim() ? "status" : ""
    ].filter(Boolean);

    return [
      {
        headline: "Detailed response window",
        subline: `${payload.items.length} response row(s) loaded for the current filters`,
        badges: [
          `${activeFilters.length} active filter(s)`,
          `limit ${this.runtime.detailedResponseLimit}`
        ],
        rows: [
          { label: "Loaded Responses", value: String(payload.items.length) },
          { label: "Limit", value: this.runtime.detailedResponseLimit },
          {
            label: "Active Filters",
            value: activeFilters.length > 0 ? activeFilters.join(", ") : "none"
          }
        ]
      },
      ...payload.items.map(item => {
        const displayName = item.participantRosterEntry?.displayName;

        return {
          headline: `${displayName ?? item.loginKey} · ${item.unitKey}`,
          subline: displayName ? item.loginKey : item.testRunId,
          badges: [
            item.status,
            item.bookletKey,
            `${item.responseLength} char(s)`,
            item.participantRosterEntry ? "roster" : "ad hoc"
          ],
          rows: [
            { label: "Response", value: this.formatResponsePreview(item.response) },
            { label: "Login", value: item.loginKey },
            { label: "Group", value: item.groupKey || "unknown" },
            { label: "Session", value: item.participantSessionId },
            { label: "Updated", value: this.formatDateTime(item.updatedAt) }
          ],
          selected:
            this.runtime.testRunId.trim() === item.testRunId &&
            this.runtime.currentUnitKey.trim() === item.unitKey,
          actionLabel: "Select Response",
          actionPayload: {
            testRunId: item.testRunId,
            currentUnitKey: item.unitKey,
            participantSessionId: item.participantSessionId,
            loginKey: item.loginKey,
            groupKey: item.groupKey,
            bookletKey: item.bookletKey,
            displayName: displayName ?? ""
          }
        };
      })
    ];
  }

  get selectedSessionReviewItems(): RecordCollectionItem[] {
    const detail = parseJsonDocument<GetParticipantSessionResponse>(
      this.runtime.participantSessionDetailView
    )?.participantSessionDetail;
    if (!detail) {
      return [];
    }

    return detail.reviews.map(review => {
      const testRun = detail.testRuns.find(
        candidate => candidate.testRunId === review.testRunId
      );
      return {
        headline: `${review.category} · ${review.unitKey ?? "whole run"}`,
        subline: review.reviewId,
        badges: [review.reviewerId, review.testRunId],
        rows: [
          { label: "Comment", value: this.formatResponsePreview(review.comment) },
          {
            label: "Participant",
            value:
              detail.participantRosterEntry?.displayName ??
              detail.participantSession.loginKey
          },
          { label: "Login", value: detail.participantSession.loginKey },
          { label: "Run", value: review.testRunId },
          { label: "Updated", value: this.formatDateTime(review.updatedAt) }
        ],
        selected:
          this.runtime.testRunId.trim() === review.testRunId &&
          (review.unitKey === null ||
            this.runtime.currentUnitKey.trim() === review.unitKey),
        actionLabel: "Select Review",
        actionPayload: {
          reviewId: review.reviewId,
          testRunId: review.testRunId,
          currentUnitKey: review.unitKey ?? "",
          participantSessionId: review.participantSessionId,
          loginKey: detail.participantSession.loginKey,
          groupKey: detail.participantSession.groupKey,
          bookletKey: testRun?.bookletKey ?? "",
          reviewerId: review.reviewerId,
          reviewCategory: review.category,
          reviewComment: review.comment
        }
      };
    });
  }

  get reviewItems(): RecordCollectionItem[] {
    const payload = parseJsonDocument<ListReviewsResponse>(this.runtime.reviewsView);
    if (!payload) {
      return [];
    }

    const activeFilters = [
      this.runtime.reviewLoginFilter.trim() ? "login" : "",
      this.runtime.reviewGroupFilter.trim() ? "group" : "",
      this.runtime.reviewBookletFilter.trim() ? "booklet" : "",
      this.runtime.reviewSessionFilter.trim() ? "session" : "",
      this.runtime.reviewRunFilter.trim() ? "run" : "",
      this.runtime.reviewUnitFilter.trim() ? "unit" : "",
      this.runtime.reviewReviewerFilter.trim() ? "reviewer" : "",
      this.runtime.reviewCategoryFilter.trim() ? "category" : ""
    ].filter(Boolean);

    return [
      {
        headline: "Review window",
        subline: `${payload.items.length} review row(s) loaded for the current filters`,
        badges: [
          `${activeFilters.length} active filter(s)`,
          `limit ${this.runtime.reviewLimit}`
        ],
        rows: [
          { label: "Loaded Reviews", value: String(payload.items.length) },
          { label: "Limit", value: this.runtime.reviewLimit },
          {
            label: "Active Filters",
            value: activeFilters.length > 0 ? activeFilters.join(", ") : "none"
          }
        ]
      },
      ...payload.items.map(item => {
        const displayName = item.participantRosterEntry?.displayName;
        const loginKey = item.participantSession?.loginKey ?? "unknown";

        return {
          headline: `${item.review.category} · ${displayName ?? loginKey}`,
          subline: item.review.reviewId,
          badges: [
            item.review.reviewerId,
            item.testRun?.status ?? "missing run",
            item.review.unitKey ?? "whole run",
            item.participantRosterEntry ? "roster" : "ad hoc"
          ],
          rows: [
            { label: "Review Id", value: item.review.reviewId },
            {
              label: "Comment",
              value: this.formatResponsePreview(item.review.comment)
            },
            { label: "Login", value: loginKey },
            { label: "Run", value: item.review.testRunId },
            {
              label: "Session",
              value: item.review.participantSessionId
            },
            {
              label: "Updated",
              value: this.formatDateTime(item.review.updatedAt)
            }
          ],
          selected:
            this.runtime.testRunId.trim() === item.review.testRunId &&
            (item.review.unitKey === null ||
              this.runtime.currentUnitKey.trim() === item.review.unitKey),
          actionLabel: "Select Review",
          actionPayload: {
            reviewId: item.review.reviewId,
            testRunId: item.review.testRunId,
            currentUnitKey: item.review.unitKey ?? "",
            participantSessionId: item.review.participantSessionId,
            loginKey: item.participantSession?.loginKey ?? "",
            groupKey: item.participantSession?.groupKey ?? "",
            bookletKey: item.testRun?.bookletKey ?? "",
            reviewerId: item.review.reviewerId,
            reviewCategory: item.review.category,
            reviewComment: item.review.comment,
            displayName: displayName ?? ""
          }
        };
      })
    ];
  }

  get reviewActionItems(): RecordCollectionItem[] {
    const reviewId = this.runtime.reviewId.trim();
    const testRunId = this.runtime.testRunId.trim();
    const participantSessionId = this.runtime.participantSessionId.trim();
    const currentUnitKey = this.runtime.currentUnitKey.trim();
    const reviewerId = this.runtime.reviewerId.trim();
    const category = this.runtime.reviewCategory.trim();
    const comment = this.runtime.reviewComment.trim();
    const items: RecordCollectionItem[] = [];

    if (testRunId && participantSessionId) {
      items.push({
        headline: "Create review for selected run",
        subline: currentUnitKey || "whole run",
        badges: ["review", "create", reviewerId || "no reviewer"],
        rows: [
          { label: "Run", value: testRunId },
          { label: "Session", value: participantSessionId },
          { label: "Reviewer", value: reviewerId || "enter reviewer id" },
          { label: "Category", value: category || "enter category" },
          {
            label: "Comment",
            value: comment ? this.formatResponsePreview(comment) : "enter comment"
          }
        ],
        actionLabel: "Apply Suggestion",
        actionPayload: { reviewCommand: "createReview" }
      });
    }

    if (reviewId) {
      items.push({
        headline: "Update selected review",
        subline: reviewId,
        badges: ["review", "update", category || "no category"],
        rows: [
          { label: "Review", value: reviewId },
          { label: "Run", value: testRunId || "unknown run" },
          { label: "Reviewer", value: reviewerId || "unchanged reviewer" },
          {
            label: "Comment",
            value: comment ? this.formatResponsePreview(comment) : "unchanged comment"
          }
        ],
        actionLabel: "Apply Suggestion",
        actionPayload: { reviewCommand: "updateReview" }
      });
      items.push({
        headline: "Delete selected review",
        subline: reviewId,
        badges: ["review", "delete"],
        rows: [
          { label: "Review", value: reviewId },
          { label: "Run", value: testRunId || "unknown run" },
          {
            label: "Expected Result",
            value: "Remove the review and refresh review read models"
          }
        ],
        actionLabel: "Apply Suggestion",
        actionPayload: { reviewCommand: "deleteReview" }
      });
    }

    if (
      this.runtime.loginKey.trim() ||
      this.runtime.groupKey.trim() ||
      participantSessionId ||
      testRunId ||
      currentUnitKey ||
      reviewerId ||
      category
    ) {
      items.push({
        headline: "Load reviews for selected scope",
        subline: testRunId || participantSessionId || this.runtime.loginKey.trim(),
        badges: ["review", "filter"],
        rows: [
          { label: "Login", value: this.runtime.loginKey.trim() || "any" },
          { label: "Group", value: this.runtime.groupKey.trim() || "any" },
          { label: "Run", value: testRunId || "any" },
          { label: "Unit", value: currentUnitKey || "any" }
        ],
        actionLabel: "Apply Suggestion",
        actionPayload: { reviewCommand: "loadSelectedScope" }
      });
    }

    if (items.length === 0) {
      items.push({
        headline: "Select a runtime run before reviewing",
        subline: "No active review scope",
        badges: ["review", "needs run"],
        rows: [
          {
            label: "Expected Input",
            value: "Select a participant session and run, then add a review comment"
          },
          {
            label: "Shortcut",
            value: "Use Participant Sessions, Open Runs, or Detailed Responses"
          }
        ]
      });
    }

    return items;
  }

  get openRunItems(): RecordCollectionItem[] {
    const payload = parseJsonDocument<MonitorOpenRunsResponse>(this.runtime.openRunsView);
    return (
      payload?.items.map(openRun => {
        const displayName = openRun.participantRosterEntry?.displayName;

        return {
          headline: displayName ?? openRun.loginKey,
          subline: displayName ? openRun.loginKey : openRun.testRunId,
          badges: [
            openRun.status,
            openRun.groupKey,
            openRun.participantRosterEntry ? "roster" : "ad hoc"
          ],
          rows: [
            {
              label: "Session",
              value: openRun.participantSessionId
            },
            ...participantSessionLinkRows(openRun.participantSessionId, {
              tenantKey: this.uiState.workspace.tenantKey,
              workspaceKey: this.uiState.workspace.workspaceKey,
              loginKey: openRun.loginKey,
              groupKey: openRun.groupKey,
              bookletKey: openRun.bookletKey
            }),
            {
              label: "Run",
              value: openRun.testRunId
            },
            {
              label: "Booklet",
              value: openRun.bookletKey
            },
            {
              label: "Current Unit",
              value: openRun.currentUnitKey ?? "none"
            },
            {
              label: "Updated",
              value: this.formatDateTime(openRun.updatedAt)
            }
          ],
          selected: this.runtime.testRunId.trim() === openRun.testRunId,
          actionLabel: "Select + Sync",
          actionPayload: {
            testRunId: openRun.testRunId,
            participantSessionId: openRun.participantSessionId,
            currentUnitKey: openRun.currentUnitKey ?? "",
            loginKey: openRun.loginKey,
            groupKey: openRun.groupKey,
            bookletKey: openRun.bookletKey,
            displayName: displayName ?? ""
          }
        };
      }) ?? []
    );
  }

  get monitorCommandHistoryItems(): RecordCollectionItem[] {
    const payload = parseJsonDocument<ListWorkspaceActivityEventsResponse>(
      this.runtime.monitorCommandHistoryView
    );
    return (
      payload?.items.map(item => {
        const event = item.activityEvent;
        const details = event.details ?? {};
        const commandType = String(details.commandType ?? "command");
        const previousStatus = String(details.previousStatus ?? "unknown");
        const nextStatus = String(details.nextStatus ?? "unknown");
        const participantSessionId = String(details.participantSessionId ?? "");
        const loginKey = String(details.loginKey ?? "");
        const groupKey = String(details.groupKey ?? "");
        const bookletKey = String(details.bookletKey ?? "");
        const displayName = String(details.displayName ?? "");
        const commandId = String(details.commandId ?? event.activityEventId);

        return {
          headline: `${commandType} command`,
          subline: displayName ? `${displayName} · ${commandId}` : commandId,
          badges: [
            event.actorId ?? "system",
            `${previousStatus} -> ${nextStatus}`,
            event.subjectId
          ],
          rows: [
            { label: "Run", value: event.subjectId },
            { label: "Session", value: participantSessionId || "unknown" },
            { label: "Participant", value: displayName || loginKey || "unknown" },
            { label: "Login", value: loginKey || "unknown" },
            { label: "Group", value: groupKey || "unknown" },
            { label: "Booklet", value: bookletKey || "unknown" },
            { label: "Actor", value: event.actorId ?? "system" },
            { label: "Occurred", value: this.formatDateTime(event.occurredAt) },
            { label: "Summary", value: event.summary }
          ],
          selected: this.runtime.testRunId.trim() === event.subjectId,
          actionLabel: "Select Run",
          actionPayload: {
            testRunId: event.subjectId,
            participantSessionId,
            loginKey,
            groupKey,
            bookletKey,
            displayName
          }
        };
      }) ?? []
    );
  }

  get runtimeCards(): SummaryCard[] {
    const runtimeState = parseJsonDocument(this.runtime.runtimeStateView);
    const currentRunState = parseJsonDocument(this.runtime.currentRunStateView);
    const openRunsState = parseJsonDocument(this.runtime.openRunsView);

    const runtimeStatus =
      readStringValue(runtimeState, ["runtimeState", "runtimeStatus"]) ?? "unknown";
    const availableAction =
      readStringValue(runtimeState, ["runtimeState", "availableAction"]) ?? "n/a";
    const runStatus =
      readStringValue(currentRunState, ["currentRunState", "testRun", "status"]) ?? "idle";
    const unitLabel =
      readStringValue(currentRunState, ["currentRunState", "currentUnit", "displayLabel"]) ??
      readStringValue(currentRunState, ["currentRunState", "currentUnit", "unitKey"]) ??
      "not set";
    const openRuns = readUnknownValue(openRunsState, ["items"]);
    const openRunCount = Array.isArray(openRuns) ? openRuns.length : 0;
    const participantLabel =
      this.runtime.participantDisplayName.trim() ||
      readStringValue(runtimeState, [
        "runtimeState",
        "participantRosterEntry",
        "displayName"
      ]) ||
      readStringValue(currentRunState, [
        "currentRunState",
        "participantRosterEntry",
        "displayName"
      ]) ||
      this.runtime.loginKey.trim() ||
      "no participant selected";

    return [
      {
        label: "Session",
        headline: runtimeStatus,
        detail: `${participantLabel} · ${
          this.runtime.participantSessionId.trim() || "no session selected"
        }`
      },
      {
        label: "Run",
        headline: runStatus,
        detail: this.runtime.testRunId.trim() || "no run selected"
      },
      {
        label: "Current Unit",
        headline: unitLabel,
        detail: `Next action: ${availableAction}`
      },
      {
        label: "Open Runs",
        headline: String(openRunCount),
        detail: openRunCount > 0 ? "Activation guard is active." : "No active blocker."
      }
    ];
  }

  get playerPreview(): RuntimePlayerPreview {
    const currentRunState = parseJsonDocument<ParticipantCurrentRunStateResponse>(
      this.runtime.currentRunStateView
    )?.currentRunState;

    if (!currentRunState) {
      return {
        hasRun: false,
        bookletLabel: "No active booklet",
        unitLabel: "No unit loaded",
        unitKey: "n/a",
        unitResponse: "",
        runStatus: "idle",
        runId: this.runtime.testRunId.trim() || "no run selected",
        availableActions: [],
        hint: "Sign in and resume a participant session to load the first unit.",
        canSaveProgress: false,
        canResume: false,
        canComplete: false,
        saveProgressLabel: "Save Progress"
      };
    }

    const unitLabel =
      currentRunState.currentUnit.displayLabel ??
      currentRunState.currentUnit.unitKey ??
      "Untitled unit";
    const unitKey = currentRunState.currentUnit.unitKey ?? "n/a";
    const canSaveProgress =
      currentRunState.availableActions.includes("save_progress");
    const canResume = currentRunState.availableActions.includes("resume");
    const canComplete = currentRunState.availableActions.includes("complete");
    const unitResponse = currentRunState.testRun.unitResponses?.[unitKey] ?? "";

    return {
      hasRun: true,
      bookletLabel: currentRunState.booklet.displayLabel,
      unitLabel,
      unitKey,
      unitResponse,
      runStatus: currentRunState.testRun.status,
      runId: currentRunState.testRun.testRunId,
      availableActions: currentRunState.availableActions,
      hint:
        currentRunState.testRun.status === "completed"
          ? "This run is complete; monitor reads should no longer list it as an open blocker."
          : "This preview is sourced from the same current-state endpoint a participant shell can use.",
      canSaveProgress,
      canResume,
      canComplete,
      saveProgressLabel:
        currentRunState.testRun.status === "paused"
          ? "Save Running"
          : "Save Paused"
    };
  }

  get runtimeActionItems(): RecordCollectionItem[] {
    const runtimeState = parseJsonDocument<ParticipantRuntimeStateResponse>(
      this.runtime.runtimeStateView
    )?.runtimeState;
    const currentRunState = parseJsonDocument<ParticipantCurrentRunStateResponse>(
      this.runtime.currentRunStateView
    )?.currentRunState;
    const openRuns = parseJsonDocument<MonitorOpenRunsResponse>(
      this.runtime.openRunsView
    )?.items ?? [];
    const items: RecordCollectionItem[] = [];
    const preparedLoginKey = this.runtime.loginKey.trim();
    const preparedGroupKey = this.runtime.groupKey.trim();
    const preparedBookletKey = this.runtime.bookletKey.trim();

    if (
      preparedLoginKey &&
      !this.runtime.participantSessionId.trim() &&
      !runtimeState &&
      !currentRunState
    ) {
      items.push({
        headline: "Start prepared participant",
        subline: preparedLoginKey,
        badges: [
          preparedGroupKey || "default group",
          preparedBookletKey || "default booklet"
        ],
        rows: [
          {
            label: "Login",
            value: preparedLoginKey
          },
          {
            label: "Group",
            value: preparedGroupKey || `group:${preparedLoginKey}`
          },
          {
            label: "Booklet",
            value: preparedBookletKey || "active release default"
          },
          {
            label: "Expected Result",
            value: "Create a participant session and start the first run"
          }
        ],
        actionLabel: "Apply Suggestion",
        actionPayload: { runtimeCommand: "participantLaunch" }
      });
    }

    if (runtimeState && runtimeState.availableAction !== "none") {
      const headline =
        runtimeState.availableAction === "launch"
          ? "Start first run for this session"
          : "Resume the participant session";
      items.push({
        headline,
        subline: runtimeState.participantSession.loginKey,
        badges: [runtimeState.runtimeStatus, runtimeState.availableAction],
        rows: [
          {
            label: "Session",
            value: runtimeState.participantSession.participantSessionId
          },
          {
            label: "Latest Run",
            value: runtimeState.latestTestRun?.testRunId ?? "none yet"
          },
          {
            label: "Expected Result",
            value:
              runtimeState.availableAction === "launch"
                ? "Create a running test run"
                : "Return the latest run to running"
          }
        ],
        actionLabel: "Apply Suggestion",
        actionPayload: { runtimeCommand: "resumeSession" }
      });
    }

    if (currentRunState) {
      const currentUnitLabel =
        currentRunState.currentUnit.displayLabel ??
        currentRunState.currentUnit.unitKey ??
        "none";
      if (currentRunState.availableActions.includes("resume")) {
        items.push({
          headline: "Resume paused run",
          subline: currentRunState.testRun.testRunId,
          badges: [currentRunState.testRun.status, "resume"],
          rows: [
            {
              label: "Current Unit",
              value: currentUnitLabel
            },
            {
              label: "Booklet",
              value: currentRunState.booklet.displayLabel
            },
            {
              label: "Expected Result",
              value: "Run status becomes running"
            }
          ],
          actionLabel: "Apply Suggestion",
          actionPayload: { runtimeCommand: "resumeRun" }
        });
      }

      if (currentRunState.testRun.status === "paused") {
        items.push({
          headline: "Monitor resume selected run",
          subline: currentRunState.testRun.testRunId,
          badges: [currentRunState.testRun.status, "monitor", "resume"],
          rows: [
            {
              label: "Current Unit",
              value: currentUnitLabel
            },
            {
              label: "Booklet",
              value: currentRunState.booklet.displayLabel
            },
            {
              label: "Expected Result",
              value: "Operator command records activity and returns the run to running"
            }
          ],
          actionLabel: "Apply Suggestion",
          actionPayload: { runtimeCommand: "monitorResume" }
        });
      }

      if (currentRunState.availableActions.includes("save_progress")) {
        const isPaused = currentRunState.testRun.status === "paused";
        items.push({
          headline: isPaused ? "Save current unit as running" : "Pause at current unit",
          subline: currentRunState.currentUnit.unitKey ?? currentUnitLabel,
          badges: [currentRunState.testRun.status, "save_progress"],
          rows: [
            {
              label: "Run",
              value: currentRunState.testRun.testRunId
            },
            {
              label: "Current Unit",
              value: currentUnitLabel
            },
            {
              label: "Expected Result",
              value: isPaused ? "Run status becomes running" : "Run status becomes paused"
            }
          ],
          actionLabel: "Apply Suggestion",
          actionPayload: {
            runtimeCommand: isPaused ? "saveRunning" : "savePaused"
          }
        });
      }

      if (currentRunState.testRun.status === "running") {
        items.push({
          headline: "Monitor pause selected run",
          subline: currentRunState.testRun.testRunId,
          badges: [currentRunState.testRun.status, "monitor", "pause"],
          rows: [
            {
              label: "Current Unit",
              value: currentUnitLabel
            },
            {
              label: "Booklet",
              value: currentRunState.booklet.displayLabel
            },
            {
              label: "Expected Result",
              value: "Operator command records activity and moves the run to paused"
            }
          ],
          actionLabel: "Apply Suggestion",
          actionPayload: { runtimeCommand: "monitorPause" }
        });
      }

      if (currentRunState.availableActions.includes("complete")) {
        items.push({
          headline: "Complete current run",
          subline: currentRunState.testRun.testRunId,
          badges: [currentRunState.testRun.status, "complete"],
          rows: [
            {
              label: "Session",
              value: currentRunState.participantSession.participantSessionId
            },
            {
              label: "Current Unit",
              value: currentUnitLabel
            },
            {
              label: "Expected Result",
              value: "Close the participant session and clear activation blockers"
            }
          ],
          actionLabel: "Apply Suggestion",
          actionPayload: { runtimeCommand: "completeRun" }
        });
      }

      if (["paused", "running"].includes(currentRunState.testRun.status)) {
        items.push({
          headline: "Monitor complete selected run",
          subline: currentRunState.testRun.testRunId,
          badges: [currentRunState.testRun.status, "monitor", "complete"],
          rows: [
            {
              label: "Session",
              value: currentRunState.participantSession.participantSessionId
            },
            {
              label: "Current Unit",
              value: currentUnitLabel
            },
            {
              label: "Expected Result",
              value: "Operator command closes the session and clears the monitor blocker"
            }
          ],
          actionLabel: "Apply Suggestion",
          actionPayload: { runtimeCommand: "monitorComplete" }
        });
      }
    }

    if (openRuns.length > 0) {
      items.push({
        headline: "Review activation blockers",
        subline: `${openRuns.length} open run${openRuns.length === 1 ? "" : "s"}`,
        badges: ["monitor", "activation guard"],
        rows: [
          {
            label: "Newest Run",
            value: openRuns[0]?.testRunId ?? "unknown"
          },
          {
            label: "Session",
            value: openRuns[0]?.participantSessionId ?? "unknown"
          },
          {
            label: "Participant",
            value:
              openRuns[0]?.participantRosterEntry?.displayName ??
              openRuns[0]?.loginKey ??
              "unknown"
          },
          {
            label: "Expected Result",
            value: "Refresh monitor and current runtime context"
          }
        ],
        actionLabel: "Apply Suggestion",
        actionPayload: { runtimeCommand: "refreshRuntimeReads" }
      });
    }

    if (items.length === 0) {
      items.push({
        headline: "Refresh runtime context",
        subline: this.runtime.participantSessionId.trim() || "no session selected",
        badges: ["read model"],
        rows: [
          {
            label: "Session",
            value: this.runtime.participantSessionId.trim() || "select or sign in first"
          },
          {
            label: "Run",
            value: this.runtime.testRunId.trim() || "none selected"
          },
          {
            label: "Expected Result",
            value: "Reload session, current run, and monitor state"
          }
        ],
        actionLabel: "Apply Suggestion",
        actionPayload: { runtimeCommand: "refreshRuntimeReads" }
      });
    }

    return items;
  }

  init(): void {
    this.viewState.setActiveView("runtime");
  }

  persistState(): void {
    this.viewState.persistShellState();
  }

  get canUseParticipantLoginActions(): boolean {
    return this.canUseWorkspaceScope && this.runtime.loginKey.trim().length > 0;
  }

  get canUseWorkspaceScope(): boolean {
    return (
      this.uiState.workspace.tenantKey.trim().length > 0 &&
      this.uiState.workspace.workspaceKey.trim().length > 0
    );
  }

  get canUseParticipantSessionActions(): boolean {
    return (
      this.canUseWorkspaceScope &&
      this.runtime.participantSessionId.trim().length > 0
    );
  }

  get canUseRunActions(): boolean {
    return this.canUseWorkspaceScope && this.runtime.testRunId.trim().length > 0;
  }

  get canSaveProgressActions(): boolean {
    return this.canUseRunActions && this.runtime.currentUnitKey.trim().length > 0;
  }

  get canSetMonitorTestletTime(): boolean {
    const remainingSeconds = Number(this.runtime.monitorTimeSeconds);
    return (
      this.canSaveProgressActions &&
      Number.isInteger(remainingSeconds) &&
      remainingSeconds >= 1 &&
      remainingSeconds <= 86_400
    );
  }

  get canCreateReviewAction(): boolean {
    return (
      this.canUseRunActions &&
      this.runtime.reviewComment.trim().length > 0 &&
      this.runtime.reviewerId.trim().length > 0
    );
  }

  get canUseSelectedReviewActions(): boolean {
    return this.canUseWorkspaceScope && this.runtime.reviewId.trim().length > 0;
  }

  get canDeleteGroupResultsAction(): boolean {
    return this.canUseWorkspaceScope && this.runtime.groupKey.trim().length > 0;
  }

  get canImportParticipantRoster(): boolean {
    return this.canUseWorkspaceScope && this.parseEntryRosterRowsPreview().length > 0;
  }

  get canGenerateEntryLinks(): boolean {
    return this.canUseWorkspaceScope && this.parseEntryRosterRowsPreview().length > 0;
  }

  get canGenerateSavedRosterEntryLinks(): boolean {
    return this.canUseWorkspaceScope && this.parseParticipantRosterView().length > 0;
  }

  get canDownloadEntryLinksCsv(): boolean {
    return (
      this.canUseWorkspaceScope &&
      (this.parseEntryLinksView().length > 0 ||
        this.parseEntryRosterRowsPreview().length > 0)
    );
  }

  participantSignIn(): void {
    if (!this.canUseParticipantLoginActions) {
      return;
    }
    this.viewState.onActionAsync(() => this.runtimeService.participantSignIn());
  }

  participantLaunch(): void {
    if (!this.canUseParticipantLoginActions) {
      return;
    }
    this.viewState.onActionAsync(() => this.runtimeService.participantLaunch());
  }

  resumeSession(): void {
    if (!this.canUseParticipantSessionActions) {
      return;
    }
    this.viewState.onActionAsync(() => this.runtimeService.resumeParticipantSession());
  }

  refreshRuntimeReads(): void {
    if (!this.canUseWorkspaceScope) {
      return;
    }
    this.viewState.onActionAsync(() => this.runtimeService.refreshRuntimeReads());
  }

  refreshParticipantSessions(): void {
    this.persistState();
    if (!this.canUseWorkspaceScope) {
      return;
    }
    this.viewState.onActionAsync(() =>
      this.runtimeService.loadParticipantSessions()
    );
  }

  clearParticipantSessionFilters(): void {
    this.runtime.participantSessionStatusFilter = "";
    this.runtime.participantSessionGroupFilter = "";
    this.runtime.participantSessionLoginFilter = "";
    this.runtime.participantSessionBookletFilter = "";
    this.runtime.participantSessionReleaseFilter = "";
    this.runtime.participantSessionLimit = "100";
    this.refreshParticipantSessions();
  }

  applyDetailedResponseFilters(): void {
    this.persistState();
    this.loadDetailedResponses();
  }

  useSelectedRuntimeAsDetailedResponseFilters(): void {
    this.runtime.detailedResponseLoginFilter = this.runtime.loginKey.trim();
    this.runtime.detailedResponseGroupFilter = this.runtime.groupKey.trim();
    this.runtime.detailedResponseBookletFilter = this.runtime.bookletKey.trim();
    this.runtime.detailedResponseSessionFilter =
      this.runtime.participantSessionId.trim();
    this.runtime.detailedResponseRunFilter = this.runtime.testRunId.trim();
    this.runtime.detailedResponseUnitFilter = this.runtime.currentUnitKey.trim();
    this.applyDetailedResponseFilters();
  }

  clearDetailedResponseFilters(): void {
    this.runtime.detailedResponseLoginFilter = "";
    this.runtime.detailedResponseGroupFilter = "";
    this.runtime.detailedResponseBookletFilter = "";
    this.runtime.detailedResponseSessionFilter = "";
    this.runtime.detailedResponseRunFilter = "";
    this.runtime.detailedResponseUnitFilter = "";
    this.runtime.detailedResponseStatusFilter = "";
    this.runtime.detailedResponseLimit = "100";
    this.applyDetailedResponseFilters();
  }

  applyReviewFilters(): void {
    this.persistState();
    this.loadReviews();
  }

  useSelectedRuntimeAsReviewFilters(): void {
    this.runtime.reviewLoginFilter = this.runtime.loginKey.trim();
    this.runtime.reviewGroupFilter = this.runtime.groupKey.trim();
    this.runtime.reviewBookletFilter = this.runtime.bookletKey.trim();
    this.runtime.reviewSessionFilter = this.runtime.participantSessionId.trim();
    this.runtime.reviewRunFilter = this.runtime.testRunId.trim();
    this.runtime.reviewUnitFilter = this.runtime.currentUnitKey.trim();
    this.runtime.reviewReviewerFilter = this.runtime.reviewerId.trim();
    this.runtime.reviewCategoryFilter = this.runtime.reviewCategory.trim();
    this.applyReviewFilters();
  }

  clearReviewFilters(): void {
    this.runtime.reviewLoginFilter = "";
    this.runtime.reviewGroupFilter = "";
    this.runtime.reviewBookletFilter = "";
    this.runtime.reviewSessionFilter = "";
    this.runtime.reviewRunFilter = "";
    this.runtime.reviewUnitFilter = "";
    this.runtime.reviewReviewerFilter = "";
    this.runtime.reviewCategoryFilter = "";
    this.runtime.reviewLimit = "100";
    this.applyReviewFilters();
  }

  applyOpenRunFilters(): void {
    this.persistState();
    this.refreshRuntimeReads();
  }

  useSelectedRuntimeAsOpenRunFilters(): void {
    this.runtime.openRunLoginFilter = this.runtime.loginKey.trim();
    this.runtime.openRunGroupFilter = this.runtime.groupKey.trim();
    this.runtime.openRunBookletFilter = this.runtime.bookletKey.trim();
    this.runtime.openRunSessionFilter = this.runtime.participantSessionId.trim();
    this.runtime.openRunRunFilter = this.runtime.testRunId.trim();
    this.runtime.openRunUnitFilter = this.runtime.currentUnitKey.trim();
    this.applyOpenRunFilters();
  }

  clearOpenRunFilters(): void {
    this.runtime.openRunLoginFilter = "";
    this.runtime.openRunGroupFilter = "";
    this.runtime.openRunBookletFilter = "";
    this.runtime.openRunSessionFilter = "";
    this.runtime.openRunRunFilter = "";
    this.runtime.openRunUnitFilter = "";
    this.runtime.openRunStatusFilter = "";
    this.runtime.openRunLimit = "100";
    this.applyOpenRunFilters();
  }

  applyMonitorCommandHistoryFilters(): void {
    this.persistState();
    this.refreshRuntimeReads();
  }

  useSelectedRuntimeAsMonitorCommandHistoryFilter(): void {
    this.runtime.monitorCommandHistoryRunFilter = this.runtime.testRunId.trim();
    this.applyMonitorCommandHistoryFilters();
  }

  clearMonitorCommandHistoryFilters(): void {
    this.runtime.monitorCommandHistoryRunFilter = "";
    this.runtime.monitorCommandHistoryLimit = "25";
    this.applyMonitorCommandHistoryFilters();
  }

  generateEntryLinks(): void {
    if (!this.canGenerateEntryLinks) {
      return;
    }
    const links = this.parseEntryRosterRows();
    this.runtime.entryLinksView = JSON.stringify({ links }, null, 2);
    this.persistState();
  }

  importParticipantRoster(): void {
    this.persistState();
    if (!this.canImportParticipantRoster) {
      return;
    }
    this.viewState.onActionAsync(async () => {
      await this.runtimeService.importParticipantRoster();
      this.generateEntryLinksFromSavedRoster();
    });
  }

  loadParticipantRoster(): void {
    if (!this.canUseWorkspaceScope) {
      return;
    }
    this.viewState.onActionAsync(() => this.runtimeService.loadParticipantRoster());
  }

  exportParticipantRosterCsv(): void {
    if (!this.canUseWorkspaceScope) {
      return;
    }
    this.viewState.onActionAsync(() =>
      this.runtimeService.exportParticipantRosterCsv()
    );
  }

  async loadEntryRosterFile(event: Event): Promise<void> {
    const input = event.target;
    if (!(input instanceof HTMLInputElement)) {
      return;
    }

    const file = input.files?.[0] ?? null;
    if (!file) {
      return;
    }

    const rosterText = await file.text();
    this.runtime.entryRosterText = rosterText;
    this.persistState();
    this.uiState.renderVersion.update(version => version + 1);
    this.applicationRef.tick();
    this.feedback.rememberActivity(
      "Participant Roster Loaded",
      `${file.name} loaded as CSV/TSV/XML/JSON roster text with ${rosterText.length} character(s).`
    );
  }

  generateEntryLinksFromSavedRoster(): void {
    if (!this.canGenerateSavedRosterEntryLinks) {
      return;
    }
    const links = this.parseParticipantRosterView().map(entry => ({
      loginKey: entry.loginKey,
      groupKey: entry.groupKey,
      bookletKey: entry.bookletKey ?? "",
      displayName: entry.displayName ?? "",
      url: this.buildParticipantEntryUrl(
        this.uiState.workspace.tenantKey.trim(),
        this.uiState.workspace.workspaceKey.trim(),
        {
          loginKey: entry.loginKey,
          groupKey: entry.groupKey,
          bookletKey: entry.bookletKey ?? ""
        }
      )
    }));
    this.runtime.entryLinksView = JSON.stringify({ links }, null, 2);
    this.persistState();
  }

  downloadEntryLinksCsv(): void {
    if (!this.canDownloadEntryLinksCsv) {
      return;
    }
    let links = this.parseEntryLinksView();
    if (links.length === 0) {
      links = this.parseEntryRosterRows();
      this.runtime.entryLinksView = JSON.stringify({ links }, null, 2);
      this.persistState();
    }

    const workspaceKey = this.uiState.workspace.workspaceKey.trim() || "workspace";
    downloadTextFile({
      filename: `${workspaceKey}-participant-entry-links.csv`,
      mediaType: "text/csv;charset=utf-8",
      text: this.createEntryLinksCsv(links)
    });
  }

  useSelectedParticipantAsEntryRoster(): void {
    if (!this.canUseWorkspaceScope) {
      return;
    }
    const loginKey = this.runtime.loginKey.trim() || "student-demo";
    const groupKey = this.runtime.groupKey.trim() || `group:${loginKey}`;
    const bookletKey = this.runtime.bookletKey.trim();
    this.runtime.entryRosterText = [loginKey, groupKey, bookletKey]
      .filter(Boolean)
      .join(",");
    this.generateEntryLinks();
  }

  saveProgressPaused(): void {
    if (!this.canSaveProgressActions) {
      return;
    }
    this.viewState.onActionAsync(() => this.runtimeService.saveProgress("paused"));
  }

  saveProgressRunning(): void {
    if (!this.canSaveProgressActions) {
      return;
    }
    this.viewState.onActionAsync(() => this.runtimeService.saveProgress("running"));
  }

  saveProgressFromPreview(): void {
    if (this.playerPreview.runStatus === "paused") {
      this.saveProgressRunning();
      return;
    }
    this.saveProgressPaused();
  }

  resumeRun(): void {
    if (!this.canUseRunActions) {
      return;
    }
    this.viewState.onActionAsync(() => this.runtimeService.resumeRun());
  }

  completeRun(): void {
    if (!this.canUseRunActions) {
      return;
    }
    this.viewState.onActionAsync(() => this.runtimeService.completeRun());
  }

  issueMonitorPause(): void {
    if (!this.canUseRunActions) {
      return;
    }
    this.viewState.onActionAsync(() =>
      this.runtimeService.issueMonitorRunCommand("pause")
    );
  }

  issueMonitorResume(): void {
    if (!this.canUseRunActions) {
      return;
    }
    this.viewState.onActionAsync(() =>
      this.runtimeService.issueMonitorRunCommand("resume")
    );
  }

  issueMonitorComplete(): void {
    if (!this.canUseRunActions) {
      return;
    }
    this.viewState.onActionAsync(() =>
      this.runtimeService.issueMonitorRunCommand("complete")
    );
  }

  issueMonitorGoto(): void {
    if (!this.canSaveProgressActions) {
      return;
    }
    this.viewState.onActionAsync(() =>
      this.runtimeService.issueMonitorRunCommand("goto")
    );
  }

  issueMonitorUnlockNavigation(): void {
    if (!this.canUseRunActions) {
      return;
    }
    this.viewState.onActionAsync(() =>
      this.runtimeService.issueMonitorRunCommand("unlock_navigation")
    );
  }

  issueMonitorSetTestletTime(): void {
    if (!this.canSetMonitorTestletTime) {
      return;
    }
    this.viewState.onActionAsync(() =>
      this.runtimeService.issueMonitorRunCommand("set_testlet_time")
    );
  }

  openRuns(): void {
    if (!this.canUseWorkspaceScope) {
      return;
    }
    this.viewState.onActionAsync(() => this.runtimeService.refreshRuntimeReads());
  }

  exportOpenRunsCsv(): void {
    if (!this.canUseWorkspaceScope) {
      return;
    }
    this.viewState.onActionAsync(() => this.runtimeService.exportOpenRunsCsv());
  }

  runRuntimeSuggestion(item: RecordCollectionItem): void {
    switch (item.actionPayload?.runtimeCommand) {
      case "participantLaunch":
        this.participantLaunch();
        break;
      case "resumeSession":
        this.resumeSession();
        break;
      case "resumeRun":
        this.resumeRun();
        break;
      case "savePaused":
        this.saveProgressPaused();
        break;
      case "saveRunning":
        this.saveProgressRunning();
        break;
      case "completeRun":
        this.completeRun();
        break;
      case "monitorPause":
        this.issueMonitorPause();
        break;
      case "monitorResume":
        this.issueMonitorResume();
        break;
      case "monitorComplete":
        this.issueMonitorComplete();
        break;
      case "refreshRuntimeReads":
      default:
        this.refreshRuntimeReads();
        break;
    }
  }

  runReviewSuggestion(item: RecordCollectionItem): void {
    switch (item.actionPayload?.reviewCommand) {
      case "createReview":
        this.createReview();
        break;
      case "updateReview":
        this.updateReview();
        break;
      case "deleteReview":
        this.confirmDeleteReview();
        break;
      case "loadSelectedScope":
        this.useSelectedRuntimeAsReviewFilters();
        break;
      default:
        this.loadReviews();
        break;
    }
  }

  runParticipantLaunchpadSuggestion(item: RecordCollectionItem): void {
    switch (item.actionPayload?.launchpadCommand) {
      case "importRosterInput":
        this.importParticipantRoster();
        break;
      case "loadRoster":
        this.loadParticipantRoster();
        break;
      case "generateSavedRosterLinks":
        this.generateEntryLinksFromSavedRoster();
        break;
      case "downloadEntryLinks":
        this.downloadEntryLinksCsv();
        break;
      case "refreshSessions":
      default:
        this.refreshParticipantSessions();
        break;
    }
  }

  participantHappyPathFlow(): void {
    if (!this.canUseParticipantLoginActions) {
      return;
    }
    this.viewState.onActionAsync(() => this.runtimeService.participantHappyPathFlow());
  }

  getParticipantSessionDetail(): void {
    if (!this.canUseParticipantSessionActions) {
      return;
    }
    this.viewState.onActionAsync(() => this.runtimeService.loadParticipantSessionDetail());
  }

  exportParticipantSessionsCsv(): void {
    if (!this.canUseWorkspaceScope) {
      return;
    }
    this.viewState.onActionAsync(() =>
      this.runtimeService.exportParticipantSessionsCsv()
    );
  }

  exportResponsesCsv(): void {
    if (!this.canUseWorkspaceScope) {
      return;
    }
    this.viewState.onActionAsync(() => this.runtimeService.exportResponsesCsv());
  }

  loadDetailedResponses(): void {
    if (!this.canUseWorkspaceScope) {
      return;
    }
    this.viewState.onActionAsync(() => this.runtimeService.loadDetailedResponses());
  }

  loadReviews(): void {
    if (!this.canUseWorkspaceScope) {
      return;
    }
    this.viewState.onActionAsync(() => this.runtimeService.loadReviews());
  }

  createReview(): void {
    if (!this.canCreateReviewAction) {
      return;
    }
    this.viewState.onActionAsync(() => this.runtimeService.createReview());
  }

  updateReview(): void {
    if (!this.canUseSelectedReviewActions) {
      return;
    }
    this.viewState.onActionAsync(() => this.runtimeService.updateReview());
  }

  confirmDeleteReview(): void {
    const reviewId = this.runtime.reviewId.trim();
    if (!reviewId) {
      this.deleteReview();
      return;
    }
    const confirmed = globalThis.window?.confirm(
      `Delete review '${reviewId}' from this workspace?`
    );
    if (confirmed) {
      this.deleteReview();
    }
  }

  private deleteReview(): void {
    if (!this.canUseSelectedReviewActions) {
      return;
    }
    this.viewState.onActionAsync(() => this.runtimeService.deleteReview());
  }

  exportReviewsCsv(): void {
    if (!this.canUseWorkspaceScope) {
      return;
    }
    this.viewState.onActionAsync(() => this.runtimeService.exportReviewsCsv());
  }

  confirmDeleteGroupResults(): void {
    const groupKey = this.runtime.groupKey.trim();
    if (!groupKey) {
      return;
    }
    const confirmedGroupKey = globalThis.window?.prompt(
      `Type '${groupKey}' to delete all collected test runs for this group.`
    );
    if (confirmedGroupKey === groupKey) {
      this.deleteGroupResults();
    }
  }

  private deleteGroupResults(): void {
    if (!this.canDeleteGroupResultsAction) {
      return;
    }
    this.viewState.onActionAsync(() => this.runtimeService.deleteGroupResults());
  }

  selectEntryLink(item: RecordCollectionItem): void {
    if (item.actionPayload?.loginKey) {
      this.runtime.loginKey = item.actionPayload.loginKey;
    }
    if (item.actionPayload?.groupKey) {
      this.runtime.groupKey = item.actionPayload.groupKey;
    }
    this.runtime.bookletKey = item.actionPayload?.bookletKey ?? "";
    this.syncParticipantDisplayName(item);
    this.persistState();

    const url = item.actionPayload?.url?.trim();
    if (url) {
      globalThis.window?.open(url, "_blank", "noopener,noreferrer");
    }
  }

  selectParticipantLaunchStatus(item: RecordCollectionItem): void {
    const participantSessionId = item.actionPayload?.participantSessionId?.trim();
    if (participantSessionId) {
      this.selectParticipantSession(item);
      return;
    }

    this.selectEntryLink(item);
  }

  selectParticipantSession(item: RecordCollectionItem): void {
    const participantSessionId = item.actionPayload?.participantSessionId?.trim();
    if (!participantSessionId) {
      return;
    }

    this.runtime.participantSessionId = participantSessionId;
    if (item.actionPayload?.loginKey) {
      this.runtime.loginKey = item.actionPayload.loginKey;
    }
    if (item.actionPayload?.groupKey) {
      this.runtime.groupKey = item.actionPayload.groupKey;
    }
    if (item.actionPayload?.bookletKey != null) {
      this.runtime.bookletKey = item.actionPayload.bookletKey;
    }
    this.syncParticipantDisplayName(item);
    this.persistState();
    this.viewState.onActionAsync(async () => {
      await this.runtimeService.loadParticipantSessionDetail();
      await this.runtimeService.refreshRuntimeReads(true);
    });
  }

  private seedSelectedRunInspectionFilters(item: RecordCollectionItem): void {
    const loginKey = this.runtime.loginKey.trim();
    const groupKey = this.runtime.groupKey.trim();
    const bookletKey = this.runtime.bookletKey.trim();
    const participantSessionId = this.runtime.participantSessionId.trim();
    const testRunId = this.runtime.testRunId.trim();
    const currentUnitKey = this.runtime.currentUnitKey.trim();

    this.runtime.detailedResponseLoginFilter = loginKey;
    this.runtime.detailedResponseGroupFilter = groupKey;
    this.runtime.detailedResponseBookletFilter = bookletKey;
    this.runtime.detailedResponseSessionFilter = participantSessionId;
    this.runtime.detailedResponseRunFilter = testRunId;
    this.runtime.detailedResponseUnitFilter = currentUnitKey;
    this.runtime.detailedResponseStatusFilter = "";
    this.runtime.reviewLoginFilter = loginKey;
    this.runtime.reviewGroupFilter = groupKey;
    this.runtime.reviewBookletFilter = bookletKey;
    this.runtime.reviewSessionFilter = participantSessionId;
    this.runtime.reviewRunFilter = testRunId;
    this.runtime.reviewUnitFilter = currentUnitKey;
    this.runtime.reviewReviewerFilter =
      item.actionPayload?.reviewerId?.trim() ?? "";
    this.runtime.reviewCategoryFilter =
      item.actionPayload?.reviewCategory?.trim() ?? "";
    this.runtime.openRunLoginFilter = loginKey;
    this.runtime.openRunGroupFilter = groupKey;
    this.runtime.openRunBookletFilter = bookletKey;
    this.runtime.openRunSessionFilter = participantSessionId;
    this.runtime.openRunRunFilter = testRunId;
    this.runtime.openRunUnitFilter = currentUnitKey;
    this.runtime.openRunStatusFilter = "";
  }

  selectTestRun(item: RecordCollectionItem): void {
    const testRunId = item.actionPayload?.testRunId?.trim();
    if (!testRunId) {
      return;
    }

    this.runtime.testRunId = testRunId;
    if (item.actionPayload?.currentUnitKey != null) {
      this.runtime.currentUnitKey = item.actionPayload.currentUnitKey;
    }
    if (item.actionPayload?.loginKey) {
      this.runtime.loginKey = item.actionPayload.loginKey;
    }
    if (item.actionPayload?.groupKey) {
      this.runtime.groupKey = item.actionPayload.groupKey;
    }
    if (item.actionPayload?.bookletKey != null) {
      this.runtime.bookletKey = item.actionPayload.bookletKey;
    }
    if (item.actionPayload?.participantSessionId) {
      this.runtime.participantSessionId = item.actionPayload.participantSessionId;
    }
    this.syncParticipantDisplayName(item);
    if (!this.runtime.participantSessionId.trim() && this.runtime.loginKey.trim()) {
      const derivedParticipantSessionId = this.findParticipantSessionIdByLoginKey(
        this.runtime.loginKey.trim()
      );
      if (derivedParticipantSessionId) {
        this.runtime.participantSessionId = derivedParticipantSessionId;
      }
    }
    this.seedSelectedRunInspectionFilters(item);
    this.persistState();
    if (!this.runtime.participantSessionId.trim()) {
      return;
    }

    this.viewState.onActionAsync(async () => {
      await this.runtimeService.loadParticipantSessionDetail();
      await this.runtimeService.refreshRuntimeReads(true);
    });
  }

  selectReview(item: RecordCollectionItem): void {
    if (item.actionPayload?.reviewId) {
      this.runtime.reviewId = item.actionPayload.reviewId;
    }
    if (item.actionPayload?.reviewerId) {
      this.runtime.reviewerId = item.actionPayload.reviewerId;
    }
    if (item.actionPayload?.reviewCategory) {
      this.runtime.reviewCategory = item.actionPayload.reviewCategory;
    }
    if (item.actionPayload?.reviewComment) {
      this.runtime.reviewComment = item.actionPayload.reviewComment;
    }
    this.selectTestRun(item);
  }

  selectReviewReadinessItem(item: RecordCollectionItem): void {
    const testRunId = item.actionPayload?.testRunId?.trim();
    if (!testRunId) {
      return;
    }

    const currentUnitKey = item.actionPayload?.currentUnitKey ?? "";
    const participantSessionId =
      item.actionPayload?.participantSessionId?.trim() ||
      this.runtime.participantSessionId.trim();

    if (item.actionPayload?.reviewId) {
      this.runtime.reviewId = item.actionPayload.reviewId;
    }
    if (item.actionPayload?.reviewerId) {
      this.runtime.reviewerId = item.actionPayload.reviewerId;
    }
    if (item.actionPayload?.reviewCategory) {
      this.runtime.reviewCategory = item.actionPayload.reviewCategory;
    }
    if (item.actionPayload?.reviewComment) {
      this.runtime.reviewComment = item.actionPayload.reviewComment;
    }

    this.runtime.testRunId = testRunId;
    this.runtime.currentUnitKey = currentUnitKey;
    if (participantSessionId) {
      this.runtime.participantSessionId = participantSessionId;
    }
    if (item.actionPayload?.loginKey) {
      this.runtime.loginKey = item.actionPayload.loginKey;
    }
    if (item.actionPayload?.groupKey) {
      this.runtime.groupKey = item.actionPayload.groupKey;
    }
    if (item.actionPayload?.bookletKey != null) {
      this.runtime.bookletKey = item.actionPayload.bookletKey;
    }
    this.syncParticipantDisplayName(item);
    this.runtime.detailedResponseLoginFilter = this.runtime.loginKey.trim();
    this.runtime.detailedResponseGroupFilter = this.runtime.groupKey.trim();
    this.runtime.detailedResponseBookletFilter = this.runtime.bookletKey.trim();
    this.runtime.detailedResponseSessionFilter = participantSessionId;
    this.runtime.detailedResponseRunFilter = testRunId;
    this.runtime.detailedResponseUnitFilter = currentUnitKey;
    this.runtime.reviewLoginFilter = this.runtime.loginKey.trim();
    this.runtime.reviewGroupFilter = this.runtime.groupKey.trim();
    this.runtime.reviewBookletFilter = this.runtime.bookletKey.trim();
    this.runtime.reviewSessionFilter = participantSessionId;
    this.runtime.reviewRunFilter = testRunId;
    this.runtime.reviewUnitFilter = currentUnitKey;
    this.runtime.openRunLoginFilter = this.runtime.loginKey.trim();
    this.runtime.openRunGroupFilter = this.runtime.groupKey.trim();
    this.runtime.openRunBookletFilter = this.runtime.bookletKey.trim();
    this.runtime.openRunSessionFilter = participantSessionId;
    this.runtime.openRunRunFilter = testRunId;
    this.runtime.openRunUnitFilter = currentUnitKey;
    this.runtime.reviewReviewerFilter = this.runtime.reviewerId.trim();
    this.runtime.reviewCategoryFilter = this.runtime.reviewCategory.trim();
    this.persistState();

    this.viewState.onActionAsync(async () => {
      if (this.runtime.participantSessionId.trim()) {
        await this.runtimeService.loadParticipantSessionDetail();
        await this.runtimeService.refreshRuntimeReads(true);
      }
      await this.runtimeService.loadDetailedResponses();
      await this.runtimeService.loadReviews();
    });
  }

  private findParticipantSessionIdByLoginKey(loginKey: string): string | null {
    const payload = parseJsonDocument<ListParticipantSessionsResponse>(
      this.runtime.participantSessionsView
    );
    const matchingItem = payload?.items.find(
      item => item.participantSession.loginKey === loginKey
    );
    return matchingItem?.participantSession.participantSessionId ?? null;
  }

  private syncParticipantDisplayName(item: RecordCollectionItem): void {
    if (item.actionPayload?.displayName != null) {
      this.runtime.participantDisplayName = item.actionPayload.displayName;
    }
  }

  private parseEntryRosterRows(): RuntimeEntryLink[] {
    const tenantKey = this.uiState.workspace.tenantKey.trim();
    const workspaceKey = this.uiState.workspace.workspaceKey.trim();
    return this.parseEntryRosterRowsPreview().map(link => {
      const entryLink = {
        loginKey: link.loginKey,
        groupKey: link.groupKey,
        bookletKey: link.bookletKey ?? "",
        displayName: link.displayName ?? ""
      };
      return {
        ...entryLink,
        url: this.buildParticipantEntryUrl(tenantKey, workspaceKey, entryLink)
      };
    });
  }

  private parseEntryRosterRowsPreview(): ParsedParticipantRosterEntry[] {
    try {
      return parseParticipantRosterText(this.runtime.entryRosterText);
    } catch {
      return [];
    }
  }

  private parseEntryLinksView(): RuntimeEntryLink[] {
    const payload = parseJsonDocument<{ links: RuntimeEntryLink[] }>(
      this.runtime.entryLinksView
    );
    return Array.isArray(payload?.links) ? payload.links : [];
  }

  private parseParticipantRosterView(): ListParticipantRosterResponse["items"] {
    const payload = parseJsonDocument<ListParticipantRosterResponse>(
      this.runtime.participantRosterView
    );
    return Array.isArray(payload?.items) ? payload.items : [];
  }

  private parseParticipantSessionListView(): ListParticipantSessionsResponse["items"] {
    const payload = parseJsonDocument<ListParticipantSessionsResponse>(
      this.runtime.participantSessionsView
    );
    return Array.isArray(payload?.items) ? payload.items : [];
  }

  private buildParticipantEntryUrl(
    tenantKey: string,
    workspaceKey: string,
    link: Omit<RuntimeEntryLink, "url">
  ): string {
    return buildParticipantEntryUrl({
      tenantKey,
      workspaceKey: workspaceKey || "demo-workspace",
      loginKey: link.loginKey,
      groupKey: link.groupKey,
      bookletKey: link.bookletKey
    });
  }

  private createEntryLinksCsv(links: RuntimeEntryLink[]): string {
    const rows = [
      ["loginKey", "groupKey", "bookletKey", "url", "displayName"],
      ...links.map(link => [
        link.loginKey,
        link.groupKey,
        link.bookletKey,
        link.url,
        link.displayName ?? ""
      ])
    ];
    return rows.map(row => row.map(value => this.escapeCsvValue(value)).join(",")).join("\n");
  }

  private escapeCsvValue(value: string): string {
    return `"${value.replace(/"/g, "\"\"")}"`;
  }

  private createUnitResponseItems(input: {
    testRunId: string;
    status: string;
    currentUnitKey: string | null;
    unitResponses: Record<string, string>;
  }): RecordCollectionItem[] {
    return Object.entries(input.unitResponses)
      .sort(([leftUnitKey], [rightUnitKey]) => leftUnitKey.localeCompare(rightUnitKey))
      .map(([unitKey, response]) => ({
        headline: unitKey,
        subline: input.testRunId,
        badges: [input.status, `${response.length} char(s)`],
        rows: [
          {
            label: "Response",
            value: this.formatResponsePreview(response)
          },
          {
            label: "Length",
            value: String(response.length)
          }
        ],
        selected:
          this.runtime.testRunId.trim() === input.testRunId &&
          this.runtime.currentUnitKey.trim() === unitKey,
        actionLabel: "Select Unit",
        actionPayload: {
          testRunId: input.testRunId,
          currentUnitKey: unitKey
        }
      }));
  }

  private formatResponsePreview(value: string): string {
    const normalized = value.trim();
    if (!normalized) {
      return "empty";
    }
    return normalized.length > 96 ? `${normalized.slice(0, 93)}...` : normalized;
  }

  private formatDateTime(value: string): string {
    try {
      return new Date(value).toLocaleString();
    } catch {
      return value;
    }
  }
}
