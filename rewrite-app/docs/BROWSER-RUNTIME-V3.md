# Browser runtime admission, format 3

The version-3 path passed actual isolated qualification and is selected by the
main workflow. This is not a claim that the complete Original parity suite passes.
The preceding diagnostic experiment remains separate from production admission.

## Provenance and required checks

The producer retains its actual hosted image, workflow commit/run and successful
attempt. Format 3 additionally emits the material SHA256 as an immutable job
output. The consumer records its actual image independently. Only the expected
producer context uses the explicit producer image output; no observed environment
value is overwritten and no image-version allowlist grants admission.

Before installation, the consumer checks the exact selected format, commit,
run/producer attempt, OS/architecture, lock and native-dependency module, initial
complete dpkg inventory, every authenticated package byte and Debian identity,
and the strict runtime-measurement schema. The embedded measurement must match
the independently supplied producer digest and this checkout's collector hash.
Package/font inventory claims must match the native APT result.

After installation it requires the exact complete APT inventory and font catalog,
then measures actual browser/font/config/library/Node material and actual current
Original Source pixels. Its complete material digest must equal the producer's.
The actual observed consumer context is checked again, including a clean tracked
checkout. Missing or changed material, unexpected fields, a stale output or a
changed Source view fails closed. Equal diagnostic profiles alone never admit a
consumer: `diagnostic-only` is rejected by the separate production schema.

Version 2 remains strict about exact image equality. An absent legacy format
selects version 2; an explicitly malformed/empty new format never falls back.
A format-3 consumer cannot silently consume a format-2 artifact or vice versa.
Partial reruns select the immutable successful producer attempt, not the newer
consumer attempt or any latest/cross-run artifact.

## Installation and rendering order

Locked Chromium bytes are downloaded before the cohesive restore. The pinned
Playwright installer only warns about missing host requirements after download;
it does not install system packages without `--with-deps`. That flag remains
absent. The required APT operation still runs inside an owned `unshare --net`
namespace, using verified local cache files, empty package sources and lists,
`--no-download`, `--no-remove` and authenticated package settings. No APT network
fallback or online consumer package resolution is introduced.

The restore starts its owned Xvfb only after APT has finished, so it does not
measure a server process left running from before an Xvfb upgrade. An independent
existing process supervisor bounds the worker and its Chromium/Xvfb descendants.
The worker reads no process memory, environment or command line. Public Source
screenshots, file hashes and supervision records are retained separately from
the strict package artifact; the latter still contains only its manifest and
exact SHA-named Debian archives.

The source renderer uses unchanged current Source 6.0.5, its Unit definition and
actual resource contents. Desktop/mobile empty/input views must reproduce in
fresh browser contexts with cleared native paint and exact consecutive frames.
No Source editing, clock freezing, pixel tolerance or expected-image-driven
recapture is added. Diagnostic historical evidence remains explicitly scoped;
it is not a full-page or full functional equivalence claim.

## Actual qualification

The isolated workflow exercises the actual composite action, not an alternate
restore implementation. One actual native producer serves eight fresh consumers.
Run [40034252270](https://github.com/jurei733/testcenter-rewrite/actions/runs/40034252270)
passed all nine jobs. Its producer used `20261012.334.1`; consumers 4 and 6
actually used `20261023.334.3`. All eight consumers restored offline and verified
the producer material SHA256
`00a1cb4898589f1653fa7b953fe6ebc94b3fd0aab0ae0b06bc32a2c7411f1195`.
Both observed labels remain recorded independently.
Every consumer then executes real archive-inspection/tamper controls and actual
Source capture controls. All mandatory production matrix groups, source pinning,
build/artifact bindings, high-severity audit and final acceptance remain intact.

A selected rerun of consumer 4 also passed as job `120691974419`: consumer
attempt 2 downloaded the same immutable attempt-1 package artifact `12535783284`.
The producer was reused, not rerun. The original eight consumers plus that
selected rerun are distinct executions; GitHub's copied attempt-2 job records
for other jobs do not count as additional executions.

The retained [receipt](../scripts/fixtures/browser-runtime-v3-20261024/receipt.json)
binds the exact probe commit/tree, all artifact digests, original job conclusions,
10 measured contexts, representative raw profiles and the complete producer
manifest. Independent local verification checked all 17 actual Debian archives,
including their control metadata; all 80 captured PNGs were byte-identical by
view, and all four RGBA hashes were independently decoded with PNG CRC/filter
validation. The four canonical PNGs equal the earlier retained diagnostic PNGs
byte for byte, so the receipt references those files instead of duplicating them.

The isolated probe exercised code tree
`183d3f87507045580731c19124a8355f8684aaca`. The subsequent runtime edit only
separates `offlineInstallMs` from `materialCaptureMs` in reporting; the isolated
consumer totals (20.3–46.6 seconds, plus a 25.3-second selected rerun) include
both operations. Admission predicates are unchanged. The full main workflow
must still qualify the final published tree and all application journeys.
