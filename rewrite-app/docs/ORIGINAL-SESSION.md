# Native participant Session boundary

The participant boundary implements the Original paths `PUT /session/login`,
`PUT /session/person`, `GET|PUT|DELETE /session`, `POST /session/challenge` and
`POST /session/person/challenge`. It uses `AuthToken` and the Original participant
AccessSet shape. Canonical RPC authentication remains available. Native admin and
operational AccessSets, `/session/admin`, native numeric Unit reads/writes and
production UI adoption are still outstanding. This boundary does not establish
paired visual parity.

The Source21 Login receipt and Source16 protected ALTCHA receipt are checked
against their pinned hashes in `scripts/original-session.test.mjs`. Tests upload
actual Player, Unit and Booklet XML; authentication does not activate a release
or create a Test. Current physical Booklet labels and current code buckets feed
the claims. ASCII case collisions retain the last whole authored bucket, then
append common Booklets in Source order. Current grants stay separate from already
owned Tests. Immediate responses use current Login group labels; person reads use
the exact credential-stage group snapshot and first stored person suffix.

Test `running` reflects known first-opening history, including paused/completed
Tests. Missing or ambiguous historical identities fail explicitly. The four
adapters expose a metadata-only Test projection; SQL does not select responses
or timers. Active negative decoder controls prove that reading the complete Test
would decode private response data while the AccessSet read does not.

The browser receives Source's five SHA-256 challenge fields. Its opaque salt
contains an AES-256-GCM authenticated encrypted credential ticket rather than
plaintext credentials. The ticket has a bounded lifetime, server-configured work,
current/previous key support and a durable one-use claim. Person work is bound to
the exact Login token; a peer token cannot consume it. Challenge limits follow
the existing deployment JSON body budget. Responses use `private, no-store`.
Configured participant/person protection also covers Source's empty-password and
`"0"` bypass cases. Source's observed replay and cross-Login acceptance are
deliberately not copied; the Rewrite retains its stronger security requirements.

The mandatory suite covers Memory, File, SQLite and PostgreSQL, real HTTP,
restart/durable replay, concurrent claims, expiry, key rotation, scope/type
denials, group-label imports, empty view settings, review grants and exact
Source-shaped AccessSets. It is included in complete unit/PostgreSQL acceptance
and both relevant focused service suites.

`npm run smoke:ui:original-session:built` uses an owned SQLite API, real admin
uploads and Chromium WebCrypto to solve work and verify typed Login/person
rotation, raw codes, replay denial, reload and empty 205 logout. It also creates an unopened native Test and signs in through the actual protected
Original-style UI: single-Booklet auto-entry opens that same Test and starts its
controller after a genuine Verona 6.0 fixture handshake. Native Session HTTP
adoption by production UI remains open. It runs after
the existing protected UI smoke in the mandatory quick proof-of-work CI cell;
the earlier smoke and all complete acceptance gates remain required.


## Unopened native Test creation (2026-10-26)

`PUT /test` accepts a genuine Original person `AuthToken`. Login, group and admin
capabilities cannot create a Test. Authentication precedes JSON parsing; the
operator boundary does not substitute for the participant capability. Success is
HTTP 201 with raw decimal bytes and `text/html; charset=UTF-8`, under
`private, no-store`. The decimal identity is separate from private Run UUIDs and
remains lossless through the signed 64-bit range.

[Unchanged production Source33](https://github.com/jurei733/testcenter-rewrite/actions/runs/40241983022)
qualifies 33 groups and 188 HTTP observations on pinned Original `eedae41840cbe90e5547c0211da818bdf620f5aa`,
with production Apache/PHP, actual ALTCHA and admin XSD uploads, TestMode off and
no SQL Test seeds or Source patches. The 16-file evidence fixture retains all
28 prior groups/53 assertion lines and checks its pinned hashes in mandatory CI.

The raw requested name is compared first using the qualified German comparison.
An owned raw-name hit returns its stable number even after physical-file deletion.
A raw miss requires the current physical Booklet, then applies Source's ASCII
whitespace/preset normalization, including duplicate values in first-key order.
Unassigned physical Booklets are allowed. Repeated/case-equivalent requests reuse
one Test; normalized reservation attempts may consume number gaps. The first raw
physical label and first name remain unchanged after replacement; a locked Test
returns 423 with its first label. Numeric gaps are not a public contiguous count.

Creation commits an unopened Run, number and first content binding atomically.
It creates no controller entry, current Unit, timer, response, TestLog or group
result row. Review-mode creation is allowed. Existing assignment claims remain
unchanged and report running=false. Subsequent canonical controller entry handles
the created Run under the same parent/Run writer fence, initializing its controller,
timer and initial artifacts once, including simultaneous entry requests.

SQLite migration 73 and PostgreSQL migration 67 add scoped unique number mappings,
a durable global decimal counter and cascading Run/person foreign keys. Memory
and File use equivalent scoped collections; File publishes its cache only after
its durable write. Existing Run writes cannot overwrite the separate identity.
Native group, generic Run and whole-workspace deletion remove mappings while
retaining the counter.
Legacy migrations create empty mappings and never guess historical numeric IDs.

Mandatory `scripts/original-test-creation.test.mjs` runs in complete unit,
PostgreSQL and focused Original-results gates. It covers actual legacy upgrade
and late DDL rollback, late File/SQL creation rollback, durable retries, role/scope
denials, raw HTTP, independent PostgreSQL writers, concurrent controller entry
and mapping cleanup. The following slice adds Test reads/state/resource transport.
Native Unit writes and report HTTP/UI projection remain open. This does not
establish complete native transport or paired visual parity.

## Native Test reads, saved state and group resources (2026-10-26)

[Unchanged production Source37](https://github.com/jurei733/testcenter-rewrite/actions/runs/40249046818)
qualifies 37 groups and 207 actual HTTP observations, retaining all 33 previous
groups and 65 assertion lines. Its 16-file fixture pins the probe, production
image/PHP receipt and 31 Original source hashes. TestMode remains off; actual
ALTCHA and admin uploads create the fixtures without SQL Test seeds or patches.

`GET /test/:number` requires the owning person and returns Source's seven fields:
mode, laststate, xml, resources, firstStart, workspaceId, presetBookletStates.
It opens once under the parent/Run writer fence, without entering a Unit,
starting a controller/timer or writing logs/state. Current physical Booklet XML
and Unit resource dependencies are used; first stored Test identity stays fixed.
Workspace numbers use a separate durable decimal mapping and lossless int64
wire formatting. A SQL foreign-number lookup rejects before decoding private
Test state, with an owned decoder-failure control. Unknown historical saved state
returns 409 instead of inventing a history. Locked reads return 423.

`PATCH /test/:number/state` preserves typed scalar/array values and PHP's encoded
object strings. Clocks reset for each packet: the greatest positive timestamp
wins within one packet, equal timestamps keep the first entry, and a lower clock
in a later packet can replace a previous value. Every input entry is logged,
including ignored duplicates/zero clocks. Null content fails before publication.
Native state remains writable in review mode. State, server clock and logs commit
together; generic stale snapshots cannot replace independently saved native state.
Native log identity collisions fail atomically. Existing progress-delivery retry
semantics keep their separate stable-ID upsert behavior.

`GET /file/:groupToken/ws_:workspaceNumber/:path` accepts the current group
capability for Resource files only. It preserves current physical bytes, including
binary data, and Source MIME, `private` cache and `X-Source: backend` headers.
Person/Login tokens, foreign or inactive scopes, non-Resource paths and traversal
are rejected. Logs/metrics replace capability-bearing paths with fixed labels,
including encoded invalid route spellings. Replaced files invalidate the bounded
catalog cache; direct resource reads avoid rebuilding the XML catalog.

SQLite 74/PostgreSQL 68 add nullable saved native state and workspace mappings.
Legacy upgrades create empty mappings/state provenance. New workspace allocation
is atomic with creation; deletion retires mappings while keeping counters.
Mandatory existing gates cover real migration/open/state rollback, binary HTTP,
restarts, foreign decoder fences and independent concurrent PostgreSQL writers.
The existing Chromium Session smoke keeps all eight previous markers and adds
native Test read/state and group-resource markers. Production frontend adoption,
native Unit transport, ZIP resource dependency edge cases, numeric administration,
report HTTP/UI and paired broad visuals remain separate open work.
