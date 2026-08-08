# Original Testcenter compatibility corpus

These fixtures are pinned from IQB Testcenter commit
`284a4ffcd9452d56dddd51939707ac7f646c3da7` (2026-04-20). Their source
paths and executable expectations are declared in `corpus.json`.

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
The corpus also contains the original XSD-backed rejection
fixtures for malformed booklet, unit, SysCheck, and Testtakers structures,
invalid XML `xs:ID` metadata identities in Booklet, Unit, and SysCheck files,
invalid or duplicate adaptive state/option identities, empty state option sets,
broken `Show if/is` references, malformed recursive conditions and aggregates,
unresolved adaptive Unit aliases or inline/external Unit variables, dangling or
invalid Testtakers monitor profiles, malformed multi-state presets, invalid or
unsafe Testtakers access windows, invalid container cardinality/order, unknown
roster attributes, nested elements in text-only fields, empty group login lists,
and duplicate runtime identities. The matching
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
artifact and original `G231mm.xml`; an import gate resolves their unmodified
`DefinitionRef player="IQBVisualUnitPlayerV2"` graph and deliberately retains
the legacy metadata warning. The host records each legacy data part's original
value kind so API-2/3 object-valued and string-valued Players both receive the
representation they emitted.
Prebuilt ZIP validation also rejects case-insensitive duplicate archive paths
before resolving manifests or dependencies, matching the reviewed assembly path.
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
