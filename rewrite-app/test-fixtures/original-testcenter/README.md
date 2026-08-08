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
fixtures for malformed booklet, unit, SysCheck, and Testtakers structures plus
duplicate runtime identities. The matching original repeated-Unit-ID fixture
proves that an explicit alias remains valid while duplicate Unit runtime keys
and duplicate Testlet IDs are rejected. The byte-identical original
`Booklet.xml`/`Booklet_sameBookletID.xml` collision pair additionally proves
that different package filenames cannot hide a duplicate Booklet metadata ID.
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
