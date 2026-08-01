# Original Testcenter compatibility corpus

These fixtures are pinned from IQB Testcenter commit
`284a4ffcd9452d56dddd51939707ac7f646c3da7` (2026-04-20). Their source
paths and executable expectations are declared in `corpus.json`.

The corpus deliberately contains both current 17.6 examples, a 17.4 booklet,
all 17 original Test-Controller system booklets, all four original
BookletConfig variants, the adaptive `Booklet2.xml` + `Unit2.xml` + coding
scheme + Verona 6 player dependency set, and the original XSD-backed rejection
fixtures for malformed booklet, unit, and Testtakers structures plus duplicate
runtime identities. It also contains the byte-exact original sample
`.itcr.zip` resource package as base64 so the binary fixture remains reviewable
and portable. The real 3.2 MB IQB Aspect 2.12.3 player is stored as Brotli-compressed
base64 together with its original 17.4 Unit and Voud definition; tests decode it
with Node's built-in Brotli support and verify the uncompressed SHA-256 recorded
in `corpus.json`. The rewrite uses these fixtures to gate successful imports,
compiled runtime policies, restriction semantics, and a compatibility profile
for the original schemas. It does not yet claim complete XSD coverage or every
Testcenter constraint.
