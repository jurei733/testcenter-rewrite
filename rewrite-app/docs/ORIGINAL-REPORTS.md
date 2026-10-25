# Native workspace report output

## Status and evidence boundary

The dedicated `original-workspace-report-wire.ts` component renders Source-shaped
response, log, legacy-review and enhanced-review records. Its mandatory suite now
compares **24 exact CSV bodies and four exact raw HTTP JSON bodies**. Twenty CSVs
come from five retained production Source families: Source27, group labels, lock
clocks, native-person lifecycle and native person labels. Their JSON documents
are normalized probe output, so they support value comparisons rather than raw
JSON byte equivalence. The new Source28 Oracle retains four CSV and four JSON
bodies exactly as returned through production HTTP. All eight match the renderer
byte for byte, including nested response JSON and numeric review categories.
Every member has a SHA-256 manifest and pinned Source
`eedae41840cbe90e5547c0211da818bdf620f5aa`.

[Source28 run 40208546516](https://github.com/jurei733/testcenter-rewrite/actions/runs/40208546516)
is terminal **success: 28 control groups / 159 HTTP observations**. All preceding
21 native auth/cascade controls and their exact assertion lines remain. Actual
Login/person ALTCHA, admin XSD uploads and production Apache/PHP/PostgreSQL run
without TestMode, SQL seeds or Source patches. The public artifact 12604982552 is
17,980 bytes, ZIP SHA-256
`e18bf955637a77773f22a6d8fb353fbe8a3f7f003f8d35f32526c758706ee719`.
Probe head `5010312460a7dfb0b569028099a03b8d10e29e0c`, tree
`056eab5f7a8649c7b010e31201a4dc4324c0da5f`; exact probe/Compose/workflow copies,
eight raw report bodies, redacted receipts and 21 unchanged Source file hashes are
retained under `test-fixtures/original-testcenter/source-workspace-results/native-unit-reports`.

The string dialect follows PHP's [documented JSON options](https://www.php.net/manual/en/json.constants.php)
and [UTF-8 input requirement](https://www.php.net/json-encode). Category collection
combines non-strict [array_keys](https://www.php.net/array_keys) with stable
[asort](https://www.php.net/manual/en/function.asort.php) comparisons; the integer
overflow fallback is translated from [Zend's string comparison](https://github.com/php/php-src/blob/PHP-8.3/Zend/zend_operators.c), rather than
collapsing distinct 64-bit or overflowing numeric strings through JavaScript Number.
The native fixture runtime is PHP 8.3.36. Source28 qualifies actual numeric
first-spelling/strict-membership, empty-token and overflowing-integer categories
through production review/report HTTP. Additional extreme numeric spellings still
have static-source and owned controls rather than their own live PHP receipt.

This is a serialization foundation. No native report HTTP endpoint, database
projection, current-file XML label reader or production result action is connected
yet. The canonical three-report ZIP is unchanged. The four native downloads,
numeric Source workspace/admin permission mapping and paired result-page visuals
remain open. The formal ledger remains **27 done / 22 partial**, all eight broad
visual rows open, with approximately **4–8 engineering weeks** remaining.

## Output contract

- CSV uses the existing Source BOM/semicolon dialect, quotes every non-null cell,
  doubles quotes, preserves exact UTF-8 strings, and has LF row separators without
  a trailing newline. Null cells remain unenclosed gaps.
- JSON uses PHP's default escaped Unicode and slash dialect, without a final
  newline. Response arrays embedded in CSV use this same JSON dialect, while
  ordinary CSV cells retain actual UTF-8 and literal slashes. Malformed Unicode
  and non-finite JSON values fail instead of producing plausible replacement data.
- Empty reports produce **zero bytes** in both formats, including both review
  versions. They do not emit `[]`, a CSV header or a BOM.
- Response fields retain DAO JSON order, separate from CSV column order. Each
  response part supplies its own stored timestamp and response type. The renderer
  never substitutes a Run timestamp, global latest data type or current roster code.
- Log and review row sequences remain caller-owned, matching Source's unsorted
  `UNION ALL`; the renderer does not introduce timestamp sorting or truncation.
- Legacy reviews use `category: NAME` with `X`/null, keep entry in its original
  position, and omit reviewer/labels. Enhanced reviews use boolean JSON categories
  or CSV TRUE/FALSE, keep reviewer, move entry to the end, then append labels.
  Category collection retains PHP numeric-string comparison, first spelling and
  strict selected-category membership, including its empty-token behavior.
- Enhanced labels come exclusively from a supplied current-file reader. Missing
  files produce empty labels; the renderer has no frozen-release fallback.
- The timestamp helper requires the stored review instant and an explicit system
  timezone. It renders seconds, handles the DST transition, returns null for an
  observed epoch at/before zero and rejects unavailable timestamps/timezones.

## Required repository and transport follow-up

The existing canonical archive cannot simply supply these inputs unchanged:

1. Native identity must join current binary Login bindings to native people and
   their first stored name suffix, plus the first stored Test name. Current roster
   code and mutable labels do not replace that history. Foreign and canonical
   extension records must remain outside native reports.
2. Saved Unit initialization and its first original Unit ID need independent
   persisted evidence. Source28 confirms response writes return HTTP404 before
   initialization, while a state write can create an owned Unit alias absent from
   the Booklet. The first caller-supplied original Unit ID survives later state
   and review writes. A Unit definition read or raw Unit log alone does not create
   a Source Unit; review deletion retains an initialized Unit. Laststate needs
   Source keys and PostgreSQL JSONB text, including its stored ordering/spacing.
3. Existing per-field clocks provide per-part timestamps, but the latest combined
   `unitStateDataType` cannot recover an older part's response type after another
   part changes type. Source28 proves four parts retain independent clocks/types,
   a newly inserted part can share an older clock, equal/stale writes preserve
   existing parts and an omitted type becomes `unknown`. Preserve accepted types
   with their writes; do not invent legacy history or use `Run.updatedAt` for them.
4. Enhanced labels must parse the actual current physical Booklet XML, preserving
   authored padding, empty labels and alias behavior. Delete/replacement and state-
   parameter Test names need coverage. A frozen content release is insufficient.
5. Native HTTP must retain Source Accept negotiation and default JSON, raw group
   filtering, empty HTTP200 bodies,
   private/no-store caching, protected workspace read access and fixed metrics
   identities. All four download actions then need real browser qualification.
   Keep the layers distinct: DAO `null` means all groups and `[]` means none;
   Source HTTP maps an absent or empty `dataIds` string to all groups, and splits
   a nonempty string on commas without trimming.

The new suite stays in complete unit, PostgreSQL and focused Original-results
inventories. Its pure output controls do not substitute for actual store, HTTP,
authorization or visual evidence at those unfinished boundaries.

The preceding serialization application passes **4,286 complete unit/frontend**
checks, including 32 new output controls, and [focused Linux/PostgreSQL run
40207496041](https://github.com/jurei733/testcenter-rewrite/actions/runs/40207496041)
passes **558 result controls / 100 seconds**, 282 Linux policy checks and a
zero-vulnerability audit. The new Source28 reference adds independent provenance,
privacy, Unit/part lifecycle and raw-body controls; its follow-up qualification is
separate. No database adapter, schema, existing archive output or participant
browser behavior changes, and no new complete PostgreSQL count or full-acceptance
result is inferred from these output-only controls.

The Source28 follow-up passes **4,293 complete local unit/frontend checks**,
including all 39 report controls, without failures/skips/cancellations. Policy
passes 280 plus one explicit GNU-timeout-only macOS skip; Actionlint/diff pass.
The application renderer is unchanged from the preceding accepted focused run.
