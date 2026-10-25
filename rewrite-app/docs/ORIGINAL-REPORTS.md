# Native workspace report output

## Status and evidence boundary

The dedicated `original-workspace-report-wire.ts` component renders Source-shaped
response, log, legacy-review and enhanced-review records. Its mandatory suite
compares **20 exact CSV bodies** from five independently retained production Source
fixtures: Source27, group labels, lock clocks, native-person lifecycle and native
person labels. Each input/output member is checked against its existing SHA-256
manifest and pinned Source `eedae41840cbe90e5547c0211da818bdf620f5aa`.
JSON comparisons retain all corresponding values and field order; explicit dialect
controls cover PHP Unicode/slash escaping, including nested response JSON.
The retained JSON fixtures are normalized probe documents, so these comparisons
do **not** claim twenty original HTTP JSON bodies byte for byte.

The string dialect follows PHP's [documented JSON options](https://www.php.net/manual/en/json.constants.php)
and [UTF-8 input requirement](https://www.php.net/json-encode). Category collection
combines non-strict [array_keys](https://www.php.net/array_keys) with stable
[asort](https://www.php.net/manual/en/function.asort.php) comparisons; the integer
overflow fallback is translated from [Zend's string comparison](https://github.com/php/php-src/blob/PHP-8.3/Zend/zend_operators.c), rather than
collapsing distinct 64-bit or overflowing numeric strings through JavaScript Number.
The native fixture runtime is PHP 8.3.36. This translation has static-source and
owned edge controls; no fresh live PHP differential run is claimed.

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
   persisted evidence. A Unit definition read or raw Unit log alone does not create
   a Source Unit; review deletion must retain an initialized Unit. Laststate needs
   Source keys and the actual stored-state representation.
3. Existing per-field clocks provide per-part timestamps, but the latest combined
   `unitStateDataType` cannot recover an older part's response type after another
   part changes type. Preserve accepted part types with their writes; do not invent
   unknown legacy history or derive all part clocks from `Run.updatedAt`.
4. Enhanced labels must parse the actual current physical Booklet XML, preserving
   authored padding, empty labels and alias behavior. Delete/replacement and state-
   parameter Test names need coverage. A frozen content release is insufficient.
5. Native HTTP must retain Source Accept negotiation and default JSON, raw group
   filtering, absent/all versus explicit empty selections, empty HTTP200 bodies,
   private/no-store caching, protected workspace read access and fixed metrics
   identities. All four download actions then need real browser qualification.

The new suite stays in complete unit, PostgreSQL and focused Original-results
inventories. Its pure output controls do not substitute for actual store, HTTP,
authorization or visual evidence at those unfinished boundaries.

Local qualification passes **4,286 complete unit/frontend checks**, including
32 new report controls, with no failures/skips/cancellations. The fresh core build
and Actionlint/diff checks pass. CI policy passes 280 controls plus one explicit
GNU-timeout-only macOS skip. No database adapter, schema, existing archive output
or participant browser behavior changes; no new complete PostgreSQL count or
hosted full-acceptance result is inferred for this isolated follow-up.
