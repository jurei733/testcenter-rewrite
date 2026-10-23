# Browser runtime admission, format 3

The version-3 path is implemented for isolated qualification. It is not yet a
claim that the main workflow or the complete Original parity suite passes.
The previous eight-host material experiment proves the selected file/render
observations; it does not replace the new producer-to-offline-consumer proof.

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

## Required qualification before main adoption

The isolated workflow exercises the actual composite action, not an alternate
restore implementation. One actual native producer serves eight fresh consumers.
The evidence must include successful offline restoration and material verification
on at least one actual opposite-image host, while retaining both observed labels.
Every consumer then executes real archive-inspection/tamper controls and actual
Source capture controls. All mandatory production matrix groups, source pinning,
build/artifact bindings, high-severity audit and final acceptance remain intact.
