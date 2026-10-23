# Optional Original UI

### Qualified Original result lifecycle (2026-10-23)

[Source run 40004889342](https://github.com/jurei733/testcenter-rewrite/actions/runs/40004889342)
passes all **27** real HTTP groups against unchanged pinned Original
`eedae41840cbe90e5547c0211da818bdf620f5aa`, with production Apache,
PostgreSQL/Redis, actual XSD uploads and administrator/person authentication.
Test mode stays disabled; no SQL seeding, fabricated token or production patch
is used. Source diff verification passes and owned containers/volumes retire.
The independently downloaded artifact `12524041027` verifies ZIP SHA256
`6af6c76d91850874958aebc430b7484922085dfbb05d2803befd69ea955ed002`.
The public receipt, runtime metadata and exact source-file hashes are retained in
[test-fixtures/original-testcenter/source-workspace-results/manifest.json](../test-fixtures/original-testcenter/source-workspace-results/manifest.json).

The native Results and Tests pages must preserve these distinct rules:

- No-code sign-in already returns the person token and Booklet assignments.
- Creating a Test without opening its Booklet produces no result row. Opening
  it produces a started Booklet with zero Units, even while Test state is `{}`.
- The detailed Test deletion list excludes empty `{}` Test state. A stateful
  but unopened Test can be listed there while still absent from Results.
- A Unit definition read does not initialize a saved Unit. Raw Unit logs before
  initialization fail with Source's actual 500 and leave zero saved Units.
  Initializing Unit state then logging counts one Unit even without answers.
- Two opened Booklets with one and two saved Units produce minimum 1, maximum 2,
  total 3 and average 1.5. Count persisted Units, rather than answers or arbitrary
  Unit-scoped log events.
- RO selected-Test deletion returns 403 and preserves results and the detailed
  listing. RW deletion removes only the selected Test; the other Booklet's exact
  answer remains. The existing person token and Booklet assignment survive, so
  launching the selected Booklet again creates a new empty Test.
- Access to the deleted Test ID returns 403 from `IsTestOwner` before the
  controller's 404 path. This is actual middleware behavior, not an auth bypass.

The extended fixture also proves a Unit review initializes a saved Unit without
answers or nonempty Test state. Deleting that review retains the saved Unit,
its response report and group counts. Actual response reports include both state-only
and review-only Units with `responses: []`; a review-only Unit has null laststate.
Four real selected CSV/JSON pairs are retained before the final review deletion
control: responses, logs, legacy reviews and enhanced reviews. All CSVs preserve the UTF-8 BOM and semicolon dialect;
an unknown group yields zero bytes. Legacy reviews use `category: NAME` with
`X`/null and omit reviewer/labels. Enhanced reviews use boolean `category_NAME`,
retain reviewer and resolve actual Unit/Booklet labels. Review text preserves
Unicode, embedded newline, quote and semicolon. These are authored fixture data,
not private participant records. Source review times use the configured Europe/
Berlin display time; the current Rewrite UTC conversion needs native alignment.

The Rewrite archive correction now projects current review Units and exact
scoped server review journal entries alongside captured Unit response keys.
Thus a comment-only Unit remains exported after the comment is deleted and the
store is reopened. A captured Verona state without `dataParts` produces an empty
response array, while an intentional empty legacy answer remains an `all` entry.
Comment-only rows retain null `laststate`. Arbitrary Unit logs do not create
report rows. Only matching tenant/workspace/Run/session review evidence qualifies;
Booklet-level comments, unknown events and foreign/mismatched identities do not.
Reading the archive leaves the exact stored Run and answers untouched.

The archive requests only the three review event types at the store boundary;
SQL filters them before decoding event details. File storage retains its existing
whole-snapshot read. Omitted event kinds
retain existing complete scoped reads; an explicit empty list reads no events.
These corrections improve the existing canonical ZIP, **not the missing native
Results table or its four individual downloads**. Native Unit state key/time
projection and initialization without any response or review evidence remain
separate work. Source review display times and current-file label semantics also
still need their native projection.

These are Source requirements, **not qualified Rewrite parity**. The Rewrite's
canonical group summary currently counts all Runs and Unit response keys;
reusing it unchanged would contradict this Oracle. Native opened-Test and saved
Unit projection, exact test-time semantics, all four selected CSV actions and
selected-Test deletion still require implementation/qualification. All eight
broad visual rows remain open. This Source27 audit reopens the previously done
Result group administration and Original result report archive rows: the current
formal ledger is **27 done / 22 partial**. Older counts below are historical
checkpoints, superseded by this audit.

### Native report page and remaining workspace tabs (2026-10-23)

Files and Systemcheck Reports are now implemented native pages. Material tab
pagination remains interactive on narrow viewports. The report table retains
Source's five columns, selection, labels, CSV filename and confirmation copy.
Adapted Source is pinned to `eedae41840cbe90e5547c0211da818bdf620f5aa`:

| Source file | SHA256 |
| --- | --- |
| `workspace-admin/syscheck/syscheck.component.html` | `9e433930f0184e8e5ed3af2f9c33f78e3db4d3bfa6983235c58f7e590a72c628` |
| `workspace-admin/syscheck/syscheck.component.ts` | `85848e7b7f3700f95161969a9c90cf9b0197abd7821c3fe64ab85b5ad2d8e3ff` |
| `workspace-admin/syscheck/syscheck.component.css` | `2841c135b291d89d7c46d5d56a5506bb5c8077d03cb069bd3ee3e37e2ce0c87f` |
| `backend/src/files/SysCheckReportFile.class.php` | `1dc05fadecedd8ee23e75cab3249fbd7b72f4a3a44d532044a0bff00e822e5d3` |

Frontend paths are under `frontend/src/app/`. Source files are unchanged; the
existing IQB MIT notice covers the adapted native templates and exact SVG glyph.
`getDigest()` concatenates exact German environment labels with one literal
space, including absent values. Rewrite exposes these version-aware arrays
alongside its established canonical name-only statistics. No private report
body/key is needed for the overview.

The real headed SQLite journey passes Primar/Sekundar/Erwachsene at 1280 and
390 px: 505 actual saves, 504 selected CSV reports with exact protected API bytes,
versioned counts, selection reset/reload, cancel confirmation, RO export/refusal,
held-download logout, real three-report deletion, empty workspace, and a blocked
deferred module followed by explicit recovery. Screenshots are unaltered native
diagnostics, not a paired Source baseline. The existing six RW and six RO file
journeys, native uploads/downloads/deletion and file-bundle recovery still pass.

Two more Original pages are missing: **Ergebnisse/Antworten** and **Tests
löschen**. No unimplemented tabs are exposed. The full four-tab geometry,
responsive header/table pixels, submitted/error/pending states, and native
Source permission projection remain open. The earlier RO-disabled report button
was a temporary fidelity gap: Source enables it for any selection. The correction
now offers the same confirmation and lets the unchanged protected API reject RO
with 403. The actual browser verifies all 505 stored reports and workspace audit
records are unchanged, and both selected Checks remain available for export.
This does not establish identical Source error rendering or paired pixels. All
eight broad visual rows remain open.

### Actual Original workspace backend Oracle (2026-10-23)

[Run 39988533872](https://github.com/jurei733/testcenter-rewrite/actions/runs/39988533872)
builds the unmodified pinned Original `eedae41840cbe90e5547c0211da818bdf620f5aa`
with its own production Dockerfile, initializes an owned PostgreSQL/Redis/data
volume and exercises the real Apache HTTP entrypoint. Test mode is disabled;
real administrator sign-in, workspace grants and self-service password changes
establish the accounts. No Source production file or permission middleware is
patched. Docker resources are retired at the end.

All nine bounded groups pass: actual readiness/version, explicit workspace
membership even for Superadmins, real RO/RW access and foreign-scope rejection,
XSD-validated multipart Syscheck upload, complete multi-Check CSV/JSON export,
version-aware statistics, rejected RO deletion, exact selected RW deletion and
revocation against an existing signed-in token. The Source exports all **505**
reports when unfiltered and **504** when two Checks are selected, confirming the
truncation/selection correction in the Rewrite. CSV keeps its BOM and omits the
unselected Check's column. Source filesystem enumeration order is observed;
this is not a cross-system byte/order-equivalence proof.

The independently downloaded public receipt artifact `12516367594` has ZIP
SHA256 `924d20ce71f00413be8eb1a29ed4ae5d0b7d44e4555dc00c2102fe492d6cf497`.
It records Source version 19.0.0 and image
`sha256:a8cc9c5a6a2c151fc188bc5e9e50d23cca524928ab46b8c1ecdd4faf6ab60bce`.
The PHP 8.3.36/extension inventory is informational CLI metadata from that image;
the behavior above is tested over Apache HTTP. Receipts contain no raw tokens,
passwords, report payloads or private save-key bytes.

This establishes a bounded executable Source baseline, not full backend
permission equivalence. Source requires an explicit workspace grant even for a
Superadmin and uses 404 for an unassigned workspace. The Rewrite's canonical
platform administrator still has inherited workspace access; a native Source
permission projection requires its own implementation/qualification. Source
statistics concatenate OS/browser names with their versions; the current Rewrite
statistics need that native projection. Source raw JSON also retains a submitted
save-key field; the Rewrite's private-key boundary remains intact. These observed
differences and full four-tab/report/results/Test-Session deletion pages remain
open. No broad visual or backend row closes.

### Current workspace files and stable participant tests (2026-10-23)

Native uploads now make ready Booklets and Syschecks available without an
operator activation. One durable workspace origin anchors Source sessions;
private runtime views resolve current Booklet, Unit, Player and resource files.
Leaf edits do not create replacement tests, sessions, releases or import jobs.
Saved answers, field timestamps, assignments and testlet clocks survive edits;
later Booklets join the same workspace and completed tests retain their identities
after sign-in. Canonical sessions continue to use their immutable snapshots,
including when a later native edit restores the existing Source origin.

The first publication commits its archive, job, release statuses and matching
audit together in all four stores. Captured file and active-release revisions
reject intervening edits or manual reactivation. Tests cover competing writers,
foreign identities, late clone/audit/manifest failures and durable reopen.
The private compilation cache is scoped to a service/schema context, bounded
to 16 workspaces and 64 MiB, and does not retain temporary archive bytes.
Runtime dependency resolution remains enabled above the public file view's
1,000-file size-calculation threshold. Participant resource access accepts
current Resource files only; roster XML and unrelated canonical JSON remain
unavailable. Syscheck choices contain metadata only and report validation uses
the current private save key. Upload reports distinguish saved files from failed
or conflicting runtime availability without displaying raw compiler details.

Qualification uses the actual Original-19 XSD validator in Memory, File, SQLite
and owned PostgreSQL. The production native-file browser matrix additionally
signs participants in through real HTTP, verifies missing-token rejection and
roster-resource rejection, then overwrites a UTF-16 Unit while retaining the run
and exact saved answer. All existing themes, widths, read-only, held-logout
download and lazy recovery checks remain. Production entry remains 468.39 kB
under the unchanged 470 kB budget.

This supersedes the automatic-availability gap below. Full four-tab workspace,
ZIP materialization/order/progress, complete reports/revalidation, physical file
deletion, large-workspace archive limits and Source/Rewrite file pixels remain
open. The monitor still represents an unstarted roster entry's primary Booklet;
complete pre-start counts for additional assigned Booklets need qualification.
Formal status remains **29 done / 20 partial; all eight broad visual rows open**.

### Native workspace file view (2026-10-22)

The published parent `d4e592cf` completes all **86 Linux jobs** in
[run 39790219381](https://github.com/jurei733/testcenter-rewrite/actions/runs/39790219381).
That complete CI acceptance establishes its bounded gates, not full Original
parity and not Linux qualification of the native view introduced next.


Authenticated Original content now mounts a separate lazy Material file view.
It replaces the generic intake/editor controls and hides the Rewrite hero,
diagnostic cards, live-context sidebar and footer while mounted. Its own Source
header shows the verified workspace name and RW/RO scope, protected account menu,
confirmed logout and logo return. Leaving the view restores the other layout.
Grouped tables retain Source labels, native checkboxes, sorting, authored
basenames, dates, full sizes, reverse dependency highlighting and hover cards.
The additional Package group represents existing canonical containers; Source
ZIP member materialization remains open.

Native file selection calls the protected loose-file upload API and retains an
itemized result before refreshing the actual catalog. It preserves raw/data-URL
bytes, renders diagnostics as text and never executes uploaded HTML. Independent
files need no fabricated runtime job. The first actual five-type strict browser
journey exposes a status gap: successful dependency-snapshot imports leave their
original Booklet/SysCheck/Testtakers records `uploaded`, although the generated
snapshot is accepted. All prevalidated physical Source files now reserve as
`accepted` atomically, with snapshot/runtime outcomes remaining separate.
Canonical package creation/review keeps its existing semantics.

A new controller captures the exact login, workspace and selected IDs/filenames
for each action. Old reads, held file reads, stale confirmation callbacks and
completed downloads cannot affect a replacement login/workspace. A refreshed read-only
grant prevents the next upload and terminates remaining queue indicators.
Logout/destruction clears rows, grouped caches, selection and upload results.
Catalog reads now provide safe XML validation diagnostics independently of a
canonical runtime-import status, without parser/XSD excerpts or XML contents.
The native UI also shows unresolved references and unsupported Player API majors.
This is not Source's complete validation-report wording/revalidation contract.

Fourteen actual-controller cases pass. Fourteen owned production-browser cases
cover all three themes at 1280/390 px with RW and RO sessions, all five loose
file types under real Original-19 XSD validation, actual runtime/roster imports,
UTF-16 and empty downloads, same-basename type folders, overwrite, cancellation
and partial guarded deletion. A real held download returns 401 after logout and
produces no file. An aborted actual lazy-component request exposes the explicit
failure view; a user Reload recovers without writes or generic editor leakage.
Four separate strict-XSD journeys retain Rewrite's canonical controls and now
exercise Original's native chooser, including missing-schema rejection without
writes. Production and all **3,719 unit/frontend cases** pass, with zero skips;
protected API cases also pass in owned PostgreSQL and stop the cluster afterwards.

The first build exceeds the unchanged 470 kB initial limit (480.67 kB). Bundle
inspection identifies Angular's shared date-formatting code; native Intl date
parts and view-local Source glyphs remove that startup cost. The final production
entry is **468.39 kB**, including the new root-layout condition, against the
parent's 468.16 kB. The budget is unchanged. A separate disposable diagnostic
build used a temporary limit only to inspect its bundle graph; it is not a
qualified production build and the configuration is restored byte-for-byte.

The new `ui-original-workspace-files` workflow row is mandatory and independently
selectable through `ci:focus`; all historical rows/commands remain required.
This native file view has not yet passed a Source/Rewrite pixel comparison.
The complete four-tab workspace shell and the other three native pages, batch
upload/order/progress parity, complete reports/revalidation, ZIP members,
automatic activation and physical deletion remain open. No broad visual row
closes: **29 done / 20 partial; all eight broad visual rows open**.

### Protected first upload and same-name overwrite (2026-10-22)

`POST /api/v1/tenants/:tenantKey/workspaces/:workspaceKey/files` now accepts
`{fileName, mediaType, sourceDocument}` for an actual loose file. A basename is
required; paths/control characters and names over Source's 120 UTF-8-byte bound
are rejected. Authored whitespace and zero-byte/encoded resources are preserved.
XML uses the decoded root and actual schema/encoding validation, rather than
trusting a MIME hint or accepting a client-supplied runtime structure. The stored
`Unit/`, `Booklet/`, `SysCheck/`, `Testtakers/` and `Resource/` type folders allow
a Unit and Booklet to share a basename as in Source. Same-type/same-name uploads
invoke the protected identity/version replacement, bound to the source revision
captured during lookup. Typed IDs retain PHP-style ASCII normalization.

Missing/ambiguous dependencies and duplicate typed IDs reject before a first
write. The actual file and `source_package_created` activity reserve together
against the complete workspace source revision in Memory, File, SQLite and
PostgreSQL. This uses a dedicated repository operation; the existing assembly
operation still rejects a creation event. A changed-revision control leaves
only the concurrent file and no orphan activity/job/release. Eight parallel
HTTP uploads with one Unit identity produce exactly one accepted creation and
one matching audit event in each store. Independent Unit/resource uploads do
not fabricate jobs; Booklet, SysCheck and Testtakers follow the existing real
importer. Booklet snapshots contain the actual uploaded Player/Unit data;
Testtakers import actual roster assignments. Releases remain staged and need
the existing explicit activation step.

`GET .../files/:sourcePackageId/download` checks the same workspace permissions
and returns exact current or historical bytes using the authored basename,
including whitespace and UTF-8 filename parameters. Protected API cases cover
all stores, UTF-16/BOM and zero-byte content, hostile payloads, RO/no-auth/monitor
and foreign-scope denial, same-basename type folders, stale writes, duplicate
IDs, same-name overwrite, immutable old downloads and subsequent runtime
hydration. The four strict Original-19 XSD browser journeys additionally reject
missing-schema first uploads without writes and accept/overwrite/download exact
UTF-16 SysCheck bytes. The complete local unit/frontend sequence passes **121 + 322 + 1,270 + 1,992 =
3,705** cases with no skips/cancellations, as do the production build and all
186 portable policy controls (two real-Linux controls remain explicit macOS
skips). These are local checks, pending the next full Linux run.

This closes another backend gap, not the full Original upload UX. ZIP member
materialization, complete Source validation reports, revalidation/automatic
activation, physical deletion and the real four-tab renderer remain open.
Formal status remains **29 done / 20 partial; all eight broad visual rows open**.

### Protected workspace-file replacement (2026-10-22)

`POST /api/v1/tenants/:tenantKey/workspaces/:workspaceKey/files/:sourcePackageId/replacements`
is a dedicated byte-carrying replacement entry point. It retains the existing
filename server-side and rejects filename/content-structure overrides. Source's
overwrite constraints are derived from the unchanged pinned `Workspace`,
`ResourceFile`, `FileData` and `Version` implementations: typed identity and
ASCII-normalized file ID remain, Verona module ID is case-sensitive, patch
upgrades/downgrades remain valid within the same identity, and zero/missing
module versions use Source's legacy filename guess, including `V4` names.
Encoded bytes and XML validate before reservation; missing/ambiguous Unit
dependencies reject without changing files, lineage, jobs or releases.

A deterministic application probe exposes an early race: another write can
change the existing source after its first read but before the population
snapshot. The old preflight can then compare stale identity while reserving
against the newer revision. Its before-snapshot control fails before the fix.
The protected path now compares that captured source revision before planning;
the existing store CAS still rejects a later edit immediately before reservation.
Both controls require the concurrent bytes to remain and no replacement,
lineage, import or release to be added.

Another real probe demonstrates that a valid standalone Player replacement
previously becomes `rejected` with `source_document_runtime_structure_invalid`:
canonical import expects a Booklet release. Valid independent Unit and ordinary
resource replacements now reserve the accepted file and lineage together,
without fabricating an import job/release. Their typed response has a nullable
`importJob`. The next real Booklet compilation initially fails in all three
local stores because old and new Unit revisions appear ambiguous. Source-file
dependency resolution and live-reference reads now choose current non-rejected
revisions rather than treating immutable history as competing live files.
Canonical console imports retain valid failed loose drafts for guided candidate
review; a real regression found in `e77c4fe5` is corrected and exercised by the
unchanged complete local proof-of-work browser row.
The subsequent snapshot must contain the exact new Player HTML and Unit bytes;
existing releases and historical downloads remain immutable.

Protected HTTP cases pass in Memory, File, SQLite and owned PostgreSQL. They
cover no-auth/RO/monitor/foreign-workspace denial, absent/invalid bodies, type/ID/
module changes, malformed XML, DOCTYPE and invalid byte encoding, exact UTF-16
replacement/download, valid zero-byte binary replacement, independent Unit/
Player acceptance, missing-Player rejection, superseded-file rejection and
subsequent actual runtime hydration. Seven pure identity controls include
Unicode distinctions, module case and filename fallback. The full local unit
sequence passes **121 + 322 + 1,269 + 1,992 = 3,704** cases without skips or
cancellations. Production build passes; four native strict-XML journeys
(Rewrite/Original, desktop/mobile) additionally exercise the new protected
endpoint against the actual Original-19 XSD profile, rejecting missing-schema
replacements without a write and accepting/downloading exact UTF-16 bytes.
The owned PostgreSQL cluster is stopped afterwards.

This is additional backend behavior, not the complete Original file workflow.
Complete upload-queue parity, ZIP member materialization, Source's complete reports and
dependency revalidation/automatic activation, physical delete semantics and
the real four-tab renderer remain open. Current pages still show the generic
console. No visual row closes: **29 done / 20 partial, all eight broad visual
rows open**.

### Original workspace files reference (2026-10-22)

The current Original mode still renders the general Rewrite workspace/content
console. The next required surface is Source's four-tab workspace shell and
file administration, including grouped files, selection, dependency metadata,
upload/replace, download, guarded batch deletion and its actual partial reports.
The generic intake/import/release controls do not reproduce that operator flow.
This is an open product gap, not a completed visual row.

A new Source-only native reference executes the unchanged pinned Original
`eedae41840cbe90e5547c0211da818bdf620f5aa`. It records 48 views and 48 independent
repeats across three themes, desktop/mobile and RW/RO claims. Empty/populated
lists, selected files, delete confirmation and cancellation are covered. Real
Source relationship names and recursive dependency closure drive the fixture;
Source excludes Player bytes from Unit size but includes them in Booklet size.
The new renderer must preserve those distinctions rather than using raw upload
sizes for every row. Fifteen complete Source files are hashed in the evidence.

Initial same-page document replacement deterministically alternates two native
shadow rasters on mobile despite equal geometry and settled dependencies. A
visibility-only diagnostic correctly fails its white-frame proof; adding root
visibility to opacity does not fix the alternation. No global capture algorithm
or comparison threshold is changed. Independent native pages for the reference
and repeat retain the unchanged white-clear, exact-style/geometry restoration
and three-consecutive-identical-frame checks. The full Source-only corpus then
reproduces exactly. The prior failure artifacts remain separate diagnostics.

This reference uses owned API fixtures. It does not establish Source backend
authorization, Candidate rendering or the required real file mutation workflow.
The new helper is not yet a CI family or complete-acceptance substitute. Formal
status remains 29 done / 20 partial, with all eight broad visual rows open.

### Workspace file read model and Player binding (2026-10-22)

A protected `GET /api/v1/tenants/:tenantKey/workspaces/:workspaceKey/files` now
provides the complete current canonical loose-file catalog. It does not inherit
the generic source-list's 500-row bound or fetch each raw document into the
browser. Metadata includes authored ID/label/description, named-Login count and
Player versions. Typed recursive relationships preserve Source's distinction:
Unit size excludes Player bytes, Booklet size includes them, and
Testtakers/SysCheck/resources retain their own sizes. The exact 1,000-file boundary
and Source's uncomputed-size state above it are explicit; files are still listed.
Missing and ambiguous typed references remain visible. Import status is not
rewritten and no Source validation report is synthesized by this read model.

The read uses canonical immutable replacement/assembly history. Generated
dependency archives and superseded revisions are excluded from the current
loose-file view, while historical downloads keep their exact bytes. Canonical
rejected-replacement policy is retained here. Source's full invalid-upload,
replace/delete lifecycle, ZIP member materialization, automatic validation/
activation and real four-tab renderer remain required work. The generic console
still renders at the current workspace/content routes; this backend preparation
does not close a visual row or claim the whole Original operator flow.

The actual replacement test first fails in Memory, File and SQLite because
workspace dependency selection cannot resolve `catalog-player@1.2.9` to Source's
stored module/major/minor identity. A second before-fix probe proves that merely
normalizing the loose lookup is insufficient: import can report `completed`
while the requested Player HTML is absent from its immutable runtime. Both the
loose-file lookup and ZIP Player hydration/validation now share the normalization,
retaining existing exact aliases first. Regression assertions inspect the actual
Player bytes, allow a different patch in the same major/minor line and reject a
wrong minor even when its filename matches. Existing metadata identity/version
checks are preserved; a successful status alone cannot satisfy this test.

Ten pure controls cover metadata whitespace/encoding-independent structure,
recursive distinct relationships, ambiguous/missing IDs, secret exclusion,
malformed/DOCTYPE inputs, Player language preference and current canonical
history. ID casing preserves Source's PHP
[`strtoupper`](https://www.php.net/manual/en/function.strtoupper.php) behavior:
ASCII letters change case while Unicode ID distinctions remain. Real protected
HTTP cases pass in Memory, File, SQLite and an owned
socket-only PostgreSQL cluster, which is stopped afterwards. They verify UTF-16
bytes and labels, downloads, replacement history, actual Player bindings,
version rejection, RO access, foreign-workspace/monitor denial and unchanged
canonical lists/activity after reads. A real 1,007-file Memory API case remains
complete when the generic list returns 500. The tests are mandatory in unit and
PostgreSQL CI; they establish Candidate API behavior, not Original backend
authorization.

The final full local unit sequence passes 121 + 315 + 1,266 + 1,983 tests, all
without skips or cancellations. Production build, all four native strict-XML
journeys (Rewrite/Original mode, desktop/mobile) and 176 CI policy checks pass.


### Current settings and directory checkpoint (2026-10-21)

Published `8935ff5e` passes the complete Linux administration settings reference
in [run 39562001420](https://github.com/jurei733/testcenter-rewrite/actions/runs/39562001420),
job `119096077885`: **24 exact Source/Rewrite viewports and 24 exact independent
Source repeats** across all three themes, both widths and both tabs/scroll states.
All six headed capture controls pass. The downloaded evidence ZIP has SHA256
`3fd0715c08e9a42c88bc5ba93b191d6bc5845a49d2ed429bf98e182cacbc6c9f`;
all 72 per-image records verify the actual cleared native frame, exact root-style
restoration and three equal visible frames against their retained PNG hashes.
Capture now clears retained browser paint before restoring the unmodified view.
The final full-viewport RGBA comparison remains zero tolerance; no mask or
reference-guided image selection is used. The earlier heading/background guesses
and steady-only captures below are historical, superseded observations.

Original settings now use a dedicated protected partial-update contract, with
per-key custom-text merge against current state inside each store's write boundary.
Settings, asset validation and the matching audit commit atomically in Memory,
File, SQLite and PostgreSQL. The old endpoint retains its existing full-map and
omitted-warning semantics. Native saves no longer pre-read and replace a stale
whole settings map. Late audit/manifest rollback, combined-map limits and two
actually queued independent PostgreSQL writers are covered. The pinned Original
meta SQL executes in its own PostgreSQL oracle. The old concurrent-map warning
below describes the earlier implementation and is superseded by this contract.

The next directory change follows Source's `SuperAdminDAO` global name-ordered
queries: flatten workspaces across their actual tenant scopes, then order names;
inserted administrators/workspaces and renamed workspaces keep that initial order.
Regression cases verify the real tenant/UUID and role target after reordering,
including a saved cross-tenant permission and subsequent rename/create. Local
validation passes 23 controller cases, 1,955 frontend cases, typecheck, production
build and the full protected administration/settings browser flow. Whole-directory
pixel comparisons, locale-specific ordering, every dialog/edited/notice state,
non-platform administration and complete Original backend authorization remain
unproven. This does not close a broad visual row or certify the new directory
change's remote build. The published `8935ff5e` baseline finishes all 85 jobs
successfully, including complete acceptance; the next directory head still
requires its own full CI.

Formal status remains **29 done / 20 partial**, with all eight broad visual rows
open. The bounded settings renderer gate is now proven on Linux; that result
must not be used as complete System administration or whole-product acceptance.


### Paired Original settings viewports (2026-10-20)

The settings reference now captures the actual unchanged Source and Rewrite in
one Chromium session, across Primar/Sekundar/Erwachsene and 1280/390 px at 844 px
height. Each Allgemein/Bildersetzungen form has an initial and a natively scrolled
bottom state: 24 complete visible viewports, with all image slots, notices,
theme previews and save/reset actions covered. Source uses owned read-only API
fixtures; Rewrite uses an actual protected SQLite API session created by real
UI sign-in. This does not prove Original backend authorization or every editor,
dialog, error and directory state. All eight broad visual rows stay open.

Source and Rewrite screenshot bytes are decoded by the same browser and every
RGBA channel is compared. A changed pixel, alpha channel, incomplete buffer or
changed viewport fails; there are no reference masks or numeric tolerances.
Each image must preserve its measured viewport/navigation layout. Initial tab
states start in a fresh document; bottom states use a native wheel in the empty
panel gutter. Capture waits for actual finite transitions and transient ripples
to finish, retaining Material's stable radio ripples. Original files are verified
before and after the job. The fourth mandatory reference family retains PNGs,
per-state geometry, pixel hashes and differences alongside the existing 18 tasks.

The complete local CI wrapper passes all 24 comparisons with zero changed
pixels and equal pixel hashes in Chromium 147.0.7727.15, after verifying the
Source artifact before and after rendering. The 121 CI/reference checks,
1,949 frontend tests, development/production builds and Actionlint pass; initial
output remains 467.97 kB under the unchanged 470 kB cap. Real administration and
settings actions, including clear/save/reassign and cascade deletion, pass
separately against the production build and owned protected SQLite API. Linux
qualification and complete current-head CI remain pending.

The paired evidence identified early navigation activation before Material's
pagination controls render. RouterLinkActive now provides Source's activation
lifecycle while the current query-selected section disambiguates the shared
Rewrite route; busy/session guards remain. Scoping Source's content-box behavior
to pagination chevrons and theme previews restores their size and mobile text
wrapping. Material buttons retain their own themed fonts; the native font reset
is limited to icon buttons. An unassigned image uses Source's undefined value
and placeholder, and the real browser gate verifies clearing, saving and
reassigning it before guarded/cascading deletion.

### Original application settings controls (2026-10-20)

The Original Systemverwaltung settings tab now loads its German Allgemein and
Bildersetzungen forms, with the pinned Source grouping/order/labels/defaults for
all 102 text replacements, separate general/text/image-assignment saves, warning
calendar day/hour, public notices, audience themes and the eight asset slots.
The existing protected settings/assets API retains its default behavior. New settings actions
capture the administrator before any asynchronous work, including FileReader;
retired replies cannot apply the global title/theme or dispatch a later write.
Separate saves read current settings and retain the required title/warning fields,
unknown custom-text overrides and unsaved edits in the other editor. The existing
full-map endpoint still has no concurrent merge/CAS contract; cross-client races
between that read and replacement write are not qualified as Source equivalence.

Focused tests cover the complete Source catalog, authored whitespace and
empty-to-default input, separate drafts/saves, retry, retired reads and file reads,
and local date/hour conversion. The real production Angular/owned-SQLite browser
gate saves general/legal/theme/warning fields, all three editor categories, uploads
an actual image, checks all eight slots and the legacy in-use rejection, then
uses the native Original removal action to clear its assignments and delete it.
Reuploading the same filename receives a new identity, does not restore deleted
assignments and uses a versioned gallery URL. It also proves live title/theme updates and retains twelve settings
captures plus the twelve administration captures across three themes and both
viewports. These captures are diagnostic; whole-page pixel acceptance remains open.
A direct unchanged Source capture exposed Rewrite's inherited 12-pixel column gap
and a calendar-suffix difference; the renderer now retains the actual Source
component's layout/imports. The Material date input still supports manual/keyboard
entry as in Source. Local Source capture uses owned read-only API fixtures; it does
not establish Original backend authorization. Material tab captures wait for the
active body to finish translating and for outgoing portals to detach; a pair of
frames alone can still capture the transition. Each narrow case starts with a
fresh page, matching the Source reference rather than a resized desktop tab bar.
The earlier twelve captures exposed a narrow navigation offset and additional
control states. The new paired initial/bottom gate above replaces that diagnostic
comparison; it does not close the complete System administration acceptance row.

The Original adapter explicitly requests `cascadeAssignments: true`; absent or
false retains the existing 409 in-use policy for other callers. Every store now
commits the catalog deletion, global/participant/operational bindings and deletion
audit together. PostgreSQL uses a schema-scoped transaction lock shared by catalog
and assignment writers; SQLite uses `BEGIN IMMEDIATE`; File uses its existing
serialized manifest commit. A queued stale PostgreSQL writer cannot restore the
deleted reference or replace its password. Source SQL/DDL is pinned by full-file
hashes and executed against actual PostgreSQL. Late audit/manifest failures roll
back the complete mutation. Reupload retains a new identity; replacement of an
existing filename keeps its identity and creation timestamp under the same lock.
Public/participant image-cache freshness beyond the gallery, concurrent whole-map
settings replacement and full Original backend qualification remain open. Persistent notices
still need the Original toast presentation. Non-platform workspace administration,
full paired-page qualification and the other formal parity requirements remain open;
this slice does not close a full-page row. The administrator capability is reopened
as partial after this Source audit, leaving 29 done / 20 partial formal areas.

Published e2304c30 exposed two obsolete tests that looked for Rewrite batch controls
inside the new Original administration. The deletion gate now retains Rewrite batch
coverage in both viewports and exercises actual Original single-account actions,
cancellation/focus, wrong-password retry, held-DELETE protection, acknowledged cache,
failed subsequent reload and missing-renderer recovery. XML intake uses the actual
Original home link to reach workspace controls. Both complete local gates pass.
The native-tab journal gate now keeps old-document retries unavailable until reload
commit; otherwise an already accepted retry could clear the journal before its
request checkpoint. It retains exact packets, owner/run/answers/clocks and completion
assertions, and passes the complete local crash/tab/reload journey. No runtime change
was introduced for that fixture ordering correction. Fresh publication CI remains
required; historical green fast feedback alone is not full acceptance.

### Original system administration adapter (2026-10-20)

The optional Original interface now mounts the German Material Systemverwaltung
header, account menu and Admins/Arbeitsbereiche tables for authenticated platform
administrators. The shared API remains authoritative. The two pinned Original
`selectPermissions` implementations are captured with full-file hashes and
executed directly against twelve corresponding Rewrite cases; the Source build
verifier rejects a missing, changed or substituted reference.

The adapter reads every workspace with its actual tenant key. A name-only new
workspace goes into the dedicated `original-interface` tenant (display name
`Testcenter`), created through the existing platform API when absent. It never
uses the last selected study tenant. Workspace keys use browser cryptographic
randomness. Reads, continuations, next batch writes and modal submissions retain
their captured administrator session. Successful permission rows are acknowledged
individually, so a partial failure retries only the remaining changes. Workspace
deletion removes its cached scoped assignments after the server's real cascade.
Existing self-deletion, self-demotion and password policy remain enforced by the
backend. Own-password reset remains available under the existing backend contract.

An owned SQLite/production-browser gate signs in through the real Original form,
grants RO and cross-tenant RW access, renames and creates workspaces, rejects an
incorrect deletion password, confirms deletion and its membership cascade, creates
and promotes/deletes an administrator, and resets a password followed by actual
required self-change and token revocation. It retains twelve users/workspaces
captures across all three themes and desktop/mobile viewports. Captures are
Rewrite diagnostics, not paired Source pixel acceptance. Stable table identity
also preserves the actual focused permission checkbox after a native edit; the
pre-fix browser regression fails when the row is recreated.

Required/own-password forms now load on demand while the existing root controller
keeps validation, credential cleanup and revocation. The required form's missing
chunk fallback offers real sign-out; a deliberately aborted renderer proves the
server password gate and subsequent 401 after closing. The production initial
bundle stays under the unchanged 470-kB limit. No server/auth/storage schema or
migration is changed by this presentation adapter.

At that adapter checkpoint the Settings tab still projected existing controls; full Original
settings appearance, non-platform workspace administration, notification/sorting
differences and paired whole-page Source qualification remain open. The formal
30-complete/19-partial count and all eight full-page acceptance rows stay open at
their previous boundaries. The last published run at `37a34bc4` passed 77 jobs,
including Source captures, PostgreSQL, Compose and the saved Systemcheck fix, but
failed JSON-roster shared-parameter publishing and final acceptance. Its follow-up
now records exactly one trusted Publish click per actual mounted definition and
waits for the parent Player surface to become interactive; fresh local and Linux
qualification are required before that failure is called fixed.


### Mounted Player startup interaction (2026-10-17)

The current Original controller covers its mounted Unit iframe while loading.
The Rewrite host now overlays the mounted iframe and makes it inert until Ready/
Start, preserving its layout for Player initialization. A production Chromium
gate explicitly holds Ready, exposes an enabled owned control and proves native
click/typing cannot change it; Start then enables normal input. The local Demo
also waits for a nonempty Start session before enabling its restored field.
All 16 Debug groups and 2,542 unit/frontend tests pass. Complete browser and
production acceptance remain separate; the formal 30/19 parity count is unchanged.

### Mixed-command terminal continuation: confirmed open gap (2026-10-14)

The actual pinned Original's Pause/Resume and Unit navigation methods are now
included in the completion fixture. Eight new overlap cases bring the Original
completion suite to nineteen passing cases. A Terminate awaiting its three saved
buffers is not cancelled by a later Pause or Resume: its own optional lock and
Starter navigation still run, its completion log still waits for that navigation,
and it does not overwrite the later controller state. Both initially RUNNING and
PAUSED controllers are covered. Only backend/router I/O is controlled; these
tests do not run the complete Original app or Player.

The fresh `audit-participant-terminal-overlap.mjs` witness runs 48 corresponding
native/deferred-remote service cases across Memory/File/SQLite. Every case retains
the later status/answers/current Unit/dispatch, but fails the terminal continuation:
the controller entry stays active and requested locking is omitted. The entry
expectation derives from the observed Original Starter route. Original remote
delivery, Rewrite Angular/HTTP, PostgreSQL and cross-document overlap remain
outside this witness. The existing loading smoke's active-entry assertion in its
later-command branch therefore cannot establish full Original parity.

All 53 focused tests, typecheck and the prior three-store single-command completion
differential pass. The new overlap differential deliberately exits 1 with
`--assert-parity` and records the failures in the owning task's
`outputs/testcenter-terminal-overlap-before-5512e1cd.json`. Runtime application
`9528a6b6855b` is unchanged; no corrected-runtime, new-image or browser acceptance
is claimed. Implementation must retain the newer state/data fence while completing
the earlier lock/navigation and its delayed log. Formal parity remains 30 complete
and 19 partial. No publication or deployment occurred.

### Native Debug completion microtask (2026-10-14)

Application `9528a6b6855b` matches the pinned Original's immediate Debug preference
change followed by completion logging in the fulfilled-handler microtask. Scope
and arguments stay attached to their invocation even if selection changes in the
same turn. Cleanup before continuation prevents an orphan entry. Original on/off
reference cases execute the actual pane method and root completion callback with
controlled storage/clock; the complete Original app is outside that oracle.

The old logger fails the new immediate-entry assertion. All 45 focused cases and
1,055 frontend tests now pass. Fifteen production Angular/SQLite Debug groups pass
both headed and in CI, including exact before/after microtask timestamps and an
unchanged paused Run, parent and timer. Existing error and isolation behavior stays
covered. The 2,452 qualified unit/frontend total combines these fresh frontend
results with the previous 1,397 non-frontend checks; those were not rerun, and all
97 backend hashes remain identical. PostgreSQL (1,580) and HTTP (498) proof stays
attached to that unchanged backend's earlier checkpoint.

The clean 930-file image passes Standard/Demo/production PostgreSQL profiles,
SQLite runtime and 689 tests as node in a read-only container. All 169 frontend
files match the tested host/frozen bytes. Existing 24 containers, immutable images,
states/mounts, 86 volumes, 423 image aliases and protected artifacts are preserved;
owned containers/volumes are removed. The preceding broader 172-group browser
qualification was not rerun. Full Original mixed-command and cross-document
ordering plus the other parity and production requirements remain open.
Formal parity remains 30 complete/19 partial; no publication/deployment occurred.

### Separate normal command completion and browser replay (2026-10-14)

Application `38d8e7ef78ff` includes runtime `67a50b1b8157`: opted-in native and
remote state effects no longer publish their completion log. A fulfilled client
continuation captures its completion timestamp and queues a separately authorized,
idempotent completion against the exact accepted command. The API verifies native
payload identity or the persisted remote execution receipt/content. Completion
cannot apply a pending command or change Run, parent, answers, field clocks or
revision. Existing command JSON carries the remote metadata; no schema change is
required. Old clients/replies preserve their existing logging and timing.

Four real store adapters cover accepted effect versus completion, concurrent
duplicates, conflicting replay, legacy clients, saving modes and reopen. A durable
browser journal retains exact completed packets across lost replies/reload, reads
fresh credentials and preserves other scopes. Timeout plus monotonic retry bounds
allow recovery when a completion route is temporarily unavailable. Headed and CI
production Angular/SQLite each prove native and remote termination with held
reconciliation, then lose the committed completion reply and restore its exact
packet from a Starter reload. No state effect is repeated and the Run is unchanged.

All 2,447 unit/frontend, 1,580 PostgreSQL and 498 Memory/File/SQLite HTTP checks
pass without skips/cancellations. All 163 Rewrite browser and nine actual Source
Worker groups pass. The actual Original three-buffer completion reference remains
bounded to controlled backend/router and a non-adaptive Unit. The independent
Memory/File/SQLite witness now passes its held-completion comparison. Full Original
frontend acceptance is not claimed.

Loading/route/tab assertions now inspect the separate completion packet and exact
timestamp instead of its former effect-log ID or synchronous persistence. The
browser-process crash fixture preserves the accepted PAUSED effect while forbidding
a completion for a handler that never receives its held effect reply. All prior
failed trials and the final ten-group crash/tab qualification are retained.
The runtime is unchanged by these browser qualification refinements.

A clean 930-file archive builds the new image; Standard/Demo/production PostgreSQL,
SQLite runtime and 689 read-only node tests pass. All 169 tested/frozen/image frontend
files match, the 469.99-kB initial bundle remains within the existing hard cap, and
runtime build options are absent. All 24 prior containers, their immutable images,
states and mounts, 86 volumes, 413 image aliases and protected artifacts are preserved.
Owned containers/volumes are removed; mount list ordering alone is normalized.

The accepting API must precede frontend rollout. Complete mixed-version recovery,
native Debug completion timing and full Original mixed-command/buffer/lock/navigation
ordering remain open with the other parity and production requirements. Formal
parity remains 30 complete/19 partial; Test logs export stays partial. No push,
release, production deployment or production acceptance occurred.

### Actual buffer and command-completion reference (2026-10-14)

Reference checkpoint `d9e3f587` replaces a held `closeAllBuffers` approximation
for the new completion cases with the pinned Original's actual three buffer
pipelines and aggregation, saved-event barrier, forced-deactivation method,
controller subscription and root command callback. The backend and router remain
controlled external boundaries; this does not qualify the whole Original app.
Five complete source hashes match `ee2ab9ab64bd91209ef8534bbe6005838024e46d`.

Nine cases prove all-buffer saving before lock, lock completion before navigation,
and command-log creation only after navigation resolves, including `false`.
The log timestamp is captured at that last phase. Empty and non-saving buffers,
paused termination, the immediate already-TERMINATED no-op, its overtaking an
earlier held termination, and exact data-part aggregation are also executable.
Non-saving log assertions cover the frontend backend-method call, not downstream
server persistence. Adaptive/timer behavior retains its existing separate gates.

The actual Rewrite native transport and application services reproduce a remaining
phase/timestamp difference on real Memory, File and SQLite adapters: the command
log is committed while the client application continuation remains held, retaining
its invocation timestamp after that continuation completes. The differential
audit's `--assert-parity` exits 1 for all three stores. Its controlled transport
and view continuation are not HTTP or complete Angular browser acceptance.
No runtime correction or completion of that parity requirement is claimed.
Test logs export is reopened as partial, leaving 30 complete and 19 partial
formal areas; the existing export-format proof remains valid within its scope.

All 2,391 unit/frontend tests pass fresh without skips or cancellations. All 306
application/package source files remain unchanged against the preceding qualified
checkpoint; earlier image/browser/HTTP/PostgreSQL results retain their original
commit boundaries and were not rerun here. Protected artifacts are preserved.
Native and remote completion phases, durable retry/reload identity, legacy-client
behavior, mixed-command overlap and real browser acceptance remain the next
implementation/qualification work. Full parity and production readiness remain
unproven; no push occurred.

### Coordinated File maintenance and process termination (2026-10-14)

Application checkpoint `d3b599ec7eee` adds safe, explicit File version compaction
and closes two observed process-lifetime gaps. The runtime implementation is
`59fc9bb7b96e`; the subsequent validation changes give File-only isolated integration
fixtures their own storage paths and wait for the exact trusted Player answer
after its asynchronous handshake. They change no runtime behavior. The File adapter remains a same-host/PID-namespace, single-writer
local-development option; PostgreSQL remains the multi-process deployment path.

The new nested sidecar manifest version is 3. Existing inline, version-one and
version-two data remain readable and migrate on a successful write or explicit
migration. Older binaries cannot read version 3, so upgrade stops old accesses
and takes an offline manifest/objects backup. Unique process/namespace access
markers coordinate current readers, writers and maintenance. The API holds its
writer registration through shutdown, while direct repository operations enroll
during access. Maintenance and competing writers are refused while incompatible
processes are alive. Unknown markers, foreign namespaces and symlinked metadata
are retained/refused. Only uniquely named markers belonging to a verified dead
process in the same namespace are removed; no expiry heuristic declares a live
writer dead. These cooperative local guards are not distributed locks.

`db:compact:file:built` previews candidate count/bytes by default; explicit
`--apply` removes only unselected known versions and dead owned pending files.
Selected objects are validated and the main manifest is rechecked before
deletion. Store and namespace identifiers plus the owning PID distinguish
pending files from live work and another store in the same directory. Unknown
or malformed files and collection-directory symlinks are preserved. Active
readers defer aggregate sidecar pruning until a later successful mutation.
Process metadata and unpublished pending files are excluded from offline
backups/moves; uncertain namespace metadata needs operator investigation.

Three owned SIGKILL probes pause the actual writer before sidecar publication,
before manifest replacement and just after it. Maintenance refuses the still
live writer. After its confirmed death, reopen observes respectively the old,
old and new committed value; compaction reclaims crash debris/old versions
without changing selected data or manifest bytes. Fifty concurrent writer/
maintenance enrollment trials never grant both actors. These checks leave the
kernel/disk running and do not prove actual power-loss durability.

A real API counterexample showed its public close callback completing before
the asynchronous File writer registration was released. The callback now
awaits one shared runtime shutdown. Another injected bootstrap I/O failure
left writer ownership active in the same process; failed bootstrap now closes
storage before rethrowing, allowing a clean retry. Both before-fix probes fail
and their current counterparts pass. File storage itself releases registration
after rejected initialization and rejects access after its idempotent shutdown.

All 2,382 unit/frontend tests, 1,536 PostgreSQL tests and the 498 HTTP checks
across Memory, File and SQLite pass without skips or cancellations. Unit,
PostgreSQL and Memory HTTP validation belongs to runtime `59fc9bb7b96e`;
File/SQLite HTTP uses the final File-only fixture correction. The first File
matrix passed 160 and failed six: its nominally isolated servers inherited the
active main File path and were correctly refused as second writers. Owned
private File paths fix the fixture defect without switching adapters or weakening
writer protection; all six targeted cases and the complete matrix pass.
The first headless context run asserted an empty iframe input before restoration
finished; its failure screenshot already shows the exact trusted answer. The
probe now polls that same expected value within its existing bound, then retains
the selected-run, sibling-answer and timestamp assertions. Failure evidence is
retained; both current headed/headless context groups pass.
Migration, doctor, metadata-required preflight, startup and shutdown also pass.

A clean archive of all 919 tracked application files builds image
`2aeff9ae818e`. Standard, Demo and production PostgreSQL profiles, SQLite runtime
and 652 tests inside the read-only image as node pass. All 169 image/frozen/host
frontend files match byte for byte, and all 206 frontend source files are
unchanged. The bounded build options remain absent from the final runtime.
One fresh headed File/Angular flow passes through participant-verona-loading.
The current backend additionally passes 159 Rewrite browser groups and nine
pinned Original Worker groups, 168 total, covering context, timer interruption,
loading/commands, Debug, native routes, copied tabs and runtime errors. The
Original harness controls router/iframe wiring; this does not establish full
Original application or visual acceptance.

All 24 preexisting containers with their image IDs/states/mounts, 86 volumes,
393 prior image aliases and the three protected artifacts remain intact. Owned
test resources are removed. This checkpoint is local: no push, remote CI,
release, deployment or production acceptance is claimed. Actual power-loss,
broader operating/performance qualification, complete Original concurrency/
timer/Player and package/property/visual/camera acceptance remain open. The
earlier intermittent SQLite CANTOPEN still has no proven original cause.

### File mutation publication and real writer readiness (2026-10-14)

Application checkpoint `c4a82157fc98` fixes the three reproduced File-store
failures from the preceding SQLite checkpoint. A readable but non-writable
manifest or package directory now fails readiness through a real exclusive
write, flush and rename probe. Probes leave committed bytes unchanged and no
probe files behind. The real API retains health while readiness returns 503;
write errors expose a generic public response and safe EACCES diagnostics, then
normal readiness and sign-in recover when permissions are restored.

Generic mutations isolate collection maps and publish the live cache only after
persistence succeeds. Failed mutations restore their pending dirty-entity sets,
remain absent from live reads and cannot leak into a later independent commit.
The File adapter additionally writes new package/release contents to immutable
hash-named files. One atomic main-manifest replacement publishes all selected
versions. Failure before that replacement preserves the previous manifest and
selected sidecars and removes newly created candidate files when cleanup is
possible. Reopen therefore retains the committed package/release, rather than
observing an overwritten rejected version. A missing selected sidecar now
rejects loading instead of silently initializing an empty repository; the new
version-two sidecar manifest also detects content-hash mismatches.

Legacy inline and version-one sidecar stores remain readable and migrate on an
explicit migration or the first successful write. Owned failure fixtures prove
that a rejected migration/replacement retains version-one manifest and sidecar
bytes and can be retried after recovery. The enclosing state document and public
migration result keep formatVersion 1; the nested sidecar manifest is version 2.
Older binaries cannot read it, so the documented rollback restores the complete
pre-upgrade manifest/objects backup while the single writer is stopped. Prior
versions of live entities remain available to readers of an earlier manifest.
Guarded deletion drops the references and prunes all versions; failed cleanup
retries on the next mutation. Retention/compaction, broader failure injection
and power-loss behavior still need operating qualification.

All 2,359 unit/frontend tests and 166 fresh File HTTP integration tests pass
without skips or cancellations. The focused 29 tests include existing File
behavior, eleven new storage failure/migration/integrity cases and two real API
cases. The previous immutable image `f386eaa7dc6b` passes one and fails ten of
the eleven current storage cases, and fails both new API cases; the same scripts
pass against the current code/image. Migration, doctor, metadata-required
preflight, startup and shutdown CLI checks pass on an owned File fixture.

A clean archive of all 913 tracked application files builds fresh image
`99695362f806`. Standard, Demo and production PostgreSQL profiles, SQLite runtime
and 629 tests inside the read-only image as node pass. All 169 production
frontend files match the frozen tested frontend and host byte for byte; all 206
frontend source files are unchanged. The bounded Node/Angular build options
remain absent from runtime configuration. The earlier 1,536 PostgreSQL tests,
332 Memory/SQLite HTTP tests and 168 browser/reference groups remain explicitly
retained evidence for unchanged non-File runtime paths, not fresh current runs.

A fresh headed File/Angular browser flow passes through the requested
participant-verona-loading boundary. It covers administrator settings/accounts,
workspace/content authoring, source intake and dependency assembly, import,
activation, prompt read models, participant login/code/reentry, navigation,
response autosave, completion and Player loading. This is one bounded flow,
not the complete Original player/visual/operating acceptance matrix. The first
attempt mistakenly enabled Demo bootstrap although the harness creates its own
administrator: bootstrap returned 409 and sign-in 401. Its failure log/report
and screenshot remain retained. The corrected attempt disables only that fixture
option and passes without an application change.

All 24 preexisting containers, their image IDs/states/mounts, all 86 volumes and
383 prior image aliases at this checkpoint's start, and the three protected
artifacts remain intact. Owned test resources are removed. The current work is
local; nothing was pushed, released or deployed and remote CI is unverified.
Complete Original functional parity and production readiness remain unproven,
including broader legacy/native concurrency and timer scheduling, full
real-package/property/visual and camera/QR acceptance, measured performance,
retention/power-loss qualification and production acceptance. The earlier
intermittent SQLite CANTOPEN still has no proven original cause.

### Live SQLite readiness, safe storage shutdown and bounded builds (2026-10-14)

Application checkpoint `ca72428d7d39` strengthens the operational boundary
without changing the participant protocol or frontend. SQLite readiness now
uses the persistent writer owned by the API instead of opening another
connection. It checks the existing schema and performs real writes in a rolled
back transaction. Missing files are not created by standalone readiness checks,
and empty databases are not silently migrated. Healthy probes retain database
bytes, schema and application data; a read-only writer, replaced database path
or obstructed journal causes readiness failure. API health remains available
while readiness returns 503. Safe driver codes are retained in operational logs;
public write failures keep their generic response and do not expose credentials.
Rejected startup migrations close their connection and shutdown closes the
successful live writer exactly once.

Closing a socket does not imply that its asynchronous database work finished.
The API now includes participant and monitor SSE polls and participant lease
closure in its request lifecycle. Shutdown drains that work before closing
storage. A disconnect during initial stream registration closes the participant
lease and starts no poller; the corresponding monitor path also starts no
poller. Eight lifecycle tests execute the actual extracted stream/shutdown
methods with controlled scheduling and services. The previous source passes
three and fails the five newly added stream cases. Two separate real
SQLite/HTTP stream tests pass; the controlled cases do not replace complete
application shutdown/load qualification.

The application code at `6d0f84e7e6c1` passes 2,346 unit/frontend tests, 1,536
PostgreSQL tests and 498 HTTP tests across Memory, File and SQLite, without skips
or cancellations. Startup and shutdown CLI checks also pass. The only subsequent
application change is the Dockerfile: build processes use a 1,536 MiB Node heap
limit and two Angular workers. Those options are absent from the final runtime
environment. A clean archive of all 911 tracked application files builds image
`f386eaa7dc6b`; Standard, Demo and production PostgreSQL profiles, SQLite runtime
and 600 tests as node inside the read-only image pass. Its 169 production
frontend files match the frozen tested frontend and the host byte for byte.
Three actual SQLite API tests fail against the preceding `1e819f1c4ad6` image
and pass in the new image, including shutdown lifetime and live-writer failure
with generic public errors.

The current backend additionally passes 159 fresh Rewrite browser groups:
context selection headed/headless, timer interruption headed/headless, loading
and commands headed/headless, Debug, native routes, copied tabs/crash recovery
and runtime errors. Nine fresh groups execute the pinned Original's extracted
timer/controller/guard/Unit-host methods and real Blob Worker. Router wiring and
iframe presentation in that reference harness remain controlled. These 168
groups do not establish full Original application, visual or package acceptance.
The prior five actual older-API groups remain predecessor evidence; no fresh
complete mixed-version rollout is claimed.

The initial concurrent HTTP/PostgreSQL qualification exhausted host storage,
producing SQLite FULL/CANTOPEN and Docker overlay failures. Those trials and a
browser ENOSPC failure remain retained. A normal Docker Desktop restart restored
the daemon; only verified owned failed resources were removed. Integration runs
were repeated sequentially. A subsequent guarded container run also stopped at
low storage and its residual owned container was removed. The final bounded
build and all profiles pass under a storage guard. The earlier intermittent
CANTOPEN in the causal-context checkpoint still has no proven original cause;
these new live-writer checks and later disk exhaustion do not establish that
cause. Build resource bounds do not guarantee host headroom under every workload.

All 24 preexisting containers, their image IDs/states/mounts, 85 preexisting
volumes, 369 prior image aliases and protected artifacts are verified intact.
Observed unrelated inventory additions are recorded separately. Four closed
owned historical SQLite fixtures were losslessly compressed, reclaiming
197,197,670 bytes with verified round-trip hashes and a retained restore script;
the protected legacy tryout database is unchanged. Only verified private owned
BuildKit records were pruned; no broad image/volume prune or Docker reset occurred.

Full functional parity and production readiness remain unproven. Further work
includes exact Original Player/navigation/timer/concurrency and completion-lock
behavior, complete real-package/property/visual and camera/QR acceptance,
measured performance and broader storage/operating failure qualification.
An owned permission fixture independently reproduces a remaining File-store
readiness gap: a readable but non-writable directory passes readiness while an
actual repository write fails with EACCES and leaves persisted bytes unchanged.
The failed change nevertheless becomes visible in the live repository and an
independent later successful write persists it. The fixture was removed; this
SQLite checkpoint fixes neither File readiness nor that failed-write cache leak.
A separate owned SourcePackage replacement also fails at the manifest write
after overwriting its existing sidecar: an independently reopened repository
then observes the rejected replacement despite unchanged manifest bytes.
That on-disk partial commit requires a persistence correction as well.
Remote CI, release, deployment and production acceptance are separate outstanding
gates. This is a local checkpoint; nothing was pushed or deployed.

### Causal timer interruption after a legacy retime (2026-10-13)

Application checkpoint `0572ff28aa89` corrects an observed same-Unit race: a
restored unclocked Goto had already changed the server timer, but its reply was
held or lost. A subsequent Pause/Terminate still observed the earlier deadline.
The old timer receipt was accepted without freezing the changed timer; the
actual predecessor frontend reproduces an expired timer after acknowledgement,
with no unrelated page errors.

New timer preparations may carry the exact outstanding legacy Goto/Resume
identity and the observation timestamp. The server records a causal witness
only when that clockless command retimes a running timer on the same current
Unit. The witness binds the participant/Run, tenant/workspace, immutable
release/Booklet/assignment, delivery ID, canonical command payload hash, old
start/deadline, and the exact resulting timer fingerprint. It is retained only
while that fingerprint and scope still match. Reconciliation requires the
known old packet and timer plus an observation after its server effect and
before its new deadline, bounded by the current server time. Other Units,
subsequent timer changes, different packet bodies, later dispatches and ambiguous
observation times cannot use this path. Ordinary exact-identity preparations
retain their existing behavior. The legacy main HTTP body remains unchanged;
the optional witness uses the existing JSON timer storage without DDL or a
schema-version change.

The pinned Original's real Blob Worker additionally proves that same-block Goto
interrupts the last STEP balance and reentry emits its first STEP immediately.
Native Goto/Resume interruption now honors that STEP; a zero STEP before ENDED
can restart the authored duration. Already-paused timers retain their previous
interruption marker. Nine fresh Original Worker groups cover the earlier seven
Pause/Terminate/zero/expiry cases plus positive-balance and zero-balance Goto
reentry. This harness executes the actual extracted controller, timer service,
Worker, guards and Unit-host methods; router wiring and iframe presentation are
harness-owned, so this is not full Original router/application acceptance.

All 2,330 unit/frontend tests, 1,536 fresh PostgreSQL tests and 498 fresh
Memory/File/SQLite HTTP tests pass without skips or cancellations. The store
matrix covers all six execution modes, Pause/Terminate, positive/zero reentry,
restart before preparation and replay, exact duplicate retention, and negative
causality/clock/scope cases. The actual previous image passes 57 and fails 81
of the 138 current store tests, including failed parent groups. Seventy-two
native-transport tests and three new contract tests pass. Typecheck and the
production build pass at 469.99 kB under the unchanged 470 kB hard limit.

Twenty-two production Rewrite timer groups pass headed and headless. Ten added
groups cover already-applied legacy Goto with a held reply or a lost first reply,
live current-state updates or deliberately withheld current-state replies, and
zero-tick reentry before Pause/Terminate. Live event reception does not guarantee
a fresh snapshot before invocation: the assertions derive the exact expected
balance from the packet's observed timer identity, while deliberately stale
cases must retain the old identity. The tests hold a genuinely committed Player
answer independently, prove the early timer freeze beyond the former deadline,
then release legacy/answer/main replies and prove one legacy state effect,
retained balance and unchanged sibling, answers and response clocks. The wider
29 command/loading groups pass headed and headless, plus 14 Debug, five route,
ten copied-tab/crash, five context, 18 ERROR and five actual older-API groups.
That is 159 fresh Rewrite and nine fresh Original Worker groups, 168 in total.

A clean archive of all 908 tracked application files produces fresh image
`1e819f1c4ad6`. Standard, Demo and production PostgreSQL profiles, SQLite runtime
and 589 API/transaction tests inside the read-only image as node pass. All 169
image, tested and host production files match; the prior host frontend is
preserved. All 24 preexisting containers, immutable image IDs/states/mounts,
85 volumes, 359 prior image aliases and protected files remain intact. Ten
checkpoint aliases are added and owned containers, volumes and the clean source
archive are removed. Three closed owned development builds were removed,
reclaiming 73,809,189 bytes while retaining every frozen production frontend.

The first backend matrix found an already-paused marker regression, now fixed.
The first full browser matrix incorrectly assumed live SSE meant an already
fresh view; the corrected assertions preserve the actual snapshot distinction.
The first current-API context run also emitted SQLite `unable to open database
file` errors during save-progress/events. Its retained database passes a read-only
`quick_check`, and all five cases pass on a fresh owned database without any
source change. The cause remains unresolved; the successful rerun is not a fix
for that operational failure. Final acceptance uses the corrected matrix and
retains this separate production-readiness finding. Backend-first rollout is required:
historical already-applied packets without the server witness, different-Unit
legacy effects, broader restored/mixed-version concurrency, clock skew, exact
Worker scheduling/hidden-window behavior, buffer/completion-log and late
terminal navigation/lock ordering remain open. Global/cross-document and
post-unload ordering, full visual/property/real-package acceptance, measured
performance, remote CI, release, deployment and production acceptance also
remain unproven. This is a local checkpoint; nothing was pushed or deployed.

### Timer preparation while legacy commands wait (2026-10-13)

Application checkpoint `ed351fc1c0e6` closes the confirmed transport gap where a
restored unclocked legacy packet blocked a new timer interruption as well as new
main commands. An eligible Pause/Terminate timer receipt can now finish while
the legacy packet waits. Its exact acknowledgement is persisted before the new
command prepares answers. New answer preparation and main state application
remain behind the legacy FIFO; the legacy HTTP packet gains no dispatch or wire
metadata. Lost timer replies retry their original packet, restoration retains
an acknowledged interruption, and controller replacement aborts the preflight
without applying a late receipt. No wire or storage schema version changes.

The receipt changes the selected timer plus the Run's transaction metadata
(`stateRevision` and `updatedAt`). It does not change Run status, command dispatch
highwater, Unit, parent session, controller entry, answers or response clocks,
and does not project a returned Run snapshot. This distinction is deliberate:
timer preparation is independent of the older command's state ordering, while
its own store mutation still participates in normal revision tracking.

All seventy native-transport tests pass, including seven new cases for Pause and
Terminate behind a held legacy reply, exact lost-reply retry, restoration,
legacy settlement during an in-flight timer receipt, controller replacement,
and an unprepared legacy packet still draining its answers. The immutable
predecessor transport passes 63 and fails exactly those seven cases. All 2,247
unit/frontend tests pass fresh, including the unchanged 31 actual-Source command/
timer oracle cases. Typecheck and the production build pass at 469.99 kB under
the unchanged 470 kB hard limit, retaining existing warnings. A comment-only
clarification was rebuilt separately; all 169 production files match the earlier
frozen frontend used by the wider browser regression.

Twelve production Rewrite timer groups pass headed and headless. The two new
cases restore an owned, seeded, prepared legacy Goto journal through a real
browser reload, hold that Goto before server application, and hold a genuinely
committed Player answer independently. New Pause and Terminate freeze the
matching timer beyond its former deadline while both main effects still wait.
The Pause case loses its first timer reply and proves the exact retry is already
acknowledged before legacy release. The legacy packet is applied exactly once;
its body, sibling Run, answers and response clocks retain their required identity.
The previous immutable frontend fails with zero timer receipts at the expected
early-interruption assertion and no unrelated page errors. This uses the current
API with an old wire journal; it is not an actual older-client executable or a
complete mixed-version timing matrix.

The wider twenty-nine command/loading groups pass headed and headless, together
with fourteen Debug, five route, ten copied-tab/crash, five context, eighteen
ERROR and five actual older-API groups. That is 139 fresh Rewrite browser groups.
Seven previously verified actual-Source Worker groups remain retained evidence:
their fixture, extractor, unit oracle and Worker harness hashes are unchanged.
The resulting 146 positive groups distinguish fresh Rewrite runs from retained
Source runs. The root CI's existing timer gate executes all twelve groups, and
the normal frontend-state gate executes the seven new transport cases. Remote CI
has not run for this local, unpushed checkpoint.

Every backend, store, contract, configuration and integration-test source hash
is unchanged from `acb3e516db34`. Its 1,432 PostgreSQL and 498 Memory/File/SQLite
HTTP tests are therefore retained predecessor evidence, not fresh executions.
A clean archive of all 906 tracked application files produces a fresh image
`620db5dfc4f8`. Standard, Demo and production PostgreSQL profiles, SQLite runtime
and 511 API/transaction tests inside the read-only image as node pass fresh.
Image, tested and host frontend match in all 169 files. The former host frontend
is preserved separately. All 24 preexisting containers, their immutable image
IDs/states/mounts, 85 volumes, 349 prior image aliases and protected files remain
intact; ten checkpoint aliases are added. Owned containers, volumes and the clean
source archive are removed, with preservation rechecked after the older-API run.

Storage preparation removed exactly 65 private unused BuildKit cache records
from three verified older dependency/build lineages of this repository,
reclaiming 1.692 GB. The current dependency cache, every image alias, container
and volume remain intact. Selection was checked read-only by explicit cache IDs
and ancestry before removal; the observed cache delta contains only those IDs.
This is a targeted own-cache cleanup, not a global Docker prune or disk reset.

Browser qualification corrected the migration setup to run only in the replacement
top-level document: injecting it into sandboxed Player frames produced unrelated
storage-access errors. Failure cleanup now releases deliberately blocked routes
without waiting indefinitely for canceled handlers. An earlier failed negative
control required stopping only its verified owned browser/API; the final negative
control exits with its original timer assertion. Earlier qualification failures
are excluded from final acceptance. Final timer logs use the corrected setup and
complete without page errors.

Complete Original parity and production readiness remain unproven. Further work
includes already-applied/lost legacy replies, broader restored and mixed-version
concurrency, exact Worker scheduling and hidden-window behavior, state-buffer/
completion-log timing, late terminal lock/navigation completion, initial loading/
controller replacement, global/cross-document and post-unload ordering, full
visual/property/real-package acceptance and measured performance. Release,
deployment and production acceptance remain outstanding separate gates.

### Zero-tick timer reentry and current code gates (2026-10-13)

Application checkpoint `acb3e516db34` distinguishes an interrupted zero STEP from
actual expiry. The pinned Original Blob Worker emits zero before ENDED; a Pause
at that boundary prevents the time lock. Its real Resume, UnitActivateGuard and
Unit host restart the full authored duration. By contrast, an enforced ENDED
keeps its time lock and redirects to the next accessible Unit. Non-enforcing
preview modes can explicitly reenter the expired block and restart its duration.
The Rewrite preserves these distinctions without changing a wire or schema
version, and resumes only the selected accessible timer rather than every paused
block in the Run. Positive balances remain bounded by the authored duration;
receipt replay after a store reconnect cannot restore an old timer or snapshot.

Native and remote Resume, ordinary Run and saving-session reentry, and the
legacy monitor issuance path share the entry projection. An already leave-locked
current Unit is skipped through the Original guard rules. This exposed a second
confirmed gap: a first Unit behind a code lock is an accessible code-entry route,
but its Player and timer must wait for code release. Current-state now exposes
that current gate, the frontend suppresses the locked Player, and a valid code
starts the current Unit in place. Invalid codes leave the Run unchanged. Existing
upcoming-gate behavior remains covered; timer preparation and state-command
ordering retain their separate receipts and highwater semantics.

The Source fixture now pins seven original files, including the actual route
guard, Unit host, code submission and lock aggregation. Thirty-one unit oracle
cases execute the extracted Original command/timer paths. Seven real Chromium
Blob-Worker groups cover Pause, ordinary and ERROR forced termination, zero-tick
Pause with/without enforced time, and actual expiry with/without enforced time.
The Source browser harness stubs iframe presentation; it does not prove the full
Original router or Player application. Sixty new Memory/File/SQLite cases and
eighty cases with PostgreSQL cover all six execution modes, native/remote
application where supported, explicit entry, sibling/answer/clock retention,
code release, and receipt replay after reopening the store. PostgreSQL replay
actually shuts down and reconnects its storage pool.

Ten production-built Rewrite timer groups pass both headed and headless:
native/remote Pause and Terminate with a held committed Player answer and a held
application, a lost timer reply, four native/remote zero-Pause/Resume combinations,
and native/remote Resume into a current code gate. The preceding immutable image
`04b894492418` passes nine and fails 51 of the sixty current store cases. The
preceding frontend fails the code-entry iframe-absence assertion while the new
frontend passes it. These controls are local regression evidence, not a complete
older-API behavioral matrix. The broader twenty-nine command/loading groups pass
headed and headless, with fourteen Debug, five route, ten copied-tab/crash, five
context, eighteen ERROR and five actual older-API groups: 135 Rewrite browser
groups plus seven actual-Source Worker groups, 142 positive groups in total.

All 2,240 unit/frontend tests, 1,432 fresh PostgreSQL tests and 498 fresh
Memory/File/SQLite HTTP tests pass without skips or cancellations. Typecheck and
the production build pass at 469.99 kB under the unchanged 470 kB hard limit;
existing warnings remain. A clean archive of 906 tracked application files passes
Standard, Demo and production PostgreSQL profiles, SQLite runtime and 511
API/transaction tests inside the fresh read-only image as node. Image
`37c36b6f1a43` matches all 169 tested and host frontend files. All 24 preexisting
containers, their immutable image IDs/states/mounts, 85 volumes, 339 prior image
aliases and protected files remain intact; ten checkpoint aliases are added.
Owned profile/test containers, volumes and the clean archive are removed. The
previous host frontend remains preserved separately. Preservation is checked
again after the actual older-API run.

The initial broader integration expectation retained the leave-locked introductory
Unit on Resume. Actual Original guard execution proves the forward redirect; the
test now explicitly checks both the leave lock and the resumed code-entry Unit.
The resulting current-code-gate failure was fixed in runtime code, rather than
removing the unlock assertion. A subsequent validation-only checkpoint updates
the Debug browser case to assert no Player before inherited-code release, release
in place, and retained Unit locks/answers; runtime and image stay at `acb3e516db34`. Final browser evidence uses the newly frozen
frontend and unique logs; earlier predecessor-frontend qualification runs are not
counted as final acceptance. Existing root CI timer/Worker gates execute the
expanded ten/seven groups; the new store cases run in unit and PostgreSQL gates.
Remote CI has not run for this local, unpushed checkpoint.

Complete timer parity and production readiness remain unproven. Remaining work
includes exact Worker scheduling and hidden-window behavior, restored/legacy
concurrency, state-buffer/completion-log timing, late terminal lock/navigation
completion, initial loading/controller replacement, global/cross-document and
mixed-version ordering, worker/post-unload behavior, full visual/property/real-
package acceptance and measured performance. Release, deployment and production
acceptance remain separate outstanding gates. An extracted-transport audit
confirms that a held unclocked legacy packet currently delays a newly captured
timer-only receipt. Removing that delay while retaining legacy state-effect FIFO
is a concrete next task; this checkpoint does not claim to fix it.

### Controller timer interruption before answer preparation (2026-10-13)

Application checkpoint `e481e22720e1` captures an eligible native or accepted
remote Pause/Terminate timer interruption before answer preparation. Its scoped,
authenticated receipt freezes the exact observed timer and balance without
changing Run status, Unit, answers, response clocks, parent session, controller
entry or command highwater. The explicit interruption marker prevents current-
state reads from restarting the timer while its original command still waits.
A later application retains the prepared balance; an explicit Resume restarts
it. Receipt replays never project an old Run snapshot into the current view.
Timer identity, Unit and dispatch checks prevent stale preparations from
interrupting a replacement timer or a newer completed command. No schema version
change is needed because the existing atomic progress-delivery receipt is reused.

Native journals retain the separate timer packet and acknowledgement across
lost replies and restoration; prepared main packets and legacy packets preserve
their prior wire identity. Remote retries retain their first interruption packet.
Pause interrupts even from ERROR or TERMINATED. Forced terminal interruption
preserves the Original ERROR, missing-Unit, locked-parent and exact TERMINATED
early returns; the authenticated current-state projection now distinguishes
aggregate parent locks from a Unit's own leave lock and non-enforced expiry.
The local interrupted timer is hidden and stops generating new warnings or
expiry refreshes while its main command is pending. Its displayed/captured
seconds use the immediate Worker-tick boundary rather than rounding up.
The server accepts the authenticated controller's bounded observation; it does
not independently prove that a local Original guard ran.

The real pinned Original Blob Worker passes Pause, ordinary forced Terminate and
ERROR-bypass browser references, including worker termination and URL revocation.
It emits an immediate first STEP; on normal expiry the zero STEP and ENDED each
write a zero TESTLETS_TIMELEFT snapshot. Four production-built Rewrite cases pass
both headless and headed: native/remote Pause and Terminate, a genuinely held
committed Player answer, an independently held application, passage beyond the
original deadline, exact sibling/answer-clock retention, and a lost timer reply.
The preceding immutable frontend `32b73d7b490d` fails at the missing early timer
receipt. Its backend control fails sixteen of 99 current tests, including the
missing timer route export at API-module load; this is not an old-API behavioral
matrix. The existing twenty-nine command/loading groups pass headed and headless,
with fourteen Debug, five route, ten copied-tab/crash, five context, eighteen ERROR
and five actual older-API groups. In total, 123 Rewrite browser groups and three
actual-Source Worker groups pass. New timer and Worker gates are wired into the
root CI workflow; remote CI has not run for this local commit.

All 2,175 unit/frontend tests, 1,352 fresh PostgreSQL tests and 498 fresh
Memory/File/SQLite HTTP tests pass without skips or cancellations. Typecheck and
the production build pass at 469.99 kB under the unchanged 470 kB hard limit.
The fresh image from 905 verified tracked files passes Standard, Demo and
production PostgreSQL profiles, SQLite runtime and 451 API/transaction tests as
node in a read-only container. All 169 image, tested and host frontend files match.
Existing build warnings remain. Earlier qualification failures caught a missing
owned-route registration, an incomplete test-host signal and a transport syntax
error before the final checks; all were repaired. The older buffer browser gate
now permits only the exact separately receipted timer mutation and continues to
compare every other Run field unchanged.

Docker stopped during a subsequent PostgreSQL preparation with an invalid storage
attachment. A normal Desktop restart recovered the daemon; the failed test volume
was absent. All 24 original containers, immutable image IDs, states and mount
fields, 85 volumes, 329 image aliases and protected files were verified unchanged
before resuming. Ten checkpoint image aliases are added. Owned profile/test
containers, volumes and the clean source archive are removed, and preservation
is rechecked after the actual older-API run.

Backend-first rollout is required for the new timer endpoint. The five older-API
groups prove their bounded existing sequential flows, not timed new-command or
complete mixed-version concurrency. Full timer parity remains unproven: zero-tick
interruption/resume, exact Worker scheduling and hidden-window behavior, restored
and legacy concurrency, state-buffer/completion-log timing, and late terminal
lock/navigation completion need further acceptance. Initial loading/controller
replacement, global/cross-document ordering, worker/post-unload behavior, full
visual/property/real-package acceptance, measured performance, remote CI,
release, deployment and production acceptance also remain open. This checkpoint
is local and unpushed.

### Timer interruption Source audit and confirmed buffer gap (2026-10-13)

A new pinned actual-Source fixture executes the complete timer start/finish/
interrupt methods, root timer-event handler, native command handler, forced
deactivation guard, and navigation helper from `ee2ab9ab64bd`. Seven reference
cases prove that Pause interrupts immediately and ordinary forced Terminate
interrupts before its awaited continuation and answer buffers. Their timers
retain the last STEP balance beyond the former expiry deadline. INTERRUPTED
clears the visible timer without setting its balance to zero or emitting a new
TESTLETS_TIMELEFT snapshot. ERROR, missing-current-Unit, locked-immediate-parent
and exact TERMINATED early returns skip that interruption. The actual ticker's
interval fallback runs under a virtual RxJS scheduler; this is not a Worker
execution or full browser lifecycle proof.

A deterministic actual-Source/application-service comparison confirms the next
runtime gap: a five-second timer paused at 2.5 seconds retains three seconds in
the Original while buffers wait until ten seconds. The current Rewrite applies
the delayed native command with zero seconds remaining, although its exact
answer and response clocks survive and the receipt remains idempotent. The audit
therefore does not claim a timer fix. Interruption must reach local countdown and
canonical expiry/navigation before answer drain, retain timer identity and Source
balance, and preserve early-return, overlapping-command, retry and legacy rules.

The seven new reference cases run in the normal frontend-state gate; all 2,148
unit/frontend tests pass fresh without skips or cancellations. Runtime code and
frontend output remain unchanged from verified application `32b73d7b490d`; its
build, 1,335 PostgreSQL, 498 HTTP, 115 browser and 438 inside-image results remain
that checkpoint's evidence and were not rerun for this reference-only audit.
Full timer/Worker timing, visual acceptance, CI, deployment and production proof
remain open. No push occurred.

### Exact terminal early returns and pending commands (2026-10-13)

Application checkpoint `32b73d7b490d` captures the pinned Original's exact
TERMINATED guard at invocation. A later Terminate while an earlier effective
Terminate waits for answer buffers logs once and returns without another buffer
wait, lock, navigation, controller-entry change or Run state effect. Its receipt
does not advance the Run dispatch highwater or finish the earlier pending phase,
so the first effective command still applies. Two calls in the same JavaScript
turn both pass the guard; TERMINATED_PAUSED also passes it and becomes TERMINATED.
The decision is not inferred from the state observed after deactivation.

Native packets preserve that decision across lost replies, retries and journal
restoration. Accepted remote terminal commands persist it with their executed
command JSON; retries with a different decision fail closed. Store invariants
allow only command-log/receipt effects for a no-op. Existing authorization,
immutable scope, access windows, completed-Run rejection and execution-mode log
filtering remain active. A retained older ERROR dialog is presentation after
successful termination; a newer trusted ERROR still interrupts the pending phase.
Pure-log no-ops can bypass a held legacy packet, while state effects preserve
legacy FIFO and prepared packets keep their original bytes. The guard decision
is reported by the authenticated controller; the server does not independently
observe the local controller phase.

All nineteen actual-Source oracle cases and 2,141 unit/frontend tests pass fresh
without skips or cancellations. Fresh PostgreSQL validation passes 1,335 tests;
the Memory/File/SQLite HTTP matrix passes 498. Typecheck and the production build
pass at 469.99 kB under the unchanged 470 kB hard limit, retaining existing warnings.
Twenty-nine command/loading groups pass headed and headless; fourteen Debug,
five route, ten copied-tab/crash, five context, eighteen ERROR and five actual
older-API groups also pass, for 115 positive groups. The preceding immutable
frontend `87be5c23dda1` fails the no-op gate after fourteen groups. Its backend
image fails 26 of 109 current contract/application tests as a negative control.
The first headed trial held an incorrect remote ACK URL; the final fixture holds
the exact acknowledgement route and passes the native lost-reply and remote
held-ACK scenarios. Every final browser run shuts down its owned API.

The fresh image from 900 verified tracked files passes Standard, Demo and
production PostgreSQL profiles, SQLite runtime and 438 API/transaction tests as
node in a read-only container. Its 169 frontend files match the tested frontend
and aligned host output. No schema version changes. The existing backend-first
rollout remains required; the five actual older-API groups prove their bounded
sequential compatibility, not full no-op mixed-version concurrency. All 24 prior
containers, immutable image IDs, states and mount fields, 85 volumes, 315 image
aliases and protected files remain intact. Ten checkpoint image aliases are added;
four other new aliases are retained separately. Owned containers, volumes and
the clean source archive are removed.

Full Original parity and production readiness remain unproven. Timer interruption,
buffer/completion-log timing and terminal lock/navigation completion after later
commands remain open. Initial loading/controller replacement, global/cross-document
ordering, complete legacy mixed-version concurrency, worker/post-unload behavior,
full visual/property/real-package acceptance, measured performance, remote CI,
release, deployment and production acceptance are still required. This checkpoint
is local and unpushed.

### Terminal controller phases before answer buffers (2026-10-13)

Application checkpoint `87be5c23dda1` enters TERMINATED or TERMINATED_PAUSED
after the awaited forced-deactivation continuation and before answer-buffer
preparation. Native Terminate starts in that microtask, not synchronously and
not after answer preparation. A same-turn Pause can therefore precede the
terminal continuation; a command arriving later during the buffer wait gets a
newer dispatch position and controller phase. Remote terminal handlers enter
their phase before the lazy execution import, and memoize their first scoped
observation and dispatch across retries.

The phase does not forge the committed Run, answer clocks, controller entry or
navigation. It suspends new remote reception while already accepted handlers
finish. A later Pause, Resume or trusted Player ERROR survives an old terminal
receipt. Prepared native packets remain exact across retries/restoration;
restored modern or legacy packets do not replay a local phase. Scope replacement
before the native terminal continuation removes that intent before delivery.

The fifteen-case actual-source oracle includes the real forced guard and held
buffers. Four new browser groups prove early native/remote termination, later
Pause/Resume during a genuinely held committed Player answer, exact response
clocks and sibling isolation, and fresh reentry. The preceding immutable frontend
`b3ddb94b9432` fails the early terminal-phase assertion after ten passing groups.
The immutable pre-fix unit control fails nine of 186 cases; all 187 final focused
cases and all 2,105 unit/frontend tests pass without skips or cancellations.

Typecheck and production build pass at 469.99 kB under the unchanged 470 kB
hard limit. Twenty-seven command/loading groups pass headed and headless;
fourteen Debug, five route, ten copied-tab/crash, five context, five actual
older-API and eighteen ERROR groups pass. The first headed fixture cleanup
incorrectly waited for an iframe absent in Pause; the final fixture checks its
presence and awaits action/response together. Existing bundle and CommonJS
warnings remain.

The fresh image from 900 verified tracked files passes Standard, Demo and
production PostgreSQL profiles, SQLite runtime and 388 API/transaction tests
as node in a read-only container. All 169 image, tested and restored host
frontend files match. Backend contracts, stores and schemas are unchanged;
previous PostgreSQL (1,313) and HTTP (498) results are reused only after all
90 backend source hashes match. Those two suites were not rerun. The existing
backend-first rollout boundary remains. All 24 existing containers, immutable
image IDs, states and mount fields, 85 volumes, 305 image aliases and protected
files are preserved; ten aliases are added. Owned containers and the clean
source archive are removed.

Full Original parity and production readiness remain unproven. Exact
already-TERMINATED no-op behavior, timer interruption, buffer/completion-log
timing and terminal lock/navigation completion after later commands remain open.
Initial loading/controller replacement, global/cross-document order, complete
legacy mixed-version concurrency, worker/post-unload behavior, full
visual/property/real-package acceptance, measured performance, remote CI,
release, deployment and production acceptance are also still required.
This checkpoint is local and unpushed.

### Forced terminal Source audit (2026-10-13)

Reference checkpoint `bac6840d74b9` executes the pinned Original's real
`canDeactivateUnit` together with the native root handler and `terminateTest`.
For the native force=true path, deactivation completes immediately and the
terminal phase is entered before `closeAllBuffers` waits. A Pause or Resume
arriving during that buffer wait changes the controller state; buffer completion
does not set the former terminal state again. Two new actual-source cases prove
both orders with held buffers, locking and navigation.

The preceding candidate `4a082496e30e` sampled native terminal state after answer
preparation. Its reference work was incomplete at that point:
the injected held deactivation Subject covered the generic method, not the real
forced native path. Green candidate browser/container checks therefore did not
prove Original parity. Its runtime change and the two unsupported browser
expectations are withdrawn. Candidate source, frontend and diagnostic results
are retained separately; the fixture receipt refinement `bd4f91bcf366` is also
withdrawn with that scenario. No candidate production-readiness claim is made.

The current runtime and browser harness again match accepted application
`438d1cebf5fd` byte for byte. The reference oracle now has fifteen cases, including
the two actual forced-guard cases; two additional native transport cases protect
prepared retry/restoration and unprepared legacy observations. All 2,093
unit/frontend tests pass fresh without skips or cancellations. The unchanged
runtime reuses the accepted build, browser and image evidence after source-hash
verification; those suites were not rerun for the current reference-only change.
All 169 host frontend files are restored to the accepted image's exact bytes.

All 24 existing containers, immutable IDs, states and mount fields, 85 volumes,
305 image aliases and protected files remain intact. Owned candidate container
and source-archive resources are removed; only its ten newly created image
aliases are deleted. Complete local terminal phase timing, the already-TERMINATED
guard, timer/navigation/buffer/log ordering and the other full-parity, CI, rollout,
performance and production acceptance requirements remain open. No push occurred.

### Immediate participant controller phases (2026-10-13)

Application checkpoint `438d1cebf5fd` enters PAUSED for Pause and RUNNING for
Resume/Goto within native invocation or successful remote ACK handling, before
asynchronous preparation, lazy execution imports or application replies. The
remote handler now starts in the ACK callback itself: an extra Promise
microtask previously allowed a later native invocation to overtake it. Shared
dispatch allocation observes the authenticated Run's existing highwater before
lazy execution. Native requests retain their pre-invocation controller
observation; remote terminal commands still sample state after preparation.

The local phase is independent of committed Run and navigation state. A held
application request leaves the server Run and trusted Player unchanged while
the console reports the Source-equivalent phase. Older receipts cannot restore
an earlier local phase. A later trusted Player ERROR interrupts the pending
phase and remains active after that command's late reply; a fresh Resume exits
ERROR immediately while retaining its existing dialog before the application.
Fresh entry and route destruction clear the phase. Restored legacy native
packets retain their prior delivery semantics and do not replay a new local
phase merely because their journal was restored. Startup transition logs stay
deduplicated; exact state-buffer and command-completion log timing remains open.

The pinned Original oracle now executes actual Pause, Resume, errorOut, Goto,
ACK-pipeline and handler-subscription bodies in seven cases. It proves normal
and reversed ACK overlap, Goto's RUNNING phase before invalid-target rejection,
and ERROR remaining after an earlier navigation promise resolves. The preceding
immutable frontend image `8a6110a0b7bc` fails at the held-request PAUSED gate.
A separate negative unit control reproduces remote/native start inversion.
Two additional real-browser groups cover both native and remote Pause followed
by trusted ERROR, the late receipt and a fresh native Resume. Answers, response
clocks and the sibling Run remain exact.

All 2,083 unit/frontend tests pass fresh without skips or cancellations.
Typecheck and production build pass at 469.99 kB under the unchanged 470 kB
hard limit. Twenty-three loading/command groups pass headful and with CI=true;
fourteen Debug, five route, ten copied-tab/crash, five context, five actual
older-API and eighteen ERROR groups also pass. The final isolated production
frontend's 169 files match the fresh image byte for byte. Its build preserves
all 169 frontend files used by the earlier running comparison. Existing bundle
and CommonJS warnings remain.

A fresh image from 900 hash-verified tracked files passes Standard, Demo and
production PostgreSQL profiles, SQLite runtime and 388 transaction/API tests
in the read-only container as node. The previous 1,313 PostgreSQL and 498 HTTP
results are reused only after all 90 backend source hashes match; those suites
were not rerun here. Backend contracts, stores and schemas are unchanged, so
the previous backend-first rollout requirement still applies. All 24 existing
containers, immutable image IDs, states and mount fields, 85 volumes, 295 image
aliases and protected files remain intact; ten image aliases are added. Owned
container and clean archive resources are removed.

Full Original parity and production readiness remain unproven. Exact timer
interruption, asynchronous navigation, native terminal-state sampling after
preparation, state-buffer and command-completion log phases still need Source
comparison. Initial LOADING/controller replacement,
global/cross-document intent order, complete legacy mixed-version concurrency,
post-unload Player effects, worker upgrades, full visual/property/real-package
acceptance, measured performance, remote CI, release, deployment and production
acceptance also remain open. This is a local checkpoint and is not pushed.

### Ordered overlapping controller applications (2026-10-13)

Application checkpoint `bc7b1ad5b6fc` lets independent native requests and
successfully acknowledged remote commands apply concurrently. ACK pacing
remains unchanged. Per-controller dispatch highwaters within each Run reject
late older state effects; changed committed Run snapshots receive a separate
revision under the store lock. Late views and receipts cannot replace a newer
snapshot. Superseded commands retain execution receipts without replaying the
old reload or Starter effect. Debug replies have their own presentation fence.
This establishes overlap and final-state ordering within a controller, not a
global intent order across independent controllers.

Memory, File, SQLite and PostgreSQL persist the optional ordering metadata.
SQLite schema 65 and PostgreSQL schema 59 migrate legacy rows without changing
answers or clocks, with rollback and retry coverage. Forged projections cannot
advance stored revisions or dispatch positions. PostgreSQL Run reads preserve
the distinction between SQL NULL and explicit JSON null so corrupt entry or
dispatch metadata fails atomically. Legacy prepared native packets retain their
exact bytes and FIFO; new version-2 packets share the controller dispatch clock
with remote applications. Backend-first rollout remains required. The older
API gate proves selected context/native compatibility, not a full mixed-version
concurrency rollout.

The pinned Original oracle executes the actual ACK pipeline, component
subscription and Pause/Resume methods for normal and reversed ACK completion.
It proves independent handler starts and completion-order logs. Five additional
browser groups hold real application requests or committed receipts and verify
a later Resume applies, stale state is fenced, and trusted answers, clocks and
siblings stay exact. The immutable preceding frontend image `8d7a246f3cf9`
fails at the held-application assertion. The crash fixture now holds a real
answer receipt to keep an intent unprepared and observes its owned Chromium
storage marker on disk before crashing the browser process. Both crash cases
retain old journals without replay and accept independent fresh commands.

All 2,067 unit/frontend, 1,313 PostgreSQL and 498 Memory/File/SQLite HTTP tests
pass fresh without skips or cancellations. Typecheck and production build
pass at 469.99 kB under the unchanged 470 kB hard limit. Twenty-one loading
and command groups pass headful and with CI=true, alongside fourteen Debug,
five route, ten copied-tab/crash, five context, five actual older-API and all
eighteen ERROR groups. Existing bundle and CommonJS warnings remain.

A fresh image from 900 hash-verified tracked files passes Standard, Demo and
production PostgreSQL profiles, SQLite runtime and 388 transaction/API tests
in the read-only container as node. All 24 preexisting containers, their
immutable image IDs, states and every mount field, 85 volumes, 285 existing
image aliases and protected files are preserved; ten image aliases are added.
Owned container, HTTP-integration, browser-profile and clean archive resources
are removed.

Full Original parity and production readiness remain unproven. In particular,
the Original changes controller status synchronously when a handler starts,
while this checkpoint still waits for application receipts; exact status,
navigation completion and command-executed log phases remain open. Initial
LOADING/controller replacement, global/cross-document intent order, complete
legacy mixed-version concurrency, post-unload Player effects, worker upgrades,
full visual/property/real-package acceptance, measured performance, remote CI,
release, deployment and production acceptance also remain open. This is a
local checkpoint and is not pushed.

### Scoped controller entry and sibling-independent reception (2026-10-12)

Application checkpoint `23af86e57514`, following persistence checkpoint
`ef01973312a5`, stores optional controller entry evidence on each Run. Entry
and termination flips advance its validated revision inside the same atomic
mutation as the selected Run and parent effects. Response-only projections and
replayed receipts preserve the current evidence. The revision orders activity
flips only; it does not establish a global order for every command or answer.
Memory, File, SQLite and PostgreSQL preserve answers and response clocks;
SQL migration failures roll back and can be retried. Legacy rows omit the field.

An already loaded terminated controller can reopen after a fresh authorized
RUNNING or PAUSED view proves a newer active entry for that same Run. Starting
a sibling cannot reopen it. Conversely, ending a sibling cannot close the
selected active Run even when the shared parent becomes signed_in. Server
stream registration, polling and atomic lease renewal follow the selected
entry; closed, expired, completed, foreign and terminated entries remain denied.
Legacy streaming still requires a launched parent. Initial LOADING context
alone still cannot open reception. Terminal reconciliation validates the exact
selected context and rejects missing, malformed or contradictory evidence.
Older replayed termination receipts cannot terminate a newer active entry.

The browser gate holds a terminal read in one actual page, resumes or pauses
through another, closes that page, then verifies the first page alone applies
a new remote command. It also launches and terminates a sibling through its
own accepted commands in the paused case. Its answers and clocks stay exact;
only that owned sibling fixture is restored before later independent groups.
The immutable preceding frontend image `03269a457d80` fails at the new paused
reception assertion. An earlier followup exposed a real server rejection after
a sibling exit; the final API, store and browser tests verify its correction.

All 2,020 unit/frontend, 1,290 PostgreSQL and 498 Memory/File/SQLite HTTP tests
were executed fresh and pass without skips or cancellations. Typecheck and
production build pass at 469.99 kB under the unchanged 470 kB hard limit.
Sixteen loading/command groups pass headful and with CI=true; fourteen Debug,
five route, ten copied-tab, five context and five actual older-API groups pass.
All eighteen ERROR variants pass headful. Existing build warnings remain.

A fresh image from 893 hash-verified tracked files passes Standard, Demo and
production PostgreSQL profiles, SQLite runtime and 371 transaction/API tests
in the read-only container as node. All 24 preexisting containers, immutable
image IDs, states and every mount field, 85 volumes, 275 preexisting image
aliases and protected files are preserved; ten image aliases were added.
Owned runtime, database and archive resources are removed. Backend-first
rollout is required for SQLite schema 64/PostgreSQL schema 58 and the entry
semantics. Older-API tests cover context/native compatibility, not a complete
mixed-version rollout of the new server behavior.

Full Original parity and production readiness remain unproven. Source-equivalent
initial loading and controller replacement, fully overlapping command application,
global/cross-document ordering, post-unload Player effects, worker/mixed-version
rollout, real-package and visual acceptance, measured performance, remote CI,
release, deployment and production acceptance remain open. This checkpoint is
local and not pushed.

### Reception after external controller reentry (2026-10-12)

Application checkpoint `1e839d66419d` restores command reception when a fresh,
authorized full view confirms that another controller resumed the same Run:
the selected Run is running and its parent session is launched. A launched
parent with a still-paused selected Run leaves that controller terminated.
An older running view captured before termination cannot reopen reception.
Answers, response clocks and sibling Runs remain unchanged.

The browser gate uses two actual pages sharing the selected Run. It holds the
first page's terminal runtime read, resumes through the second page, closes
that page and verifies a new remote Pause is applied by the first page alone.
The immutable preceding frontend image `0399c6ad4fda` fails exactly at the new
reception assertion; the negative unit control also reproduces the defect.
Released Goto view handlers now finish within a bounded wait before routes are
removed, followed by two animation frames before checking late-view fencing.
An earlier trial stalled before the new case and is not a negative control.

All 1,978 unit/frontend tests pass without skips or cancellations, including
96 focused context, execution and ERROR tests. Typecheck and production build
pass at 469.99 kB under the unchanged 470 kB hard limit. Fifteen loading/command
groups pass headful and with CI=true; fourteen Debug, five route, ten copied-tab,
five context and five actual older-API groups pass. All eighteen ERROR variants
pass headful. Existing bundle and CommonJS warnings remain.

A fresh image from 892 hash-verified tracked files passes Standard, Demo and
production PostgreSQL profiles, SQLite runtime and 340 transaction/API tests
in the read-only container as node. All 24 existing containers, their immutable
image IDs, states and every mount field, 85 volumes, 255 preexisting image
aliases and protected files are preserved. Owned runtime and archive resources
are removed. Backend, contracts, schemas, manifests and workflow are unchanged
from `56cc13512b02`: its 1,269 PostgreSQL and 498 HTTP tests are reused only after
89 backend source hashes match; those suites were not rerun in this checkpoint.
The prior backend-first rollout requirement still applies.

Full Original parity and production readiness remain unproven. A paused Run
with a launched parent cannot yet distinguish external same-Run Pause reentry
from sibling activation. Per-Run controller state and ordering, source-equivalent
initial loading and controller replacement, fully overlapping application,
post-unload Player effects, mixed-version and worker rollout, real-package and
visual acceptance, measured performance, remote CI, release, deployment and
production acceptance remain open. This checkpoint is local and not pushed.

### Terminal presentation and received-command lifecycle (2026-10-12)

Application checkpoint `56cc13512b02` finishes verified native and remote
terminal effects independently of the later Starter runtime read. New reception
stops immediately while already accepted receipts survive. An accepted Pause,
Resume or Goto of an already loaded controller can reopen reception before its
next Unit view arrives. A lightweight initial LOADING context still cannot do so.
Transient presentation failures retry independently; abort and scope replacement
end recovery, and permanent access or scope failures remain closed.

The backend now reactivates the parent session atomically with an accepted Pause,
Resume or Goto, matching the native command path. Replaying an older application
cannot reactivate it again. Exact answers, response clocks and sibling Runs remain
unchanged. An identical ordinary Run refresh no longer fences a confirmed command;
changed answers, selection or state still do. Terminal reconciliation leaves a
newer local receipt in control of its own Unit refresh.

All 1,975 unit/frontend tests, 1,269 PostgreSQL tests and 498 Memory/File/SQLite
HTTP tests pass without skips or cancellations. Typecheck and production build
pass at 469.99 kB under the unchanged 470 kB hard limit. Fourteen loading/command
groups pass headful and with CI=true; fourteen Debug, five route, ten copied-tab,
five context and five actual older-API groups pass. All eighteen ERROR variants
pass headful. The previous production frontend `6b4ae9daa478` fails the held
terminal-presentation assertion; its backend fails the three new parent
reactivation cases. A separate negative unit control reproduces the identical-view
Goto failure before the fix.

A fresh image from 892 hash-verified tracked files passes Standard, Demo and
production PostgreSQL profiles, SQLite runtime and all 340 transaction/API tests
in the read-only container as node. Existing 24 containers including image IDs,
state and every mount field, 85 volumes, 245 preexisting image aliases and the
protected files are preserved. Owned database, container and archive resources
are removed. Contracts, schemas, manifests and workflow are unchanged; backend
semantics changed. Backend-first rollout remains required. Older-API checks prove
the existing context/native entry contracts, not the new remote parent behavior.

Full Original parity and production readiness remain unproven. Open work includes
initial loading and controller replacement activation, fully overlapping command
application and global Run ordering, post-unload Player delivery and cross-document
effects, complete mixed-version/worker rollout, real-package/visual acceptance and
measured performance. Remote CI, release, deployment and production acceptance
are outstanding. This checkpoint is local and has not been pushed.

### Accepted commands while the next Unit view loads (2026-10-12)

Application checkpoint `6b4ae9daa478` projects a verified remote application
receipt before fetching its next full Unit view. An already accepted Pause,
Resume or Goto therefore does not wait behind an older held view. The transport
validates all six immutable Run scope fields and the actual returned status;
local view generations fence superseded replies. A terminal runtime reply is
re-read when a newer native entry arrived while it was pending, retaining that
entry instead of closing it with the older receipt. Existing ERROR presentation
and its scoped recovery behavior remain covered by the original regression gates.

When the confirmed selection and loaded Unit metadata differ, the old Player is
retired without remounting it. Its existing scoped listener can still process
already queued reports; a new Player waits for the target metadata. Text drafts
and Save remain disabled during that mismatch. Durable response-only delivery
now finishes independently of its subsequent view refresh, so a held refresh
cannot strand a later foreground answer drain or termination. The browser gate
uses actual input in the authenticated former frame while the native Goto receipt
is held, then verifies its final answer, termination and absence of any fabricated
target-Unit answer. It does not claim post-unload message delivery.

The pinned Original `ee2ab9ab64bd` dispatches acknowledged commands without
awaiting the previous component handler. Its fresh LOADING state does not open
reception, whereas an already open endpoint survives LOADING. This checkpoint
addresses the accepted-receipt/view boundary; it does not infer permission to
start a remote channel from a merely running canonical Run.

All 1,952 unit/frontend tests, 1,266 PostgreSQL tests and 498 Memory/File/SQLite
HTTP tests pass without skips or cancellations. Typecheck and production build
pass at 469.99 kB under the unchanged 470 kB initial hard limit. Twelve loading
and command groups pass both headful and with CI=true; fourteen Debug, five
route, ten copied-tab/crash and five context groups also pass. Five compatibility
groups pass against the actual older API image `9b099ecc69ee`. All eighteen ERROR
variants pass headful, including the native theme/viewport cases and accepted
Pause with a held older answer. The preceding production frontend `1fd4aa257c28`
fails the new held-view Pause projection assertion.

A fresh image from 892 hash-verified tracked files passes Standard, Demo and
production PostgreSQL profiles, SQLite runtime and all 337 transaction/API tests
in the read-only container as node. Existing 24 containers, all mount fields,
85 volumes, 235 preexisting image aliases and protected files are preserved;
dependency installation layers are reused. The owned clean archive is removed
after verification. API, schemas, manifests and workflow are unchanged here.
The prior backend-first entry-capability rollout requirement still applies;
older-API checks do not prove new startup-log semantics or full mixed-version rollout.

This is a local checkpoint. Source-equivalent early reception, controller
replacement activation, post-unload Player delivery, cross-document late effects
and global Run ordering remain open. Terminal runtime reconciliation can still
delay following received commands. Actual frontend upgrades, complete visual and
real-package acceptance, measured performance, mixed-version rollout, remote CI,
release, deployment and production proof remain separate work. Full Original
parity and production readiness are not established.

### Initial controller lifecycle buffering (2026-10-12)

Application checkpoint `1fd4aa257c28` records LOADING and the initial ready,
paused or failed state without requiring a loaded Unit, a response or the answer
outbox. The pinned Original loader sets LOADING before awaiting test data and its
root component subscribes controller changes to the independent test-state buffer.
The new browser advertises `controllerLifecycle: browser-v1` on all three entry
paths; the API suppresses only the synthetic entry RUNNING log for this client.
Clients without this field retain their existing entry behavior. Timer, activation,
audit, response and field-clock transactions are unchanged.

The initial log journal binds all six authorized scope fields, retains exact event
IDs and timestamps across retry/reload, uses fresh credentials without storing them,
and leaves other scopes and unrelated storage untouched. Native receipts and the
existing durable Player log path suppress duplicate status entries. After the first
full view, those established paths own later transitions. Non-saving modes do not
persist these logs. No INIT event is fabricated from the Original subscription,
whose pre-test emissions are filtered by its test-state buffer.

All 1,926 unit/frontend tests, 1,266 PostgreSQL tests and 498 Memory/File/SQLite
HTTP tests pass without skips or cancellations. Typecheck and production build
pass; the initial bundle remains 469.99 kB under the unchanged 470 kB hard limit.
Eight loading groups pass both headful and with CI=true, including pre-Unit ERROR
and lost-receipt replay across a real reload with one server entry per original ID.
Fourteen Debug, five route, ten copied-tab/crash and five context-fallback groups
also pass. The prior production frontend fails the new initial-loading assertion
with actual RUNNING / expected LOADING. Five compatibility groups pass against
the actual older API image `9b099ecc69ee`.

A fresh image built from 892 verified tracked files passes Standard, Demo and
production PostgreSQL profiles, SQLite runtime and all 337 transaction/API tests
in the read-only container as node. Existing 24 containers, 85 volumes, image
aliases and protected files are preserved; both dependency installation layers
are reused. The owned clean archive is verified and removed after validation.
Deploy the accepting API before the frontend: old-API compatibility checks cover
existing context/native contracts, not the new startup-log semantics.

This remains a local checkpoint. Remote early-loading reception, replacement
activation and late effects, complete visual/real-package/performance acceptance,
mixed-version rollout, remote CI, release, deployment and production proof remain
open. Full Original parity and production readiness are not established.

### Native LOADING observations and transition logs (2026-10-12)

Native terminal packets now distinguish an authorized controller still in LOADING
from a server Run that is already running. Debug and command observation use the
same loading projection, retaining the existing ERROR and PAUSED precedence.
The prepared packet keeps its exact status, timestamp and delivery identity across
reload and retry. The API accepts LOADING and logs a real transition to RUNNING
for early Resume even when the canonical Run was already running; an already
committed server pause still controls the paused termination variant. Execution
modes retain their response/log filtering. Answers, field clocks, immutable scope,
sibling Runs and the remote queue remain protected by the existing transaction.

A new protected browser case holds both the initial full view and the resumed view,
observes LOADING on the actual HTTP request, checks the single RUNNING transition
and command log, then releases the real Player. It fails against the preceding
production bundle with actual RUNNING / expected LOADING. The final loading gate
passes all seven groups headful and with CI=true, including the full observed
LOADING/PAUSED/RUNNING/ERROR command sequence. The fourteen Debug, five route,
ten copied-tab/crash and five context-fallback groups also pass. All 1,897 local
unit/frontend tests, 1,252 PostgreSQL tests and 498 Memory/File/SQLite HTTP tests
pass without skips or cancellations. Typecheck and the production build pass;
the initial bundle remains 469.99 kB under the unchanged 470 kB hard limit.
Five further browser groups pass with the actual older API image `9b099ecc69ee`,
covering its authenticated context fallback and existing native status values.

Application checkpoint `bfc07884cd23` additionally passes Standard, Demo and
production PostgreSQL container profiles, SQLite runtime and all 326 transaction/API
tests in the read-only image as `node`. Its clean archive contains 892 hash-verified
tracked files without host dependencies or the protected presentation. The image
build reuses both dependency installation layers. Existing 24 containers and all
85 volumes are retained; the final preservation report verifies their mount fields,
existing image tags and protected file hashes separately. This is local evidence;
remote CI, publication, release, deployment and production remain unverified.

Remaining Original controller lifecycle acceptance includes initial buffering,
remote early-loading reception, replacement activation and late effects.
New LOADING packets require
the updated API; deploy the accepting backend before the frontend. Existing
RUNNING/PAUSED/ERROR packets and their receipt fingerprints remain supported.
The older-API context fallback does not prove support for new LOADING packets.
Full visual/property/real-package acceptance, actual frontend upgrades, measured
performance, remote CI, release, deployment and production acceptance remain open.

### Native commands after a browser-process crash (2026-10-12)

The pinned Original `CommandService.commandFromTerminal` creates an ephemeral
command and publishes it directly; it does not persist or restore terminal
commands. The Rewrite therefore does not automatically replay an unproven
pre-crash native intent. Reentry reads the authenticated, explicitly selected
Run. A command already committed on the server remains effective, even if its
receipt was lost. Fresh commands use the new document owner and delivery ID;
unowned journal rows are preserved without authority to execute or delete them.
This policy is separate from recovery of participant answers through the outbox.

The existing required tab gate now also crashes two complete Chromium processes
with `Browser.crash`, relaunches each persistent profile and restores its real
tab through the [browser session API](https://developer.chrome.com/docs/extensions/reference/api/sessions).
One case leaves a prepared terminate-with-lock and an unprepared Goto queued;
the other commits Pause while holding its response. Both verify no `pagehide`,
no old native replay on reentry/online reception, exact selected Run, unchanged
answers and nonempty captured field clocks, expected command log counts, retained
unowned journal bytes, an empty remote command queue and working fresh commands.
The Player must actually receive its restored answer after its asynchronous start.

The browser must persist its open-session preference as well as its DOM store
before the crash. An owned extension with only the `sessions` permission invokes
Chromium's real restore operation; it never injects application storage. Its
profile, including credentials, is removed after each case. In the observed
Chromium path the restored tab does **not** retain the old `sessionStorage`.
Restoration paths that retain that namespace, and interrupted actual frontend
upgrades, remain separate acceptance work; they are not inferred from this gate.

Four new crash groups and the six existing copied-tab groups pass locally both
headful and with `CI=true`; 55 focused native transport/Original-reference tests
also pass. The existing non-optional CI command already invokes the extended gate;
remote CI remains unverified. Application sources, manifests, lockfile, build
configuration and Dockerfile are unchanged from `0e8538d10915`, so its 1,890 tests,
typecheck, production build and image validation are reused predecessor evidence,
not fresh broad executions. Only the regression gate and these acceptance notes
change. No push, release, deployment, full parity or production claim is made.

The preceding storage cleanup removed 70 precisely selected obsolete Testcenter
cache entries (Docker reports 4.29 GB). Existing 24 containers with all mount
fields, 85 volumes, image tags and protected file hashes remain intact. The current
install cache is retained; fresh SQLite/PostgreSQL startup, migration, preflight,
readiness and write/read checks pass. About 10.4 GB was free after that cleanup.
Sustained cache growth remains an operational concern for later changed manifests.

### Native command ownership across copied tabs (2026-10-12)

A copied active tab no longer adopts or removes the originating tab's native
command journal. The document receives a fresh owner; a normal reload retains
its own owner only through an exact departing handoff. Real opener copies,
removed openers, clone destruction/reentry/close, source retry and a copied tab
reloaded before app bootstrap pass six production-bundle groups. The first
browser reproduction failed before the fix on the shared owner. Normal cases
use the real service worker; the explicitly interrupted uncached-bootstrap case
bypasses it for that download.

Checkpoint `0e8538d10915` passes 1,890 local tests, typecheck, production build,
41 console/browser groups, all three PostgreSQL container profiles, SQLite
runtime and 320 read-only image checks as `node`. Backend integration and the
broader 147 browser cases remain verified predecessor evidence. The 891-file
archive was verified and removed, all existing containers/mounts/volumes and
protected hashes remain intact, and about 4.6 GB is free. Remote CI and production
remain unverified. See [the scope and remaining acceptance in PARITY](./PARITY.md#native-command-ownership-in-copied-browser-tabs-2026-10-12).
Without a verified departing handoff, legacy/crash intents are retained without
automatic execution; their complete recovery/upgrade policy is still open.
Full Original lifecycle, remote/activation races, visual/property/package,
performance and production acceptance remain required.


### Native commands after controller destruction (2026-10-12)

An actual Angular route exit now cancels pending native effect intents, including
a retry and an intent waiting for trusted answers to drain. A full document reload
still restores the exact prepared delivery, without repeating a server effect
after a lost receipt. A native Pause committed to the former Run remains there;
its late response cannot replace another Booklet's Player or saved answers.
The five-group production-bundle browser gate checks real Back/Forward destruction
and reentry with the same document, two saved Booklets, entry selection and clocks.
It failed before the fix on the retained resume journal and now passes.

Checkpoint `98b182dddcd4` passes 1,883 local tests, typecheck, production build and
35 console/browser groups, including the actual prior API image. All three
PostgreSQL container profiles, SQLite runtime and 320 read-only image checks as
`node` pass. The existing containers/mounts/volumes and protected hashes remain
unchanged. The 890-file archive was verified and removed; about 6.4 GB is free.
Backend integration and the broader 147 browser cases are verified predecessor
evidence, not fresh executions. The new gate is required by the console CI job;
remote CI and production remain unverified. See [the scope and remaining
acceptance in PARITY](./PARITY.md#native-command-lifetime-on-an-actual-route-exit-2026-10-12).
Cloned-tab ownership, wider remote/activation races and full Original lifecycle,
visual/property/package and production acceptance still remain open.


### Reentry across the controller-context API addition (2026-10-12)

Only a missing-route 404 now uses the older authenticated current-state route.
Explicit Run and Session selection remain intact; access rejection, missing Runs
and malformed responses stay closed. Both metadata and full/eager views validate
all six scope fields, while session-only legacy links use the server's authorized
selection. An older API supplies console authority only with the real full-state
reply, without fabricated Unit data.

All 1,881 local tests, typecheck and the 469.99 kB production build pass under the
unchanged hard limit. Five contract groups and five actual prior-API-image groups
verify two saved Booklets, exact reentry, retained answers/clocks, legacy selection
and rejection boundaries. Six loading and fourteen Debug/native groups also pass.
The unchanged backend retains checkpoint `7fdff889a3bd`'s PostgreSQL/HTTP/compatibility
proof. Full Original lifecycle/visual/property/package acceptance, remaining rolling
versions and production acceptance remain open. See [the current scope and proof
boundaries in PARITY](./PARITY.md#participant-reentry-with-an-older-api-2026-10-12).

Application checkpoint `94a7d5b42f1a` also passed all 147 existing browser cases,
all three PostgreSQL container profiles, SQLite runtime and all 320 read-only image
checks as `node`. The archive's 889 file hashes were verified and the archive removed.
All 24 existing containers, all mount fields, 85 volumes and protected hashes are
preserved, with about 8.01 GB free. The proof contains 304 verified evidence files;
remote CI and production confirmation remain unverified.

### Console and Debug during initial loading (2026-10-12)

All five terminal methods now bind before the first complete Unit view, matching
the pinned Original command/root initialization order. Dispatch and Debug still
require a server-authorized selected Run. A read-only participant controller-context
route supports a new document whose full Unit request fails, without inventing
Unit data or responses. Native receipts update early LOADING/PAUSED/ERROR display;
older full-view replies cannot restore a paused or terminated frame. Resume recovers
the selected Run after an initial load error, and the exact entry URL is written
before loading. Trusted old-Unit reports drain without creating a next-Unit answer.
Original surface styles now load before the Player and hide technical summaries
while the existing loading/paused views are displayed.

All 1,874 local tests, 1,244 PostgreSQL tests, 498 HTTP and 61 compatibility checks,
typecheck and the 469.99 kB production build pass under the unchanged hard limit.
Six loading/error Chromium groups, fourteen existing Debug/native groups and
all 147 existing browser regression cases pass;
the CI matrix includes both gates, with remote execution unverified. Full Original
visual/property/package and lifecycle acceptance, LOADING wire/log observation,
old-backend compatibility, route/tab ownership, measured performance and production
rollout remain open. See [the current contract and proof boundaries in PARITY](./PARITY.md#participant-console-before-the-first-unit-view-2026-10-12).

Application checkpoint `7fdff889a3bd` also passed all three PostgreSQL container
profiles, SQLite runtime and all 320 read-only image checks as `node`. Its clean
archive's 888 tracked files were hash-verified and the archive removed. The 24
existing containers, all mount fields, 85 volumes, protected presentation and host
TypeScript package remain intact, with about 8.95 GB free. The local proof preserves
307 verified evidence files; remote CI and production acceptance remain unverified.

### Native Resume accessibility (2026-10-12)

Native Resume now applies the pinned UnitActivateGuard next-accessible-Unit
fallback, retains all code/leave/Unit locks and answers, and starts only the
selected timer. The Source code-first exception and no-later-Unit fallback remain
intact; a missing current Unit does not fabricate a first-Unit selection.
All 1,852 local tests, 1,239 PostgreSQL tests, typecheck, the 469.99 kB production
build and fourteen protected Chromium/SQLite groups passed. The added browser
case verifies the real paused Player, authenticated redirect, exact saved answers
and clocks, retained Unit lock and reentry. Original resume/navigation/guard
methods execute directly in pinned reference tests. Checkpoint `9b099ecc69ee`
also passed all three PostgreSQL container profiles, SQLite runtime and 316
checks in the read-only image as `node`; the clean archive's 886 file hashes
were verified and the archive removed. All 24 existing containers, every mount
field, 85 volumes and protected hashes remain intact, with about 9.52 GB free.
Full controller lifetime,
early ERROR, live visual/property/package acceptance, performance and production
rollout remain open. See [the current contract and evidence in PARITY](./PARITY.md#native-resume-entry-guard-2026-10-12).

### Native console workflow (2026-10-12)

All five Source console methods are now provided in the selected participant
controller. Pause, Resume, Terminate and Goto use their own authenticated
participant endpoint and stable transaction receipt, without a monitor queue or
ACK. The root handler's immediate-parent unlocks, exact aliases/sequence, minute
restoration, positive balance retention and lowercase termination-lock arguments
are preserved. The browser drains trusted captures, validates scope and receipt,
orders tab-owned intents, restores them on reload and fences replaced controllers.
ERROR recovery replaces the errored frame and clears its presentation.

Controller/Player-only logs now travel as explicit log-only packets, without
creating an empty answer or response clock. Foreground/worker/reload preserve the
marker, and older workers do not accept their version-2 message/entry as answers.
Legacy answer packets retain their former version and identity. All 1,839 local
tests, 1,231 PostgreSQL tests, typecheck, 469.99 kB production build and thirteen
Chromium/SQLite groups passed. Checkpoint `6253dd500773` additionally passed
all 147 existing browser cases, 498 HTTP and 61 compatibility checks, three
PostgreSQL container profiles, SQLite runtime and 310 read-only image checks as
`node`. Its clean archive's 886 files were verified and the archive removed.
All 24 existing containers, every mount field, 85 volumes and the protected
presentation retain their identities/hashes; about 10.36 GB of host space remains.

The Native Resume redirect gap recorded at checkpoint `6253dd500773` is resolved
by the newer Native Resume accessibility checkpoint above.
Full Original live/property/visual/package and
controller-lifetime acceptance, performance and production rollout remain open.
See [the current contract and evidence in PARITY](./PARITY.md#native-participant-console-commands-and-log-only-delivery-2026-10-12).

### Participant Debug lock origins (2026-10-12)

Testlet details now match pinned Source own/ancestor lock priorities, show all
four lock fields and their effective `BY ... THROUGH ...` cause, and activate
code/time badges only at that cause's origin. The Source root `[0]`, inherited
block label/timer ID and Unit leave-lock metadata are also shown. Hidden access
codes remain redacted; the existing gate metadata keeps lock diagnostics
accurate. Local projection and countdown updates perform no persistence.

All 1,773 local unit/frontend tests, typecheck, 469.96 kB production build and
nine Chromium/SQLite Debug groups passed. Twenty-eight new checks execute the
pinned Original lock methods, while the actual Booklet proves own and inherited
code-lock origins. The unchanged core retains its prior 1,199-test PostgreSQL
proof; this frontend-only change does not repeat that suite.
Checkpoint `fbb5f1ea4eed` additionally passed all three PostgreSQL container
profiles, SQLite runtime and 286 read-only image checks as `node`. Its clean
archive's 879 tracked files were verified and the archive safely removed.
All 24 existing containers, every mount field, 85 volumes and the protected
presentation remain unchanged; about 11.6 GB of host space remains. Full visual and
property parity, native console commands, early ERROR, real-package/controller
transitions, performance and production acceptance remain open. See
[the current scope and evidence in PARITY](./PARITY.md#effective-participant-debug-testlet-locks-2026-10-12).

### Participant Debug and hidden codes (2026-10-12)

The selected-run Debug pane now implements all ten Source windows, explicit
native/remote Debug commands, development-only preference restoration and
offline local-response projection. Its initial checkpoint is `236cec382fba`;
remaining visual and package acceptance is itemized below.

Diagnostic GET/POST now retain the participant execution-mode boundary for
Testlet access codes. Hot-return, hot-restart, simulation and the legacy default
receive an empty code string with the original prompt and gate metadata; demo,
review and trial retain the authored code. Only the cloned transport snapshot
is changed. This deliberately hardens Original raw Debug property visibility.
All 1,745 unit/frontend and 1,199 PostgreSQL tests passed, with typecheck,
469.96 kB production build and all nine Chromium/SQLite Debug scenario groups.
The expanded Booklet still displays its active code gate without the secret.
Application checkpoint `02bce022a44a` additionally passed all three PostgreSQL
container profiles, SQLite runtime and 286 checks in its read-only image as
`node`, built from a clean, hash-verified Git archive. The 24 existing
containers, all mount fields, 85 volumes and the protected presentation remain
unchanged. Owned resources and the build archive were removed safely.
Full parity and production readiness remain open. See
[the current scope and evidence in PARITY](./PARITY.md#participant-debug-and-access-code-visibility-2026-10-12).

### Atomic fresh participant Run initialization (2026-10-11)

Local application checkpoint `613e2323e17c` resolves the reserved-Run/initial-log
gap. Actual fresh launch/resume creates the Run, activates its current parent and
persists initial timer/state logs and audit together in all four stores. Failed
writes leave no partial Run or artifacts; retry creates one complete Run and
concurrent losers reuse it. Timers start inside the parent reservation lock.
Current closure, expiry, code and execution mode are checked there. Existing
Runs remain unchanged; historically incomplete initial artifacts are not repaired.
SQLite/PostgreSQL schemas remain 63/57; File proof covers one repository owner.

Local validation passed 1,587 unit/state, 1,157 PostgreSQL, 498 HTTP and 61
compatibility tests without skips, all 147 browser reference/state cases, three
PostgreSQL container variants, SQLite runtime and 254 read-only image tests as
node. The web build remains 469.88 kB under the unchanged 470 kB hard gate.
All 24 existing containers, every mount field, 85 volumes and the protected
presentation retain their identities/hashes; the owned archive was removed safely.

Browser harness checkpoint `66e1389d1171` closes an observation race where the
route held the real focus-bearing packet before the request waiter was registered.
The check waits for its actual failure and subscribes before connectivity changes;
exact delivery/answer/reload assertions and timeouts remain intact. Eight cases
passed three consecutive runs, including four clock-skew cases each. The image
was built from the application checkpoint before this test-script-only correction.
Failed-attempt logs, route/client diagnosis and screenshots remain in the evidence.

Full parity and production readiness remain open. Next implement the pinned
Original root debug command and persistent pane, then audit command lifetime
across replacement controllers. Remaining Source acceptance, mixed-version
rollout, remote CI, release and deployment proof remain open. Nothing was pushed
or deployed. Previous sections below preserve historical checkpoint evidence.
See [the evidence and limits in PARITY](./PARITY.md#atomic-fresh-participant-run-initialization-2026-10-11).

### Scoped Player clocks and response-only deliveries (2026-10-11)

Local application checkpoint `e6587f2e626c` resolves the stored-clock bootstrap
and delayed-answer control gaps. The selected Run supplies immutable Unit clock
snapshots to active and retired Player frames; fresh captures advance beyond a
legacy server clock without carrying the opaque barrier in the packet. Foreground
and worker outbox requests explicitly use response-only transport, preserving
current navigation, status, pause source and timer state. Existing legacy receipts
remain acknowledgeable, and non-saving modes retain no answer data or clocks.

Validation passed 1,549 unit/state, 1,104 PostgreSQL, 498 HTTP and 61 compatibility
tests without skips, all 147 browser reference/state cases including four actual
clock-skew cases, three PostgreSQL container variants, SQLite runtime and 216
read-only image tests as node. The web build remains 469.88 kB under the unchanged
470 kB gate. All 24 existing containers, mount configurations, 85 volumes and the
protected presentation remain intact. The owned build archive was removed safely.

Production readiness remains open. The actual launch service leaves a reserved
Run when its first initial-log write fails; retry does not recover those logs.
Combine fresh reservation, parent activation, initial logs and audit in one store
write. Remaining Source acceptance, root command lifetime/debug, mixed-version
rollout and remote CI/release/deployment proof also remain open.
See [the evidence and limits in PARITY](./PARITY.md#scoped-player-clocks-and-response-only-deliveries-2026-10-11).

### Durable participant deliveries and response field ordering (2026-10-11)

Local application checkpoint `8ae5c5253e10` adds immutable scoped delivery receipts
and independently ordered response fields in all four stores. SQLite/PostgreSQL
schemas are now 63/57. Repeated accepted deliveries cannot replay older answers
or controls; new captured answer fields use strictly newer timestamps and retain
absent values. Foreground and worker retries preserve their capture metadata.

Validation passed 1,522 unit/state, 1,078 PostgreSQL, 498 HTTP and 61 compatibility
tests, all 143 browser reference/state cases, and the clean-archive PostgreSQL/
SQLite runtime checks plus 196 read-only image tests as node. The web build stays
469.88 kB under the unchanged 470 kB gate. All 24 existing containers, 85 volumes,
mount configurations and the protected presentation remain intact; build cache
cleanup freed 2.861 GB and container starts completed successfully.

Production readiness remains open: bootstrap Player clocks from stored scoped
clocks for legacy answers, keep first delayed answer deliveries from resetting
controls, and combine fresh Run creation with its initial artifacts. Remaining
Source acceptance and remote CI/release/deployment proof also remain open.
See [the full evidence and limits in PARITY](./PARITY.md#durable-participant-deliveries-and-response-field-ordering-2026-10-11).

### Atomic runtime transitions and monitor intent persistence (2026-10-11)

Local application checkpoint `225f0ff29ed7` extends the transaction used for
progress and timers to adaptive choices, code gates, direct resume, existing-Run
session reentry, starter preparation/return, completion and monitor commands.
The remaining ten application runtime `saveTestRun` calls have been removed.
Decisions use the current scoped Run and parent inside the store write boundary;
Run changes, test logs, activity and completion/activation parent status commit
together. Existing-Run reentry now activates its controller in that same write.

Monitor command intent is part of the projection. Deferred Source commands queue
the intent and issued-command audit together; native controls commit their Run
effect, queued intent and audit together. Memory remains synchronous, File
publishes detached maps only after persistence, SQLite uses BEGIN IMMEDIATE and
PostgreSQL locks parent before Run on one client. Schema versions remain 62/56.
File evidence covers one repository owner; SQL evidence also exercises independent
writers. Mode behavior, monitor-pause protection, transient non-saving packets,
starter confirmation ordering and the non-saving completion response are retained.

The required mutation suite now has 114 tests across Memory/File/SQLite and 158
when PostgreSQL is enabled. New cases interleave answers, locks, access expiry,
current-unit/status changes and sibling completion after the initial read; fault
injection verifies complete rollback after Run, log, command, audit and final
parent writes. Local validation passed 1,431 unit/state tests, 982 full PostgreSQL
tests and 166 HTTP tests per Memory/File/SQLite store (498 total), without skips.
The production web build passes at 469.88 kB under the existing 470 kB hard gate;
the 450 kB warning and four style warnings remain.

A clean archive of the application commit passed PostgreSQL standard/demo/
production-boundary and SQLite runtime checks, plus 125 tests inside the read-only
image `testcenter-rewrite-app:completeness-225f0ff29ed7` as user node. Its image ID
is `sha256:b8b059760d06158cb36beddd6dc2cdab6656a501859b0cddcb12b65851e80f09`.
All 24 existing containers, 85 volumes and their mount configurations
were preserved; the owned archive was removed after unlinking its node_modules
symlink. The protected presentation still hashes to
`7a2826bc8f1a9ffb92519a90f3784a6b1dbc27000892b21068a55a637a958a8a`.

Chromium passed two received-termination/error/reentry variants, four real
input/offline/retry/reload variants, 36 player-exit reference states and all 57
completeness/pixel-reference cases, plus all 44 paused-exit reference states
(143 browser state cases total).
An initial mobile retry request timeout and a six-border-pixel, one-color-level
capture difference were retained as failed-attempt evidence; the isolated reruns
passed without changing application code or Source reference fixtures.

Full parity and production readiness remain open. An owned Memory probe confirms
that replaying a previously accepted older delivery overwrites a newer same-unit
answer. Pinned Source `ee2ab9ab64bd91209ef8534bbe6005838024e46d` rejects older
response timestamps in TestDAO; durable scoped delivery receipts and response
version ordering are the next priority. Fresh Run creation/reservation plus its
initial artifacts still needs a combined boundary. Other Source acceptance,
command lifetime/debug and remote release/deployment proof remain outstanding.
The live GitHub CI snapshot is green for older commit `143dc3e73ae8`; it does not
cover this local application checkpoint.

### Atomic participant progress and timer persistence (2026-10-11)

Local application checkpoint `7037c86870cc` adds `mutateParticipantRun` to all
four stores. Progress merges answers and shared parameters, evaluates navigation,
locks and monitor-pause state, and projects timers from the current scoped Run
inside the storage write boundary. The resulting Run, test logs, activity and
any timer-completion parent status commit together. The projection performs no
asynchronous repository access. Memory projects synchronously, File publishes
its detached maps after persistence, SQLite uses BEGIN IMMEDIATE, and PostgreSQL
locks the parent before the Run on one client. Schema versions remain 62/56.

Current-state reads now calculate missing booklet-state snapshots inside the
same timer transaction. Shared timer persistence also reads the current Run
rather than writing the caller's old snapshot. Existing immutable Run identity
and parent fields are preserved; no-op projections do not write. Source behavior
was checked against the pinned controller/DAO at
`ee2ab9ab64bd91209ef8534bbe6005838024e46d`. That DAO explicitly notes a whole-test
laststate race; the reference establishes behavior, not an atomicity guarantee.

New required tests reproduce two independent service queues saving different
answers, a monitor pause applied after a progress request's initial read,
concurrent lock/expiry changes, and a current-state query overlapping a save.
They check timer completion against current sibling Runs, scope denials,
immutable fields and detached results. File persistence failure leaves cached
state unchanged; SQL failures after Run/log writes or during the completion
parent update roll back every artifact. A separate SQLite worker and independent
PostgreSQL connections prove that a blocked mutation reads the writer's committed
answer and preserves it. The new suite runs in both required local/PG gates.

All 1,345 unit/state cases (80 + 177 + 520 + 568), 863 complete real-PostgreSQL
integration cases and 166 HTTP integration cases each for Memory, File and
SQLite pass without failures or skips. Core and production web builds pass at
469.88 kB under the unchanged 470 kB error budget; existing bundle/style warnings
remain. Both received-termination/ERROR-dialog/re-entry browser cases pass, as do
four native offline/save/retry/reload cases in the Original and rewrite shells
at widths 1280/390, preserving exact answers, the selected Run and foreign-session
isolation. These are rewrite-host checks, not a new live Original backend run.

Five clean-image checks pass: PostgreSQL standard/demo/production boundaries,
SQLite startup, and 39 command-API/Run-mutation cases inside the read-only image.
Image `testcenter-rewrite-app:completeness-7037c86870cc` runs as node and has ID
`sha256:4b058272e5456a2746faebd34854d10f9d81d97fec2a62431a18ad1de597abcf`.
The tracked build archive is removed. All 24 pre-existing container IDs and
85 volumes, host dependencies and the protected presentation are preserved.
This checkpoint is local and unpushed.

Full parity and production readiness remain unproven. Other whole-Run mutation
paths still need the same atomic treatment, including resume, starter return,
completion and direct monitor operations. Delivery replay/order and ACKs arriving
after replacement-controller activation, the Source debug command, the full
Original acceptance corpus, remote CI/release/deployment and live production
proof remain open. The preceding checkpoints below are historical evidence.

### Atomic participant controller activation (2026-10-11)

Local application checkpoint `73b60bf81b8b` replaces the preceding checkpoint's
separate session read/write during launch and re-entry with
`activateParticipantController`. The repository reads the current parent and
selected Run inside its write boundary, validates tenant/workspace/session/Run
and content-release scope, checks closed/expired parent and locked/completed
Run states, and changes only the parent's status. It preserves all current
session fields and every Run field. A repeated eligible activation is read-only.
Memory uses a synchronous decision, File publishes its detached session map only
after persistence, SQLite uses BEGIN IMMEDIATE, and PostgreSQL locks the parent
before the Run on the same client. Schema versions remain 62/56.

New required tests cover scope denials, expiry and pause semantics, detached and
idempotent results, File persistence failure/cache recovery, and SQL rollback.
Independent SQLite workers hold writes while activation starts; separate
PostgreSQL pools demonstrably wait on parent/Run row locks. A concurrent close
or lock survives and activation rejects it without restoring a stale parent.
These tests run in the local unit gate and full PostgreSQL gate.

All 1,317 local unit/state tests (80 + 177 + 492 + 568) and the complete
824-case PostgreSQL integration pass without skips. Core and production web
builds pass at 469.88 kB under the unchanged 470 kB error budget. Both regular
and replacement-dialog browser termination/re-entry cases pass again, including
the same saved Run, restored SSE and unapplied acknowledged follow-up command.
The earlier eight command-overlap browser cases belong to checkpoint
`876192634bf8` below. Five new clean-image checks pass, including 11 real command
API tests inside the read-only image. Image
`testcenter-rewrite-app:completeness-73b60bf81b8b` has USER node and ID
`sha256:0ba767ebcd2dde32aeb3569c85047344f3ed4bd291854c44bf0df3c441a223ab`.
The tracked build archive is removed. All 24 original container IDs, 85 volumes,
the host dependencies and protected presentation digest are preserved. About
9.45 GiB are free; the initial warning and four style warnings remain.

Full parity and production readiness remain open: protect stale progress and
current-state writes across API servers; resolve cross-controller late ACK and
integrated multi-command ordering; implement debug; complete the Original corpus
and full-page/device acceptance. This operation protects controller activation,
not the entire launch/resume/logging transaction. Remote CI, release, deployment
and live production remain unverified. These checkpoints are local and unpushed.

### Historical command delivery after controller termination (2026-10-11, 876192634bf8)

Local application checkpoint `876192634bf8` corrects the preceding checkpoint's
redelivery of acknowledged deferred commands. Pinned Source
`ee2ab9ab64bd91209ef8534bbe6005838024e46d` filters `executed = false` in
`TestDAO::getCommands`; its ACK sets that flag before browser dispatch. Memory,
File, SQLite and PostgreSQL now deliver only commands with a null ACK. The
receiver rejects previously acknowledged records. An application failure can
still retry its accepted receipt within the current controller, and application
receipts remain durable and idempotent. A new controller does not consume old
ACKed intents or invent an execution timestamp for a discarded effect.
SQLite schema 62 and PostgreSQL schema 56 restore the corresponding partial
index without rewriting answers or command history. Both fresh stores and
failed/retried upgrades from the preceding index versions are covered.

Real browser verification also found and fixed two re-entry defects. A terminated
controller now records `view=starter` in its synchronized Router address,
so the retained error dialog's reload remains on the starter. Re-entering an
existing Run activates the current participant session, allowing its SSE stream
to reopen; launch rereads the parent before changing its status. The replacement
error dialog now has an opaque white background when its optional surface
variable is absent, with actual computed styles and a screenshot inspected.

Eight actual Chromium cases pass with regular and replacement error dialogs:
received pause/resume/terminate after ERROR, and an unreceived terminate that
stays inert until explicit reload. Received termination logs ERROR → TERMINATED,
retains the dialog over the starter, preserves the exact saved response and last
unit, and permits explicit re-entry into the same Run with a live connection.
A second resume whose ACK was held behind termination remains acknowledged but
unapplied after re-entry; it is absent from delivery and command-executed logs.
These browser cases are part of the required runtime-error smoke runner.

All 1,298 local unit/state tests (80 + 177 + 473 + 568), the complete 797-case
PostgreSQL integration and core/production web builds pass without skips.
The initial web bundle is 469.88 kB below the unchanged 470 kB error budget.
Five clean-image checks pass: PostgreSQL standard/demo/production boundaries,
SQLite startup, and 11 command API tests within the read-only image, including
the restored SSE connection. Image
`testcenter-rewrite-app:completeness-876192634bf8` has USER node, schema 62/56
and ID `sha256:6aa149bb68377a37c40501cc07b7268783eeb0e57faa90ce10372ac3eefa190c`.
The tracked build archive is removed safely; the protected presentation, all
24 original container IDs and 85 volume names are intact. About 10.07 GiB are
free. The 450 kB warning and four style warnings remain.

Full parity and production readiness remain open. Next verify ACK arrivals after
a replacement controller is already open and multiple simultaneous command
completions in real Source/Native browsers; protect session activation and
progress/current-state writes across API servers; implement debug; complete the
Original acceptance corpus and full-page/device checks. Remote CI, release,
deployment and live production are unverified. This checkpoint is local and has
not been pushed. The preceding sections document their historical revisions.

### Historical deferred participant command dispatch (2026-10-11, db4ecc666bc8)

Local application checkpoint `db4ecc666bc8` connects the atomic storage
foundation to the authenticated participant application API and real browser.
Issuing or acknowledging pause, resume, goto, complete or complete_and_lock
stores an intent/receipt without applying its Run, timer or controller effect.
Successful dispatch uses the stored command and latest Run under the repository
lock. The API ignores forged command type, target and execution timestamps.
The deep contract route is
`POST /api/v1/participant/sessions/:participantSessionId/commands/:commandId/application`.
Legacy intents retain their already-applied effects; their application is a
receipt-only operation. Direct Native lock/navigation/time extensions retain
existing behavior. The Source debug command is still missing.

New deferred commands remain pending after ACK until their execution receipt is
stored. SQLite schema 61 and PostgreSQL schema 55 update that pending index.
The receiver preserves ACK completion order through asynchronous application,
retries transient failures before its successor, and aborts view projection on
route cleanup. Application replies must match the exact accepted receipt and
Run/session scope. A duplicate receipt can restore an interrupted local view
without replaying its durable effect.

Source termination is resumable: complete returns to the starter, preserves the
last unit and saved answers, interrupts timers, and leaves the session signed_in;
complete_and_lock additionally locks the Run. The explicit participant complete
operation remains final. SSE refuses a session at the starter. Starter cleanup
also clears the serialized state fallback so rendering cannot resurrect the old
Run. Legacy optional assignment identities survive command normalization under
the immutable parent guard. A terminated resumable Run still blocks release
activation until explicitly completed.

Current checks pass core compilation and the production web build (469.88 kB,
unchanged 470 kB error limit), 1293 unit/state tests (80+177+469+567) and 791 full
PostgreSQL integration tests, with no failures or skips. Eight actual Chromium
cases pass with normal and fallback dialogs: received pause/resume after ERROR,
and unreceived pause/terminate after ERROR followed by explicit reload. The
received cases verify Source ERROR-to-PAUSED/RUNNING controller log order;
unreceived intents stay inert. Terminal reload/re-entry resumes the same saved
Run. All eight owned API processes stop and every stored browser receipt has a
server execution timestamp and execution sequence 1. The receiver/API order
checks do not substitute for a multi-command browser comparison.

Five clean-image checks pass: PostgreSQL standard/demo/production-secret
boundaries, SQLite startup, and 11 real command API tests inside the read-only
image. Image `testcenter-rewrite-app:completeness-db4ecc666bc8` uses USER node,
SQLite schema 61 and PostgreSQL schema 55; its ID is
`sha256:83f2023bb2a8db2d1525b5301c1a5503d94b9f5a33a5de184eb29c67875cc4b9`.
The tracked build archive is removed without following the host dependency
symlink. All 24 pre-existing container IDs, 85 volumes and the protected
presentation digest remain unchanged. The recovered host has about 10 GiB free.
The 450 kB initial warning and four style warnings remain unresolved.

Full parity and production acceptance remain open. Next, retire ACKed but
unexecuted intents when the Source root terminates, including late ACK/re-entry
races; prove queued terminate with its retained ERROR dialog and real browser
multi-ACK order; protect stale progress/current-state writes across API servers;
implement debug; finish the Original acceptance corpus, full-page/device and
fallback visual checks. Remote CI, release, deployment and production proof are
unverified. This checkpoint is local and has not been pushed.


### Historical atomic application foundation (2026-10-11, 6ef2057f7fb5)

Application checkpoint `6ef2057f7fb5` commits the storage infrastructure below.
The repository now commits an acknowledged command's Run effect, execution
receipt, participant logs, workspace activity and optional session status in
one operation. Memory uses a synchronous detached transform, File publishes
its cache only after persistence, SQLite uses BEGIN IMMEDIATE and PostgreSQL
locks the parent session before the Run. SQLite schema 60 and PostgreSQL schema
54 add a unique execution-order index. Older ACK records remain valid.

The first application receives a server execution timestamp and a per-Run
execution sequence. Retries do not execute the transform again or replace newer
saved answers. The transform reads the latest stored Run under the same lock;
immutable parent fields and foreign or duplicate log identities are rejected.
Failures in any associated SQL write roll back the entire operation. File
persistence failure leaves both cached and durable state unchanged for retry.

Fresh checks pass typecheck, the production web build (469.85 kB, unchanged
470 kB error budget), all 1269 unit/state checks and 787 full PostgreSQL
integration checks. The 56 targeted local command checks include real SQLite
writer processes, restart/retry, injected write failures and failed/retried
legacy migrations. PostgreSQL additionally covers independent pools and the
same transactional failures. Owned PostgreSQL resources are removed; exact
inventory retains 24 pre-existing containers and 85 volumes.

All four clean-image checks pass for this application commit: PostgreSQL
standard/demo/production-secret boundaries on schema 54 and SQLite on schema 60.
Image `testcenter-rewrite-app:completeness-6ef2057f7fb5` has USER node and ID
`sha256:4be48633796c9968efc0fda8ed21f91680b4fc97619d37d773fb2d762ef82675`.
The tracked build archive is removed after the checks, with the protected
presentation excluded and all pre-existing container and volume IDs preserved.

Four fresh browser checks at the same application commit also pass received
pause/resume with native and fallback dialogs, actual iframe lifecycle and saved
answers retained; all four owned API processes shut down. These verify the
existing transport and do not prove deferred command application or Source
PAUSED/ERROR log-order parity.

Pinned Source backend revision `ee2ab9ab64bd91209ef8534bbe6005838024e46d`
confirms the separation: MonitorController.putCommand stores and broadcasts;
TestDAO.setCommandExecuted only updates the receipt flag. Neither operation
applies a controller effect. Native must apply it following successful browser
dispatch, rather than treating the transport ACK as the effect itself.

This is repository infrastructure. Monitor issuance and the participant browser
still use the previous immediate canonical effect, so the confirmed PAUSED/ERROR
log-order mismatch remains open. Storage order tests use pinned Source fixtures
and do not prove integrated browser effect order. The next step is to connect
application through the participant API and move command effects to successful
browser dispatch, including terminal save drain. Cross-server stale progress
writes, complete Original acceptance, devices, remote CI, release and deployment
remain unproven. This checkpoint is local and has not been pushed.

### Scoped command transport and same-status resume (2026-10-11)

Application checkpoint `357eba0ffd84` connects nonterminal monitor commands
with independent IDs to authenticated selected-Run command listing and ACK
routes. SSE carries pending records; polling uses the same scoped collection.
The server derives tenant/workspace ownership and the first receipt timestamp.
An ACK changes receipt metadata without changing the Run or its saved answers.

The browser validates records and receipts before dispatch, suppresses duplicate
ACKs, spaces ACK starts by one second and dispatches in successful ACK completion
order. ERROR cuts new delivery while preserving accepted requests and scheduled
ACKs; route/session cleanup cancels both. Pending receipts also suppress opaque
SSE state refreshes, including the interval after the server persists an ACK
but before its held browser response arrives. The receiver loads lazily through
a contract subpath; the production initial bundle is 469.85 kB under the unchanged
470 kB error budget. Existing warning budgets remain exceeded.

Fresh checks pass typecheck, the production web build, 1237 unit/state checks
and 741 full PostgreSQL integration checks, including the new real command API
proof in a private schema. All 21 runtime browser cases across 16 variants pass,
including native/fallback same-status resume, accepted pause and old save replies.
Resume replaces the actual errored iframe, restores the saved answer, retains
the dialog and matches the pinned Source post-ERROR logs `ERROR, RUNNING`.
Read-only storage inspection confirms the exact persisted command receipts.
These are owned API/player fixtures, not a complete Original backend or device
acceptance proof.

All four fresh-image checks pass: PostgreSQL standard, demo and production-secret
boundaries plus SQLite. The image `testcenter-rewrite-app:completeness-357eba0ffd84`
has USER node and ID `sha256:6598630b62a1fe6a41507bf19c1041b016649ecf9f1449ba8a69b6773c6062f8`. Its build uses an archived tracked checkout;
the protected presentation is excluded. Owned test resources are removed and
exact inventory retains 24 existing containers and 85 volumes. About 8 GiB are
free after builds; the preceding targeted cleanup reclaimed about 5 GiB.

Confirmed remaining gaps: monitor issuance still changes canonical state before
browser execution, and its Run mutation and command insertion are separate writes.
In the held-pause test, Native persists `PAUSED` before `ERROR`; Source instead
records `ERROR, PAUSED` at browser execution. Pause DOM/receipt checks pass while
this log-order mismatch remains open. Integrated multi-command effects in ACK
completion order, terminal command delivery and termination/save-drain equivalence
still require work. All eight complete Original UI acceptance rows, real devices,
current-checkpoint remote CI, release, deployment and production proof remain
open. This is a local checkpoint; nothing was pushed.

### Durable command identities and receipts (2026-10-11)

Application checkpoint `5f88508c12e8` persists commands with independent IDs,
per-Run sequences and an idempotent first acknowledgement in Memory, File,
SQLite (schema 59) and PostgreSQL (schema 53). All four scope identifiers
must match the parent Run. SQL reads also check the parent in the same query;
writes serialize under a SQLite transaction or PostgreSQL Run lock. File
receipts update the cache only after durable persistence succeeds. Run and
workspace deletion remove their command history. Issuance and receipt alone
leave status, saved answers, timers and the current Unit unchanged.

Two additional pinned Source probes record pause/resume after ERROR with
normal and reversed HTTP acknowledgement completion. The effect order follows
successful acknowledgement completion, including RUNNING then PAUSED when
responses finish in reverse order. This is frontend evidence on owned
API/player fixtures, not a guarantee of execution in issuance order.
`scripts/record-original-runtime-command-order.mjs` guards the actual controller
states, command logs, DOM identity and response completion order in both cases.

Fresh validation passes typecheck, the production web build, 1216 unit checks,
733 full PostgreSQL integration checks and 32 additional command/migration
checks. These include two actual SQLite writer processes, independent
PostgreSQL pools, file write failure/recovery, selected-Run isolation,
parent deletion, restart durability and failed migrations with exact saved
answers retained after retry. The previously latest-schema-58 SQLite test
was updated for the new migration. An initial 512-MiB private tmpfs was too
small for the full corpus; the private-volume rerun passes and removes all
owned resources.

The new image `testcenter-rewrite-app:completeness-5f88508c12e8` has USER node
and ID `sha256:215ebc9da10cf2997f9f5b707ffa0078a65646463126746027903b64dca2fdfb`.
All four fresh container checks pass: PostgreSQL standard, demo and production
secret boundaries plus SQLite. Exact inventory preserves the 24 existing
containers, 85 volumes and protected presentation. Disk recovery initially
reclaimed about 5 GiB; 9.2 GiB is free after the current builds and cleanup.

This is storage infrastructure. Monitor issuance still mutates canonical
state directly; no producer, authenticated command endpoint or browser
consumer is connected to the new collection. The same-status resume regression
and termination/save-drain equivalence remain open. All eight complete Original
UI acceptance rows, remote CI for this checkpoint, real devices, release,
deployment and production proof remain open. Nothing was pushed.

### Command reception and dependency caching (2026-10-11)

Packaging checkpoint `26f74a5bd6be` installs workspace dependencies from the
root lockfile and all nine workspace manifests before copying application
sources or applying build metadata. Runtime copies retain node ownership.
A second image build in an owned archived checkout changes an API source file
and the build timestamp: both development and production npm-install layers
are CACHED, while the application rebuild and runtime preflight succeed.

Six fresh read-only Source browser probes at
`ee2ab9ab64bd91209ef8534bbe6005838024e46d` cover pending and queued
pause, terminate and resume. The recorder checks actual DOM identity:
pending replies after ERROR retain the original iframe and receive no ACK;
queued resume retains the dialog, replaces the iframe, records RUNNING and
reopens polling. Queued pause/terminate retain their existing observations.
These are unmodified Source frontend probes on owned API/player fixtures,
not a Source backend control-state equivalence claim.

An opt-in Rewrite regression (`UI_SMOKE_RUNTIME_RECEIVED_RESUME=true`)
issues a real same-status/same-Unit monitor resume, captures its resulting
current-state refresh before ERROR and delivers that response afterwards.
It currently fails the specific Source-derived DOM assertion: the errored
iframe remains connected. The failure is verified with the actual API shut
down and no page errors. This refresh is not a durable command receipt.
The regression is recorded, not fixed or enabled as a passing CI scenario;
command identity, receipt handling and already-accepted command execution
remain necessary. Clearing ERROR on an arbitrary snapshot cannot establish
that command causality.

Fresh checks pass 41 existing error-reception/save-drain tests and three
browser cases (normal runtime error, accepted pause, accepted pause with the
lazy-dialog fallback). Fresh-image Docker passes standard/demo/production-
secret PostgreSQL (schema 52) and SQLite (schema 58). The image
`testcenter-rewrite-app:completeness-26f74a5bd6be` has USER node and ID
`sha256:a387648696fad847f7e2265ca881280958607ec2342ec25214dbdc00ee46e65f`.
All owned runtime resources are removed; exact inventory retains 24 existing
containers, 85 volumes and the protected presentation hash.

Application/frontend sources are unchanged from `ef83639c4597`. Its 1192
unit checks, typecheck, production build, 56 runtime contracts and complete
Verona recovery checks below remain retained evidence, not new full-suite
runs. The new Docker builds compile the current production application.
Ordered command delivery, Source termination equivalence, all eight complete
Original UI acceptance rows, current-checkpoint remote CI, real devices,
release and deployment remain open. Nothing was pushed.



### Late save receipts and accepted control state (2026-10-11)

Application checkpoint `ef83639c4597` acknowledges successful durable Player saves
without projecting their Run snapshot into an errored controller, another
selected Run, or a state that has advanced through an applied refresh since
the request started. Receipt processing still removes the exact delivered
outbox entry and drains following packets. Unchanged active Runs retain their
ordinary save-state synchronization. Backend authorization, completion and
monitor write guards are unchanged.

A real-browser negative probe on the prior build reproduces a late paused
save receipt removing the ERROR Frame. A second probe uses only copied static
assets from the verified owned 92e0d0eaa776 image: an old running receipt
temporarily recreates the Player after an already accepted pause. The reference
container was never started and was removed immediately after extraction.
The corrected native and failed-lazy-load dialogs preserve the ERROR Frame or
the accepted paused state, retain exactly one runtime error/controller ERROR,
acknowledge the outbox, and preserve the exact incomplete response on reload.
A DOM observer rejects transient Player resurrection hidden by a later pause.
Read-only SQLite inspection confirms exact runtime-error text and one controller
ERROR for each of the four owned native/fallback cases.
Four new actual-method tests also cover ERROR, a newer state, Run switching
and normal successful receipt handling.

All 1192 unit/state checks pass (533 frontend). Typecheck and the subsequent
production build pass; initial size remains 469.41 kB under the unchanged
470 kB error budget, with existing warning budgets unchanged.
Fresh production browser checks pass the existing 17 runtime cases, the two
new accepted-pause/old-receipt cases with native/fallback dialogs, all 56
runtime contracts and the complete Verona/official-player recovery flow.
The late-save pair was additionally repeated with exact persisted error text
and controller log checks. The other browser groups from 92e0d0eaa776 remain
retained evidence; this checkpoint does not claim eight fresh browser groups.
API/store code is unchanged from bceb17b4db38; 166 memory/file/SQLite and 702
PostgreSQL integration checks remain retained evidence, not new API runs.

Fresh-image Docker passes standard/demo/production-secret PostgreSQL (schema
52) and standalone SQLite (schema 58). Image `testcenter-rewrite-app:completeness-ef83639c4597`
has USER node and revision ef83639c4597; ID `sha256:9a8b1aadc32f7bdda1f3b0718afb84008b3102555710c6392709d3348180a24f`.
All owned runtime resources are removed. Exact inventory preserves 24 existing
containers, 85 volumes and the protected presentation hash. Approximately 5.2 GiB are free.

Ordered/same-status command delivery, Source termination equivalence and all
eight complete Original UI acceptance rows remain open. Nothing was pushed;
current-checkpoint remote CI, real devices, release, deployment and overall
production readiness remain unverified.

### ERROR and accepted monitor pause overlap (2026-10-10)

Application checkpoint `92e0d0eaa776` cuts new participant channel delivery and
ordinary status refreshes on a validated ERROR from the selected running Unit.
Already accepted channel refreshes may finish. A pre-error accepted pause moves
the controller to PAUSED, removes the Player and reopens the channel, while
keeping the error dialog until reload. Ordinary late status responses and API failures
cannot replace or clear the errored Run; route/session cleanup still invalidates
in-flight responses and discards queued refreshes.

Pinned Source frontend ee2ab9ab64bd91209ef8534bbe6005838024e46d passes four
owned Primar/desktop fixtures: pending pause/terminate are ignored after ERROR,
queued pause executes and reopens command reception, and queued terminate
returns to Starter. A maintained recorder validates the four complete probes.
These are Source frontend/stub observations, not Source backend state proof.
Pinned backend MonitorController.putCommand stores and broadcasts a command;
TestDAO.getCommands reads unexecuted commands in timestamp order, and
patchCommandExecuted marks the selected test/command as acknowledged.
The current Rewrite monitor API applies canonical Run changes immediately.
Native canonical completion is not claimed equivalent to Source terminate.

The old production build reproduces the late-monitor-pause regression.
The corrected production replay passes 15 runtime cases, including native and
failed-lazy-load dialogs for late and already received pause. It verifies
retained dialog, reopened channel, exact incomplete answer/progress and reload.
All 1188 unit/state tests pass (529 frontend), including 11 new ERROR reception
cases. Typecheck and the subsequent production build pass with unchanged
469.41 kB initial size and 470 kB error budget; existing warnings remain.
Fresh browser replay also passes 56 runtime contract cases, 22 Player-version
cases, 44 pause, 43 exit, 32 header cases, Systemcheck and the complete
Verona/official-player recovery sequence.

API/store code is unchanged from bceb17b4db38. Its 166 memory/file/SQLite
and 702 PostgreSQL checks are retained evidence, not fresh API reruns.
Fresh-image Docker passes standard/demo/production-secret PostgreSQL (schema
52) and standalone SQLite (schema 58). Image `testcenter-rewrite-app:completeness-92e0d0eaa776`
has USER node, revision 92e0d0eaa776 and ID `sha256:334a95f30170f76fea2d8b7b6e800c8f99f4e8a9e7ba29bebf98a90778640a9d`.
Owned runtime resources are removed; exact inventory preserves 24 containers,
85 volumes and the protected presentation hash. Approximately 6 GiB are free.

Same-status/ordered command delivery, control-state reconciliation from late
save responses, Source termination equivalence and all eight full Original UI
acceptance rows remain open. Nothing was pushed.
Published main 143dc3e73ae8 has successful GitHub Actions run 38000558022;
that run does not validate this unpublished application checkpoint.
Remote CI, real devices, release, deployment and overall production readiness
remain unverified.

### Exact runtime error text and custom help (2026-10-10)

Application checkpoint `0e5c90b47fb5` preserves runtime message whitespace in
descriptions and logs, and keeps the Original log key for a missing code.
The guarded fallback now preserves empty descriptions, renders allowed rich
HTML through Angular sanitization, and displays multiline help with pre-wrap.
Existing diagnostic bounds and secret redaction remain in force.

The unchanged pinned Source frontend passes 28 cases: six known codes, an
unknown code, defensive missing code, empty/rich whitespace messages, and
application/login/booklet help across three themes and desktop/mobile.
Missing code is defensive behavior, not a valid optional protocol field.
A maintained recorder rejects incomplete Source probes. Source fixtures use
owned API/player stubs; they do not prove Source backend authorization or
persistence. Both probes neutralize the pointer before measuring dialogs.
An initial hover-shadow mismatch is retained as test-harness evidence.

All 56 Rewrite contract cases pass with native and failed-lazy-load dialogs:
exact description HTML/text, exact stored messages and keys, first-dialog
retention, one controller ERROR, focus trapping, and exact answer/progress/Run
recovery. Collapsed native dialog inset pixel comparison covers 28 cases
(maximum RMS 0.01357 on 0-255 RGB); outer shadows, underlying
page, expanded metadata and fallback geometry are outside that pixel scope.
The gate is included in ci:browser:quick. Negative unit/browser probes reproduce
the whitespace loss before the fix.

All 1177 unit/state checks pass (518 frontend). Typecheck and the subsequent
production rebuild pass; initial size stays 469.41 kB below the unchanged
470 kB error limit. Existing 450 kB/style warnings remain. Final production
browser replay passes runtime 11, versions 22, pause 44, exits 43, headers 32,
Systemcheck and the complete Verona/official-player recovery flow.
API/store code is unchanged from bceb17b4db38; its 166 memory/file/SQLite
and 702 PostgreSQL checks are retained evidence, not repeated API runs.

Fresh-image Compose passes standard/demo/production-secret PostgreSQL (schema
52), and standalone SQLite passes schema 58. Image `testcenter-rewrite-app:completeness-0e5c90b47fb5`
has USER node, revision 0e5c90b47fb5 and ID `sha256:3dac41aeffa4c89d4fa3c8a322e9b96a978922385b7149ee0eff6b021573ec1b`.
Owned resources are removed; exact inventory preserves 24 containers,
85 volumes and the protected presentation hash. Approximately 6.8 GiB are free.

Overlapping monitor commands and all eight full Original UI acceptance rows
remain open. Nothing was pushed; remote CI, real devices, release, deployment
and overall production readiness remain unverified.

### Durable replacement logs and recovered retry (2026-10-10)

Application checkpoint `bceb17b4db38` resolves the previous multi-unit answer
outbox recovery failure. Restoration now protects only the actual packet in
transit; a retry during the final status refresh can restore new work. A focus
log takes the durable answer rather than an older runtime draft.

Replacement answer packets retain unacknowledged logs with stable entry IDs.
The optional, validated `clientEntryId` remains scoped to the authenticated Run;
legacy callers retain the existing delivery/index IDs, and upgrading an old
outbox reproduces those IDs exactly even after batch reorder. No store migration
is required. Two new headful cases hold an old log-bearing request while a newer
answer replaces it, then let the old request either succeed or return 503.
Both preserve the latest exact answer and store each error log exactly once.
Negative state probes also reproduce the lost retry and stale focus-answer bugs
before their fixes.

All 1168 unit/state checks pass, including 509 frontend-state checks. All 166
API checks pass separately on memory, file and SQLite, and all 702 PostgreSQL
integration checks pass. The new configured-store API case verifies legacy ID
upgrade, reordered batches, distinct identical events, rejected IDs without
answer mutation, and participant/Run authorization. The worker regression keeps
the same log ID through an in-flight replacement and retry.

The final production browser replay passes all 11 runtime-error cases, 22 version
error cases, 44 pause cases, 43 exit cases (37 Original, 6 Rewrite), 32 header
cases, the broad Systemcheck flow and the complete Verona/official-player flow.
The latter includes three-Unit recovery plus STARS 28-Unit, parallel Run,
mid-drain reload, process crash, background sync and capacity checks. The initial
production bundle remains 469.41 kB under the unchanged 470 kB error limit;
450 kB and component-style warnings remain. Typecheck passes; its development
output was replaced by a fresh production build before the final browser replay.

Current-image PostgreSQL Compose passes standard, demo and production-secret
modes (schema 52), and standalone SQLite Docker passes (schema 58). Image
`testcenter-rewrite-app:completeness-bceb17b4db38`, ID `sha256:f09ebe09d48b1fb657f629863c0a7efc9c64971a3809d4644f97320c68de32dd`, has USER node, revision
bceb17b4db38 and timestamp 2026-10-10T18:57:05.043Z.
All owned container resources are removed. Exact comparison preserves all 24
preexisting container IDs, 85 volume names and the protected presentation SHA-256
`7a2826bc8f1a9ffb92519a90f3784a6b1dbc27000892b21068a55a637a958a8a`. Approximately 7.5 GiB are free.

The first file-store replay hit an HTTP timeout during a verified 902-second
macOS Maintenance Sleep (20:57:34 to 21:12:36 local time). Its complete replay
with process-scoped sleep prevention passes 166/166; the failed trace is retained.
Pinned Original master is freshly verified at
`ee2ab9ab64bd91209ef8534bbe6005838024e46d`. Source frontend fixtures do not prove
Source backend authorization/persistence. Custom help, further notification and
command overlap cases, and all eight full Original UI acceptance rows remain
open. Nothing was pushed; remote CI, real devices, release, deployment and
overall production readiness remain unverified.

### Version-specific errors and acknowledged log delivery (2026-10-10)

Application checkpoint `392692085f19` shows the pinned Original's titles and
expanded descriptions for missing and unsupported Verona Player versions,
including the actual failed-lazy-module fallback. Supported startup and the
existing legacy module-version correction are retained. The production initial
bundle remains 469.41 kB under the unchanged 470 kB error limit; the existing
450 kB and component-style warnings remain.

Twelve new unmodified Source frontend cases cover both version errors across
Primar, Sekundar and Erwachsene on desktop/mobile. The owned Rewrite cases begin
with a previously saved exact response/progress packet and retain it through
rejected startup and reload, without leave locks or timer cancellation. The new
mandatory quick-browser wrapper passes all 22 headful cases: 12 native states,
2 failed lazy-module downloads, 2 delayed saves, 2 failed saves with recovery,
2 delayed error-log deliveries after the answer was already saved, and 2 failed
such log deliveries with recovery. All 1158 unit/state checks pass, including
499 frontend-state checks. The existing nine runtime-error cases and all 44
pause cases also pass against this checkpoint. All 43 exit cases (37 Original,
6 Rewrite), 32 header cases and the broad Systemcheck flow pass. The broad
Verona regression fails in its later multi-unit answer outbox recovery check; that failure
is retained and remains unresolved at this checkpoint.

Two negative browser probes confirmed actual storage defects. Refresh could
acknowledge a log-bearing packet merely because its answer text already matched
the server; error logs emitted after a delivered answer could instead use a
detached HTTP write which reload did not await. Controller/focus logs now use
the durable answer outbox. Restoration skips an active drain and requires a
matching saved status plus an answer-only packet before inferring delivery;
a foreground answer write likewise cannot acknowledge queued logs or a different
status. Eight added save-drain tests and the delayed/failed browser cases prove
these narrow corrections.

All twelve closed-dialog interiors are pixel-identical after a 28-pixel inset.
Zero whole dialog rectangles are identical; no full-viewport or expanded-report
screenshot identity is claimed. A separate new unit probe confirms the next
open gap: replacing a same-Unit packet during its failed in-flight delivery can
lose the older packet's unacknowledged logs. That concurrent replacement is not
covered by the completed version/error cases. Custom help, further error and
command overlap cases, and all eight full Original UI acceptance rows remain open.

Current-image PostgreSQL Compose passes in standard, demo and production-secret
modes (schema 52), and standalone SQLite Docker passes (schema 58). Image
`testcenter-rewrite-app:completeness-392692085f19`, ID
`sha256:72421ecb598f4601da35681bd81d1b0b4db62ad0bd4536805f43d29549c7493b`,
has USER node, revision 392692085f19 and declared timestamp
2026-10-10T18:28:20.222Z. Owned containers/volumes are removed; exact comparison
preserves all 24 preexisting container IDs and 85 volume names, plus the protected
presentation SHA-256
`7a2826bc8f1a9ffb92519a90f3784a6b1dbc27000892b21068a55a637a958a8a`.
Approximately 9.1 GiB are free after these runs.

API/application/store code remains unchanged from checkpoint 9d9ec5754879 and
its recorded 165 SQLite API/701 PostgreSQL integration checks; these full suites
were not replayed for this frontend checkpoint. Remote Original master is freshly
verified at `ee2ab9ab64bd91209ef8534bbe6005838024e46d`. The Source references use
owned API fixtures and do not prove its backend authorization/persistence.
Nothing was pushed; remote CI, real devices, release and deployment are unverified.

### Runtime-error dialog and durable reload (2026-10-10)

Application checkpoint `d026e3f7c63f` retains the running Original Player behind
its native Material error dialog. It reproduces the help text, Fehlerdetails,
focus, non-dismissible backdrop/Escape behavior and reload action. The fixed
Source SVG and fixed en-US/local-zone date output are rendered directly, while
the native dialog and expansion panel remain deferred. The first implementation
failed the unchanged 470 kB initial budget; the final production build is
469.41 kB. The 450 kB and component-style warnings remain; no limit was raised.

Six unmodified Source frontend references and six owned SQLite browser cases
cover Primar, Sekundar and Erwachsene on desktop/mobile, incomplete responses,
and forbidden timed-block exits. A repeated error from the same callback leaves
one dialog and one CONTROLLER=ERROR, while preserving both runtime-error logs.
The reference and Rewrite share only an owned synthetic Player; the Source
frontend stays unchanged. The new mandatory quick-browser gate also proves a
failed lazy-module download, a delayed save, and failed saves followed by recovery.
These nine headful cases pass. The 44 pause cases, 43 normal exits (37 Original,
6 Rewrite), 32 header cases and the broad system-check browser flow also pass.
The broad Verona flow passes after updating its stale merged-timer exit
expectation: the timed confirmation suppresses the later leave-lock check, with
current-unit/status guards present. Cancel and accepted return preserve the exact
stored answer packet and leave unit/testlet locks empty. The new answer setup
waits for vopStart's rendered unit definition before typing.
Reload waits for the durable outbox, preserves
exact response/progress packets and the selected authorized Run, and fences
context changes while awaiting storage and Router navigation. All 1140 current
unit/state checks pass, including 481 frontend-state checks.

The six closed-dialog interiors are pixel-identical after a 28-pixel inset.
Zero complete dialog rectangles or full viewports are claimed identical: the
rounded corners expose different backgrounds (574 changed rectangle pixels on
desktop, 362–364 on mobile; maximum channel difference 155). Expanded diagnostic
content is functionally checked, without claiming complete screenshot identity.
Custom help variants, other startup/error categories and overlapping commands
remain open, as do all eight full Original UI acceptance rows.

The new image passes PostgreSQL Compose in standard, demo and production-secret
modes (schema 52), plus standalone SQLite Docker (schema 58). Image
`testcenter-rewrite-app:completeness-d026e3f7c63f` has ID
`sha256:fcd2cd7ed3fea049c3d9798e84ec78034a198dad0c4700baac01c3bdf1ea5da8`,
USER node, revision d026e3f7c63f and declared timestamp
2026-10-10T17:23:04.421Z. Owned containers/volumes are removed. Exact inventory
comparison preserves all 24 preexisting container IDs and 85 volume names; the
protected presentation remains SHA-256
`7a2826bc8f1a9ffb92519a90f3784a6b1dbc27000892b21068a55a637a958a8a`.
Approximately 9.9 GiB remain free after the runs (8.7 GiB during them).

The API/application/store implementation is unchanged from checkpoint
9d9ec5754879 and its recorded 165 SQLite API/701 PostgreSQL integration checks;
those full suites were not replayed for this frontend change. Source master is
freshly verified at `ee2ab9ab64bd91209ef8534bbe6005838024e46d`. The Source references
use owned API fixtures and do not prove Source backend authorization/persistence.
Nothing was pushed. Remote CI, real-device acceptance, release and deployment
are still unverified.

### Native pause container and startup budget (2026-10-10)

Application checkpoint `85e8e9e86fe8` uses the pinned Original's native
Material sidenav container/content, closed end drawer and white content surface
for the pause card. This clips the upper card shadow at the content boundary.
The first drawer build exceeded the unchanged 470 kB startup limit by 694 bytes.
Migrating the root template's conditional rendering to Angular control flow
removes its static NgIf dependency and lowers the production initial bundle to
469.02 kB. The existing 450 kB warning and component-style warnings remain;
no budget was increased.

Eight sequential headful browser suites pass against owned SQLite APIs: all 44
pause cases, 32 header cases, participant login/second-code cases, admin login
with and without its proof-of-work challenge, offline shell/central bug reporting,
global warning and raw-response settings, and required/voluntary password changes.
All 469 frontend state tests also pass. The API/application/store implementation
is unchanged from the preceding 9d9ec5754879 checkpoint and its recorded
1128 unit/state, 165 SQLite API and 701 PostgreSQL integration checks.

The new application image passes PostgreSQL Compose in standard, demo and
production-secret modes, plus standalone SQLite Docker. The image is
`testcenter-rewrite-app:completeness-85e8e9e86fe8`, with ID
`sha256:127a8503e58a17a4fd77db5b53751b81e80a47bc416cc1855f1e1c86b045299e`,
USER node and revision 85e8e9e86fe8. Its declared build timestamp is
2026-10-10T16:34:04.899Z. Owned test containers/volumes are removed. Exact comparison
preserves all 24 preexisting container IDs and 85 volume names, and the protected
presentation SHA-256 remains
`7a2826bc8f1a9ffb92519a90f3784a6b1dbc27000892b21068a55a637a958a8a`.
Approximately 11 GiB remain available after the runs.

A new full-PNG comparison of the 44 pause cases measures at most 0.13965% changed
pixels. The remaining differences are the header shadow and three card-edge
pixels; the maximum channel difference is 5. Zero full viewports are pixel-identical.
This improves the former upper-shadow overlap but does not close full-page UI
acceptance, remote CI, real-device, release or deployment proof.

The next confirmed gap is the Original runtime-error surface. Six unmodified
Source frontend cases (three themes, desktop/mobile, Hot Return with incomplete
presentation/response and a forbidden timed-block exit) pass in
`scripts/reference-original-runtime-error.mjs`. The Source retains its iframe,
focuses a native non-dismissible dialog, shows the default custom technical-help
text and expandable Fehlerdetails, and offers Schließen und neu laden. Escape and
backdrop clicks retain the dialog. Each case logs one Runtime Error: runtime-error
and one CONTROLLER=ERROR, then reloads through the same participant route and
sends a connection-lost beacon. Portable presentation expectations are saved in
`scripts/fixtures/original-runtime-error.json`. These are frontend references on
owned API/player fixtures, not Source backend authorization or persistence proof.
The Rewrite's retained-player/native-error-dialog implementation and broader
error, custom-text and overlapping-command acceptance remain open. The pinned
Source revision remains `ee2ab9ab64bd91209ef8534bbe6005838024e46d`, freshly verified
against remote master. All eight full Original UI acceptance rows remain open.

### Paused starter exits (2026-10-10)

Application checkpoint `9d9ec5754879` matches the pinned Original pause-status
exit. A visible pause leaves for Starter without a termination question, another
CONTROLLER write, changed response packets, timer cancellation or leave locks.
The interrupted timer and monitor pause remain intact. A forced silent pause
keeps only the ordinary end-test confirmation. Staying makes no mutation;
approval records `TERMINATED_PAUSED` and, if configured, locks the whole test.
Source's `patchLock` writes the separate `BOOKLETLOCKEDbyTESTEE` event and locked
flag, preserving the controller state; the Rewrite now does that for paused exits.

The lazy Original pause surface uses Source's native raised card, booklet title,
login and mode labels, custom pause text and retained unit toolbar. The paused
toolbar has Source's natural height and hides interrupted time. In all captured
cases card/toolbar/title/paragraph geometry agrees within 0.6 px; fonts, colors,
spacing, borders and shadows agree exactly. The shared participant controller
continues to own the Run and the ordinary interface keeps its existing surface.

Unmodified Source `ee2ab9ab64bd91209ef8534bbe6005838024e46d` passes 42 frontend
cases: Hot Return across three themes and desktop/mobile, Hot Restart in Primar
at desktop, three timer leave policies, and visible/silent pause. Two more
Source cases prove the configured termination lock. The matching 44 authenticated
Rewrite browser cases use its real SQLite API, owned operator pause commands and
trusted synthetic Verona input. Anonymous/foreign sessions, stale units/status,
exact saved packets, interrupted timers and absent leave locks are checked.
The 36 advisory, 57 completeness/visible-button and 43 normal-exit regression
cases also pass to owned API shutdown: 180 successful browser cases in total.
An extra PNG audit finds 44 exact card-body crops but zero exact full viewports;
small differences remain at the header/toolbar and upper-card shadow overlap.
Full pixel parity is therefore still open despite matching measured geometry
and computed styles.
Source frontend fixtures do not prove Source backend authorization; the pinned
PHP controller/DAO and TestLog sources independently establish the lock event.
This does not close the full Player UI row or untested navigation/custom-text
and hidden-header combinations.

Optional `expectedStatus` fences stale HTTP confirmations. Run, current unit,
view and status are also checked after lazy loading, autosave, draft saving,
preparation, confirmation and the response. A refresh observing this action's
exact server result before HTTP completes is accepted; a newer remote pause
cannot be erased by the old response. The production methods are exercised in
frontend state tests, alongside native browser flow checks.

All 1,128 unit/state tests pass (469 frontend), all 165 SQLite API tests and all
701 PostgreSQL integration tests pass. PostgreSQL uses a fresh owned container
and volume, removed afterwards. The new 44-case browser gate is mandatory in
`ci:browser:quick`; the initial bundle stays at 469.99 kB under the unchanged
470-kB limit. Existing budget warnings remain visible.

Fresh standard/demo/production-secret PostgreSQL Compose checks (schema 52) and
standalone SQLite Docker (schema 58) pass for application `9d9ec5754879`. Image
`testcenter-rewrite-app:completeness-9d9ec5754879` is
`sha256:c7190455bac4b65f100c8d304fd89582be76c9fe1fe6d3be4987f081c75f728d`,
uses `node`, and declares build time `2026-10-10T15:36:01.071Z`. All owned test
resources are removed. Exact inventories retain all 24 existing containers and
85 volumes, and the protected PPTX checksum is unchanged. Lossless compression
of one additional closed owned test database saves 106,082,263 bytes, with a
verified SHA-256 round trip. After the current image build, 11 GiB remain free.

Keep the negative evidence: 24 pre-correction memory-store pause cases failed
with forced-completeness denial. The first Source probe looked for literal
"Testpause" although Source resolves its default custom text. The first own card
used that fallback and had the wrong width. Reusing the same paused participant
across viewports then blocked a fixture's next Player load; each browser case now
uses its own workspace. The old API expectation of a termination during visible
pause caused the first SQLite/PostgreSQL replay to fail. Its replacement checks
unchanged complete test-log lists against the observed Source behavior; corrected
full replays pass. Failure logs and closed database evidence remain available.

All eight full Original UI rows, physical-device acceptance, current remote CI,
release and deployment acceptance remain open. Next establish Source's actual
Shell/error and overlapping-action behavior, then widen Player/Review acceptance.

### Starter exit advisory order (2026-10-10)

Application checkpoint `f74f3f8512a1` follows Source's order of completeness,
timer and leave-lock checks. In Demo/Review/Trial, an allowed timer is cancelled;
other non-enforced timers are interrupted before a later confirmation opens.
Cancelling that confirmation keeps the Run and current unit active, without
restarting its timer, changing saved packets or applying a leave lock. A repeated
attempt repeats the completeness notice but not the timer notice. Non-confirmed
lock notices appear immediately; confirmed lock notices appear only after consent.
A forced timed confirmation short-circuits the later leave-lock check.

The preparation endpoint authorizes the participant's selected Run and current
unit. Its effects come from stored execution policy; it cannot bypass forced
completeness/time rules or persist preview packets. Saving modes use stored
responses for completeness. Old foreground actions are fenced by Run, unit and
view at lazy loading, autosave, draft save, preparation, confirmation and response.
The optional current-unit guard on the final return request also rejects stale
HTTP confirmations while retaining compatibility for existing API callers.

Unmodified Source `ee2ab9ab` passes 36 owned frontend cases: three preview modes,
three timer leave policies, unit/testlet locks and both confirmation settings.
Their captured copy and notice order match all 36 authenticated Rewrite browser
cases with the real SQLite API and trusted synthetic Verona input. The browser
also checks anonymous/foreign-session rejection, stale units, unchanged packets
and no implicit locks after staying. A separate forced-time Source probe records
zero remaining time and termination without an additional unit leave-lock write.
These fixtures do not prove Source backend authorization or full Player UI parity.

All 1,031 local unit/state tests pass, including 444 frontend tests. All 165
SQLite API and 605 PostgreSQL integration tests pass; PostgreSQL used a fresh
owned container and volume, both removed after verification. The production
initial bundle remains 469.99 kB under the unchanged 470-kB limit. The new browser
gate is mandatory in `ci:browser:quick`.

Keep the negative evidence: the first preparation implementation let status
reads automatically resume an interrupted timer. A persisted interruption bound
to the loaded unit fixes that; status/save, repetition and explicit resume are
tested across all four stores. Native lifecycle copy initially used a UI timer
projection without its identity/duration fields; the compiler caught it and the
implementation now retains the actual current-state timer.

Fresh isolated PostgreSQL Compose checks (standard/demo/production-secret,
schema 52) and standalone SQLite Docker (schema 58) pass for application commit
`f74f3f8512a1`. Image `testcenter-rewrite-app:completeness-f74f3f8512a1` has ID
`sha256:c0304bf4c57342bafb8c69c8db21e54f273f14be2b0f8b35fbe1613d06033274`,
revision `f74f3f8512a1`, user `node` and declared timestamp
`2026-10-10T14:31:03.202Z`. All owned resources have been removed. Exact inventory
checks retain all 24 pre-existing containers and 85 volumes; the protected PPTX
checksum is unchanged. After the new image build, host availability is 12 GiB.
The 57-case completeness/visible-button and separate 43-case normal-exit
regressions both pass through owned API shutdown. Together with the new 36-case
advisory matrix, this checkpoint has 136 successful browser cases. The later
test-only refinement loads the pinned fixture before spawning its API and checks
Source's actual `UNITS_LOCKED_AFTER_LEAVE` / `TESTLETS_LOCKED_AFTER_LEAVE` keys;
all 36 captured advisory traces plus the forced-time trace have neither key.
All eight full Original UI rows, physical-device acceptance, current remote CI,
release and deployment acceptance remain open. Next compare paused exits and
Shell/error/busy races, then widen Player and Review acceptance.

### Completeness before starter exit (2026-10-10)

A forced logo exit now checks the current unit's completeness before timed-block
or leave-lock decisions. Direct return-to-starter requests cannot skip that check
with confirmation flags. The API resolves the nearest testlet/root policy and
projects it with the current unit; the frontend uses the newest local Player
report instead of an older API packet. A denial leaves saved responses, locks,
timer expiry and the running Run unchanged. Non-saving modes evaluate transient
reports without persisting them. Monitor navigation overrides keep the separate
forbidden-timer restriction.

Unmodified Source ee2ab9ab confirms the ordering in 54 presentation/response/both
cases and 18 legacy Verona 2 cases, across three themes, desktop/mobile and three
leave policies. Two additional fresh-Player probes distinguish an absent response
status from explicit incomplete progress. Source requires exactly `complete` for
presentation; `complete-and-valid` is accepted for responses. The controller,
Verona interfaces, InfoDialog and close SVG match their pinned Git blobs. These
frontend probes use owned API/Player fixtures; they do not prove Source backend
authorization or whole-page parity.

The Original UI presents the native information dialog with one close button.
The shared UI also offers only a close action. A malformed positive result cannot
approve a denied exit. Run/view fences cover lazy loading, autosave settling,
draft saving and the eventual HTTP response, so an obsolete exit cannot clear a
replacement view or stop its event stream. The lazy policy and direct contracts
subpath keep the unchanged 470-kB initial limit; the production build is 469.99 kB.

Local checks pass all 868 unit/state tests (including 419 frontend tests and 47
exit-method tests), 165 SQLite API integration tests and 421 PostgreSQL integration
tests against a fresh owned container. The mandatory 57-case browser gate uses
trusted Verona input, direct authenticated/anonymous/foreign-session HTTP calls,
exact stored packets, timer/lock precedence, native focus/close behavior and
Source dialog copy/geometry. Its visible close-button comparison uses real
locator screenshots from all 72 Source cases, including fractional positions;
off-screen transparent whole-page crops are not accepted as icon evidence.
The final 57-case visible-button replay and the separate 43-case normal-exit
regression both pass through owned API shutdown. The original animation timeout
remains recorded; its precise cause is not established by the successful retry.

Keep the negative evidence: the old API returned HTTP 200 for a forced incomplete
exit; the initial implementation invented an absent response status and failed
an existing execution-mode case. Explicit MatIconRegistry wiring and a contracts
barrel re-export exceeded the initial bundle budget. The inline SVG first sat
four pixels too low on desktop; Source's inline baseline/automatic icon height
fixes it. A generic close-button hash failed for a differently sized response
dialog; reference hashes are now captured separately for every state. A normal
exit replay timed out while waiting for animations; its retry brings the owned
page forward and preserves animation diagnostics on any repeated failure.

### Current container and storage checkpoint (2026-10-10)

Application tree ca54c32603bd passes fresh isolated standard, demo and
production-secret PostgreSQL Compose runs at schema 52, plus the same image's
standalone SQLite Docker runtime at schema 58. The local image is
`testcenter-rewrite-app:completeness-ca54c32603bd`, revision ca54c32603bd, user
`node`, image ID `sha256:09e3106f02f5f59b57718f7390c67038606b7d8374400cdb63ab2762d7407b54`.
Its declared build timestamp is 2026-10-10T13:44:39.382Z. All owned projects have
removed their containers and volumes after verification. The earlier a0f479d6
image also passed these four container executions.

Docker recovered from a stopped engine after a bounded Desktop restart. Two
completed owned SQLite artifacts were losslessly compressed and checksum-verified,
saving 212,118,099 bytes. A further 1.269 GB of unused Docker build cache was removed after the current
builds. Exact inventories retain all 24 pre-existing containers and 85 volumes;
the protected PPTX checksum is unchanged. The final measured host availability is 13 GiB. Complete Original UI rows, physical-device acceptance, remote CI,
release and deployment acceptance remain open. Continue with unforced timer/lock
advisory ordering on exit and the remaining Shell/error/busy and wider Player/
Review matrices; the visible-button and normal-exit replays are now closed.


### Original in-player logo exit and hidden header (2026-10-10)

The optional Original Player now opens the native Material confirmation used by
unmodified Source ee2ab9ab. A saved exit asks "Sicher, dass du den Test beenden
möchtest?" without an extra saved-progress paragraph. A timed-block or leave-lock
warning is folded into that one question. Source's restriction labels reverse
the native result: "Hier bleiben" stays, "Trotzdem weiter" continues. Primar fills
the first native false-result button; Sekundar/Erwachsene retain outlined order.
A forced forbidden timer reports the Source toast and never opens a dialog.
The shared Rewrite labels/renderer and server restrictions remain in use.

Source's hidden header has a 48px positioned logo wrapper and an inline native
link, whose measured hit rectangle differs from the image. Both visible and
hidden header geometry now follow that actual DOM. Replacing an open dialog uses
Material-generated IDs and keeps the original live focus trigger; destruction
unsubscribes before closing. Weak focus references do not retain detached views.
The parent rejects old overlay results, and the exit action fences its awaited
confirmation against a changed Run or view lifecycle.

The read-only Source helper covers 36 combinations: three themes, desktop/mobile,
visible/hidden header, and plain/confirm/forbidden exit. Its API and synthetic
Player fixtures establish frontend behavior, not Source backend authorization.
The actual logo/image and 24 native dialog geometry/style/copy measurements are
pinned in scripts/fixtures/original-player-exit.json. Caller revision metadata
must still be verified against the unmodified Source build externally. Reproduce
with ORIGINAL_PLAYER_REFERENCE_ROOT, ORIGINAL_PLAYER_REFERENCE_COMMIT and a fresh
absolute UI_SMOKE_ARTIFACT_DIR, then reference:ui:original-player-exit:built.

The new mandatory ci:browser:quick gate owns its real SQLite API and credentials.
Its 36 Original cases check trusted Verona answers and exact stored packets,
modified activation, native focus trap/Escape/backdrop/stay, one confirmed exit,
cancelled timer state, and an actual forbidden-return 409. It also checks native
dialog replacement, a deliberately missing lazy bundle's guarded fallback, and
six shared Rewrite cases. Only the injected missing-bundle case models no Service
Worker in its owned top frame; the normal matrix keeps production Worker behavior
and the opaque Verona sandbox. Actual request failures stay fatal through child/stream
shutdown. The 24 production-method tests exercise scoped timer/lock copy, reversed
results, destroyed/replaced overlays, live focus ownership and changed Run/view
fences; the complete frontend suite has 396 tests. Production build/typecheck
retain the 470-kB initial limit (469.99 kB). The existing 24-state protected Review
workflow and native header/read-only Starter gate also pass. The final 43-case
exit gate succeeds through owned API shutdown. The settled broader participant
entry/leave/resume/logout slice has 1,283 requests, zero actual API failures/5xx,
and orderly shutdown at participant-entry-start-after-sign-in. This is a bounded
local replay; it does not replace the complete browser/Compose matrix.

Keep the negative observations. The initial Source forbidden check accidentally
read the older timer snackbar instead of the current toast stack; the final
helper waits for the exact denial text. The first own check exposed inherited
logo fonts/inline hit geometry. Dialog replacement exposed a real detached-focus
regression and one comparison captured the replacement's intermediate animation;
the final gate waits for settled animation. The shared single-booklet login
already starts its Player; the test must not click a disappearing Starter button.
The first bundle-failure injection was satisfied by the Worker cache and did not
block a request. Playwright's Worker-block shim then threw in the opaque iframe;
the final injection models absent Worker support only in the owned top frame and
requires an actually blocked bundle. The shared fallback passes an explicit
request context and rejects obsolete results. The broad native cancellation flow
now waits for Material dismissal before opening its next confirmation.
A broad smoke initially reused demo bootstrap credentials with a different first-
admin password; repeat on a fresh owned, non-demo database. Complete PNGs retain
Player/notification/background differences, so no complete Original UI row,
physical hardware, remote CI, new container image, deployment or production
acceptance is closed here. The protected PPTX and user stores are preserved.
This checkpoint is local and unpublished; continue remaining whole Player/Shell,
error/busy and production acceptance.

## Acceptance baseline

The current native-logo correction makes 48 complete initial/focus/alert RGBA
pairs and twelve complete settled-tooltip pairs byte-identical to unmodified
Source ee2ab9ab. Native login activation resets the form; modified activation
clears both tabs. Source cancels modified Starter activation, while copied links
open an independently authorized read-only Starter. The own real SQLite gate
covers 24 participant/admin cases, eight fresh/running Starter cases across four
modes, unchanged server Run/answers and pending save outbox, and anonymous/foreign
session denial. It is mandatory in ci:browser:quick. The normal leave confirmation
and pending-authentication protection remain in use. This is a bounded header
proof; the bounded hidden-header/timer logo checks below complement it. Remaining Shell/error/busy states, whole flows and
production acceptance are still open. No complete row is closed.

To reproduce current Source header evidence, use the same externally verified
production build/revision and a fresh owned artifact directory as below, then
run reference:ui:original-header:built. Add ORIGINAL_LOGIN_REFERENCE_ENTRY=admin
for admin login or ORIGINAL_LOGIN_REFERENCE_STARTER=true for Starter. These
three modes pass twelve cases each. The helper's revision metadata is a caller
assertion, not Source/backend/production verification. Tooltip comparisons wait
for animation completion; intermediate scaled rectangles are not the fixture.

The latest participant alert comparison closes the plain-paragraph and stale
submitted-form presentation gaps: 24 complete Caps Lock/rejected-credential
RGBA pairs are exact across three themes and four widths. Rejection clears the
credentials and resets pristine/untouched/submitted state without forcing
focus. Source error/warning icons shrink naturally inside narrow notices.
Participant HTTPS notice geometry matches in twelve cases; eleven full-page
images are exact and one has 25 differing text pixels. Admin HTTPS notices have
separate current Source measurements. Protected real participant/admin browser
gates pass, including no-request HTTPS blocking, actual challenges and retry.
These bounded states do not close the login/Shell or cross-cutting row;
remaining whole Player/timer, errors/busy states and full production acceptance
are open.

Fresh 2026-10-10 comparison removes the Rewrite's synthetic initial participant
login/group values. Blank entry is disabled, while saved names and explicit
links retain their values across reload in both interfaces. The current Source
is built from verified byte-exact tracked frontend/common/definitions files at
`ee2ab9ab`; equal own frontend fixtures have no unknown requests or page errors.
The initial participant comparison matched desktop but exposed mobile full-page
heights of 847/844px. The corrected participant and admin entry shells preserve
the Source footer's overflow outside AppRoot, while html/body clip the window.
All twelve full-page pristine-focused-name RGBA pairs now match byte-for-byte:
both login surfaces, three themes and desktop/mobile. The two protected headful
production gates also pass their four-width matrix and actual login/recovery
cases; a DOM Range regression assertion rejects the clipped admin baseline.
The subsequent native-focus correction also makes the six initial participant
desktop/mobile RGBA pairs byte-identical without first focusing the name fields.
All 72 initial/password/visibility/back/repeated-password/invalid-return focus
states match Source across three themes and four widths. The independently
observed native Tab sequence is logo, welcome scroll container, name; Source's
logo was still a link while Rewrite used a button at that checkpoint; the correction above now resolves that bounded difference. One wider Primar/600px image
has 113 differing text pixels, while its fresh single-case replay is exact.
Both are retained; no complete Shell/login or cross-cutting row is closed.
Source's native window clipping and the footer-free starter are retained.
The corrected focus comparison uses the same actual pristine input state;
an earlier extra click had touched only the already-focused Rewrite control.
The fresh Source camera diagnostic again exits 2 after twelve actual
`video.nativeElement` startup/re-entry failures. These are separate negative
reference observations, not successful camera or physical hardware acceptance.

To reproduce the Source focus observation, first verify the unmodified current
Source revision and its production build, then run:

```sh
ORIGINAL_LOGIN_REFERENCE_ROOT=/path/to/original/frontend/dist/testcenter-frontend/browser \
ORIGINAL_LOGIN_REFERENCE_COMMIT=ee2ab9ab64bd91209ef8534bbe6005838024e46d \
UI_SMOKE_ARTIFACT_DIR=/path/to/new/owned/source-evidence \
npm run reference:ui:original-login-focus:built
```

The helper records the caller's revision assertion, renders the unchanged
frontend on owned rejected-login fixtures and fails unknown requests/page
errors. It does not verify that revision itself or establish backend behavior.
It also checks the Source notice fixtures and native form reset. For a real
insecure HTTP origin, run it with `ORIGINAL_LOGIN_REFERENCE_INSECURE=true` and
a new artifact directory. Add `ORIGINAL_LOGIN_REFERENCE_ENTRY=admin` to check
the admin notice. These three modes each pass twelve Source cases. The Source
participant fixture makes one rejected name probe; the protected Rewrite gates
independently require zero credential/challenge requests in that context.
The regular protected login and bounded entry/logout browser gates verify the
Rewrite's real authorization/session flow independently.

Requested on 2026-09-12: keep the existing rewrite interface available and add
an optional interface identical to the Original Testcenter. This is a separate
acceptance axis from functional parity; the historical 94% estimate in
PARITY.md does not measure it.

Current upstream target, reverified on 2026-10-09:
`ee2ab9ab64bd91209ef8534bbe6005838024e46d`. Its only new commit since
`14c98284` adds an initial short-header fallback e2e case and sample setup;
frontend tree `64032f00186dc287c9de3ffd63cc235fe1c9a5da` is unchanged.
The owned native label corpus now covers eight configurations, both interfaces
and both widths (32 cases), including this initial missing-short-label fallback,
exact Run/Session identity and byte-exact saved-response reload. These functional
checks do not close a full-page comparison row. The protected-login busy states,
insecure-context HTTPS notice and independent short Unit labels have current
functional browser evidence. Toolbar on-primary colors and full-page visual
identity require fresh comparison, not only the historical comparisons.
See `PARITY.md` for the source-backed delta and separate deployment boundaries.

Historical rendered reference: `iqb-berlin/testcenter` commit
`c35cff81383949b4664e0fdffa3ba1154d144d9d` (19.0), fetched on 2026-10-03.
Compare source files from that revision, not the older local checkout.

## Required behavior

- Explicit, reversible interface selection. The existing rewrite interface
  remains the default until the Original interface passes acceptance.
- Both interfaces use the same authorized application services and persisted
  data. Switching must not reset answers, create a test run, change permissions,
  or bypass a participant navigation restriction.
- Preserve the independent Primar, Sekundar and Erwachsene presentation themes,
  authored texts, branding and participant-specific configuration.
- Do not equate a color/font override with an identical interface. Reproduce
  page structure, spacing, typography, controls, dialogs and interaction states.
- Keep rewrite-only tenant and diagnostic tools accessible without inserting
  them into the Original participant workflow.

## Acceptance matrix

### Attachment labels and QR-page text (2026-10-20)

The shared manager/camera now honor Original runtime text keys with exact
global < operator precedence and the distinct template/direct empty rules.
Source-executed checks pin the German fallback wording without extending the
102-default editor. Sixteen real protected production Chromium/SQLite cases
cover both interfaces, desktop/mobile, defaults, global text, empty overrides
and padded multiline text, including actual QR-PDF download parameters and
foreign-group denial. Original PDFs substitute the actual second-code suffix,
insert replacement-token characters literally and use distinct group labels
for batch document titles. See the 2026-10-20 PARITY.md entry for evidence.

This does not adapt the complete manager/camera Material layout or prove
physical devices or full-page identity. No complete visual row is closed.

### Separate Player and Review toolbar references (2026-10-09)

The current unmodified Source has two different icon hosts: the main Player
toolbar uses 18px SVGs in 18x24px MatIcon hosts; the Review pane uses 24px SVGs
in 24x30px hosts. The optional Original renderer now preserves both geometries.
Its main toolbar keeps Source's default cursor; the pane retains pointer for
enabled controls and default for disabled controls. The disabled list button
keeps full opacity instead of inheriting the Rewrite's 0.65 opacity.

Both reference helpers wait for real finite drawer/ripple transitions and fonts
before capture. They independently compare both toolbar hosts/SVGs and cursors
in all 24 form/filled/list/edit states across three themes at 1280/390px.
Every list/edit capture first proves the same intended own comment is visibly
rendered. Protected SQLite native CRUD/back/new/retry, exact UTF-8 answers,
same Run reload, foreign-Session denial and the existing Rewrite switch pass.
The earlier diagnostic that selected `toolbar-right` measured the main Player
toolbar; it was not a measurement of the pane's `mat-toolbar`.

These are component comparisons, not full-page identity. Small image differences
remain and none of the eight complete acceptance rows is closed here. Source
fixtures prove rendered frontend behavior; they do not prove Source backend
authorization or physical camera/window acceptance.

### Current Starter and Review-download messages (2026-10-09)

Unmodified current Source `ee2ab9ab` renders 24 owned fresh/mixed/long-title/
Review Starter states in all three themes at 1280/390px. Their 2,928 measured
Starter geometry/style values match the protected Rewrite renderer exactly.
These are frontend fixtures, not Source backend authentication evidence.

The empty Review export exposed a concrete presentation difference: Source
shows a bottom-centered, independently dismissible toast; the Original-mode
Rewrite had inserted an inline status paragraph. The optional Original interface
now uses Source's stack, five-second per-message lifetime, close action,
inverse-surface colors, native button font and narrow-width text wrapping.
The existing Rewrite feedback remains available. Populated exports download
their exact CSV without an empty-message toast. Late replies across Session/
view changes are discarded before feedback/downloads; a destroyed Starter
suppresses its pending empty-message toast.

The existing protected SQLite Starter gate passes all 48 geometry/state cases,
exact saved-answer resume, duplicate pending-start prevention and authorized
empty exports. It additionally requires 18 exact single/stacked/first-dismissed
toast comparisons against actual Source in the six theme/viewport combinations,
native click/Enter/close, polite live announcements and independent expiry.
Fifteen production-method regressions cover download results, failed/stale
responses, destroyed views and independent timers. The new Source reference
helper is reproducible without changing Source or vendor assets:

```sh
ORIGINAL_STARTER_REFERENCE_ROOT=/path/to/original/frontend/dist/testcenter-frontend/browser \
UI_SMOKE_ARTIFACT_DIR=/path/to/new/owned/source-evidence \
npm run reference:ui:original-starter:built
npm run smoke:ui:original-starter:built
```

Verify current Source SHA and build before running the reference. The measured
toast fixtures are in `scripts/fixtures/original-starter-review-toasts.json`.
These checks close this component's empty-export presentation gap. Whole-page
pixel identity, all start/resume/error combinations, broader export feedback and
the complete cross-cutting requirements remain open; no full-page row is closed.

The 2026-10-08 PDF continuation adds nine actual TCPDF label-placement/wrapping
references and four actual Source bookmark references. Short/long generated
PDF pages decode correctly, and native protected single/batch exports retain
their scope. This does not close any full-page UI row: Source QR drawing/pixel
details, extended cases, the normal Source capture page and physical camera/
window visibility still require separate evidence. See `PARITY.md` for exact
whole-flow versus focused-run and publication boundaries.

Normal Source capture reference is currently blocked at `ee2ab9ab`:
`runCamera` reads `video.nativeElement` before dynamic ViewChild initialization.
Twelve fresh actual initial/re-entry states across all three themes and both widths
reproduce the failure without a video stream or metadata lookup. Native reload
returns to the Starter and capture URL re-entry fails again. The standalone
`diagnose-original-camera-reference.mjs` exits 2 and retains actual error states;
these cannot count as successful capture comparisons or close any matrix row.
The reference remains unmodified, and real camera/window acceptance is separate.

### Current Review drawer comparison (2026-10-08)

An additional read-only comparison on 2026-10-09 decodes the actual PNGs from
`goal-review-header-probe/` and the settled `source-label-review-reference/`
captures in all 24 states. Header content pixels match exactly in all three
themes and both widths; differing pixels occupy only the last two header shadow
rows. Its zero-scroll before/after measurements and decoded pixels do not
reproduce the earlier sporadic clipping described below. The retained result
is `goal-review-header-pixels.json`. This narrower header observation does not
establish full-page identity or close a matrix row; no image or runtime was
modified for the comparison.

Freshly rebuilt unmodified `ee2ab9ab` references and the protected owned SQLite
Rewrite gate repeat all 24 comparisons on 2026-10-09. They retain identical own
content, exact rendered list/editor checks, font/drawer readiness, native input,
same-Run persistence and foreign-Session rejection. All measured panel, toolbar,
form, button, label, list and header comparisons pass. Actual raw screenshots
still differ, including header raster clipping despite identical rectangles;
this is current component evidence, not full pixel identity or closure of any
complete acceptance row. The frontend source tree is unchanged from `14c98284`.

The optional participant Review pane now adapts the actual `14c98284` toolbar,
700px inner panel/90%-viewport drawer, Material form, current-Unit and whole-Test
lists, add/edit/back actions, priorities/categories, primary/on-primary colors
and scrim. The existing Rewrite pane remains available. Both use the same
authorized facade and SQLite review routes; there is no second persistence or
credential path. Pane/list/draft state is scoped to the exact Run and Unit.

`reference:ui:original-review:built` renders unmodified current upstream assets
with owned API fixtures; `smoke:ui:original-review:built` uses a protected owned
SQLite API. They share the same synthetic Player, labels and exact comment.
Before every list/edit capture they require the intended visible entry or exact
editor text, completed fonts and settled drawer geometry. Trusted native wheel
input puts both panes at the same natural top/left scroll endpoint before each
capture; no DOM scroll setter or forced input establishes the comparison.
All 24 empty/filled/list/edit
pairs pass in Primar, Sekundar and Erwachsene at 1280 and 390 pixels: panel,
drawer, toolbar and form-control rectangles match exactly, as do measured
toolbar/action-button colors, button geometry/shape/font, all form-label colors
and fonts, list typography and
scrim. Earlier empty/incorrect review-list
fixture captures are not evidence. Source-frontend fixtures do not prove the
Source backend. A fresh 24-state comparison also verifies the corrected plain
form-label tint and inherited drawer theme without a duplicated Material theme.
The production initial bundle remains 469.98 kB under the unchanged 470 kB gate.
Raw screenshots still differ and history-dependent native scrolling remains a
separate comparison requirement; this is not full pixel identity.

The next rendered comparison extends the gate to header/title/logo rectangles
and action-button opacity, cursor and transform. It exposed a real global
Rewrite-style leak: disabled Material buttons were additionally dimmed to 65%,
and enabled actions inherited a pointer cursor and hover translation. Only the
Original Review action buttons now use the current Source presentation (opacity
1, default cursor, no translation). Review edit captures await the intended
visible editor before measuring its scroll region; an independently retained
negative attempt had measured a disappearing list region during that transition.
Capture helpers also wait two native animation frames after wheel input.
Header/title/logo rectangles match in all 24 states. Some raw captures still
clip header raster content despite identical post-capture rectangles in both
unmodified Source and Rewrite; this observation is not a proven product layout
regression or resolved full screenshot acceptance.

Native protected browser flows also pass new/edit/save/delete/cancel, add/back,
test/unit/task targets, simultaneous categories, exact Unicode/newline content,
same-Run reload, restored editable drafts after closing/reopening, list reopening,
failed-save retry and switching to Rewrite. Own credentials authenticate their
own Run (`200`) and fail for another Session's Run (`401`); its review inventory
remains byte-for-byte unchanged. Eight actual production-class regressions cover
restoration, duplicate actions, destroyed views and late results across Run/Unit
boundaries. The new browser gate is mandatory CI. No full-page row below is
closed by this component-level comparison.

A subsequent native keyboard gate reproduced focus leaving the open drawer
after confirmed Review deletion (the unchanged 30-second focus assertion failed).
The old fallback targeted the generic sidebar close button, which the Original
Review pane no longer renders. It now targets the visible Review list/form close
action and retains the generic target for the Unit sidebar. The fixed-assets
protected comparison passes all 24 states plus visible in-drawer focus and
native Tab containment after deletion in all six theme/viewport combinations.
Fresh typecheck, production build (469.98 kB) and all 505 core/frontend checks
also pass. The retained failing log/screenshot establish the original defect;
these Cloud gates are separate from publication CI and full cross-cutting UI
acceptance.

To reproduce against separately built unmodified upstream assets:

```sh
ORIGINAL_REVIEW_REFERENCE_ROOT=/path/to/original/frontend/dist/testcenter-frontend/browser \
UI_SMOKE_ARTIFACT_DIR=/tmp/owned-original-reference \
npm run reference:ui:original-review:built
ORIGINAL_REVIEW_REFERENCE_METRICS=/tmp/owned-original-reference/metrics.json \
UI_SMOKE_ARTIFACT_DIR=/tmp/owned-rewrite-review \
npm run smoke:ui:original-review:built
```

Verify the upstream source SHA and build first. Use fixed production assets and
separate owned databases/ports; do not run build/typecheck cleanup against assets
still used by a browser fixture. A protected full new-tree run reproduced a
disabled save button after drawer recreation despite a retained draft. Its
negative log/screenshot were retained; the implementation now restores real
form changes and the new native close/reopen regressions pass. The complete
protected SQLite suite then passed on fixed final production assets. An immediate
new Edit-value read was corrected to await that exact rendered value, retaining
the assertion and default timeout; its failure screenshot showed the expected
text already rendered. Publication CI remains separate from these Cloud gates.

The current independent header/navigation/toolbar short-label keys now compile
and render in both interfaces, including missing-short-label fallback, modern
toolbar-key precedence and read-only projection of older stored source keys.
The complete repository browser smoke includes seven native XML configurations
at 1280 and 390 pixels, real UI login, native Controller radio input, Unit
navigation and byte-exact same-Run reload. The owned production Chrome repetition
passes all 28 cases, as does an independent bundled Chromium repetition. Smaller
mobile Rewrite card padding fixes a reproduced
vendor-content clipping failure without changing Original geometry or vendor
files. These functional label gates are separate from freshly rendering the
unmodified current upstream and comparing complete pages: none of the eight
full-page rows below is closed by this implementation.

The shared-target ItemBuilder correction retains the same exact native
Participant/iframe/runtime binding when headless Chromium does not create a
separate Player CDP target. The existing repository smoke passes Rewrite and
Original in CI mode as well as headful Chrome/Chromium (six cases). It still
requires visible controls, real trusted inputs, completed browser resource
downloads and byte-exact durable response; no Player sandbox, vendor bytes,
browser flag or test-library code is changed. See `PARITY.md` for the negative
CI reproduction and exact owner/identity/deadline checks. This is browser-harness
acceptance only: all eight complete visual comparison rows below remain open.

The 2026-10-07 focused ItemBuilder acceptance now passes in both interfaces with
headful Chrome and bundled Chromium. Exact native frame/Session binding replaces
an independently reproduced Playwright opaque-srcdoc inventory failure; the
Player, vendor bytes, compatibility adapter and sandbox are unchanged. Real
trusted checkbox/text input, rejection of foreign Sessions and covered controls,
interaction-derived state and byte-exact durable reload are required. Original's
intentionally hidden API-version diagnostic is checked for its actual handshake
text, while the actual Player and controls must be visible. This supersedes the
earlier focused blank-frame observation, not complete long-sequence acceptance,
the visual answer-restoration limitation or any full-page row below. The new
additional runtime reload verifies completed native browser HTML/Script loads
in the exact authorized frame and a new loader, before input and after participant
re-entry, in both interfaces. A fresh native binding verifies visible controls
after each resource probe; no API fetch or weakened sandbox replaces the browser
proof. The separate full sequence now uses the same gate; see `PARITY.md` for its
actual validation boundary. None of the eight complete Original-UI rows is closed
by this shared browser-harness change.

The current protected-login HTTPS notice is adapted from the actual
`14c98284` protection service and alert layout. The shared Rewrite protection
service refuses required challenges before sending credentials in a real
insecure browser context. Original name entry advances locally to its disabled
password step without a credential probe; administrator and second-code entry
are disabled directly. Inactive scopes and secure localhost remain available.
Owned production/headful Chrome gates cover both interfaces, all three themes,
administrator desktop/mobile layout, direct/Enter submissions, and second-code
keypad controls. The Source's non-shrinking 24px error icon is asserted at both
widths. Fixed old-browser geometry fixtures retain their warning even when the
installed Chrome is newer. These gates and actual controller/service regressions
are separate from a freshly rendered unmodified upstream page comparison:
none of the eight full-page rows below is complete.

The 2026-10-07 shared navigation correction synchronizes automatic Run-bound
addresses with Angular Router instead of only replacing native history. Owned
protected SQLite/immutable production browsers prove prevented Back and Forward
retain the exact selected Run, preset assignment, interface and unsaved draft;
the visible shared fallback reload control then restores the saved answer.
All six non-saving entry cases remain green. The longer official Verona 3 flow
also passes its unchanged exact-URL navigation assertion. Thirty-eight actual
entry-method regressions include awaited reload, cancellation and stale view
boundaries. This closes the reproduced local navigation defect, not complete
publication CI or any rendered Original-reference row. The raw-text variant
fixture uses the shared fallback Player, not the Original Verona toolbar.

Run-bound re-entry now distinguishes saving and non-saving modes in the shared
facade. Real protected SQLite/headful Chrome verifies Demo, Review and Simulation
login, code unlock, transient response and hard reload in both interfaces: the
same Run is retained but its transient answer, unlocks and timer are reset.
Saving A/B answers and monitor restrictions remain unchanged. All six paths are
included in the mandatory variant browser gate, with fifteen actual-entry-method
regressions. This fixes the shared Simulation reload CI failure locally; complete
publication CI and every full rendered Original-reference row remain separate.

The updated 2026-10-07 mandatory variant smoke creates both unfinished Runs
through the real protected Starter workflow, without repository seeding. Owned
SQLite/headful Chrome passes A/B answer preservation, exact preset selection,
automatic run-bound browser addresses, hard reload of each assignment,
background-save isolation, monitor pause/resume and completing B without closing
A, in both interfaces. Full Memory/File/SQLite API suites also pass concurrent
assignment creation, same-named timer isolation and monitor/completed denial.
Publication `09942c4c` passes native PostgreSQL (219 tests); its complete CI still
fails at the shared Simulation re-entry boundary described above. Full CI remains
an independent gate. This shared functional implementation changes no full
rendered Original-reference acceptance row or pixel-identity claim.

Both interfaces now bind the selected Run ID through state, asset preload,
live updates and actual generated re-entry links. Exact preset assignment,
Unicode answers and Run ID survive hard reload; another run's later background
saves cannot steal selection or bypass the selected run's monitor pause.
Production/development protected SQLite browsers and headless production pass.
At the earlier selected-Run publication, the second open Run in that focused
fixture was repository-seeded; the updated real-launch acceptance above now
replaces that fixture. These shared functional safeguards do not
close any full rendered-UI acceptance row or pixel-identity claim.

The 2026-10-07 operator handoff check also passes in both interface modes on
owned protected SQLite/headful Chrome: a generated entry starts the requested
login and its exact authenticated Run, and the refreshed operator card exposes
the same Run-bound re-entry URL. The older participant's response and Run status
remain unchanged. Shared browser gates now check that durable identity instead
of racing login inputs removed after success, and retain the same full-height
Player invariant after layout settling. This closes no full UI row. The separate
immutable Memory/headful Chrome ItemBuilder blank-frame failure remains open;
see `PARITY.md` for the retained evidence and publication boundaries.

The subsequent full SQLite flow exposed omitted Run IDs in Workspace/Content
operator links. Their Run-specific cards now bind the represented Run and exact
preset assignment instead of an unrelated roster/default selection. Real owned
protected SQLite/headful Chrome checks pass in both interfaces for Group,
Participant, Booklet and Unit detail links, actual link opening, hard-reload
answer restoration and Content release Run links; both participants' answers and
statuses are preserved. Thirteen actual-getter regressions cover variant and
historical/fallback boundaries. This shared functional fix changes no rendered
Original-reference acceptance row and by itself proved neither full UI identity
nor the then-blocked second unfinished Booklet launch.

The shared backend now permits exact preset-assignment resumption after returning
to the starter, rather than rejecting its variant key against the source Booklet
key. Both interfaces passed real participant login, Unicode draft preservation,
confirmed starter return, same-run resumption and session-link/hard-reload
restoration with owned protected SQLite in production/development; production
also passed headlessly. The mandatory quick-CI variant smoke retains exact
run/answer assertions. This earlier same-assignment check did not close the
other-unfinished-Booklet gap; the updated real-launch check above now covers that
workflow locally, without closing the full starter row or pixel-identity claim.

Latest participant-starter comparison (2026-10-05): the optional renderer now
matches the pinned 19.0 intrinsic 684px card/intro width, 24px gaps, 94px companion,
normal paragraph typography, flex-column margins, Material icon baselines,
completed-button opacity and bordered Review action. The scrolling content is
viewport-bounded below the Source toolbar, including the authenticated account
control at both sides of the 600px breakpoint. The native scroll button sends
the actual Source's smooth 300px increment rather than jumping to the bottom.
The Source's narrow-screen clipping is retained in this optional interface;
the responsive Rewrite interface remains independently available.

All 48 equal-fixture states passed in each final production/development build:
three themes × four viewports × fresh, mixed/completed with custom action labels,
long/wrapped/unbreakable labels and Review-enabled starters. The reference uses
the unmodified `c35cff81` frontend with a bounded API fixture; Rewrite uses real
protected API/SQLite. Text, geometry and measured visible styles match,
including the account control and disabled opacity. Raw RGBA is identical in
33/48 production and 29/48 development pairs. Remaining pairs retain differences
up to 7,733 pixels and 67/255 channel units; complete pixel identity is not
established. Scripts, metrics, screenshots and logs are retained in ignored
`.data/original-starter-reference-20261005.*`.

The new mandatory quick-CI browser regression passes all 48 states in both builds
and exercises real login, keyboard scrolling, non-lifting account hover, a
blocked duplicate pending start, exact saved-answer resumption and participant
bearer authorization for the actual HTTP 204 Review export. The separate login
regression and all 165 core, 12 presence and 83 frontend/preflight tests passed.
Initial production output for that layout step was 469.61kB below the unchanged 470kB hard limit.
Fresh publication CI remains separate proof. This narrow comparison does not
close the complete starter/shell row: empty/error/custom-branding states,
Source snackbar feedback and other claims remain open. A functional P0 gap was
also reproduced: another unfinished Booklet blocks an otherwise available
selection. Explicit run-bound reads now avoid answer-update chronology, while
historical session-only links retain that fallback. The
mixed rendering fixture completes one Booklet before starting the other; it
does not prove that blocked workflow. See PARITY.md's explicit acceptance.

Latest administrator-login comparison (2026-10-04): the optional signed-out
operator entry now uses the pinned 19.0 400px Material card, bordered centered
form, German labels/actions, shared Source header/footer and Testtaker link.
It calls the same authorized operator login, proof-of-work, persistence and
return-route logic as Rewrite; there is no second credential store. Native
setup remains accessible through the interface selection or `?ui=rewrite`.
Structured error identifiers preserve Source copy despite different HTTP
codes. Passwords are cleared after results and on destruction. Duplicate
pending Enter is rejected, late failures cannot clear a replacement secret,
post-login asset failures do not erase accepted authorization, and a failed
lazy renderer exposes the safe Native entry without attempting authentication.

All 48 equal-fixture states passed in each final production/development build
across three themes, desktop/mobile and both sides of the 600px breakpoint,
with empty/filled/Caps Lock/wrong-password forms. Source is the unmodified
`c35cff81` frontend with a bounded API fixture; Rewrite uses real protected
API/SQLite. Text, geometry and visible styles match. Both matched CSS rules
specify `margin:auto`; inconsistent Chromium resolved margin values remain
in the recorded diagnostics while actual form positions are compared exactly.
Raw RGBA is identical in 41/48 production and 44/48 development screenshots;
other pairs retain raster-edge differences up to 1,291 pixels and 24/255
channel units. This is not complete pixel identity, Source-backend proof or
a closed shell/login/administration row. Evidence is retained in ignored
`.data/original-admin-reference-20261004`.

Each build also passed twelve real login configurations with 24 browser-solved
admin security challenges, actual scheduled/expired access rejection, normalized
blank-name errors, retained authorization after a failed asset read and the
actual failed-component chunk fallback. Full protected SQLite passed through
workspace deletion; participant login and deletion dialog regressions stayed
green. All 157 core plus 78 frontend/preflight tests passed; initial output is
469.31kB below the unchanged 470kB limit. Publication `fae90ea5` subsequently
passed all 35 push-CI jobs (run `37226072648`), including PostgreSQL UI and
participant-detail review. The later durable participant-presence publication
`a095936b` finished with 20 successful and 15 failed push jobs: the browser
failures share the STARS partial-delivery fault boundary, which failed to block
actual worker-owned network sends. An owned reproduction confirmed all exact
answers were durably saved; the regression now intercepts both network owners
and additionally checks the actual server-side seven-Unit boundary. Fresh
publication verification remains required. Neither result closes a full
Original UI row.

Latest administration-dialog comparison (2026-10-04): the optional Original
account-deletion confirmation now adapts the pinned 19.0 Material template,
600px dialog, German singular/plural prompt, seven-character form gate,
submit-before-cancel order and inline `Falsches Kennwort.` alert. The secret,
authorization callback, pending duplicate guard and stale-request checks still
belong to the shared controller. Wrong-password focus waits for the actually
re-enabled Material button and preserves its mouse/keyboard origin. Native
Rewrite confirmations and the workspace's additional exact-key guard remain
unchanged; the workspace dialog is still not Original-rendered.

All 18 equal-fixture dialog states passed in each fresh production/development
build (three themes × desktop/mobile × empty/filled/wrong password). Text,
geometry, visible computed styles and focus match the unmodified `c35cff81`
frontend. Source uses a bounded fixture backend rejecting unknown calls;
Rewrite uses its real API and isolated SQLite. Screenshots, metrics, script
and logs are retained in ignored `.data/original-password-reference-20261004`.
This is a narrow renderer comparison, not full-page pixel identity or a closed
administration row. Both builds also passed four real protected deletion
configurations and a failed-network-renderer fallback gate: cancellation sends
no DELETE, wrong passwords preserve accounts, pending Escape/backdrop/duplicate
submits cannot dismiss an action, failed directory refreshes do not repeat
acknowledged deletions, and the safe Native fallback preserves the selection.
The separate full protected SQLite flow passed through `workspace-delete`.
All 157 core and 70 frontend/preflight tests passed. Initial production output
is 468.25kB, below the unchanged 470kB error budget. Fresh publication CI is
still separate proof; no complete Original UI matrix row is closed by this step.

The shared file-intake view now explains its strict Original 19 XSD policy or
explicit legacy compatibility setting. Real API/SQLite browser gates pass valid
and invalid imports in both interface preferences at desktop/mobile widths,
in production/development. This is shared import behavior, not an Original
administrator-page rendering comparison; the administration row stays open.

The `0da8fbfe` publication's PostgreSQL UI job has now passed the full protected
flow, including saved-dialog focus and workspace-access revocation. Its overall
CI is not green: a separate participant-detail job hit a forced click while an
entry-link record was replaced. Normal actionability-checked clicks replace
those two forced entry-link clicks; the protected SQLite full flow passes
through the real participant popup and `participant-launch-status-session-link`.
Fresh complete publication CI remains required.

The Original 19.0 deletion password requirement is now enforced in shared
administrator/workspace services and the UI. Both interface preferences use the
same safe confirmation flow; desktop/mobile production/development tests cover
wrong-password retry, focus, no-request cancellation, pending duplicate guards,
and directory-read failure after a real acknowledged deletion. The password is
dialog-local, never persisted. Its readable opaque surface is regression-tested.
This paragraph records the preceding shared functional step. The narrow
Original account-deletion renderer comparison is now described above; the
complete administrator/workspace pages remain part of the open row below.

The previous login publication's PostgreSQL UI job raced the Material saved-report
dialog autofocus immediately after its animation. The full smoke now waits for
the required in-dialog focus state itself before testing Tab/Shift+Tab; no focus
assertion or timeout is removed. The protected SQLite full operator gate passes
this save/focus sequence and continues through workspace/account deletion.
Fresh complete PostgreSQL and publication CI proof remain separate requirements.

Latest login comparison: both name and password fixtures now match the actual
19.0 rendering in all three themes at 1280x720, 390x844, 599x844 and 600x844,
in each fresh production/development build (24 states each). Source viewport
height/footer sizing, two-column mobile overflow, heading margins, Material
icon baseline, label styling and bordered browser-warning card replace the
earlier approximations. The Original warning formats three-part semver only;
the shared support policy and Rewrite's raw browser version are unchanged.
The actual Rewrite build identity remains truthful in the footer.

The bounded Source backend fixture rejects unknown calls; each Rewrite instance
uses real API/SQLite. Text, geometry and computed styles match. Raw screenshots
are fully RGBA-identical in 17/24 production and 21/24 development pairs; the
others retain small edge differences, at most 114 pixels and 12 channel units.
This is not completed pixel identity, all configurations, Source-backend proof
or a closed shell/login row. Error/custom-branding/admin-login states and the
other complete surfaces remain open. Evidence, scripts and logs are retained in
ignored `.data/original-login-reference-20261004`.

The new twelve-configuration quick-CI regression also exercises actual 401
responses, password fallback, focus, reveal/back and a real password-authorized
session without storing its password. Production/development gates passed;
another production run solved fourteen real browser proof-of-work challenges.
The protected entry gate through password sign-in and the three-theme real
Systemcheck-save gate passed. All 144 core/49 frontend tests passed. Initial
production output is 467.99kB, below the unchanged 470kB error budget. The
portable Linux logo assertion is separately published with a fresh checkpoint
(`5aa72bf0`); latest login publication CI remains a separate requirement.

Latest welcome comparison: the unmodified 19.0 frontend exposed the inherited
980px cap, card/text colours, disabled-FAB dimming, icon baseline and table
wrapping. These Original-only styles now match the rendered source. Its shared
header has the 22px/28px centred title, proportional logo and actual 64px/56px
toolbar breakpoint below 600px. Native Rewrite layout remains separate.
Twelve equal-fixture comparisons passed in each production/development build,
across three themes at 1280x720, 390x844, 599x844 and 600x844. Visible text,
geometry and visible computed styles match, with screenshots retained locally
in ignored `.data/original-welcome-reference-20261004`. The Original frontend
uses a bounded synthetic backend; every Rewrite comparison uses its own real
API/SQLite. The CI regression checks both breakpoint sides and real report
persistence; the full protected Systemcheck and participant-entry gates passed.
This does not close the Systemcheck row, other fixtures or full-page pixel
identity. Initial production output is 467.94kB under the unchanged 470kB limit.

Latest acknowledgement step: the Original Systemcheck success notice now uses
the pinned 19.0 Material confirm template, two actions and audience-dependent
ordering, including the adult override for live administrator/monitor access.
Its lazy overlay is request-ID guarded and does not replace Rewrite or
destructive verification dialogs. Fresh headful production and development
three-theme tests passed real persistence, focus containment, desktop/390px
bounds, cancel/confirm/Escape and the return to Start. The complete protected
production Systemcheck regression also passed adult ordering and confirms
that cancelling the notice cannot remove the already-saved report or answers.
Initial output is 467.73kB with the unchanged 470kB error budget.

The `bc8a7bf1` push CI completed successfully (35/35), including the
acknowledgement and watchdog steps; its acknowledgement-only predecessor was
superseded. Newer changes still require their own CI. An isolated, unmodified build of
Original `c35cff81` with its own locked Angular 20.3.29/Material 20.2.14 is now
available for source-rendered comparisons; a successful build alone does not
close any visual-parity row.

The first actual comparison corrected dialog typography (30px heading,
16px/24px content), 720px maximum width and duplicate disabled-button dimming.
The save form follows the actual 19.0 field without a visible password suffix;
the upstream unimported suffix does not render. Rewrite retains its reveal.
All twelve dialog-state comparisons passed on 2026-10-04 at 1280x720/390x844
in all three themes: visible text, geometry and computed styles/tokens,
including button children. The reference runs the unmodified Original frontend
with a bounded synthetic backend fixture, not the Original backend. Rewrite
uses its real API/SQLite and retains the submitted answers. Locally retained
screenshots and comparison metrics are in the ignored
`.data/original-dialog-reference-20261004.gFehUo` directory. Corrected builds,
three-theme production/development regressions and the full protected
production Systemcheck gate passed again. These narrow dialog comparisons do
not establish whole-page pixel identity or close the Systemcheck matrix row.

Implementation in progress: the home page now offers a browser-local interface
choice. `?ui=original` and `?ui=rewrite` also select it for a direct entry. The
choice survives navigation/reload and leaves unrelated URL parameters intact.
The Original option is explicitly labelled a development preview. The initial
participant header adaptation is not a completed visual-parity claim; login,
page composition, typography, controls and all matrix comparisons remain open.

The Original participant login now has the name-first passwordless probe,
password fallback, password visibility control, back navigation and credential
error reset. It uses the existing participant sign-in, proof-of-work and
assigned-booklet/session logic, not a second authentication implementation.
Local Chromium checks exercised real passwordless and password-protected
demo-workspace accounts; mocked errors cover the view transitions without
consuming real login attempts. The main smoke also checks that Original and
Rewrite sign-in restore the same session/run. The complete local SQLite/Chromium
smoke passed on 2026-10-03; publication and current CI remain separate gates.
Nunito Sans files are copied from the pinned Original
and shipped with their OFL; adapted Original layout code retains its MIT notice.
Material 20.2.14 (the Original lockfile version) now provides the login fields
and primary/tonal buttons under a component-scoped theme. Focus follows name,
password, back and retry transitions, with a Caps Lock hint. Local Chromium
checks cover focus and the real passwordless path. Full screenshot comparisons,
remaining icon/control details and the other surfaces remain open.

The participant starter now adapts the Original's numbered Material cards,
684px card/intro layout, companion assets, Starten/Fortsetzen/locked actions and
bottom Review download action. Available and in-progress assignments open
through the existing authenticated resume service; locked/completed assignments
cannot launch. The Original starter replaces the Rewrite diagnostic cards only
when a signed-in participant has no active run. Player/terminal/error states
continue through the existing controller. Long-list scrolling is observed with
an IntersectionObserver. Equal-fixture comparison and the operator/monitor
starter remain open; this is not a closed visual-parity row.
The focused integrated memory/Chrome smoke passed on 2026-10-03 through
`participant-entry-sign-in`, including cancellation of return, confirmed
return to the Original card and resuming the exact same session/run. Additional
local browser checks cover locked/completed cards, retry after a failed resume,
desktop/mobile widths and an actual Review account's empty CSV response (204)
with its authored start-button text. Full CI for the new commit is still a
separate gate. The current production bundle is 468.47kB under the unchanged
470kB error limit; its 450kB warning remains. The subsequent lazy participant
credential adapter brings the current bundle to 468.94kB without raising
either budget; Original theme-size warnings remain unchanged.

All rows are currently open. Close a row only with matching reference states
and browser evidence at equal viewport, theme, text and fixture settings.

The optional player now adds the Original's grouped task/page navigation above
the existing Verona frame. Adapted Material controls, SVGs, labels, readonly
and hidden modes, page lists and separate global buttons reuse the same
controller events and server-authoritative permissions; no second iframe or
session implementation is introduced. A headful Chromium/isolated-SQLite check
on 2026-10-03 passed nine official Bklt_Config variants within 29–39, real forward/back
task and page changes, the same-run return to Rewrite, narrow-width grouping,
and no page errors. The Original player now has a full-height frame without
Rewrite diagnostic cards, an authored-title/timer Material toolbar and modal
task/comment side panels. The panels reuse the existing state and persistence;
opening and closing them does not replace the iframe. Headful Chromium checks
cover keyboard trapping and return, draft retention, actual comment save/delete,
nested confirmation focus, mobile bounds, authored menu permissions, actual
reload of the same run and return to Rewrite. The integrated smoke has the same
surface gate. Remaining sidebar contents, dialogs and matching
reference screenshots keep the Player visual-parity row open. This is not a
completed visual-identity claim.
The Original login footer now has the source's Material-link order and German
labels, and is absent from the Starter and active Player as in 19.0. Its version
label describes the actual Rewrite build, not a fictitious Original release.
The Starter account menu shows the authorized login, authored group label,
booklet access and build identity. A headful Chromium/isolated-SQLite check
passed both surfaces, viewport-height login composition, opaque themed CDK
overlays, mobile menu bounds, Escape/close focus restoration and same-run
return to Rewrite. A fresh protected SQLite/Chromium entry gate also passed
the footer/account assertions and the same-session/run Starter resume. The
sign-out control now reproduces the verified access lifecycle of Original
`deletePersonToken`: revoke access without deleting responses, issue a fresh
credential on re-entry, and keep the old credential invalid. Local
`clearSession` is not equivalent to that operation. Logout waits for server
confirmation; a failed attempt keeps the account menu and error notice open
for retry. It preserves pending answer queues and does not erase a concurrently
renewed key or another participant's visible session. A headful Chromium/
owned-SQLite check passed an actual Player answer save, temporary failure,
successful retry, old-key rejection, real UI re-login into the same run and
byte-identical answer restoration, desktop focus and mobile keyboard logout.
Twenty-five frontend/worker/test-actor/logout-state tests passed. The current
production bundle is 469.00kB, below the unchanged 470kB error threshold.
The fresh complete protected SQLite/Chromium production browser gate also
passed through this logout/re-entry path, official Player and Test Controller
flows, monitors, attachments and Original exports, with final exit 0. Current
publication CI and matching-reference screenshots remain separate gates;
this verifies the server-backed logout path, not the complete visual-parity
row. The pinned Original's confirmation dialog and audience-specific button
order are now adapted too. Its source text and companion image precede actual
revocation; Primar places the filled `Hier bleiben` button first, whereas
Sekundar and Erwachsene place the outlined `Abmelden` button first. Cancel and
Escape preserve access and return focus to the account button. A session change
or component destruction prevents a stale confirmation. A fresh protected
SQLite/Chromium entry gate passed the cancel/revoke/re-entry sequence. Separate
headful checks passed all three actual application themes at 1280px and 390px,
native keyboard focus, real logout failure/retry and byte-identical saved Player
response restoration. Twenty-five frontend-state tests and backend/shared
typechecking passed. The production initial bundle is 469.72kB within the
unchanged 470kB error limit: the dialog is lazy-loaded and repeated identical
font declarations were consolidated without changing font values. Current
screenshots show the adapted Rewrite surface, not an equal-fixture comparison
against a rendered Original; the matrix rows remain open.
The official ABI development-rendering regression is also fixed: Player loading
notifications no longer synchronously change the parent save/leave state inside
Angular's view/input lifecycle. The new isolated `smoke:ui:verona-development`
gate passed both layouts with actual ABI input/save, authored reload, page
reload and Unit changes, the same run and exact saved response, no page/console
errors and final exit 0. This adds a dedicated CI check without disabling
Angular verification or replacing another runtime's frontend/database. It is
functional browser evidence, not matching-reference screenshot acceptance.
The Systemcheck selection now adapts the pinned 19.0 400px Material card,
German instructions, explicit start even for a single check, authored labels
and descriptions, and the home action. Rewrite tenant/workspace diagnosis inputs
are absent from this selection. A metadata-only directory returns no report key,
Unit definition, Player or release payload; identical check IDs in different
workspaces remain separate choices. Dedicated system-check sessions see only
their authorized scopes; invalid credentials do not fall back to public access.
Headful checks passed empty/single/multiple selection, actual scoped selection,
390px layout bounds, one error notice and real retry, required password change,
re-login and sign-out. The corresponding selection cases are in the repository
browser gate. The protected login card and the remaining check steps still use
the Rewrite layout. Header details and equal-fixture rendered Original comparisons
remain open; this does not close the Systemcheck matrix row.
The selected check now has the pinned Original welcome's two 400px Material
cards, German step labels and instructions, source environment table, and real
Material FAB previous/next navigation using the existing controller guards.
The header says `Systemcheck`; its logo returns home rather than sending an
unhandled participant-only event. Selection adds an exact tenant/workspace/check
permalink; reloading restores that check, and returning to the directory clears
it. A questionnaire containing only authored headers also retains its step,
matching the source instead of counting only input controls. New environment
reports now use the current Original labels/IDs (`Browserversion`,
`Betriebssystem`, `Betriebssystemversion`, `Bildschirmauflösung`, `Browsersprache`,
`Fenstergröße`); existing reports are not rewritten. Navigation now also has
the source's Material tooltips and accessible control names. Network, Unit,
report composition, the protected-account card, remaining header
details and equal-reference screenshot acceptance are still open.
The final headful welcome check and fresh protected SQLite/Chromium report gate
both exited 0, including reload, cleared selection, header-only questions and
the home action. Twenty-five frontend-state tests passed. The production initial
bundle is 469.91kB below the unchanged 470kB error limit. Screenshots were
inspected for actual table readability and 390px bounds; they are not Original
reference screenshots. Publication CI is an independent gate.
Player-only visual rules are now delivered when a Verona host is created,
instead of on every initial shell entry. Their selector/declaration bytes and
global specificity remain unchanged. The isolated development browser gate
passed actual computed-style comparisons against the previous initial placement
in both layouts at 1280px and 390px, no overflow, and actual ABI answer/save,
authored reload, page reload and Unit changes with exact response retention and
no page/console errors. The headful welcome gate passed the real visible
Material tooltip. The production initial bundle is now 467.76kB, under the
unchanged 470kB error limit; this is not rendered Original-reference acceptance.
The 2026-10-04 questionnaire adaptation uses the pinned Original's centered
810px Material card, authored introduction/header text, outlined string/select/
multiline fields, four-row textarea autosizing, separate checkbox prompt and
vertical radio group. It writes only the existing controller's answers; step
round trips preserve all five input types. Required questions retain the shared
report warnings rather than gaining native validation or invented label
asterisks. The lazy view explicitly excludes Rewrite textarea minimum-height
and form-label styles: browser assertions verify actual text-row height and
Material label typography/color, not just presence of a Material class.
A fresh protected SQLite/headful Chromium production gate exited 0 through
all six question types, native option/checkbox/radio interaction, keyboard radio
navigation, answer retention, header-only questions, 390px/1280px bounds and the
existing report save/download/export paths. Both actual screenshots were
inspected. The production initial bundle is 469.90kB under the unchanged 470kB
error limit; 140 unit tests and 25 frontend-state tests passed. These are adapted
Rewrite screenshots, not equal-fixture rendered Original comparisons. Current
publication CI and the complete visual-parity row remain open.
The Original network step now adapts the source's centered 810px Material card,
automatic start, German progress/rating copy, side-by-side logarithmic canvas
plots, live sequence averages and keyboard-operable `Neustart`. It uses only the
shared configured byte measurements and report entries. Returning to a completed
network step retains its results instead of starting another measurement.
The shared controller cancels its pending latency/download/upload fetches when
the check changes, the account signs out, the step leaves or the route destroys
the view. An old measurement cannot install its results/errors or release the
busy state of a newer check; request timeouts and abort listeners are cleaned up.
The protected SQLite/headful Chromium report gate exercises real successful
measurements, failed packages followed by a real restart, all three request-stage
cancellations in both interfaces, same-step retention, native keyboard restart,
actual 1280px/390px bounds and the existing report/export flows. Its controlled
held requests verify actual browser aborts and no page errors. Screenshots are
inspected as adapted Rewrite evidence, not matching rendered Original reference
images. The chart preserves the source's canvas/projections/grid/dot output but
iterates only labelled x ticks, avoiding millions of empty four-byte iterations
for a large package. UAParser now loads on environment capture rather than the
initial shell; capture generations suppress stale results and refresh the
zoneless view. Current complete CI, the Unit/report/protected-entry surfaces and
the full Systemcheck reference comparison remain separate acceptance gates.
The final fresh protected SQLite/headful Chromium production report gate exited
0 on 2026-10-04, including all six held-request cancellation cases and the
source's in-progress package-size copy. Both final screenshots were inspected.
The production initial bundle passed at 469.52kB under the unchanged 470kB error
limit; 140 unit and 25 frontend-state tests passed. The previous publication's
push and PR workflows each had 33/35 successful jobs with Ops/Quick still
running at this checkpoint, not a confirmed complete CI result.
An additional headful check passed authored Unit/Booklet header titles,
preservation of a hidden header after cancelling return to the starter, hidden
and explicit global-forward controls, and the Original `markedNo` interaction:
the task arrow remains actionable for a completeness explanation, stays on the
same task when denied, and advances only after the required response and
presentation are complete. All of these cases are also in the repository smoke.

The Unit stage now adapts the pinned task title/divider, full-height frame and
bottom-right numbered Material controls using the existing guarded Verona
host. It sends the Original's disabled log policy in both interfaces and keeps
the same saved answer envelope. Protected SQLite/headful production and
development gates exercise two actual pages, both answers, leaving/returning,
keyboard controls, wrong-source messages and runtime-error restoration. The
development entry no longer raises a busy-state `NG0100`. Participant-only
status/Review/timer styles are unchanged but lazy; real save/readiness computed
styles match their former global placement at desktop/mobile widths in both
interfaces. Initial production output is 467.64kB with unchanged budgets.
Inspected screenshots are of the adaptation, not the rendered upstream.
Mobile title/label clipping prevention and Material keyboard-change handling
are deliberate safety/accessibility adaptations. Equal-fixture upstream
comparison, the report/operator layout and all eight complete rows remain open.
The `01249459` push CI is complete (35/35); its separate PR timer-integration
failure used a blind wall-clock sleep rather than the service's returned timer
expiry. The test now validates and waits for that bounded authoritative deadline
without changing production timer behavior or weakening terminal-state checks.
Fresh complete Memory and isolated SQLite integration suites each passed
161/161; full CI for the newly published steps is still pending.

The report stage now adapts the source's 810px raised Material card, required
question warnings, three bulleted lists and send/cancel actions. The shared
answers, measurement results, save controller and stored report payload are
unchanged; only the additional Rewrite application probe is excluded from the
Original list. Public Original reports no longer include Rewrite operator
tools or an extra English check-selector action. Fresh protected SQLite/headful
production and development report gates passed keyboard opening/cancellation,
no accidental report POST, focus return, warning/valid states, cancellation to
Start and 390px layout. Desktop/mobile adaptation screenshots were inspected.
The anonymous save and confirmation dialogs, operator layout and rendered
upstream reference comparison remain open. The production budget is unchanged
at 467.64kB. CI caught the Unit test leaving before the Simple Player's debounced
answer notification; it now awaits the active frame's exact two-answer state
before testing restoration, without weakening the saved-answer assertions.
Current complete push/PR CI is not yet confirmed.

The anonymous report form now adapts the source's actual Material dialog,
500px width/600px height, outlined key/title fields, suffix password toggle and
raised save/cancel buttons. The Original overlay theme is scoped to this unique
panel class and does not alter Rewrite dialogs. The lazy launcher returns only
form values to the existing save controller and closes on destruction, with
no independent authorization or report engine. Minimum lengths, blank fields,
show/hide state, keyboard focus trapping, Escape/cancel focus return, cleared
reopening and desktop/mobile bounds pass protected SQLite/headful production
and development gates. A real Enter submission returns 201, retains both exact
Unit answers and the display-hidden diagnostic in the shared payload, appears
in the report export and is removed by the existing synthetic-data deletion
flow. The initial bundle is still 467.64kB. Viewport-height bounding and
whitespace-only rejection are deliberate safety adaptations; confirmation,
operator layout and the rendered upstream comparison remain open.

The later STARS background-test CI failure was an active Player removing only
the test's artificial trailing outer-JSON whitespace, not losing a raw answer.
The background matcher now compares the entire canonical envelope only for
the active Unit; inactive Units stay byte-exact and raw dataPart strings remain
exact. Four negative/positive matcher tests and all 29 frontend-state tests
passed. A fresh protected SQLite/headful production run passed the foreground,
parallel hard-reload and 28-Unit background sequence, with both queues empty.
Production answer behavior is unchanged and full current CI stays unconfirmed.

| Surface | Required comparisons |
| --- | --- |
| Shell and login | Header/logo/footer, welcome panel, name/password steps, errors, admin entry |
| Participant starter | Booklet selection, start/resume/locked/completed states, review download |
| Participant player | Toolbar, unit navigation, code entry, timer, pause, leave confirmation, loading/errors |
| Workspace | Directory, files, import diagnostics, selection and batch actions |
| Results and monitor | Groups, run controls, response/review exports, attachments |
| System check | Selection, questions, network test, report submission and report administration |
| System administration | Admins, workspaces, settings, authentication and destructive-action dialogs |
| Cross-cutting | Keyboard/focus, narrow viewport, long texts, all three themes, switching persistence |

## Participant Debug pane checkpoint (2026-10-12)

All ten Source Debug windows are now available through explicit local or
selected-run remote `debug` commands. Saved window selection automatically
restores only in development, matching the pinned Source production guard.
Production Chromium/SQLite verifies window toggling/closing, native dragging,
configuration/mode fields, Custom Text keyboard selection, condition parsing,
offline tracked-variable projection, pause/ERROR purity and rejection of a
held response from a previously selected booklet. Pinned Source excerpts gate
formatters, conditions, all 39 raw config defaults and six mode definitions.
The Source MIT notice remains distributed in `assets/ORIGINAL-UI-LICENSE.txt`.
Diagnostic snapshots also retain the rewrite's participant access-code
visibility boundary, as described in the current checkpoint above.

This is functional coverage with owned fixtures, not a live Original Debug
pixel comparison. The other native console commands, early-loading ERROR,
inherited lock descriptions and large real-package Debug acceptance remain
open; full parity and production acceptance are not established.

## Current upstream functional delta

The new baseline includes changes since the previous audit. Before updating
functional completion, examine sensitive-route reauthentication, login-code
case handling, API error/409 responses, report Accept-header handling and
loading transitions. CI-only changes do not create product requirements.
The 2026-10-03 fetch also includes the 19.0 XML, authentication, ownership,
CSV and live-connection changes itemized in PARITY.md. Login and starter source
layouts did not change between the previous UI reference and this revision.

## Source reuse

The Original repository is MIT licensed (IQB). Retain the relevant copyright
and license notices when copying layouts, styles or assets. Account for fonts
and other assets' own license notices separately.
