# Systemcheck errors before the routed wizard loads

The public installation-mode request now waits for its document-owned error
presenter, independently of the lazy Systemcheck wizard. Previously a connection
failure could trigger another module request after the browser was already
offline, leaving the initial document empty. Routed shells can also satisfy code
readiness with their existing presenter; the registry retains only code, with no
actor data or view-owned closure. View retirement cannot cancel the shared read.
Document destruction prevents a late read or presentation.

Public application settings load at bootstrap, and the error component supplies
its Original overlay styles itself. Its theme and layout therefore remain
available while the wizard module is held. The existing initial bundle limit
stays 470 kB; this build is 439.09 kB. Administrative refresh generations, history
retirement, duplicate-error protection, actor boundaries and URL redaction remain
in force.

## Evidence and mandatory regression

The pinned functional oracle in
`test-fixtures/original-testcenter/source-workspace-results/native-syscheck-early-offline/`
runs the actual unchanged Source backend and cached frontend, with strict XML
validation, real administrator uploads, no API mocks and no SQL seeds. It holds
the actual Source SysCheck module, cuts the real mode connection, then verifies
an offline global error and fresh login recovery. Chrome 156.0.8078.80 and
Chromium 147.0.7727.15 cover all three themes at 1280/390 by 850 pixels. All 277 Source
input hashes are verified before and after the twelve contexts. Owned workspaces,
containers and volumes are retired afterwards.

Source additionally shows three program-error dialogs when its uncached icon
resources fail. Both strict Source repaint attempts retain 30 differing pixels
against the required zero-pixel self-control. Those failed image pairs and the
strict capture script are preserved explicitly. This fixture is a functional
oracle, not an admitted pixel golden; it proves no new visual parity.

The existing mandatory Systemcheck suite retains its 80 cases and adds 18 early
cases. It holds the current build's actual wizard chunk, waits for the genuine
public mode request and settings, switches the browser offline, then requires a
dialog without another JavaScript request or a visible wizard. Early theme/layout
must match the loaded-shell dialog. Anonymous details, Escape retention, zero
browser credentials/reports and a new root-login document remain required.
The existing 60 second phase, 240 second standalone and 480 second aggregate deadlines
are unchanged. No CI job, browser admission or pixel threshold is relaxed.

## Remaining scope

Early Source header/resource-failure behavior, authenticated error identity and
test-mode, remaining description/stack semantics, private/admin navigation and
the complete 49 functional/eight broad visual requirements remain open. Neither
this fix nor the retained exact public-header/selection comparisons completes the
full Original-parity goal.
