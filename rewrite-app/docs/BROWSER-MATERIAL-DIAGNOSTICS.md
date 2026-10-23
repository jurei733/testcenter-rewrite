# Native browser material diagnostics

This is an isolated diagnostic, not a replacement for the required version-2
browser-package restore or its exact runner-image check. Equal diagnostic output
never grants production admission. The production workflow does not consume this
profile, and its current image rejection remains unchanged.

The observed hosted rollout allocates both `20261012.334.1` and `20261023.334.3`.
The actual package inventories and authenticated native APT package bytes have
matched in earlier observations, but names/versions and a font catalog alone do
not prove that the actual rendering material is identical.

## Evidence captured

Each diagnostic host first executes the unchanged authenticated native APT oracle
for its actual image. Its profile requires that exact commit/run/attempt/lock/image
context and the actual post-install dpkg inventory. No expected image label is
substituted, and no existing artifact context check is disabled.

The profile hashes every regular file in the installed locked Chromium payload,
actual font files returned by fontconfig, actual fontconfig input files, Node,
Xvfb/font tools and shared libraries mapped by its owned browser processes while
the Source views are open. Sandboxed renderers can disable ordinary access to
`/proc/PID/maps`; only a PID returned by this browser's CDP process inventory with
this user's actual/effective UID can use a privileged read of its map paths.
Process memory, environment, command lines and unrelated processes are not read.

It renders unchanged current Source player **6.0.5**, its unchanged sample
Unit definition and actual resource-package contents, bound by SHA256 to pinned
Original `eedae41840cbe90e5547c0211da818bdf620f5aa`. The older 6.0.4 corpus fixture
is deliberately not substituted for the current player. Source's random-text
input stream is seeded reproducibly; Source bytes, clocks, content and form
implementation stay unchanged. A real Unicode form entry and ordinary blur
interaction exercise a second state. Desktop/mobile views each reproduce in two
fresh browser contexts. The existing cleared-native-paint and three-consecutive-
frame capture requires full exact RGBA equality; there is no pixel tolerance,
mask, expected-image-driven recapture or Source editing.

The collector targets native Ubuntu 24/Linux x64. A local macOS exploration
found two differing antialiasing pixels in a native range control after form
entry, despite stable individual frames and the existing full repaint. That
observation is not treated as Linux qualification or hidden by tolerance. The
headed diagnostic control explicitly runs on Linux; cross-host repeatability
must still be proven on actual hosted images. The platform-independent
controls validate current Source bytes, non-image workflow binding, changed
font/browser/runtime/pixel rejection, malformed profile rejection and explicit
`productionAdmission: false` even when profiles match.

## Qualification boundary


[Actual eight-host run 40030001971](https://github.com/jurei733/testcenter-rewrite/actions/runs/40030001971)
now passes **8/8** jobs on both observed image versions. Independent artifact
ZIP size/digest verification, profile/native-manifest validation and actual PNG
byte comparison confirm identical material hash
`3ed8f406b90ce68ebbbf15af3a0773c97fe4223771772302686e456e1d0a9a77`.
Each profile has **591 logical file entries** (including aliases for browser
libraries), with 933,512,684 bytes hashed. Native package before/after inventories
and all **17** authenticated package identities/byte hashes also match. All
**64** actual PNGs are identical by view across fresh contexts and hosts; one
canonical PNG per view is independently decoded and checked against its exact
RGBA hash. Representative full older/newer profiles, native manifests, four PNGs,
all eight artifact/job provenance records and the comparison receipt are retained
under `scripts/fixtures/browser-material-cohorts-20261023` with SHA256s.

This proves the selected material/render observations for those actual hosts and
this exact lock/script/browser/source combination. It does not yet qualify a
version-3 restore/admission implementation; the required version-2 production
image binding remains in place.


The isolated eight-host workflow records actual observed image labels and retains
profiles, Source screenshots and each native APT manifest. It does not select or
fabricate a runner image. At least two actual different image versions, matching
material and repeated exact Source pixels would be needed to establish this
selected cohort evidence. One observed image, a failed view, a changed material
file or missing process mapping is insufficient.

Even equal output only qualifies these material observations and selected Source
views. It does not prove every full Original page, backend behavior or a new
production restore protocol. Any version-3 admission design must keep exact
producer provenance, before/after package state, authenticated package bytes,
font/material bytes and actual Source rendering checks, with fail-closed drift
controls and independent real offline restore qualification before use.
