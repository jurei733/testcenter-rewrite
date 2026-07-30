# Original Testcenter compatibility corpus

These fixtures are copied verbatim from IQB Testcenter commit
`284a4ffcd9452d56dddd51939707ac7f646c3da7` (2026-04-20). Their source
paths and executable expectations are declared in `corpus.json`.

The corpus deliberately contains both current 17.6 examples, a 17.4 booklet,
and the original XSD-backed rejection fixtures for malformed booklet, unit,
and Testtakers structures plus duplicate runtime identities. The rewrite uses
these fixtures to gate a compatibility profile for the original schemas. It
does not yet claim complete XSD coverage or every Testcenter constraint.
