# Original participant group snapshots

## First native Test Booklet identity survives live file edits (2026-10-24)

The Source47 production observation above distinguishes an existing Test's
`bookletName`/`bookletLabel` from a new Test created after replacing the live
Booklet XML. The Rewrite now captures both strings at native Test creation in
`originalResultState`, using the server-resolved assignment name and physical
Booklet label. Native XML file projections retain a separate raw label when
canonical display trimming/fallback would differ, including padding, newlines
and the empty string. The unchanged Source `XMLFile::xmlGetNodeContentIfPresent`
and `FileData::getLabel` preserve that node text. Existing canonical display
normalization remains unchanged. Later opening, response writes and live-file
replacement preserve the first Test identity. A later new person/Test captures the current label. This metadata belongs
to the Test and is independent of current roster/group labels and current files.

Only server-marked native people establish this snapshot. Canonical and unknown
legacy Test metadata remain unchanged. Existing Tests without captured names or
labels stay unknown after reopening; no current file is used to invent history.
Atomic Run projections ignore attempts to replace a first identity, and invalid
persisted partial/type metadata rejects a mutation before any partial effect.
All four stores already persist the evidence JSON, so no new SQL migration is
required. SQLite remains at 68 and PostgreSQL at 62.

`original-test-identity.test.mjs` imports actual schema-validated Player, Unit,
Booklet and Testtakers files through the normal live-content path. It replaces
the same Booklet XML, reenters the same person, starts a new person/Test and
compares both ordinary labels against the complete SHA-bound Source47 receipt.
Additional raw-label cases are local controls derived from the unchanged Source
file reader; they are not additional production HTTP Oracle observations. It
also covers exact saved answers, unchanged pre-reentry Test clocks, ignored
caller/projection metadata, malformed-record rollback/recovery, durable reopening
and unknown legacy history in Memory, File, SQLite and PostgreSQL. It runs in
the required unit/PostgreSQL suites and core-only Original-results focus command.

Final local qualification passes **4,007 unit/frontend checks** and **2,130 full
PostgreSQL checks**, without failures/skips. The focused PostgreSQL command passes
**200** checks; its observed 12.58 seconds runs concurrently with full suites and
is not a cold-build or hosted speed claim. CI policy passes 266 checks with its
one explicit GNU-timeout-only macOS skip. Core/web typechecking and production
build pass; the initial bundle remains 468.39 kB under 470 kB. Owned test schemas
and connections are absent before removing the owned database and stopping its
initially stopped cluster. Hosted acceptance of this follow-up tree is separate
from the still-running security-patch pipeline.


This implements the observed immutable Test-label prerequisite. Native detailed
Test DTOs/pages, durable Original person suffixes and the remaining auth/deletion/
export/grant/visual requirements below are still open; this is not a native
listing or full Original-parity claim.

## Stable native people across current Login group changes (2026-10-24)

[Unchanged production Source47 run 40041716400](https://github.com/jurei733/testcenter-rewrite/actions/runs/40041716400)
proves that reentry after case-only group spelling changes and moves to another
group retains the existing person and Test IDs while rotating the person bearer.
Current result group spelling can differ from the frozen detailed-Test group
spelling. A live Booklet replacement also preserves an existing Test's label.
The complete 13 public files and exact run/script/source hashes are retained in
[the native identity manifest](../test-fixtures/original-testcenter/source-workspace-results/native-identities/manifest.json).
The initial token-equality assumption is recorded as a failed probe; the final
probe requires distinct bearer tokens, equal Test IDs and current-token access.

The Rewrite now records server-validated native XML provenance and a separate
`OriginalLoginBinding`. A credential login updates its current group and frozen
group-snapshot reference before the person-code step. All already linked people
move in one store transaction; their Test runs, answers and clocks are untouched.
Case-only changes retain the first snapshot key/label. A new group captures its
own label. Reentry on the same active release/mode finds the existing person;
the existing HTTP credential issuer then rotates that person's bearer and rejects
the preceding token. Canonical JSON/CSV and unmarked historical people retain
their prior contracts. A JSON provenance flag cannot opt into native identity.

Memory uses one synchronous update, File publishes one queued replacement,
SQLite uses `BEGIN IMMEDIATE`, and PostgreSQL locks the workspace in a transaction.
Stale parent saves resolve the current binding and cannot detach its identity,
change its login/scope, or restore the former group. Late SQL and file-publication
failures preserve both binding and all people. Workspace cascade removes only
its bindings; unrelated workspace people remain unchanged.

SQLite migration **68** and PostgreSQL migration **62** add the binding table,
nullable native person pointer and nullable roster provenance. Older file
manifests default to no bindings. Upgrade controls retain unknown old people
without inventing login history. Historical migration fixtures remove all later
native structures before rewinding their version ledger; production migrations
still reject inconsistent schemas rather than silently ignoring duplicate columns.

The focused PostgreSQL command passes **191 checks in 6.40 seconds after core
build**, including all four stores and protected HTTP token rotation. Full local
unit/frontend qualification passes **3,981** checks and the complete PostgreSQL
gate passes **2,121**, with no failures or skips. CI policy passes 266 checks
with its one explicit GNU-timeout-only macOS skip. Core/web typechecking and
production build pass; the initial bundle remains 468.39 kB under 470 kB. All
owned schemas and sessions are gone before removing the owned database and
stopping its initially stopped cluster. Hosted qualification for this new tree
is recorded separately when terminal.

This closes the demonstrated group-move prerequisite under one fixed active
release/mode. The native two-step authentication protocol, changed-release/mode
identity, monitor-first login, native Results/Tests DTOs and pages, deletion/grants,
individual downloads and eight broad visual rows remain open. The retained Source
Booklet-label observations are requirements for those pages, not implemented
native listing parity. No complete Original-parity claim follows from green CI.

## Exact imported XML labels (2026-10-24)

Native Testtakers XML now retains the parsed `Group/@label` string through the
participant/operational parser, roster import and every store. Padded and
whitespace-only labels remain distinct from absent values. Literal XML attribute
whitespace follows XML normalization; numeric tab/newline/CR references remain
those characters, character references decode once, and a quoted `>` no longer
truncates the enclosing Group. Canonical JSON/CSV parsing and the existing
canonical display-label normalization retain their contracts.

An explicitly empty native label is retained in the roster but cannot invent a
group-key label or a successful participant session. Actual Original accepts the
XML, stores that label as SQL NULL, then fails Login construction with HTTP 500
before checking the password. The Rewrite returns a typed HTTP 500 for this
invalid stored metadata, without creating a group/person snapshot; a repaired
roster permits the next login to capture the exact repaired label. Absolute
access-window checks still apply. Existing snapshots are immutable and are not
retroactively reconstructed from a later roster.

[Unchanged production Source run 40038272672](https://github.com/jurei733/testcenter-rewrite/actions/runs/40038272672)
passes **41 HTTP groups**, retaining all previous 32 controls and adding eight
raw label vectors plus a monitor-first lifecycle control. Complete public bytes
and their SHA-bound provenance are in
[the new fixture manifest](../test-fixtures/original-testcenter/source-workspace-results/group-labels/manifest.json).
The initial probe's empty-label success assumption failed against actual Source;
the final probe asserts its observed failure, absence of a frozen bad snapshot
and subsequent repair. Source is unchanged, test mode is off, actual XSD/upload/
authentication are used, and owned containers/volumes retire.

Local qualification passes **3,944 unit/frontend checks** and **2,072 PostgreSQL
checks** with the implementation. The later Source-receipt-only regression also
passes in the final **143-case** focused command across all four stores and
protected PostgreSQL HTTP; protected SQLite HTTP is included in the complete
unit run. Complete protected API suites additionally pass **173 checks each**
in Memory, File and SQLite. The owned PostgreSQL database is removed and its
initially stopped cluster is stopped again. This focused process takes
**6.38 seconds after core build**. CI policy
passes **264** checks with one explicit GNU-timeout-only macOS skip. Typechecking
and fresh production build pass; the initial entry remains **468.39 kB** under
the unchanged 470 kB limit. No schema migration is needed. These checks qualify
the described label path, not the remaining native pages or complete hosted
acceptance of the final tree.

The monitor-first control proves that a monitor's successful credential login
freezes the group label before any participant person exists, even after roster
replacement. It defines the still-open Rewrite monitor-login requirement; the
label correction alone does not implement that lifecycle.

The Rewrite persists `OriginalParticipantGroup` separately from participant
rosters, person sessions and Test runs. This is the data foundation for the
remaining native Results and Tests pages; those pages remain partial.

## Credential lifecycle

The first successful participant credential validation creates a group snapshot
within the tenant/workspace scope. Absolute access windows are checked before
creation. A missing or incorrect person code can still prevent person-session
creation after the group has been captured, matching Original's separate login
and person steps. Invalid passwords, unknown logins and closed absolute access
windows create no group.

The snapshot preserves the first server-resolved `groupKey`, `groupLabel`,
`createdAt` and `lastModifiedAt`. Reimporting a roster, repeating a code error,
logging in again or opening another person session does not overwrite it. Inputs
for label and timestamps sent by an HTTP caller do not supply snapshot metadata.

The new repository methods are internal, scoped ports, not public management
endpoints. `getOrCreateOriginalParticipantGroup` returns `null` if the workspace
has been removed; `listOriginalParticipantGroupsByWorkspace` returns defensive
copies. Creation and lookup share one write boundary:

| Store | Boundary |
| --- | --- |
| Memory | Synchronous scoped lookup and insertion |
| File | Existing writer queue and atomic manifest publication; an existing snapshot does not rewrite the manifest |
| SQLite | `BEGIN IMMEDIATE`, including parent-workspace lookup |
| PostgreSQL | Transaction and parent-workspace row lock, including first insertion |

Source uses the ICU collation `de-DE-u-ks-level2`. The Rewrite uses a shared
`Intl.Collator` with accent sensitivity within the locked workspace, rather than
using a lowercase string as a unique Unicode identifier. SQL keeps a binary
composite primary key; the workspace lock also serializes equivalent spellings
when no group row exists yet. Case, composed/decomposed accents, accent
distinctions and concurrent first creation have storage controls. These selected
controls do not establish equivalence for every Unicode string or ICU version.

## Persistence and upgrade

SQLite migration **67** and PostgreSQL migration **61** add
`original_participant_groups`. The file manifest adds the
`originalParticipantGroups` collection; older manifests default to an empty
collection. No migration reconstructs historical labels or times from current
rosters or old sessions. Existing answers, sessions and result clocks are
preserved. Workspace cascade deletion removes its snapshots in the same existing
write boundary and retains snapshots in other workspaces.

The snapshot times are ISO server timestamps internally. Native result timestamps
must be projected as whole Unix seconds, consistently with the independent Source
Test-row clock evidence. Client response timestamps continue to use milliseconds.

## Qualification and open scope


[Actual Source run 40025829117](https://github.com/jurei733/testcenter-rewrite/actions/runs/40025829117)
passes **32** HTTP groups on unchanged Original
`eedae41840cbe90e5547c0211da818bdf620f5aa`, including the existing 29 result/clock
controls. The three additions prove pre-code label capture across a real roster
replacement, the case/composition/accent examples above, and snapshot recreation
with the current label after native whole-group deletion. Apache, PostgreSQL and
Redis use the actual production path with `TestMode=false`; no SQL seed or Source
patch creates this evidence. Source stayed clean and owned containers/volumes
were removed successfully. The complete public artifact and SHA-bound provenance
are committed under
`test-fixtures/original-testcenter/source-workspace-results/group-snapshots`.
The Source-only deletion control defines remaining Rewrite work; it does not
qualify a native Rewrite deletion implementation.


Run `npm run test:original-results` for a fresh core build and focused archive,
Test clock, group snapshot and protected HTTP checks. These cases also run in the
mandatory unit and real PostgreSQL gates. No Angular build is needed for that
iteration command.

The controls cover first valid credentials before code entry, later roster
imports, invalid authentication and access windows, server-owned metadata,
concurrent creation, scope separation, durable reopen, unknown legacy history,
failed file/SQL creation and workspace cleanup. Protected SQLite and PostgreSQL
HTTP checks use actual admin bootstrap, roster import and participant sign-in.

The canonical Results cards and exports still have their existing contracts.
They do not yet consume this snapshot as a native Original result table. The
native group clock after selected-Test deletion, whole-group native session and
snapshot deletion, monitor-login creation, explicit native workspace grants, individual download
routes and paired-page visual proof remain open. Existing canonical group-result
deletion retains person sessions and is not a substitute for Original's whole-group
session deletion. No complete group-parity claim follows from this foundation.
