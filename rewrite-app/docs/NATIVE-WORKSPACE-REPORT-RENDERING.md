# Native workspace report rendering (R87)

The optional Original file view now renders paired backticks as text spans. It
keeps filenames, XML placeholders and diagnostics as escaped text. This matches
the pinned Original's pairing rule without interpreting report strings as HTML.
The actual Original Alert uses innerHTML; its inserted `.highlight` span has no
Angular scope attribute, so the apparent scoped italic/color rule does not apply.
The observed production renderer inherits normal text styling.

The file view also preserves the Original's content-box sidebar, report heading
sizes, raised-card surface color, inline row-icon alignment and native scroll
container. Toolbar button sizing stays in the toolbar: in Original, that scoped
rule does not reach the separate upload-report component's Ok button.

Original first adds frontend compatibility errors and computes invalid counts.
For at most 1000 files, its dependency response then replaces the row DTOs. The
per-row derived compatibility error disappears while the aggregate remains
invalid. The Rewrite follows that presentation behavior using the catalog's
existing dependency phase flag. Persisted file errors, missing dependencies,
authorization and participant compatibility checks retain their existing gates.
Logout, destruction and stale workspace responses cannot retain another scope's
phase flag.

The local renderer comparison uses the genuine archived Darwin/arm64 build of
Original `eedae41840cbe90e5547c0211da818bdf620f5aa` produced by
`aacfb395372aeaab50acb62d5ca2336fca636330`. All 80 compiled files and six Source
anchors were checked. The fixture response comes from the committed real-HTTP
`native-workspace-zip-reports-http` capture. Rewrite uploads the same archive
through its actual FileReader and protected production SQLite API.

Across Chrome156 and locked Chromium147, three themes, widths1280/390 and three
report positions, **33/36** complete viewport comparisons are pixel-exact. Each
successful view also has an exact independent Original repeat, three identical
native captures, a witnessed white repaint and exact style/geometry restoration.
All 19 report notices and page text match. Three first Original captures remain
unstable: Chrome/Erwachsene/390/highlight, locked/Primar/390/highlight and
locked/Sekundar/390/bottom. Their failed frames are retained. They are unqualified;
no mask, tolerance, frame selection or stability-gate reduction was introduced.
Fresh independent pages avoid retained paint from prior view transitions, but do
not solve every Source capture. This is local evidence, not same-run Linux CI.

The schema error's `<version>` placeholder intentionally stays literal text.
Broader parser/schema variants, arbitrary HTML-shaped Source messages, hover
report completeness and the remaining Original intake/order behavior need their
own evidence. This report view does not close the unchanged 49 functional
requirements or eight broad visual surfaces. The scope ledger stays27 done /
22partial; complete functional and visual Original parity remains unproven.

Functional regression evidence for the frozen build:117 native UI controls and
12 real IndexedDB/serviceworker controls pass in each browser, including the
39MB root ZIP, exact protected downloads and actual small/large GeoGebra edits,
reload and zero-page worker delivery. The existing root-ZIP case now also checks
literal schema-placeholder spans. Frontend state passes2430/2430; workflow policy
passes367 with four existing platform skips. The focused suite passes26/26.
All440 backend source/compiled input hashes match R86, so its489 four-store,
72 file-runtime,25 monitor and85 focused backend checks are reused by byte
identity. Both workspace result/test tabs and Systemcheck reports pass in both
browsers. The Systemcheck harness now honors the requested browser channel and
records the actual browser version. These are scoped development results; no
merge, deployment or complete visual acceptance follows from them.
