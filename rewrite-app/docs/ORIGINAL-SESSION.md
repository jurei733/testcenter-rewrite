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


### Source-paired native Testlog candidate (2026-10-28; Linux integration pending)

The candidate adds metadata-owned atomic `appendOriginalTestLogs` to all four stores and protected literal `PUT /test/:id/log`. Person and metadata-only ownership checks precede body decoding; the current numeric mapping and immutable parent scope are checked again inside the append transaction. Whole batches are validated before writes. Existing artifact IDs cannot be overwritten, including an own ID named `__proto__`. Empty batches only validate ownership; repeated payloads receive distinct IDs. No Run, Unit, controller, revision, response, presence or timer is rewritten.

The production Source oracle [40604121346](https://github.com/jurei733/testcenter-rewrite/actions/runs/40604121346) passed 48 groups, preserving all 41 prior groups and 80 literal assertions. Unmodified pinned Original runs under Apache/PHP 8.3.36 with genuine ALTCHA and protected uploads, without SQL seeds or test mode. Its 284 HTTP observations and 36 Source file hashes establish defaults, whole-batch rejection, duplicates, no-ops, ownership-before-body ordering and lock-independent append. Artifact 12780616116 has 29,865 bytes and SHA256 `3deec3bb689d89f1c337529cabb7318b409864aac52b0b9d3db690039c4665a6`. Raw protected JSON/CSV reports establish already PHP-encoded content, including numeric-zero falsiness. Malformed nonempty JSON returns HTTP500 with generic `Internal error.`; a zero-byte body returns HTTP400.

Three cumulative production oracles extend this evidence without removing prior groups or assertions. Each retains the same 36 pinned Source hashes and immutable raw protected reports:

- [Source51 / 40618525961](https://github.com/jurei733/testcenter-rewrite/actions/runs/40618525961): NUL/Unicode content, strict field types, signed floating zero and exact raw JSON numbers. Artifact 12785833669: 35,196 bytes, SHA256 `4241fb86af0b06aba5201968414238505268497890612425cb69c0a5c8a37f4a`.
- [Source52 / 40620574561](https://github.com/jurei733/testcenter-rewrite/actions/runs/40620574561): full signed int64 client timestamps, PDO truncation of NUL-containing keys, numeric property order, duplicate property replacement, JSON depth boundaries and rejection of nonfinite decoded numbers. Artifact 12787546117: 40,935 bytes, SHA256 `75103da43efe5964d44823ef4dd71cfae693b8aaf57299868352c4f7c3f3e15d`.
- [Source53 / 40624110311](https://github.com/jurei733/testcenter-rewrite/actions/runs/40624110311): 177 actual PHP float encodings, comprising specified edge values and deterministic finite IEEE-754 samples, submitted as raw HTTP JSON. Artifact 12789120697: 65,859 bytes, SHA256 `bd4148ca1d3027d5fb2c81719d16dfed131338dad96228a4035bcb3632a55c00`.

The native-only decoder retains raw int/float distinctions and object property order after strict UTF-8/JSON validation and the existing request-byte bound. It rejects invalid Unicode, excessive depth and unsupported native values. Content is encoded once using the observed PHP dialect. Exact wide client clocks survive Memory/File reopening, SQL int64 reads and generic log saves using validated decimal metadata; native report JSON and CSV keep their original digits. Native log IDs are distinguished from state/presence events so a caller-controlled key or extreme client timestamp cannot become controller state. Optional null/missing content becomes an encoded empty string, timestamp zero remains zero, and client CONNECTION logs do not synthesize server-CONNECTION markers. Source-style HTML errors retain escaped messages, an opaque Error-ID, Test-Mode:NO and private no-store caching. Wrong-kind capability denial omits the Source bearer echo, and route logging uses a redacted template.

Local verification passes 217/217 native creation/read/Unit/log cases across Memory, File, SQLite and actual PostgreSQL14.9, with zero skips and owned database/server cleanup. Tests reproduce complete Source51 (14 rows), Source52 (23 rows) and Source53 (200 rows) protected JSON/CSV bytes after durable reopening; actual SQL-backed HTTP tests also submit every 177 float token and the exact int64 boundaries. Generic save/reopen and presence checks protect the distinction between log-only and state events. Fresh core/web builds, complete type checks and locked dependency audit pass; the audit finds zero vulnerabilities. All 12 production-built protected-browser markers pass locally, including genuine WebCrypto-authenticated native Testlog append and unchanged Test/Unit state. All 4,477 unit/frontend tests pass without skips. Local policy checks pass 325 cases with their one explicitly Linux-only case skipped on macOS; native Linux qualification remains required.

Report comparisons establish collection/formatter parity using Source insertion order; the literal native report and lock endpoints and production frontend adoption remain open. Linux integration and full candidate acceptance remain required. No broad functional or visual row closes.
