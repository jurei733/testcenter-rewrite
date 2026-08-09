# Original Testcenter compatibility corpus

These fixtures are pinned from IQB Testcenter commit
`284a4ffcd9452d56dddd51939707ac7f646c3da7` (2026-04-20). Their source
paths and executable expectations are declared in `corpus.json`.

The coding-scheme corpus also pins the official MIT-licensed
`@iqb/responses` 3.6.0 `SOLVER/case1` scheme, input, and expected outcome at
commit `e04e585e6514e5257ac42f48b629628326471f90`. Those byte-exact fixtures are
kept versionless on purpose: they exercise the same legacy normalization used
by the original Testcenter, including base-variable aliases, chained solver
derivation, successful decimal calculation, `NO_CODING`, and `DERIVE_ERROR`.
The same pinned release contributes the byte-exact `UNIQUE_VALUES` scheme plus
case-03 input and outcome. That second family covers dependent derivation,
derived code/score, boolean results, and the `REMOVE_ALL_SPACES`,
`REMOVE_DISPENSABLE_SPACES`, `TO_NUMBER`, and combined lower-case/space
processing paths. Four further byte-exact families complete the release's
derived-value core: `CONCAT_CODE/01`, `COPY_VALUE/03`, `SUM_CODE/02`, and
`SUM_SCORE/02`. They retain alias-aware concatenation, sorted and chained
codes, explicit code/score zeroes, missing-input `UNSET`, dependency
`DERIVE_ERROR`, partial-input `INVALID`, and derived recoding. Every source
path and hash is recorded separately in `corpus.json`. The versioned 3.0
`array-length-check` family adds both official cases for AND-connected rule
sets, `ANY_OPEN`, `LENGTH`, automatic residual zeroes, derived `SUM_SCORE`,
and sorted adaptive-array comparison. The deliberately versionless `arrays`
family adds all four official cases for `SORT_ARRAY`, numeric array positions,
`SUM`, `ANY_OTHER`, `ANY`, untouched raw array values, and the ambiguous
multi-value result `CODING_INCOMPLETE`. The versionless `fragmenting` family
adds its official regex case, including first/second capture selection,
`IGNORE_CASE` after fragmentation, exact scores, and unchanged response text.
Eight `rules/*` families add all 15 official cases for matching/regex and
legacy preprocessing, open and closed numeric ranges, one-sided numeric
comparisons, boolean/null/empty predicates, numeric zero with derived
`SUM_SCORE`, and empty arrays. They pin the boundary-specific
`CODING_INCOMPLETE`, empty-string `INVALID`, automatic residual zero, and
empty-array code 34 outcomes used by the multi-booklet Participant gate.
The four byte-exact `rules/injected-vars` cases extend that gate with a ninth
family. They preserve a Player-supplied non-Base `d1` response across
`CODING_COMPLETE`, `DISPLAYED`, `INVALID`, and `CODING_ERROR`, including zero
and negative code/score values, while the three Base values still normalize to
`NO_CODING` through the official server-side coder.
The eleven byte-exact `rules/intended-incomplete/case2` cases add the tenth
family and complete the official source-status propagation matrix. An
`INTENDED_INCOMPLETE` Base response is combined in turn with
`CODING_INCOMPLETE`, `DERIVE_PENDING`, `UNSET`, `NOT_REACHED`, `DISPLAYED`,
`PARTLY_DISPLAYED`, `DERIVE_ERROR`, `NO_CODING`, `INVALID`, `CODING_ERROR`,
and `INTENDED_INCOMPLETE`; the Participant gate selects a distinct persisted
route for every official derived status and the final zero-code/zero-score
result.
The remaining eight official `test/coding/rules` schemes close that source
tree completely at 18 schemes and 38 input/outcome pairs. They add
`BASE_NO_VALUE`, a supplied Derived variable that must be recalculated,
numeric/null matching, `INTENDED_INCOMPLETE` residual coding, `ELSE`, AND joins
within one ruleset and across array-positioned rulesets, plus the boolean array
variant. Their fixtures remain byte-for-byte identical to tag `3.6.0`, and the
same 18-booklet Participant package executes every route in memory, file, and
SQLite.

The corpus deliberately contains current 17.6 examples, including the original
`Booklet.xml`/`Booklet3.xml` pair with equal top-level-testlet species, a 17.4 booklet,
all 17 original Test-Controller system booklets, all four original
BookletConfig variants, the adaptive `Booklet2.xml` + `Unit2.xml` + coding
scheme + Verona 6 player dependency set, and the complete official
Session-Management package with two booklets, five units, the legacy
`verona-player-simple-6.0` reference, and all 12 original participant logins.
That package gates password-free and password-protected entry, ordered
multi-booklet assignment, second codes, access windows, and hot-return versus
hot-restart re-entry. The official Group-Monitoring booklet and roster add the
original participant plus scoped monitor login, both imported view profiles,
group isolation, and the pause/resume/go-to/lock/unlock command path. The corpus
also pins the byte-exact official `CY_SysCheck_2.xml` beside the sample system
check. Together they gate same-workspace check selection, measured versus
skipped networking, the complete original question-type set, required-field
feedback, a resolved Verona item, save-key reports, and isolated report cleanup.
The byte-exact original `Testtakers_withoutSyscheck.xml` E2E fixture adds the
legacy 15.2 roster generation without monitor profiles or a system-check login.
Together with the current roster it gates the XSD feature boundaries introduced
in 15.3 (monitor profiles), 15.4 (Booklet state presets and extended monitor
fields), and 17.6 (per-login `ViewSettings`) across memory, file, and SQLite.
The corpus also contains the original XSD-backed rejection
fixtures for malformed booklet, unit, SysCheck, and Testtakers structures,
invalid XML `xs:ID` metadata identities in Booklet, Unit, and SysCheck files,
invalid or duplicate adaptive state/option identities, empty state option sets,
broken `Show if/is` references, malformed recursive conditions and aggregates,
unresolved adaptive Unit aliases or inline/external Unit variables, dangling or
invalid Testtakers monitor profiles, malformed multi-state presets, invalid or
unsafe Testtakers access windows, invalid Booklet/Testtakers container
cardinality/order, version-invalid Unit Metadata/Variable fields, unknown roster,
Booklet, and Unit attributes, nested elements in text-only fields, empty group
login lists, invalid SysCheck metadata/config ordering, attributes, simple
content and custom-text IDs, and duplicate runtime identities. The matching
original repeated-Unit-ID fixture
proves that an explicit alias remains valid while duplicate Unit runtime keys
and duplicate Testlet IDs are rejected. The byte-identical original
`Booklet.xml`/`Booklet_sameBookletID.xml` collision pair additionally proves
that different package filenames cannot hide a duplicate Booklet metadata ID.
Normal workspace uploads reject both case-insensitive filename collisions and
case-insensitive, type-local Booklet, Unit, and SysCheck ID collisions, while
the explicit replacement path retains immutable version history. Prebuilt ZIPs
remain guarded by the same typed identity rules during import.
The byte-exact Verona 6 player additionally proves the original Resource rule:
different HTML filenames cannot hide the same case-insensitive player module ID
and major/minor version, either as loose uploads or inside a prebuilt ZIP.
For runtime compatibility beyond the Player versions bundled by that Testcenter
commit, the corpus also pins the official MIT-licensed
`verona-player-simple` tags `1.0.1`, `2.1.0`, `4.0.0`, and `5.2.0`. Their byte-exact HTML
documents declare Verona APIs 2, 3, 4, and 5 through the legacy HTML meta element, the early
`@id`/`@type`/`apiVersion` shape, the short-lived `$schema`-based experimental
shape without `metadataVersion`, and metadata 2.0 respectively. The API-2
artifact intentionally has no JSON-LD module metadata, so import retains the
stable legacy warning and the runtime ready handshake is authoritative. They are kept
as Brotli-compressed base64 and gate metadata import, generation-specific
`dataParts`, state restoration, and real Player navigation requests in
Chromium. These fixtures come from the official Player repository rather than
the pinned Testcenter tree; every source URL, SHA-256, tag, commit, and license
is recorded in `corpus.json`.
The corpus additionally pins the official MIT-licensed ABI 3.3.0 scripted-survey
Player and its release example definition; both are encoded portably without
changing the release bytes. This independent Player family uses
Verona API 2.1 with `iqb-scripted@1.0` definitions and string-valued
`allResponses` key/value state. Its production Chromium gate persists text and
radio answers and restores both after reload. A second independent family pins
the official DAN 3.0.0 Player release plus the byte-exact `G231mm.voud`
definition from the official Verona Player Testbed at a fixed commit. Its
production Chromium gate persists and restores a positioned multiline-text and
multiple-choice response through DAN's JSON-string `all` data part. The corpus
also retains the Testbed's historical metadata-free `IQBVisualUnitPlayerV2.99.2`
artifact and original `G231mm.xml`; import and production browser gates resolve
and execute their unmodified
`DefinitionRef player="IQBVisualUnitPlayerV2"` graph while deliberately
retaining the legacy metadata warning. The browser gate persists and restores
the real multiline and choice response after reload. The host records each
legacy data part's original value kind so API-2/3 object-valued and string-valued
Players both receive the representation they emitted.
Prebuilt ZIP validation also rejects case-insensitive duplicate archive paths
before resolving manifests or dependencies, matching the reviewed assembly path.
The original backend's in-memory Testtakers identity fixtures are reconstructed
as standalone XML files as well. They gate the file-graph rule that distinct
Testtakers files in one package may not reuse a login or group identity even
when their complete assignments differ; `corpus.json` points back to the
generating strings in `VfsForTest.class.php`.
It also contains the byte-exact
original sample `.itcr.zip` resource package as base64 so the binary fixture
remains reviewable and portable. The real 3.2 MB IQB Aspect 2.12.3 player is stored as
Brotli-compressed base64 together with the complete original three-unit 17.4
booklet. Its media-heavy 16.17 MB second Voud definition is compressed the same
way; tests decode both artifacts with Node's built-in Brotli support and verify
every original Unit/Voud/player SHA-256 recorded in `corpus.json`. The rewrite
uses these fixtures to gate successful imports,
compiled runtime policies, restriction semantics, and a compatibility profile
for the original schemas. It does not yet claim complete XSD coverage or every
Testcenter constraint.
