# Original participant group snapshots

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
snapshot deletion, monitor-login creation, complete Original label preservation
through the import parser, explicit native workspace grants, individual download
routes and paired-page visual proof remain open. Existing canonical group-result
deletion retains person sessions and is not a substitute for Original's whole-group
session deletion. No complete group-parity claim follows from this foundation.
