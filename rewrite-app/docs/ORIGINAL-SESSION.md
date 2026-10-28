# Native participant Session boundary

The participant boundary implements the Original paths `PUT /session/login`,
`PUT /session/person`, `GET|PUT|DELETE /session`, `POST /session/challenge` and
`POST /session/person/challenge`. It uses `AuthToken` and the Original participant
AccessSet shape. Canonical RPC authentication remains available. Native admin and
operational AccessSets, `/session/admin`, numeric administration and
production native-transport adoption are still outstanding. Unit transport is
implemented in the candidate described below. This does not establish
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
The native Unit candidate below extends these paths; report HTTP/UI remains open. This does not
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
mixed native Unit adoption, ZIP resource dependency edge cases, numeric administration,
report HTTP/UI and paired broad visuals remain separate open work.

## Native Unit transport candidate (2026-10-26)

[Unchanged production Source41](https://github.com/jurei733/testcenter-rewrite/actions/runs/40256816222)
passes 41 groups and 231 HTTP observations, with all 37 previous groups and
74 assertion lines retained. Its 16-file fixture pins 34 Original source hashes,
the exact probe, production Apache/PHP receipt and eight raw report files.
Actual ALTCHA/admin uploads create every fixture; TestMode stays off, with no SQL
Test seeds or Source patches.

`GET /test/:number/unit/:physicalId[/alias/:alias]` returns the five Source fields:
state, dataParts, unitResponseType, definition and definitionType. Definition and
normalized Player identity come from current physical workspace files. An absent
saved Unit returns empty objects and an empty response type. Reading does not
create a Unit, open a Test, start a controller or modify Test clocks. PHP-falsy
alias `0` falls back to the physical Unit name. Test ownership is checked from
indexed metadata; SQL Unit access does not decode unrelated canonical responses,
with positive owned and foreign decoder controls.

`PATCH /test/:number/unit/:name/state` accepts both the legacy array and the
`{newState, originalUnitId}` body. Unlike Test state, Unit field clocks persist
across packets; equal/stale/zero updates do not replace an accepted value. Every
submitted entry is logged. The first stored Unit name and original ID survive
case-equivalent writes. Units outside current Booklet assignments are allowed.
State, clocks and logs publish atomically.

`PUT /test/:number/unit/:name/response` requires an initialized Unit and merges
each data part with its own strictly increasing clock and durable response type.
A new part can have clock zero; an omitted type defaults to `unknown`. A stale
part cannot change its content/type or suppress a new sibling part. The legacy
GET exposes one response type from its final stored part, matching the qualified
Source case; Source's SQL query itself has no general ordering guarantee.
`PUT /test/:number/unit/:name/log` accepts legacy arrays and `{logEntries}`.
Log-only writes create no Unit. Unit GET/state/response remain independent of
Test locks and execution-mode response-saving policy, as Source41 demonstrates.
JSON reads and empty HTML write responses use private/no-store caching.

SQLite75/PG69 persist a scoped Unit row separately from the canonical Run. Unit
packets avoid decoding/replacing the complete Test payload. Parent/Run locks
serialize first creation and German case-equivalent aliases with deletion and
canonical writes. File cache publication follows durable commit. Result-group
inventory reads only Unit identities, includes actual saved native Units and
does not decode their private JSON. Generic Run, group and workspace deletion
retire Unit rows; old schemas receive no fabricated Unit clocks.

Canonical legacy data without native field-clock provenance returns explicit409.
A later canonical response change marks an existing native row's history unknown,
preserving its first identity; stale native values are not returned as current.
Valid Unit fields/part strings, Unicode, original SQL string lengths and bounded
payloads are validated before publication. Full mixed-transport adoption and
native result/report projection remain open, together with Test-log HTTP,
numeric administration, ZIP dependency edges and the eight broad visual rows.
This candidate extends existing mandatory service/unit/PostgreSQL and protected
browser inventories; full candidate qualification remains required.


### Native Testlog append storage preparation (2026-10-28; not endpoint parity)

A separate candidate adds a metadata-owned atomic `appendOriginalTestLogs` operation to Memory, File, SQLite and PostgreSQL. It rechecks the current numeric mapping and immutable parent scope before examining append rows, validates the whole batch, rejects artifact identity collisions and inserts without rewriting any Run, parent, Unit, controller, presence, revision, response or timer. SQL paths transport identity columns only and retain the existing scoped parent locks. Empty packets append nothing; repeated packets with new artifact IDs remain separate rows.

Fresh core compilation and the complete existing native Test creation/read/Unit suite pass locally: 105 Memory/File/SQLite cases, then 149 cases across all four stores on actual PostgreSQL 14.9. Meaningful additions cover durable reopening, an own durable artifact ID named `__proto__` across all four stores, exact zero timestamps, duplicate payloads versus duplicate IDs, every foreign parent column, validation of a whole batch before writes, actual late INSERT failures, actual File publication failure/cache rollback, retired mappings and actual owner writes while unrelated canonical response JSON is malformed. The owned temporary PostgreSQL database is removed and its previously stopped owned cluster is stopped again. These are local storage results, not native Linux endpoint qualification.

No OriginalTest service method, literal Testlog HTTP route, production frontend/report adapter or broad acceptance row is added by this storage preparation. The separate prepared production-PHP oracle retains every 41 prior group and 80 literal assertion lines, adding seven Testlog groups; it has not run yet. Its protected JSON/CSV reports must establish the exact new boundary before endpoint/report parity is claimed. Static pinned Source inspection identifies optional null/missing content defaults, PHP-falsy encoded numeric zero and the Source's malformed-JSON HTTP500 behavior. Those findings must not be silently replaced by assumed request/error semantics. The existing canonical report formatter quotes strings, so adoption of already PHP-encoded native log content also needs an explicit, evidenced transport boundary.


### Source-paired native Testlog endpoint candidate (2026-10-28; Linux integration pending)

The separate production Source oracle [40604121346](https://github.com/jurei733/testcenter-rewrite/actions/runs/40604121346) now passes all 48 groups, retaining the 41 prior groups and 80 literal prior assertions. It exercises unmodified pinned Original under production Apache/PHP 8.3.36, genuine ALTCHA and protected uploads, without SQL seeds or test mode. Its 284 HTTP observations and 36 Source file hashes establish the append defaults, whole-batch rejection, duplicate/no-op behavior, permission-before-body ordering and lock-independent append. Independently verified artifact 12780616116 has 29,865 bytes, SHA256 `3deec3bb689d89f1c337529cabb7318b409864aac52b0b9d3db690039c4665a6`, 14 safe members and no database. The raw protected JSON and CSV reports establish the already PHP-encoded native log content, including numeric-zero falsiness. Actual malformed JSON returns HTTP500 and the exact generic body `Internal error.`; zero-byte body returns HTTP400.

This candidate adds the OriginalTest service append and literal protected `PUT /test/:id/log`, with metadata-only person ownership checked before JSON decoding and mapping/ownership rechecked by the atomic store transaction. Optional null/missing content becomes an empty string; timestamp zero remains zero and does not synthesize a server-CONNECTION marker. Empty packets perform ownership validation without changing Test/Unit/Run state. All append rows carry native numeric Test ownership and null Unit identity. The native log formatter handles its already encoded content separately. Error responses retain the Source HTML media type, escaped messages, an opaque Error-ID, Test-Mode:NO and private no-store caching. Wrong-kind capability denial deliberately omits the Source's bearer echo. The route logger uses a redacted route template. Unexpected backend faults still reach the existing global error handler.

Fresh core/web builds, complete type checks and locked dependency audit (zero vulnerabilities) pass locally. All 4,447 unit/frontend cases pass without skips. The complete native creation/read/Unit/log suite passes 178/178 cases across actual Memory/File/SQLite/PostgreSQL14.9, without skips; the owned database and server are cleaned up. Actual SQL-backed HTTP tests cover authorization before malformed bodies, typed PHP encoding, complete-batch rollback, malformed/empty bodies, exact errors, defaults, no-op and padded numeric IDs. Protected Source-paired log collection and JSON/CSV formatting reproduce all 15 Source report rows byte-for-byte: 14 actual append rows and one separately established Source-known lock fixture. This is formatter proof, not an implemented candidate lock/report endpoint. All 12 existing-plus-new production-built protected-browser markers pass locally, including the new real WebCrypto-authenticated Testlog append and unchanged Test/Unit state. Native Linux qualification, complete integration and production report/lock/frontend adoption remain open. No broad functional or visual row closes.
