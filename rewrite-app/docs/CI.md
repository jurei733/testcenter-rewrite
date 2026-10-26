# CI iteration and complete acceptance

## Native Unit candidate and realistic SQLite contention feedback (2026-10-26)

The accepted predecessor [40256061895](https://github.com/jurei733/testcenter-rewrite/actions/runs/40256061895)
is terminal **89/89 success** on head `4cecdd2af7ee71906cfa1117a450312abe252122`,
tree `5a4d7ef0ef75b42d9fc64774c5b91e5cf16965a2`; actual PR merge
`4e50ba0fb538b6c8b0c39ff4f256880c140f9c04` has the independently verified same
tree. Actual leaves pass 4,390 unit/frontend, 2,626 PostgreSQL and all57 exit
scenarios, without failures/skips/cancellations. Its job span is **30:11**,
01:49:12–02:19:23 UTC. The prior isolated service and protected-browser feedback
on that tree takes104s/242s; these are scoped measurements, not proof of a causal
complete-pipeline speedup.

Native Unit GET/state/response/log extends the existing creation suite and
protected Session browser entry. The complete unit/PostgreSQL and reusable
`original-results` gates consume the same cases; no broad matrix or duplicate
frontend build is added. Source41 retains every Source37 control and qualifies
the changed transport against unchanged production Apache/PHP/PostgreSQL.
New Unit rows keep packet writes separate from large canonical Test payloads.

An initial broad local PostgreSQL regression run has2641/2643 passes: an external
SQLite worker's COMMIT reports BUSY, failing that case and its enclosing parent.
The same SQLite suite passes in isolation. A controlled actual-reader case now
reproduces zero-timeout COMMIT failure and proves the production bounded wait
policy commits after reader release. The external fixture uses that existing
repository policy and requires an explicit committed receipt, while preserving
the original blocked-mutation assertion and both independent answers. Production
SQLite policy remains5s. This addresses the fixture's zero-timeout behavior;
the final candidate passes fresh local regression; Linux qualification remains required.

Final local validation: fresh production build, **4,404 unit/frontend** checks
(160+325+1,865+2,054), **2,646 real PostgreSQL** checks, **303** targeted native
and mutation controls across all four stores and all **11 Chromium markers**.
The final complete runs have zero failures/skips/cancellations. Policy passes281
with its one explicit GNU-timeout-only macOS skip; complete-lock audit zero,
Actionlint and diff checks pass. Hosted qualification and the next complete
acceptance run remain separate requirements. The prior accepted trees are not
evidence for this subsequent Unit implementation.

## Native Test read/state feedback in the existing inventory (2026-10-26)

The accepted predecessor [40249520035](https://github.com/jurei733/testcenter-rewrite/actions/runs/40249520035)
is terminal success, **89/89** jobs, on head
`52a2ef4f055073b300cbf041c8b1606c502a9da3`, tree
`e2116b26afc999b14d009cc20eaeb1dbd70d1170`. Actual PR merge
`78c4b2172439a9d91b57842e98e39c6651cc1c0f` has the independently verified same
tree. Actual leaves pass **4,360 unit/frontend**, **2,585 PostgreSQL** and all
**57 exit-completeness** scenarios without failures/skips/cancellations. Its job
span is **30:47**, 00:28:21–00:59:08 UTC. This accepts the workspace cleanup tree,
not the subsequent native-read candidate.

Native Test GET/PATCH and group Resource coverage extends the existing mandatory
`original-test-creation.test.mjs` inventory. The same suite runs in complete unit,
PostgreSQL and `original-results`, so `npm run ci:focus -- original-results` uses
one fresh core build for short service feedback. No broad job or repeated Angular
build was added. The protected Chromium Session smoke retains all eight original
markers and adds two native read/state/resource markers. Production UI adoption
and broad paired visuals remain open. The Test-read tree is accepted by full40256061895 above; subsequent Unit qualification remains separate.

Local qualification passes a fresh production build, **4,390 unit/frontend**
checks (160+325+1,851+2,054), **2,626 real PostgreSQL** checks, **101** targeted
native controls across all four stores and all **10 Chromium Session markers**.
The complete unit/PostgreSQL runs were repeated after final URL-redaction
hardening; they have zero failures/skips/cancellations. Policy passes 281 with
its one explicit GNU-timeout-only macOS skip; the complete locked audit reports
zero vulnerabilities, and Actionlint/diff checks pass. The final browser retains
every earlier marker and uses the same production frontend build with fresh core
output. Its hosted Linux and full acceptance are recorded above. The prior
96-second service result is scoped to its own
earlier tree and does not establish this candidate's timing.


## Native creation enters existing fast and complete gates (2026-10-26)

The accepted predecessor [full run 40240110529](https://github.com/jurei733/testcenter-rewrite/actions/runs/40240110529)
is terminal success, **89/89** jobs on head `1e520949c212964f70641e5b799125f6e081c290`,
tree `402c85c3a4bd08c21c6b6e2eea2e103dfdabe48a`. Actual merge
`ff0fa64e1bad542d592bb78edaa71b4e1ae20cdc` has the independently verified same tree.
Its actual leaves pass 4,316 unit/frontend checks, 2,525 PostgreSQL checks and all
57 exit scenarios. The actual job span is **30:05**. This accepts that predecessor,
not the subsequent native-creation implementation.

The new native Test-creation suite is mandatory in the existing complete unit,
PostgreSQL and `original-results` service inventories. A policy control prevents
its removal from any of the three paths. The existing quick proof-of-work cell
also retains every prior protected-browser check and now exercises native creation
followed by actual protected UI entry of the same Test. No new broad job matrix
or repeated production build is needed for these additions.

Local qualification of the actual implementation includes a fresh production
build, complete unit/frontend **4,352** and PostgreSQL **2,573** passing controls,
without failures/skips/cancellations. Subsequent test-only additions pass **56**
targeted controls across all four stores, including upgrade/DDL failure, independent
PostgreSQL writers, concurrent first controller entry and number cascade cleanup.
The real Chromium native-session smoke passes all eight markers, including
Source-format raw Test creation and actual protected Original-style UI entry.
Policy passes 281 controls with its explicit GNU-timeout-only macOS skip; diff
checks and Actionlint pass. Hosted qualification and complete acceptance for this
new implementation remain required. Prior 96-second service / 143-second Player
feedback measurements apply to their exact earlier scoped trees, not this candidate.


## Durable response-type feedback and complete acceptance (2026-10-25)

[Full run 40237514022](https://github.com/jurei733/testcenter-rewrite/actions/runs/40237514022)
is terminal **success: 89/89 jobs**, without skips/cancellations, on diagnostic
head `206ef29e7927adf06829972f79741d99209a0f7b`, tree
`3432cf460e11f88f776afd6b205ccd8ac00f76ef`; actual merge
`3b881f5f87a9042fdad062e44af11ab279b9498e` has the independently verified same tree.
Actual complete unit/frontend and PostgreSQL leaves pass **4,293 /2,495** checks;
the full exit-completeness leaf passes all **57** cases. The 89-job span is
**29:29**, from 21:52:24 to 22:21:53 UTC. This accepts that exact application tree;
it does not establish the preceding intermittent failure's cause or a causal
whole-pipeline performance gain.

The subsequent durable part-type application `73b36c7e9ca6247a69be283c14baea21fedc45ae`,
tree `9047d091c3248fce26d98f10e98a16dd4a5fd4e6`, has a fresh complete local
production build, **4,316** unit/frontend checks, **2,525** real PostgreSQL checks,
**109** targeted ordering/rollback controls and real IB Player save/reload checks
in both interfaces. Mandatory policy passes 280 with its explicit GNU-timeout-only
macOS skip; all other local controls have no failures/skips/cancellations. The
owned test database was removed after verifying owner, zero other clients, no
remaining owned schemas/public relations; its owned PostgreSQL cluster is stopped.

[Isolated Linux run 40239144647](https://github.com/jurei733/testcenter-rewrite/actions/runs/40239144647)
is terminal success. The existing reusable `original-results` service path accepts
**595** checks on fresh PostgreSQL 16 in **96 s**, including installation, audit,
282 policy controls and fresh core compilation (13,344 ms; service entry 43,785 ms).
A separate native-material job passes both actual IB Player interfaces, 281
policy, 17 browser and four archive controls in **143 s**; fresh production build
33,041 ms and the two-interface Player entry 24,147 ms. Both audits report zero
vulnerabilities; neither job skips, retries or weakens acceptance. Wrapper head
`8b26bc4485c7706b302fbc0c2c3dc34b699cff2f`, tree
`077be5d55c0ff0ae3e785d18172986b2babc3dc8`, adds only one fixed qualification file
to that exact application tree. Blob/tree/parent/ref checks verify the boundary.
This is scoped service/Player feedback; the part-type follow-up still requires
its own complete acceptance after integration. Native report HTTP/UI connection
and exact Source browser buffer/flush grouping remain separate open work.

## Owned completeness failure evidence (2026-10-25)

[Full run 40209993795](https://github.com/jurei733/testcenter-rewrite/actions/runs/40209993795)
is terminal **failure: 87 successful jobs, one failed exit-completeness browser
leaf and the failed acceptance aggregate**, without skips/cancellations. Actual
unit/frontend (4,293) and PostgreSQL (2,495) leaves pass. Head
`4d800e83d844ea2bdedb502984418f4cbe298dcd`, tree
`e7d09d60873eb12577e701ece38aae2b2a6e9ee2`, actual verified merge
`66f1f132b6527edf4a3fa1dc4f561c0dbacc0c32` identify the failed acceptance.

The completeness smoke reports 48 successful cases, ending with Erwachsenen
desktop / forbidden / both. In the next mobile case, its final complete-state
confirmation does not reach the Material-open selector before the existing
30-second locator deadline. The 848-byte artifact 12606230910 has SHA-256
`52dbae6a5836eee316967e830a58bf7c6524bac180bb764aec2e54456904f098` and contains
only the quick console log. No failed UI document or image survived. The actual
cause is unestablished; it is not attributed to the preceding report renderer.

The owned smoke now records fixed per-case phases and native pointerdown/up/click
events, including trusted input and element identity/connectivity, without
redispatching clicks. On failure it writes a bounded JSON document summary and
viewport screenshot under the existing public artifact root. Raw HTML, form
values, request headers/bodies, storage, URL/query values, environment and
exception messages/stacks stay outside JSON receipts. The SQLite fixture remains
in its separate private temporary directory. Snapshot/screenshot operations have
their own five-second diagnostic limits; original failures still propagate.

Every prior product assertion, exact reference/pixel measurement, operation
deadline and all 57 scenarios remain. An additional positive assertion requires
both saved progress fields to be complete before the final logo action. Two real
Chromium controls prove a stable native click works, a deliberately replaced
target can lose a native click and the observer distinguishes it; private input,
storage, query and error sentinels stay out of JSON. These controls are mandatory
in native browser qualification. This improves diagnosis and fixture precision;
it does not establish that the historical UI failure was a lost click or is fixed.


The diagnostic-only application candidate `5ebfdf38d1f20c911ddcf1a1254e7a79e1ea2aa0`
has tree `bd6f4a3540fc35cff0a968ac64b042eaf2eba153`. All **57** local cases pass
from a fresh production build (505,420 ms for the 57-case entry), with 16 browser
controls passing and one explicit Linux-only skip on macOS. The mandatory local
policy suite has 280 passes and its explicit GNU-timeout-only macOS skip.
[Isolated Linux run 40236405909](https://github.com/jurei733/testcenter-rewrite/actions/runs/40236405909)
is terminal success: **57/57** headed production cases, **17/17** browser controls,
**281/281** policy controls, **4/4** native archive controls and zero complete-lock
audit vulnerabilities. Wrapper head `4b3679244b981131a933ba2a2616f07d1ed97d13`,
tree `1586718cf864b7b24eb04924cc22b8c872c65ecd`, adds only one fixed qualification
workflow to that application tree; the blob/parent/tree/ref were independently
verified. Its single job took **11 min 10 s**, including fresh runtime, audit,
policy, authenticated browser material, controls and build; the actual 57-case
entry took 534,510 ms. This scopes feedback without reducing acceptance coverage.
It does **not** establish the earlier failure's cause or make the failed full run
successful. A new full acceptance is required after integration.

## Complete timer feedback without the broad queue (2026-10-25)

`rewrite-timer-focus.yml` exposes a manual/reusable **non-acceptance** workflow.
It reads the fixed `verify/ui-controller-timer` selection from the actual acceptance
inventory, compiles the complete production app once, then runs all nine Original
and 22 Rewrite scenarios in order. A failed build or entry stops execution and
preserves its status; there are no retries or optional product checks. Browser
mode matches the full timer leaf. No arbitrary check or shell input is accepted.

The single fresh Ubuntu job retains locked installation, the complete-lock audit,
all CI policy controls and Linux archive qualification. It uses the same v3 native
APT/material producer as complete CI, including authenticated packages and actual
Chromium material verification, directly on its own runner. No cross-run build,
package artifact or privileged cache is reused. The locked Chromium download cache
is the same as in complete CI. Separate receipt uploads run even on success;
failure/cancellation logs remain bounded to the owned timer directories. SQLite
stores and package archives are excluded. Actions are pinned and checkout has no
persisted credentials; the token is read-only.

The workflow has a 25-minute outer job limit; each timer entry retains its existing
eight-minute total and one-minute phase limits. Its separate concurrency group
cannot cancel a live full acceptance run. Full acceptance remains mandatory,
including on changes only to this focused workflow. The four new policy controls
include execution of the actual CLI with failing build/first-entry/second-entry
children and verify that failures propagate without retry or later dispatch.
Hosted runtime and timing must be qualified independently; no speedup is inferred
from the smaller job inventory.

## Bounded controller-timer diagnosis and accepted cascade feedback (2026-10-25)

The two actual timer entries now run under independent owned-process supervision:
**60 seconds per phase and eight minutes total per entry**. Scenario, browser/context
cleanup, callback settlement and owned API shutdown have explicit phase records.
Route-entry/exit and wait breadcrumbs are observations; they never extend a deadline.
The supervisor terminates only its spawned process group and verified descendants,
and records entry/phase/process identities without environment or request contents.
Failure and cancellation retention now includes supervision and Original worker
receipts alongside the existing bounded failure JSON/API log, excluding SQLite data.

This follows [full run 40196969583](https://github.com/jurei733/testcenter-rewrite/actions/runs/40196969583),
head `1877876110772ae711e5ab88262ba2b3382dcf31`, tree
`cbe17c96cfed2e4d3b2868a29298272e8ddc7753`, verified merge
`18d52398cf4982824c11c320468d081eb0028123`. It is terminal **cancelled**:
87 successful jobs, one cancelled timer leaf and one failed acceptance aggregate.
The timer job starts 13:23:16 UTC and cancellation is logged at 14:23:29 UTC,
against its configured 60-minute limit. All nine Original worker controls pass;
16 Rewrite scenario markers pass, ending with native Pause / applied legacy /
stale state / lost legacy reply at 13:28:04 UTC. The logs cannot distinguish that
scenario's cleanup from the next scenario's body. The complete 76-artifact inventory
contains no controller-timer diagnostics. Actual Linux unit/frontend (4,222) and
PostgreSQL (2,417) leaves pass, but this is not full acceptance.

Unchanged local controls pass all nine Original and 22 Rewrite scenarios; a separate
phase-only repeat also passes all 22, including every cleanup boundary. The hosted
hang is not reproduced or claimed fixed. The follow-up supplies bounded failure
and decisive phase evidence; it retains global route cleanup semantics, every
scenario, every product assertion and all existing operation deadlines. Exact
product assertion lines remain identical to the preceding harnesses.

Local qualification of the supervised entries passes nine Original controls
(58.96 s) and all 22 Rewrite scenarios (236.54 s), with successful owned shutdown.
Eighteen supervisor/deadline controls include a real non-settling child that fails
and retires correctly, plus public-evidence privacy checks. Complete unit/frontend
passes **4,254 checks** without failures/skips/cancellations. Policy passes 276 plus
one explicit GNU-timeout-only macOS skip; Actionlint passes. The backend implementation
is unchanged from its already qualified **2,456 PostgreSQL** controls.

[Isolated native cascade feedback 40200874804](https://github.com/jurei733/testcenter-rewrite/actions/runs/40200874804)
is terminal **success, 3/3 jobs** on application
`c716350b1d31843a4e982d6162ed2c5c216e2edb`, tree
`25e9561e7a9c2889b47aebffaa73950f4e0cf646`, plus one verified wrapper.
Actual Linux results pass **526 checks / 67 seconds**, auth **361 / 93 seconds**,
Systemcheck **9 / 55 seconds**. Each retains 278 policy controls, no skips and a
zero-vulnerability complete-lock audit. Fresh core builds take 8.06 / 13.63 / 13.34 s;
selected suites take 27.64 / 35.25 / 4.05 s. These are measured focused feedback,
with independent complete acceptance still required for the follow-up.

## Native deletion coverage retains full and focused gates (2026-10-25)

The [atomic native group/session cascade](ORIGINAL-RESULT-GROUPS.md) adds its complete
suite to existing unit, PostgreSQL and focused Original-results gates. All old
checks remain. The final local application passes **4,250 unit/frontend**, **2,456
PostgreSQL**, and **217 targeted** controls. This includes actual protected HTTP,
late durable rollback, no private-result decoding, a large selection and seven
independent PostgreSQL writer operations observed waiting on database locks.
Policy has 276 passes and one explicit macOS GNU-timeout skip; the complete-lock
audit has zero vulnerabilities. Core/web typechecking, the complete production
build, Actionlint and diff checks pass. Existing CSS/CommonJS warnings remain.
The owned test database is removed after owner, zero-client and zero-schema
checks; the initially stopped cluster is stopped again. Hosted qualification
of this change is separate.

The preceding reference-only full run
[40196969583](https://github.com/jurei733/testcenter-rewrite/actions/runs/40196969583)
has 87 successful jobs and an unusually long-running controller-timer browser
leaf at the last observation. It is still live, not a completed acceptance result.
The new application is qualified on an isolated branch while that run remains
intact. No timer assertion, required gate or deadline has been removed, and no
unproven timer fix or whole-CI speedup is claimed.

## Production Source deletion reference joins existing service feedback (2026-10-25)

The [native group-deletion reference](ORIGINAL-RESULT-GROUPS.md) adds four frozen
production-evidence controls to the existing mandatory Original result suite.
They verify artifact/source/probe integrity, genuine guarded production setup,
whole-group capability revocation, moved identity preservation, denied writes,
fresh recreation and public-receipt redaction. All 16 previous ALTCHA controls
remain in the isolated Source run. No unit, PostgreSQL, policy, audit or full
acceptance gate is removed; the focused results path receives the same controls.
The new reference is not proof of a Rewrite deletion implementation or UI parity.
Local verification passes **109/109** result/archive/Session controls with the new
reference; CI policy passes 276 checks with one explicit GNU-timeout-only macOS
skip. The captured Source workflow passes Actionlint and the diff is clean.
The previously qualified 4,218/2,413 full suites belong to the application tree
recorded below; no fresh complete-suite count is inferred for this reference-only
follow-up.

## Complete native result-read acceptance (2026-10-25)

[Full CI 40193724586](https://github.com/jurei733/testcenter-rewrite/actions/runs/40193724586)
is terminal **success, 89/89 jobs**, without failed, skipped or cancelled jobs.
Head `2027fb9bae2707fdc366c51411e7502129248e61`, actual PR merge
`7955844b44889617bccbf817c6f6cb60709587c6` and verified application tree
`449f063094c5119fc295fcd50d3013fc793a976c` qualify the final adapter layout.
Actual hosted logs pass **4,218 unit/frontend**, **2,413 PostgreSQL** and **277
Linux CI-policy** checks, with zero audit vulnerabilities. The protected native
Session browser journey, complete console/context journey, Original/reference,
PostgreSQL UI and deployability gates all pass.

Observed job span is **31:38**, 12:34:44–13:06:22 UTC; Fast feedback completes
at 12:39:15 UTC. Together with the preceding 30:01 and 28:59 runs, this does not
establish a whole-CI speedup. For iteration, [focused run 40193801269](https://github.com/jurei733/testcenter-rewrite/actions/runs/40193801269)
passes all three service jobs on the same application tree plus one isolated
wrapper: participant-auth **361 checks / 83 seconds**, original-results **483 /
88 seconds**, system-check-reports **9 / 53 seconds**. Every focused job retains
278 Linux policy checks and the complete-lock security audit. Focused success
is separate from full acceptance; neither removes the other gate.

## Complete guarded Session acceptance and native result reads (2026-10-25)

[Full CI 40189158651](https://github.com/jurei733/testcenter-rewrite/actions/runs/40189158651)
is terminal **success, 89/89 jobs**, without failures/skips/cancellations. Head
`bc5301893e16b42434f1e74e59705e39e2004647`, actual merge
`87f8b971f5ebb428df91df8f864c147974b85206` and verified application tree
`660471677674e6525e6d7fa3eebae47794343df4` qualify the native participant Session
boundary, guarded work, complete protected UI prefix and corrected compound Xvfb
execution. Actual Linux logs confirm **4,183 unit/frontend**, **2,366 PostgreSQL**
checks and zero audit vulnerabilities. The full console-loading/context-compat
leaf succeeds, including terminal route drain and all five context markers.
PostgreSQL UI, Original/reference and deployability gates pass as well.

Observed job span is **30:01**, 11:30:36–12:00:37 UTC, and Fast feedback completes
at 11:35:38 UTC. The preceding green baseline was 28:59. These queue-dependent
measurements do not establish a causal whole-CI speedup. The independently
qualified service feedback remains 60–99 seconds, with its separate tested scope.
Full acceptance remains mandatory.

The next native group-result read uses one scoped inventory snapshot: one SQL
statement for SQLite/PostgreSQL and one synchronous projection of committed state
for Memory/File. Response values, timers, passwords, bearer/token material and private review text
are absent from that repository DTO. Real decoder fences actively reject complete
Run reads while permitting the new read. Actual protected SQL HTTP verifies RO
workspace access, anonymous/invalid/foreign-workspace denial, native array shape,
no-store headers and exact group filtering. The suite joins full unit/PostgreSQL
and original-results focused acceptance; no previous gate is removed.

The read matches pinned Source's saved-Unit statistics, first group labels,
current binary Login bindings, persistent opening history and max(group/Test)
Unix-second clock. Indexed lookups and scalar aggregates handle a 140,001-person /
140,001-Login fixture without quadratic scans or argument-stack overflow. This
is an owned correctness/scale fixture, not a production-load timing guarantee.
See [contract, actual Source evidence and remaining UI/wire scope](ORIGINAL-RESULT-GROUPS.md).
The next application tree requires its own independent hosted qualification.

Local qualification of this follow-up passes **4,218 complete unit/frontend**
checks (121 + 325 + 1,722 + 2,050) and **2,413 complete PostgreSQL** checks,
without failures/skips. The final SQL placement is isolated under each adapter;
after that equivalent relocation and removal of an unused metadata-list port,
**138/138 all-store result/archive/Session controls**, core/web typechecking,
production build and CI policy pass again. Policy has 276 passes and one explicit
GNU-timeout-only macOS skip; complete-lock audit reports zero vulnerabilities.
Actionlint and diff checks pass. Existing CSS/CommonJS build warnings remain.
The owned database is removed after checking its owner, zero other connections
and no remaining test schemas; the initially stopped cluster returns to stopped.
New exact-head Linux qualification remains separate from the green baseline.

## Compound browser commands stay inside one display (2026-10-25)

Native Session [full run 40188347937](https://github.com/jurei733/testcenter-rewrite/actions/runs/40188347937)
is terminal **failure: 21 successful, three failed and five skipped jobs**. The
quick proof-of-work leaf fails after the preceding protected UI smoke succeeds;
Fast feedback and the final aggregate consequently fail, and dependent broad
qualification groups do not run. Head `873d2e547c27c4fa4fb9c8396f46386b478488ab`
and actual merge `9f757a0b9a0394dd7d6729951a26b0930b0c7f90` share application
tree `59ac7c6075069f4150b0fe95c1606a992e156bb6`. Its retained 690-byte artifact
12597297384 has SHA-256
`4eaa8e3361a9c33a7628ea0c2a6cfc8119a167bcf54c1137b9fcb3c351dd03e1`.
It contains no completed native browser marker and only a generic Error category;
the original Playwright exception was deliberately not retained.

The workflow previously substituted `first && second` after `xvfb-run` directly.
Shell parsing therefore ran the successor outside Xvfb, with only that successor
piped through the logger. Both quick tiers now pass their entire matrix command
through an environment variable to an explicit inner Bash under Xvfb. Both inner
and outer shells retain `-e -o pipefail`. No command inventory, assertion, deadline,
job gate or headed-renderer requirement is removed.

An executable shell control reproduces the old successor's missing display,
then verifies both commands share the same display owner under each actual tier's
new logger command. First-command failures prevent the successor, second-command
failures propagate through tee, and an inner failing pipeline also fails the job.
The original outer-logger false-green negative control remains. All **276 local
policy cases pass**, with one explicit GNU-timeout-only macOS skip. Actionlint and
diff checks pass; all six native browser/WebCrypto markers pass locally.

Native browser diagnostics now retain bounded phase/category fields in their own
public subdirectory. They classify the known headed-browser display error without
serializing exception messages, evaluated arguments, tokens, credentials or HTML.
Private SQLite fixtures remain outside that public directory. Actual corrected
Linux browser qualification is still required; the old generic artifact alone
does not recover its missing exception.

The exact application also passes independent [focused run 40188428421](https://github.com/jurei733/testcenter-rewrite/actions/runs/40188428421),
**3/3 jobs**: auth **361 tests / 87 s**, results **436 / 99 s**, Systemcheck
**9 / 60 s**, each with **277 Linux policy checks**, no skips and zero complete-lock
audit vulnerabilities. Fresh core times are 12.48 / 13.68 / 13.08 seconds; selected
tests 34.18 / 36.87 / 4.16 seconds. Wrapper
`2ed5f30bcc8db8475f85340132f0574c15edd96d` adds only one isolated workflow.
Focused success does not override failed full acceptance or prove visual parity.

## Native Session boundary and bounded console cleanup (2026-10-25)

The published native-assignment [full run 40183685738](https://github.com/jurei733/testcenter-rewrite/actions/runs/40183685738)
is terminal **failure: 87 successful jobs, one failed participant-console leaf and
the failed acceptance aggregate**, with no skips/cancellations. Head
`eb4bc435b5a1a93cab674ed6c3ddbb525623b138` and actual merge
`da6cd39959c32e9b46f3a9b0c0d34850636c013f` have identical application tree
`e6ff901be9d43603e8c664ec0c9c3538f2d09a10`. The retained supervisor identifies
`terminal-independent-native:drain-released-routes` during a global route wait.
Artifact 12595387239 is 1,179,460 bytes with ZIP SHA-256
`feb7e44c6f1f6d1a458b4382d10b4211f41a6c0c8fa2b837b703ff36f78718e2`.
The historical blocking request and application/SDK cause remain unestablished.

The terminal scenario now removes exactly its four owned handlers and bounds
callback drain, retaining every product assertion and deadline. An independent
Chromium fixture proves unrelated handlers survive, held callbacks must actually
settle and unexpected callback failures still fail the smoke. This corrects test
lifecycle ownership without accepting a timeout as success.

The same published application tree passes independent [focused run 40183765371](https://github.com/jurei733/testcenter-rewrite/actions/runs/40183765371),
**3/3 successful jobs**: auth **304 tests / 90 s**, results **379 / 91 s**,
Systemcheck **9 / 58 s**. Every job passes 277 Linux policy checks, no skips, and
complete-lock audit with zero vulnerabilities. Fresh core times are 9.77 / 12.86 /
9.77 s and test times 34.99 / 34.41 / 3.13 s. Its isolated wrapper adds one workflow
only. Focused success does not override the failed complete acceptance.

The new [native participant Session boundary](ORIGINAL-SESSION.md) adds mandatory
contract/security/HTTP checks to full unit, PostgreSQL and relevant focused
service suites. Its real Chromium/WebCrypto protocol journey joins the existing
quick proof-of-work cell. No broad visual row closes and production UI adoption
remains open. New hosted acceptance must qualify this follow-up independently.

Final local qualification passes **4,183 unit/frontend** (121 + 325 + 1,687 +
2,050), **2,366 complete PostgreSQL** checks, and **141 all-store native
Session/person controls**, without failures/skips. Typechecking, production build,
Actionlint and diff checks pass. Full-lock audit reports zero vulnerabilities;
policy passes 275 with one explicit GNU-timeout-only macOS skip. The existing
protected UI smoke and all six native Session/WebCrypto markers pass as a pair.
The complete console-loading/context-compat pair passes, including the formerly
hanging terminal route drain and all five context compatibility markers.

An earlier local console attempt failed before the repaired drain: the remote
Pause completion log was absent while Resume was present. That attempt remains
failed evidence; its root cause is not established. The smoke now retains bounded
command IDs, completion response statuses and controller/completion log metadata
for that boundary, without relaxing exact-once assertions. The diagnostic rerun
passes the full pair. A passing rerun does not prove that intermittent issue fixed.
Owned PostgreSQL has zero other connections and no remaining test schemas before
removal; the initially stopped cluster is stopped again. New exact-head hosted
acceptance remains required.


## Complete release-free baseline and protected Source proof (2026-10-25)

[Full CI 40180975239](https://github.com/jurei733/testcenter-rewrite/actions/runs/40180975239)
is terminal **success, 89/89 jobs**, without failures, skips or cancellations.
Head `195cf6142ea8199c51745f03889563fe50a2e732` and merge
`ddf0bde583f36c761df41ab586585a0c7f5d20ce` have verified exact application tree
`78a1914d6387b2de8e01578eb148227843e63712`. Actual Linux logs confirm **4,133
unit/frontend** and **2,301 PostgreSQL** checks. The complete native-route and
native-tabs leaf passes all **21 product/readiness markers**, including the
formerly failing first-prefix reload. Full PostgreSQL UI, Original/reference,
startup/shutdown and deployability gates pass. The audit job succeeds.

Observed job span: **28 min 59 s**, 09:31:12–10:00:11 UTC; Fast feedback finishes
09:35:19 UTC. This is shorter than the preceding green dispatch baseline's
31:17, but one queue-dependent observation does not establish a causal speedup.
The independent exact-application [focused run 40181089376](https://github.com/jurei733/testcenter-rewrite/actions/runs/40181089376)
passes all three reusable jobs: authentication **296 tests / 81 s**, results
**371 / 83 s**, Systemcheck **9 / 60 s**. Fresh-core times are **13.23 / 9.59 /
13.32 s**, selected-test times **31.97 / 31.12 / 3.96 s**. Every job also passes
**277 Linux policy checks**, no skips, and the full-lock audit with zero
vulnerabilities. The isolated wrapper adds only one workflow to the same
application tree; complete acceptance remains separate.

New unchanged-production [Source ALTCHA qualification 40181968246](https://github.com/jurei733/testcenter-rewrite/actions/runs/40181968246)
passes **16 groups / 32 HTTP observations** with Login/person protection active,
real XSD fixture uploads and the actual verifier. Artifact **12593679219**, 4,711
bytes, has ZIP SHA-256 `6dfc32dfcd191360675a1ef2758532e22ac09bb218e6ecb6402e736803d851ba`.
All four members and eight Source file hashes are checked. Probe head
`ffa67c0c015a041f8103de723f5a1ead8b8f11a9` has tree
`77789338c74f839d327e96dbe12cff8951f92dfd`, adding only its three isolated probe
files to the published application tree. Original production code stays unchanged;
owned containers and volumes are retired. Public evidence excludes credentials,
bearer headers and complete challenge values. See [contract and limits](ORIGINAL-RESULT-GROUPS.md).

The current native assignment follow-up requires its own qualified application
tree. It rejects stale-code fallback without losing Source-backed owned-Test or
zero-code reentry. An initially overstrict attempt fails the existing Source62
controls; those assertions remain unchanged, and the corrected implementation
retains their behavior. A narrow green auth result is not full acceptance.
Native HTTP/PoW implementation and broad visual parity remain open.

Final local qualification of the native code-grant correction passes **4,139
unit/frontend**, **2,309 full PostgreSQL**, and **304 focused all-store auth**
checks, without failures/skips/cancellations. Fresh production build, typechecking,
both-interface Booklet variant/selection/browser journeys, Actionlint and diff
checks pass. The full-lock audit reports zero vulnerabilities. Policy passes 275,
with one explicit GNU-timeout-only local skip. The owned PostgreSQL database has
zero other connections and zero remaining test schemas before removal; its
initially stopped cluster returns to stopped. New exact-head hosted acceptance
still has to run independently of the green preceding baseline.


## Native route readiness, retained evidence and release-free authentication (2026-10-25)

The authentication-core [full run 40174750198](https://github.com/jurei733/testcenter-rewrite/actions/runs/40174750198)
is terminal **failure**: 87 successful jobs, one failed browser leaf and the
failed final acceptance aggregate, with no skipped/cancelled jobs. Published head
`0a41d7ac78da70069311673681625fdb295bd362` and actual merge
`f3f9d7e332df5b53ab3acaca253e7855ce814d24` share exact tree
`38e1db3727a02ef3895703cab5befa57a4b00c93`. The first native-route smoke times
out at its 30-second `page.reload(networkidle)` wait, before the native-tabs
script runs. The expected failure uploads find no files because that prefix
used a private temporary directory. Its historical blocking request and any
application root cause are therefore **not established**.

The route prefix now uses the existing independently exercised native readiness
helper: DOM readiness plus all five required `window.tc` methods. Reload keeps
old-document retries unavailable until document commit before releasing the
route interception. Original exact Run, answer, clock, owner, journal and
idempotency assertions remain; no deadline or product assertion is relaxed.
A real browser fixture rejects a missing method and accepts ready methods while
a held background transport makes network-idle time out. Both complete production
route and native-tab journeys pass locally, including lost receipts, SPA
destruction/reentry, copied-tab ownership and browser crashes.

The first prefix honors `UI_SMOKE_ARTIFACT_DIR` and writes the workflow's exact
root `failure.json`/`failure.png` paths. Its public JSON contains bounded checks
and same-origin pending-request paths/methods only. It excludes request queries,
headers/bodies, document text and error payloads. Real filesystem controls prove
the configured upload paths, redaction, private-store retention and JSON survival
after screenshot failure. The workflow keeps its narrow explicit upload list.

Independent [focused Linux run 40174841334](https://github.com/jurei733/testcenter-rewrite/actions/runs/40174841334)
passes all three reusable service jobs. Its wrapper adds only one workflow to the
same published application tree (head `ce9591d14a52b3c78422f32e82ade1fa9cd496e5`).
Actual participant-auth / original-results / system-check results are **278 / 353 /
9 tests**, whole jobs **79 / 87 / 63 seconds**, fresh core **11.15 / 12.79 / 13.16
seconds**, selected tests **32.30 / 32.20 / 4.09 seconds**. Each also passes **275
Linux policy checks** without skips and a complete-lock audit with zero
vulnerabilities. Focused success does not override the failed full acceptance.
The earlier dispatch change still has no measured whole-CI speedup.

The current follow-up also qualifies [native person creation without content](ORIGINAL-RESULT-GROUPS.md).
Its local full unit/frontend suite passes **4,133** checks (121 + 325 + 1,637 +
2,050), full PostgreSQL passes **2,301**, and independent all-store auth
and migration controls pass **77/77**. Production build, core/web typechecking,
Actionlint and diff checks pass; full-lock audit reports zero vulnerabilities.
CI policy passes **275**, with one explicit GNU-timeout-only macOS skip. Two old
SQLite settings/role fixtures now include their historical content-release column.
An overstrict workspace-existence check found by canonical PostgreSQL reservation
controls was removed; only native parents take the new workspace lock, preserving
the standalone canonical contract. Those failed attempts are not passing receipts;
complete final suites are rerun after the corrections. New exact-head hosted
acceptance remains separate. Native HTTP/PoW and broad visual proof remain open.


## Native authentication core and completed pipeline follow-up (2026-10-25)

The dispatch/trigger follow-up completes [CI 40069256223](https://github.com/jurei733/testcenter-rewrite/actions/runs/40069256223)
with **89/89 successful jobs**, no failures/skips/cancellations. Head
`512756886778f18132b07a12372d28f41ba36ebd` and actual merge
`0a21dcf4826a7ef9e59103311b556254b8cf06d8` share verified tree
`bd6b0fc6bd3dabeca19d2d9a3609e2eb4413c50e`. Actual logs show **4,078
unit/frontend**, **2,224 PostgreSQL** checks and zero complete-lock audit
vulnerabilities. Linux policy passes **274/274**, without skips. Full PostgreSQL
UI and every mandatory Original/browser/deployability group pass.

Its observed span is **31 min 17 s**, 06:12:07–06:43:24 UTC on October 24,
compared with the preceding run's **30 min 46 s**. Fast feedback arrives at
06:17:12 UTC. The modeled 7–9-minute dispatch reduction is therefore **not an
observed full-CI speedup**. Shared queue availability and individual job runtimes
are not controlled by that model. Focused service feedback remains the separately
measured 59–78-second iteration path; complete acceptance remains required.

The next change implements a genuine internal native Login/person authentication
port, described in [the native lifecycle scope](ORIGINAL-RESULT-GROUPS.md). Its
new `original-login-protocol.test.mjs` remains mandatory in complete unit and
PostgreSQL acceptance and both relevant focused service suites. Actual Source21
receipts are integrity-checked; the second phase runs with password reads,
credential rebinding and failure-counter resets actively forbidden. Stable
Login/group capabilities survive reopening and password imports, while native
person bearers retain digest-only storage and compare-and-revoke logout.

The final local unit/frontend run passes **4,122 checks** (121 + 325 + 1,626 +
2,050), with no failures/skips. Complete PostgreSQL acceptance passes **2,283**
checks. The final adapter layout independently passes **59/59 authentication
controls over all four stores**, including two SQL connections, the registered
File writer, an older File manifest and deliberately failed SQLite70/PostgreSQL64
migrations. Migration SQL stays inside the infrastructure adapters, as required
by the repository Design Rules; the identical 936-byte text has SHA-256
`ed44f77699645e4a97e7503014f85bd16e25113e5bf49038f44b6d944e4e4d1a`.
The final layout repeats the protocol/migration checks after that byte-identical
placement. Input-capture controls also prove a caller cannot alter a queued
private capability's validated scope or token after submission.

Final core/web typechecking, **273 local policy passes** with one explicit
GNU-timeout-only macOS skip, Actionlint and diff checks pass. Historical schema
fixtures now retire the new private FK child/index before recreating their older
schema; all original rollback/data assertions remain. One old SQLite migration
fixture initially failed for that dependency and is corrected, rather than
removing its coverage. File's intentional one-writer exclusion remains enforced; concurrent clients
share its registered writer while SQL clients use separate connections. No
production assertion is weakened.

The first PostgreSQL attempt has no terminal TAP summary and is not a passing
run. At resumption its process handles and processes are absent, the cluster is
stopped, and startup recovery reports an interrupted database system; the
interruption's cause is not established. Those states are revalidated before restarting.
The interrupted owned database is removed only after its owner and zero
connections are verified. The successful replacement database has zero other
connections and zero remaining test schemas before removal; its initially
stopped cluster returns to stopped. New exact-head hosted acceptance still
needs to qualify the authentication follow-up independently of the green
pipeline baseline. No native HTTP/AccessSet/ALTCHA or visual parity is inferred.

## Latest full baseline, measured service feedback and queue ordering (2026-10-24)

[Full run 40067020592](https://github.com/jurei733/testcenter-rewrite/actions/runs/40067020592)
completes successfully with **89/89 jobs**, no failed, skipped or cancelled jobs.
Published head `072b075c6fa6b58647268a19e8e209dc9978818d` and actual checkout
merge `9145fd1fb124177d43d46b9ab59f575413c14dd5` have the same verified tree
`d6f6d36af68320ed2dff248508539d6074c32f1b`. Actual logs confirm **4,078
unit/frontend** and **2,224 PostgreSQL** checks, with no failures/skips, and
zero complete-lock audit vulnerabilities. Full PostgreSQL UI and all remaining
browser, Original-reference and deployability gates pass. The historical starter
failure does not recur; its root cause remains unproven. The run spans
05:38:09–06:08:55 UTC (30 min 46 s); early Fast feedback finishes at 05:43:02 UTC.

The independently successful [focused run 40067107146](https://github.com/jurei733/testcenter-rewrite/actions/runs/40067107146)
uses the exact same application tree with only an isolated qualification wrapper
added, head `337034f4c820d2dd71e63bb24bfcf96b47fded8c`. It exercises the actual
reusable production service workflow, without advancing or cancelling full CI:

| Complete PostgreSQL service suite | Checks passed | Whole job | Fresh core | Selected tests |
| --- | ---: | ---: | ---: | ---: |
| Participant authentication | 219 | 78 s | 13.03 s | 22.96 s |
| Original results | 294 | 69 s | 8.83 s | 18.83 s |
| Systemcheck reports | 9 | 59 s | 13.15 s | 4.06 s |

Every focused job also passes **273 Linux policy checks**, without skips, and
the full locked-graph audit with zero vulnerabilities. Job IDs are
`120792563750`, `120792563794` and `120792563560`, respectively. These are
observations of focused feedback; no whole-pipeline speedup is inferred from
their smaller scope. Manual dispatch still requires the workflow on the default
branch; no merge or deployment is performed here.

The next pipeline change submits the 40 broad verification shards in descending
observed duration. Its immutable timing fixture records the preceding successful
[89-job run 40064366620](https://github.com/jurei733/testcenter-rewrite/actions/runs/40064366620),
head `a6daa1d25ff9904e4f0fdfa20847988a32528c94`, and the complete previous matrix.
No command, browser requirement, assertion, deadline, dependency, runner limit
or acceptance prerequisite is removed. The five console shards retain all eight
checks; their membership control now permits the deliberate dispatch reorder.
Future extra suites can be added without inventing timings or rewriting this
historical receipt.

| Independent list-scheduling model | Previous order | Long jobs first | Model reduction |
| --- | ---: | ---: | ---: |
| 15 available slots | 25 min 54 s | 17 min | 8 min 54 s |
| 16 available slots | 23 min | 15 min 57 s | 7 min 3 s |

This model includes the recorded whole-job setup times but does not simulate
GitHub's shared queue, other workflow jobs or variable runtime. It is not an
observed hosted speedup. The reordered tree still requires its own full hosted
acceptance. Regression controls require every recorded command/option, descending
measured order, unchanged runner limits and the model's five-minute improvement.
The control fails against the previous order before the correction.

The same follow-up closes a trigger gap: changes only to
`.github/workflows/rewrite-service-focus.yml` now trigger full CI on main pushes
and PR updates, just like the main workflow and shared action. A negative
control fails against the old path filters. Both workflows pass Actionlint;
the final local policy run passes **273**, with one explicit Linux-only GNU
timeout control skipped on macOS and no failures. The read-only token,
immutable actions, credential-free checkout and fatal audit/test failures remain.

## Complete exact-Login baseline and current native modes (2026-10-24)

[Run 40064366620](https://github.com/jurei733/testcenter-rewrite/actions/runs/40064366620)
qualifies head `a6daa1d25ff9904e4f0fdfa20847988a32528c94` with **89/89 successful
jobs**, no failures/skips/cancellations. Actual checkout merge
`89390babc33ce0659f970889df38ae22d4e59021` has exactly published tree
`b97a3ef2273afe5d56d9f907e287624bcf84876a`. Actual logs independently verify
**4,073 unit/frontend** and **2,216 PostgreSQL** checks, plus zero complete-lock
audit findings with dev/optional dependencies included. Full PostgreSQL UI and
every other required group pass. The historical starter-prefix failure does
not recur; this does not establish its root cause. Narrow failure retention
remains available for any recurrence.

The follow-up applies Source21's current Login mode immediately to already-open
native people/Tests at roster import, with existing bearers and exact saved
state preserved. It includes current-mode guards for delayed Test saves/fresh
reservations, exact-name and canonical separation, atomic roster/parent/Test
rollback and a real PostgreSQL held-parent/import/FK-activity control. SQL
projection uses scope/mode metadata without loading private response payloads;
a decoder-fence regression proves that distinction. See
[the implementation scope and remaining parity](ORIGINAL-RESULT-GROUPS.md).
Full hosted acceptance of this later tree remains separate from its qualified
baseline; every mandatory acceptance group remains required.

Final local qualification of the live-mode/metadata follow-up passes **4,078
unit/frontend checks** (121 + 325 + 1,582 + 2,050) and **2,224 complete PostgreSQL
checks**, without failures/skips. The real authentication focus passes **171**
non-PostgreSQL checks in 11.21 seconds after its incremental core build, and
**219** PostgreSQL checks. These are local observations, not hosted/cold-build
speed promises. Core typechecking/build, CI policy 271/one explicit
GNU-timeout-only macOS skip and diff checks pass. SQL decoder fences, late
roster publication failure and blocked-parent/FK controls remain in the existing
required suites. All schemas and other connections retire before dropping the
owned database and stopping its initially stopped cluster. No additional
Angular production build is needed for this core-only local change; the full
hosted workflow still performs its fresh shared production build.

## Native Login isolation qualification after focused pipeline adoption (2026-10-24)

The focused service runner catches the next real Original discrepancy: exact
native Login names were being folded like group names. The correction and its
actual Source21 evidence are described in
[the native identity scope](ORIGINAL-RESULT-GROUPS.md). Existing mandatory suites
now include six independently authenticated case/composition peers, concurrent
first entry, preserved private Test data and 30 denied protected peer reads,
plus complete integrity checks for all four Source21 artifact members. No
required suite or acceptance job is removed.

The final complete local unit/frontend command passes **4,073 checks**
(121 + 325 + 1,577 + 2,050), with no failures/skips. The final real
`ci:focus -- participant-auth` passes **166 non-PostgreSQL checks**; selected
tests take **10.57 seconds** after its incremental core build. These are local
observations, not hosted or cold-build speed promises. Full hosted acceptance
of the final follow-up remains required.

The complete local PostgreSQL command also passes **2,216 checks**, with no
failures/skips, and the PostgreSQL authentication focus passes **211**. All
test schemas and other connections are absent before dropping the owned
database and stopping its initially stopped cluster. Core typechecking/build,
CI policy (271 passes/one explicit GNU-timeout-only macOS skip), Actionlint
and diff checks pass. No new Angular build is needed for these core-only
changes; complete hosted acceptance still performs its fresh shared production
build and every mandatory browser gate.

The predecessor [run 40060887122](https://github.com/jurei733/testcenter-rewrite/actions/runs/40060887122)
is now terminal: **87 successful jobs**, the one starter-prefix browser failure
below and failed final acceptance. No jobs are cancelled or skipped. Its
successful complete PostgreSQL UI and remaining useful jobs finish normally.
The focused pipeline and native-isolation follow-up can therefore be published
without discarding useful running qualification. The historical failure stays
visible; the follow-up's evidence retention does not claim its root cause fixed.

## Standalone Linux service feedback with complete security checks (2026-10-24)

`.github/workflows/rewrite-service-focus.yml` provides a separate manual/reusable
workflow for `participant-auth`, `original-results` or `system-check-reports`.
Each invocation validates that exact selection before installation, checks out
without persisted credentials, installs the locked Node/dependency runtime,
audits the entire lock including dev/optional dependencies, runs CI policy and
freshly builds core before executing every selected test. It starts its own
PostgreSQL 16 service; the existing test suites own and retire their schemas.
There is no browser download, production Angular build, borrowed build artifact
or upload of databases, request bodies or credentials. Invalid/reusable-call
input fails with status 2. Audit, policy, build and test failures remain fatal.

Actual [Linux qualification 40062029384](https://github.com/jurei733/testcenter-rewrite/actions/runs/40062029384)
runs the exact reusable workflow from an isolated push wrapper on
`codex/service-focus-qualification-20261024`, head
`6af21a4e8caf56864cb710235b161c231d6365ff`. All three jobs pass:

| Complete selected suite | Checks passed | Whole job | Fresh core build | Selected tests |
| --- | ---: | ---: | ---: | ---: |
| Participant authentication | 205 | 59 s | 9.01 s | 15.39 s |
| Original results | 280 | 74 s | 9.44 s | 20.44 s |
| Systemcheck reports (PostgreSQL) | 9 | 47 s | 7.67 s | 2.24 s |

Each job also passes all **272 Linux CI-policy checks**, without skips, and
reports **zero complete-lock audit vulnerabilities**. The three-job wrapper
finishes in 77 seconds. These are observed targeted runs with warm dependency
availability; they do not measure or replace complete acceptance. Both workflow
and job names explicitly distinguish service feedback from acceptance. The
existing full workflow, PostgreSQL UI, Docker/Compose, Original browser evidence
and final required aggregate remain mandatory for a release.

Manual dispatch becomes available when this new workflow is present on the
default branch, as [GitHub documents](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow).
After that, select the workflow in Actions or use, for example:

```sh
gh workflow run rewrite-service-focus.yml --ref YOUR_BRANCH -f check=participant-auth
```

The isolated qualification does not change the active PR branch or cancel its
useful full-CI jobs. Its production workflow blob is
`2e5b9145d387ef972397271cdd71af5682983983`. The later generic failure-document
retention and its additional policy control below are separate follow-up work.

## Preserve the actual failing starter document (2026-10-24)

Full [run 40060887122](https://github.com/jurei733/testcenter-rewrite/actions/runs/40060887122)
qualifies its **4,068 unit/frontend** and **2,210 PostgreSQL** checks, but leaf
[`ui-monitor-finish-all` 120774941703](https://github.com/jurei733/testcenter-rewrite/actions/runs/40060887122/job/120774941703)
fails in the earlier `participant-entry-review-comments` prefix, waiting for
`#participantStarterScrollButton`. That does not qualify the leaf's later
finish-all cases or the full tree. Its actual checkout merge
`50328dd7aa8f3231a474b6a1610f692bde9470cc` has exactly published head
`ee09f710466c92025f894c950b2694a0f6e6c831`'s tree
`12c1de2be2250fe71b611dac8219bc9be4fbc260`.

The process writes its failure screenshot/JSON, but the existing specialized
artifact uploads do not retain either file at this prefix. Extended browser
leaves now retain precisely `failure.json` and `failure.png` on failure or
cancellation, under a unique leaf/attempt name, for seven days. No success
captures or directory-wide store/log uploads are added. The original test
command, input, assertions and deadlines stay unchanged. This repairs evidence
retention; the historical starter failure's root cause remains open. The later
local CI-policy gate passes **271**, with its one explicit GNU-timeout-only
macOS skip, and Actionlint passes both workflows.

The complete preceding prefix through `participant-entry-review-comments` also
passes locally with a real headed Chromium, the unchanged production frontend
and owned SQLite database, in 93.26 seconds. Browser/API teardown completes and
the owned SQLite file is removed. This local non-recurrence is not a Linux
reproduction or a fix for the historical failure.

## Focused participant authentication and core-only unit iteration (2026-10-24)

`npm run ci:focus -- participant-auth` runs the existing native group/Login/
person, protected HTTP sign-in, browser credential-selection and logout suites
after one fresh core build. These six files remain in mandatory unit/frontend
CI. The command selects complete suites, accepts no arbitrary shell command and
preserves the first failure's status. PostgreSQL cases run too with
`FIRST_SLICE_STORE=postgres` and `FIRST_SLICE_POSTGRES_URL` pointing to an owned
test database, as in the complete PostgreSQL runner. This is preparation for the
remaining native Login-token protocol work, not proof of that protocol's parity.

`npm run ci:focus -- unit` now follows the same core-only dependency as the
regular `npm run test:unit`, instead of compiling an unused Angular production
frontend. Unknown or browser consumers still select the complete production
build; policy/no-emit typechecking need none. The hosted workflow still restores
the verified same-run production build and retains its separate terminal-overlap
parity gate and every other required acceptance job.

An actual focused authentication run passes **161 checks**, zero failures/skips,
with `dist/apps/web` moved outside the checkout for the entire run. Total elapsed
time is **11.55 seconds**, including a **0.22-second incremental core build**.
The complete focused unit command also passes all **4,068 checks** (121 + 325 +
1,572 + 2,050), zero failures/skips, with web output absent throughout: **70.12
seconds** total, including a **0.18-second incremental core build**. Neither
command generates web output. These are local measurements, not hosted
or cold-build speed guarantees. The owned verification restores the original
web directory on exit.

## Complete zero-code baseline and atomic native person follow-up (2026-10-24)

[Run 40054649901](https://github.com/jurei733/testcenter-rewrite/actions/runs/40054649901)
qualifies published head `6af24f42f11dbca121bb8db156ae97ce5b422338` with
**89/89 jobs successful**, no failures, skips or cancellations. Its actual merge
`ead812d6cb583a03837e7148fd9291da26e68311` has exactly the published tree
`1d64534afe71a44d95653909b7a7be96d390d9a5`. Actual logs verify **4,041 unit/
frontend checks**, **2,173 PostgreSQL checks** and zero complete-lock audit
findings with dev/optional dependencies included. The full PostgreSQL UI and
all remaining required groups pass. The historical Linux navigation failure
did not recur; a green rerun does not establish its root cause. Failure-only
diagnostics remain available for any recurrence.

The native suffix resolver builds on that green tree. Local implementation
qualification passes **4,068 unit/frontend checks** and **2,210 complete
PostgreSQL checks**, with no failures/skips. The focused SQL/native/HTTP/live-file
controls pass 101 checks, including the real blocked-parent/FK lock sequence,
late rollback and eight concurrent protected HTTP credentials resolving one
person with one latest valid bearer. The later targeted-fixture-only follow-up
passes all 77 native controls across four stores. CI policy passes 267 checks
with its one explicit GNU-timeout-only macOS skip. Core/web typechecking and
production build pass; initial entry remains 468.39 kB under 470 kB.

The existing required suites retain every new regression. Mode/assignment edits
in the fixture import only the changed Login, preserving assertions while
avoiding rehashing unrelated test passwords. Native authentication no longer
loads every workspace person for a service-layer scan: resolution reads its
scoped Login under the durable writer lock. File no-op reentry and unchanged
SQL mode projections avoid extra writes. These changes do not remove any
mandatory acceptance gate. See [identity scope and remaining work](ORIGINAL-RESULT-GROUPS.md).

The final real focus command passes **233 non-PostgreSQL checks in 10.81 seconds**
after its incremental core build; the PostgreSQL focus passes **280 checks**.
These are local observations under other qualification work, not hosted/cold-build
speed promises. The complete suites retain all cases.


## PostgreSQL UI failure evidence without extra success captures (2026-10-24)

[Run 40051919357](https://github.com/jurei733/testcenter-rewrite/actions/runs/40051919357)
finishes **87 successful jobs**, one failed PostgreSQL UI leaf and failed final
acceptance. Its actual merge `c3a237e03ec78728e8376ce6c74b240b71f483dd`
has the exact published tree `8f6b696cef09b8663888b0f5f785d45967ec6ec6`.
Actual logs qualify all **22 Rewrite timer and nine Original Worker cases** in
[120747363324](https://github.com/jurei733/testcenter-rewrite/actions/runs/40051919357/job/120747363324)
and all **44 Exit/dialog cases** in
[120747363000](https://github.com/jurei733/testcenter-rewrite/actions/runs/40051919357/job/120747363000).
The independent PostgreSQL UI leaf
[120747362686](https://github.com/jurei733/testcenter-rewrite/actions/runs/40051919357/job/120747362686)
times out navigating from `/app/runtime` to Workspace after the booklet-detail
Review Response handoff. Its screenshot is written to an unretained temporary
directory, so this run cannot prove whether the navigation received trusted
input or why it stayed on Runtime. The remaining useful jobs finish normally;
this failure is not hidden by restarting the whole job.

The full PostgreSQL UI now retains its exact failing process log plus a
failure-only screenshot and bounded navigation JSON (trusted shell-nav events,
focus/visibility, link bounds and active element). It records no credentials,
request bodies or database dumps. The separate failure directory does not turn
on the large journey's success screenshots. Explicit Bash keeps `pipefail`
through `tee`; the unchanged UI command, deadlines and assertions remain
mandatory. Policy checks require the failure/cancellation upload, seven-day
retention and narrow paths. This improves diagnosis; it does not claim the
historical navigation failure's root cause is fixed.

The accompanying standalone-zero XML parser fix is exercised in all existing
required native identity/HTTP/focused suites and normal/protected login browser
gates. [Source62 and the remaining native suffix gaps](ORIGINAL-RESULT-GROUPS.md)
are retained with exact public bytes. Local implementation qualification passes
4,041 unit/frontend and 2,173 complete PostgreSQL checks, plus focused
PostgreSQL 243, CI policy 267 passes/one explicit GNU-timeout-only macOS skip,
core/web typechecking and the 468.39 kB production entry under 470 kB.
All thirteen Source62 artifact members are revalidated in the native identity
suite; its receipt-bound follow-up passes 41 checks across all four stores.
The full local headed PostgreSQL UI also passes through the failed hosted
navigation and every later review/monitor/deletion assertion to successful
owned teardown. This does not reproduce or explain the historical Linux
navigation failure. All test schemas and other database sessions are absent
before dropping the owned database and stopping its initially stopped cluster.
Exact hosted acceptance remains separate from these local results.

## Strict held-route transport and dialog fallback (2026-10-24)

[Run 40049080532](https://github.com/jurei733/testcenter-rewrite/actions/runs/40049080532)
finishes all 89 jobs: 86 succeed, two browser leaves fail and final acceptance
fails. The successful security predecessor remains independently qualified;
this later tree must not be described as fully green.

The timer leaf passes all nine paired Original Worker cases, then its owned
`route.fetch` fails with `ECONNRESET` in a held save-progress request. The API log
shows successful surrounding requests and a six-second idle interval, consistent
with retirement of a pooled test connection. This is a transport diagnosis,
not proof of an application timer failure. Held-route forwarding now requests
`Connection: close` from its first request and explicitly disables retries.
A real Playwright HTTP regression proves distinct sockets, preserved payload/
authorization, one server-observed POST when its committed reply is lost,
an unchanged failing route gate and no HTTP500 replay. No mutation, assertion,
deadline or entire job is retried to turn an error green.

The player-exit leaf separately times out closing the missing-lazy-bundle
fallback. Its trusted input trace contains no button event, and focus remains
in the Player iframe. The fallback now uses the existing CDK focus trap with
safe initial focus and Escape cancellation. Its real browser gate additionally
checks forward/backward Tab confinement before the existing pointer-driven
cancel/confirm and protected return assertions. Full hosted verification of
these fixes remains required on their exact published tree.

The native person-data follow-up passes 4,039 local unit/frontend checks and
2,172 full PostgreSQL checks, with no failures/skips. CI policy passes 266
checks with its one explicit GNU-timeout-only macOS skip. Core/web typechecking
and production build pass; initial entry remains 468.39 kB under 470 kB.
The final `ci:focus -- original-results` passes 205 non-PostgreSQL checks:
incremental core build 0.241 seconds, selected tests 5.736 seconds. Its focused
PostgreSQL variant passes 242 checks. These are local observations under
concurrent work, not hosted/cold-build speed guarantees. All cases remain in
the mandatory suites; no complete acceptance gate is removed. Owned PostgreSQL
schemas/connections are absent before removing the database and returning the
initially stopped cluster to its stopped state.

## Complete security-patch acceptance and first native Test labels (2026-10-24)

[Run 40046280241](https://github.com/jurei733/testcenter-rewrite/actions/runs/40046280241)
qualifies published security head `f0d653bc914d28c0d30625d49a1ba5c4e9feca1a`
with **89/89 Linux jobs successful**, no skipped/cancelled/failed jobs. Its actual
PR merge `2de353cb4d7dddf46a202e4e36a531996b6b6ccf` has the exact published tree
`0d360189411ac648eb7122731fc8b1420a03b46a`. Actual job logs verify **3,981 unit/
frontend checks**, **2,121 full PostgreSQL checks**, zero complete-lock audit
findings and the successful complete console journey. Every other required
browser/reference/runtime/integration group and final acceptance passes.

The next native Test-label change uses that green tree as its base. Local
implementation qualification passes **4,007 unit/frontend** and **2,130 full
PostgreSQL** checks. Its focused command retains all cases in the mandatory
suites and adds actual schema-validated live-file replacement controls. Complete
Source53 production evidence now confirms ordinary, padded/newline and empty
Booklet labels, while identifying further still-open person-code/suffix and
two-step-login requirements. See [the exact scope and evidence](ORIGINAL-RESULT-GROUPS.md).
The later receipt-only update passes the final 174-check non-PostgreSQL focus and
nine direct PostgreSQL native-label checks. Hosted acceptance of this follow-up
tree remains separate from the green security-patch run above.

## Current green baseline and faster service iteration (2026-10-24)

The published baseline `856dfd8d5d09dd659033938c3cb84599d37977d0`
qualifies all **89/89** actual Linux jobs in
[run 40040342490](https://github.com/jurei733/testcenter-rewrite/actions/runs/40040342490),
including 3,945 unit/frontend checks, 2,073 PostgreSQL checks and the complete
participant console. Its merge tree is exactly the published source tree. This
supersedes the earlier pending qualification below, without changing the recorded
failed predecessor. It does not qualify later changes or full Original parity.

`ci:focus` now includes `original-results` and `system-check-reports`. Selecting
only these service/store checks runs one core build and every existing leaf.
A mixed/browser/unknown build consumer retains the complete production build;
policy and no-emit typecheck still need none. A failed core build stops every
selected test with its exact status. The complete workflow and all mandatory
gates stay unchanged, and these regression cases remain in unit/PostgreSQL CI.

A real `npm run ci:focus -- original-results` passes **148** local non-PostgreSQL
checks: an incremental core build takes 0.33 seconds and the test command takes
7.74 seconds on this machine. The full fresh production build observed during
qualification takes 23.55 seconds for Angular alone; that work is unnecessary for
this selected service suite. These are individual local observations under other
concurrent tests, not a cold-build or hosted critical-path speed guarantee.
The focused PostgreSQL variant passes **191** checks in 6.40 seconds after core
build. Full local qualification passes **3,981 unit/frontend checks** and
**2,121 PostgreSQL checks**, including every new regression. Native identity and
rollback coverage is described in
[the group lifecycle evidence](ORIGINAL-RESULT-GROUPS.md).

## Exact timer-preparation result clocks in the console gate (2026-10-24)

Full [run 40037128795](https://github.com/jurei733/testcenter-rewrite/actions/runs/40037128795)
reaches the complete matrix after successful security and fast-browser gates.
Its console leaf `120700962068` exposes an outdated full-record expectation:
an accepted timer interruption changes Test state and therefore advances both
server-owned Original Test timestamps, exactly to the interruption receipt time.
The existing assertion expected those newly added fields to remain unchanged.

The full-record check now explicitly expects `hasTestState=true`,
`lastTestStateAt=acceptedAt` and `lastTestModifiedAt=acceptedAt`, retaining the
exact preceding opening time and every other field comparison. A separate
assertion requires real opening evidence. No metadata field is dropped, and no
application effect, retry, deadline or input changes. The complete headed local
console journey passes through held continuations, terminal overlaps and final
reload/early-error cases with owned teardown. Full hosted acceptance for the
corrected tree remains to be established.

## Qualified material-bound offline browser runtime (2026-10-24)

The main workflow now selects format 3. It preserves both actual hosted image
labels and admits consumers only after complete archive/context checks, offline
native APT restoration and equal actual browser/font/library/Node material plus
exact current Original Source pixels. The actual production composite passes
one producer and eight consumers across both observed images, then a selected
consumer rerun against the immutable original producer attempt. Independent
evidence covers 17 package archives, 10 profiles and 80 PNGs. All mandatory
matrix and acceptance gates remain; legacy format 2 still requires exact labels.
See [protocol, actual qualification and limits](BROWSER-RUNTIME-V3.md).

The first complete run after adoption also discovers a newly reported high
body-parser vulnerability. Its audit fails correctly; a compatible three-record
lock update and independent old/new scans are documented in
[the audit evidence](DEPENDENCY-AUDIT.md). That finding does not invalidate the
earlier isolated runtime qualification or make a failed full run green.

### Install-free full-scope security audit and targeted patches (2026-10-23)

The required dependency job now audits the committed lock directly, with explicit
dev/optional inclusion and the unchanged high threshold, avoiding npm cache
restoration and package installation. Owned temporary-workspace controls with no
`node_modules` still reject the old vulnerable lock, including under
`NODE_ENV=production`. Targeted Angular CLI 21.2.28 / Zod 4.6.6 and compatible
ip-address 10.7.4 updates clear all three current findings after a clean install.
See [audit scope, exact evidence and timing limits](DEPENDENCY-AUDIT.md).
The actual predecessor audit failed correctly. The exact revised job now passes
[isolated Linux run 40027715625](https://github.com/jurei733/testcenter-rewrite/actions/runs/40027715625):
zero vulnerabilities, about 0.91 seconds for audit and nine seconds for the job
(previous job: 21 seconds). This is an individual hosted observation and does not
make the predecessor run green or establish complete hosted acceptance.


### Focused group-snapshot feedback (2026-10-23)

`npm run test:original-results` now also covers group snapshots and the actual
protected pre-code login flow. It builds the core once, runs without an Angular
build and retains every case in the full unit/PostgreSQL gates. On the owned
local PostgreSQL qualification, the focused test process passes **129** checks in
**3.95 seconds** after core build. This is a measured focused test duration, not
the complete CI critical path or a hosted-runner speed guarantee. The existing
independent PostgreSQL job and strict browser-image provenance remain unchanged.

[Source run 40025829117](https://github.com/jurei733/testcenter-rewrite/actions/runs/40025829117)
qualifies **32** production HTTP groups on unchanged pinned Original. Complete
SHA-bound public evidence is retained with the source fixtures; see
[the group lifecycle and remaining scope](ORIGINAL-RESULT-GROUPS.md).


## Verified Test-row clock versus Test-state evidence (2026-10-23)

[Actual Source Oracle 40018466023](https://github.com/jurei733/testcenter-rewrite/actions/runs/40018466023)
passes all **29** production Apache/PostgreSQL HTTP groups. Original source remains
`eedae41840cbe90e5547c0211da818bdf620f5aa`, test mode stays off, real XSD/admin/person/
monitor authentication is used, and owned containers/volumes retire. Independently
downloaded artifact `12529202876` verifies ZIP SHA256
`f9d07cc3db4b05e1c9e954d2b50df3a0086a502ac0ceb57a6a7efc409ad38f89`.
Its complete public reports, receipt, image/runtime metadata and pinned source/script
hashes are retained under `source-workspace-results/lock-clock` alongside the earlier
27-check fixture. The initial Oracle 40018047489 is retained as failed: its 25 ms
clock control assumed finer precision than the unchanged Source's Unix-second API.
The corrected probe crosses that actual whole-second boundary and keeps the strict
changed-time assertions. It changes no Source code, clocks or database state directly.

The Source proves that lock, same-value relock and unlock move the Test-row result
time without creating nonempty Test state or Units; an unopened Test still does
not become a Result. Unit definition/state/log calls leave that Test-row time
unchanged. The Rewrite now keeps `lastTestModifiedAt` separate from
`lastTestStateAt`/`hasTestState`, persists lock time even for a non-saving mode,
forwards same-value lock effects under the store lock, and rejects/discards forged,
terminal-noop and superseded metadata effects. Existing JSON metadata columns make
this additive; no new SQL migration or fabricated legacy history is introduced.
Native group result times are Unix seconds; client response-part `ts` remains
milliseconds. The native result projection still needs that explicit conversion.

Full local unit/frontend regression passes **3,900** (121 / 324 / 1,406 / 2,049),
full PostgreSQL passes **2,017**, and full API passes **173 each** in Memory, File
and SQLite. The later Source-receipt regression is also covered by the final
**88-case** focused Original-results command with PostgreSQL. Stronger exact
reentry expectations pass 183 cases separately. CI typechecking and fresh production
build pass, retaining **468.39 kB** under the unchanged 470 kB entry limit. These
checks qualify the recorded implementation scopes, not full Native Results/Tests
pages or the complete 89-job Linux acceptance.

## Independent full database feedback (2026-10-23)

Main run 40014001739 demonstrates that a browser cohort rejection in the fast set
also skips the complete PostgreSQL group through `fast-feedback`. That database
group now depends directly on successful shared build, typecheck, dependency audit
and mandatory unit checks. It can therefore qualify the exact same-run build
without waiting for, or being skipped by, an unrelated browser image rejection.
Its complete serial test inventory, isolated owned schema, migration/doctor/preflight
and protected startup smoke remain unchanged. PostgreSQL UI stays in the browser
path, and complete acceptance still requires both database and browser groups.
A workflow graph control checks the full transitive ancestor set, all four positive
dependencies and the mandatory database leaves. This improves useful database
feedback; it does not turn a failed browser/acceptance result green.

## Original sample external-resource readiness (local follow-up, 2026-10-23)

The failed participant-detail-review trace contains correct required-field answer
notifications, followed by an empty value in the same document with a replaced
input node. The unchanged Source sample definition explains that transition:
its asynchronous external fetch appends text through `#unit.innerHTML +=`, which
recreates the existing form controls and loses values entered before the append.
The browser smoke now waits for the exact actual external content in `#unit`
before its existing answer entry. Existing save/persistence/reentry assertions,
input helper, attempts and deadlines remain unchanged; no additional input is
synthesized. Source application/player/definition bytes remain unchanged.

An actual headed control executes the existing original player HTML and sample
definition against an owned HTTP server. Holding the real external response
reproduces the early-input reset and changed node identity when released. The
production readiness helper stays pending while that response is held; after
release, one native fill preserves the exact answer. Both the existing diagnostic
control and this causal control pass. The control remains in the mandatory native
browser-capture group. The complete affected participant-detail-review journey also passes locally and
closes its owned browser/API. Isolated Linux run 40015789397 passes both causal
controls and the actual sample phase on native image `20261023.334.3`, then fails
later at the monitor selection cleanup: a successful batch asynchronously removes
its accepted runs after the smoke's `isEnabled()` check but before its redundant
Clear Selection click. Verified artifact `12528963599` has ZIP SHA256
`970a50a10f88ee1eedaa83c6d132d359d07036dbc5b2fb9438d4e42c58e2db6e`.
The correction asserts the actual empty-selection postcondition and disabled
Clear button instead of issuing another input. Existing cohort request/target
assertions remain. Six existing monitor navigation/selection controls pass. The
next isolated Linux candidate retains the same complete journey and also uploads
its owned failure screenshot. Neither partial success nor matching package/font
catalogs proves shared-image compatibility, full Linux acceptance or a fix for the
unrelated missing native clicks.

## Early runner image rejection and result-state qualification (2026-10-23)

[Run 40008675385](https://github.com/jurei733/testcenter-rewrite/actions/runs/40008675385)
on `4af7dcc5` is terminal: **79 successful / 10 failed jobs**. Eight browser
consumers reject the exact runner-image binding before browser installation:
producer `20261012.334.1`, consumer `20261023.334.3`. The complete base dpkg
inventory hashes match, which does not establish image/font/browser equivalence.
The separate participant-detail-review failure retains trusted input/change
observations followed by empty player answer state; its cause is unresolved.
The mandatory acceptance job fails. The full PostgreSQL and PostgreSQL UI jobs
succeed. No overall green or missing-click fix is inferred.

The package producer now advertises its validated exact image version as a job
output. Every actual browser consumer and the independent offline qualification
reject another image **before Node setup, npm installation or artifact downloads**.
The version travels through an environment variable rather than interpolated
shell code. Missing/malformed metadata fails without being echoed or evaluated;
partial reruns keep the successful producer's exact output. This cheap rejection
never replaces authenticated artifacts, exact run/attempt/lock/image binding,
package hashes, full dpkg inventories or final native font checks. It reduces
wasted setup on an incompatible runner; it does not make mixed images compatible
or prove a reduction in successful full-run time. The real shell controls
reproduce the observed rollout mismatch and cover malformed/injected values,
missing outputs, same-image success and preservation of earlier step outputs.

Result-state work adds optional server-owned opening/Test-state evidence to all
four stores, with SQLite migration 66 and PostgreSQL migration 60. Legacy rows
remain unknown rather than receiving invented historical timestamps. The required
unit group passes **3,895 cases** (121 / 324 / 1,401 / 2,049), and the complete
real local PostgreSQL group passes **2,011 cases**. Two subsequently added protected
API scenarios also pass independently on SQLite and PostgreSQL (nine API cases
per invocation). They cover ignored forged metadata, authorization, response-only
and log-only writes, exact delivery replay, same-unit Test-state writes, rejected
navigation rollback, reopening and non-saving review mode. The fresh-core focused
command now includes those API controls and passes **83 cases** with PostgreSQL.
The complete policy group passes **244**, with one explicit GNU-timeout-only
macOS skip and no failure. CI typechecking and the fresh production build pass;
entry remains **468.39 kB**, under the unchanged 470 kB limit. Full new-head Linux
acceptance remains required. Native Results/Tests pages and the formal partial
parity rows remain open.


## Current local export/isolation qualification (2026-10-23)

Complete local qualification passes **3,866 unit/frontend cases**
(121 / 324 / 1,372 / 2,049), **173 full API cases each in Memory/File/SQLite**,
and **1,971 full PostgreSQL cases**, with no application test failures/skips.
The corrected PG run uses its owned temporary schema against the same reused
local database that exposed the prior failure. Generated test/sentinel schemas
are absent afterward; the owned PG cluster is stopped. The final focused archive
path passes **34 cases**, including real HTTP and all four stores.

CI policy passes **242 cases**, with its one explicit GNU-timeout-only macOS
skip and zero failures. Complete CI typechecking and a fresh Angular production
build pass. Initial entry stays **468.39 kB** under the unchanged 470 kB limit.
Source report bytes, receipt and provenance hashes are checked in the archive
regression. The actual current headed player-exit smoke also passes all **44**
journeys (38 Original / six Rewrite) and closes its owned browser/API. The native
input recorder remains diagnostic; these successful repeats do not establish a
fix for the earlier missing click. Full new-head Linux/89-job acceptance is still required; predecessor
`dd8505f4` remains failed at the native exit fallback and acceptance.

## Repeatable isolated PostgreSQL qualification (2026-10-23)

The complete PostgreSQL starter now gives each invocation a generated owned
schema, passes that schema through the existing connection options and removes
it only after its child finishes. Existing socket, credentials and other options
are preserved; the configured database and its other schemas remain intact.
Both callback failure and success attempt schema cleanup and pool close; cleanup
failures retain the original error. Child exit status and the complete serial
test inventory are retained. No production schema/migration behavior changes.

This follows a real local failure: invoking the previous starter against a
reused owned database produces **1,954 passes / 10 failures**, starting with
bootstrap returning 409 because previous administrator state already exists.
The failed run is retained rather than relabeled green. Six local controls
cover connection-option preservation, generated-name bounds, exact status,
creation/child/cleanup failure and independent invocations. An actual PostgreSQL
control creates data inside two temporary scopes, exercises success/failure,
checks those schemas are absent afterward and proves separate owned sentinel
bytes survive. Controls remain required in policy and the full real PG group.
The subsequent full run uses the new isolated starter against that same
previously used database; its actual result is recorded with qualification.

## Unanswered Unit exports and focused iteration (2026-10-23)

The Original archive now includes saved state-only and comment-only Unit rows.
The pre-fix regression fails in Memory, File and SQLite: missing data parts are
exported as an opaque answer, and review-only Units are absent. The correction
keeps empty response arrays, intentional empty legacy answers, null comment-only
state and the exact stored Run. Scoped persisted review evidence retains a Unit
following comment deletion/reopen; arbitrary logs are excluded. The SQL-backed
read filters event types before decoding details, preserving existing unfiltered
callers. File storage retains its normal whole-snapshot read.

`npm run test:original-results` performs a fresh core build and the complete
archive and result-state regressions, including actual protected HTTP creation/clock
controls and verified Source report fixtures. It needs no Angular/browser build. `FIRST_SLICE_STORE=postgres` with
an owned database adds the actual PostgreSQL cases. This focused path supplements
the unchanged mandatory unit/PostgreSQL gates and complete 89-job acceptance.
No timing comparison or overall acceleration is inferred from its small scope.

The corrected isolated exit diagnostic passes the **entire unchanged** headed
player-exit journey in [run 40004885960](https://github.com/jurei733/testcenter-rewrite/actions/runs/40004885960).
Its owned copy adds only bounded native/focus observations and retains the full
prefix, original assertions and deadlines. The original test stays SHA256
`3e793afd93b817395f449bfabcb47dd439be208024487f92483a11457ffb1435` and the
owned copy/API retire. Independently downloaded artifact `12524350606` verifies
ZIP SHA256 `53c00694feb60f9ce877ab1d9022904a5cddd2a07b36bfff3012298205cfb370`.
The fallback records one trusted Stay click and one trusted Continue click;
all existing later Rewrite cases pass too. This does **not** identify or fix the
earlier missing click. Regular smoke gains the same at-most-100 all-target
pointer/focus observations in its existing initialization and failure snapshot;
no additional pre-click await, retry, synthetic event or longer bound is added.

The first isolated exit probe `40003773131` fails before browser launch because
its workflow invokes the wrong diagnostic filename. The corrected workflow names
the exact file and validates Source SHA/insertion boundaries before building.
This is a probe-launch correction, not an application runtime correction.

## Current complete-head exit fallback failure (2026-10-23)

[Run 39999128704](https://github.com/jurei733/testcenter-rewrite/actions/runs/39999128704)
for `dd8505f4` finishes with **87 successful jobs and two failures**: the Original
player-exit leaf and the correctly failing acceptance gate. All other useful jobs
finish; no running matrix is canceled by a branch update.

The leaf passes the theme/width/exit-policy matrix and resumed state-gap case,
then fails its deliberately missing native-dialog-module fallback. The fallback
is visible, but the single Stay click does not dismiss it within the unchanged
30-second bound. Playwright records a completed click at (510.55, 505), while the
existing native event observer witnesses only the preceding logo click and no
Stay pointer/click. Failure JSON records a visible focused document with the
Player iframe active. This evidence does not yet establish the cause or a fix.
No retry, synthetic click, longer timeout or weakened assertion is added.

Artifact `12522716787` is independently downloaded and verifies ZIP SHA256
`c2183e63393c71181315cef58eae5a4dddaa3ed9ae194d8ff8c2842881298afc`.
It retains failure JSON/PNG and the complete Playwright trace. The separate
successful Verona leaf does not explain this fallback failure, nor resolve the
earlier missing shared-parameter input. A local complete unchanged player-exit
journey is used for diagnosis; a pass alone will not prove a fix.

## Executable Original result lifecycle baseline (2026-10-23)

The isolated production Source probe now passes **27 real HTTP groups** in
[run 40004889342](https://github.com/jurei733/testcenter-rewrite/actions/runs/40004889342).
It qualifies created/opened/stateful Test inclusion, saved state-and-log Units
without answers, aggregate counts, RO refusal and selected-Test deletion with
unchanged identity/other-Booklet data. The extension retains four actual selected
CSV/JSON pairs, including both distinct review versions and unanswered Unit rows.
Source and owned-resource cleanup checks
also pass. The receipt and its independently verified ZIP digest are recorded
in [Original parity notes](ORIGINAL-UI-PARITY.md#qualified-original-result-lifecycle-2026-10-23).

This isolated reference probe does not replace any of the complete application's
89 required gates or establish Rewrite equivalence. It provides an executable
baseline before implementing the two missing native workspace pages. In
particular, canonical all-Run/answer-key summaries cannot stand in for the
Original's opened-Test/persisted-Unit statistics.

## Source report denial and native input diagnostics (2026-10-23)

The native Syscheck report button now follows the actual Source template for
RO readers too: selection enables confirmation, and the protected API refuses
the confirmed request with 403. No backend permission check changes. The browser
proves exact preservation of all 505 reports, selected Check IDs and workspace
audit records, then exports the same complete 504-report CSV. A first rejected
request retains the unchanged table; an accepted batch followed by refusal
reloads actual results, including a zero-count concurrent deletion.

The final frontend/state plus selection/statistics/HTTP group passes **2,049
cases**, including **16 controller cases**; policy passes **234** with its one
explicit Linux-only GNU-timeout skip on macOS. A fresh Angular production build
and the entire report journey pass. Unchanged core/API/store qualification from
the preceding native report publication remains valid for those unchanged files.

The complete original Verona prefix also passes separately on Linux in
[run 39995283724](https://github.com/jurei733/testcenter-rewrite/actions/runs/39995283724).
Its source stays SHA256-bound to
`3e7013202716cb0dee80a6f69578fd3b1cf557a5a3abb674dd8a866949178cf2`;
all assertions/full prefix/stop boundary remain, and the owned diagnostic copy
is retired. Independently downloaded artifact `12519677848` verifies ZIP SHA256
`ed2fa4ca7df7fe768a27e6e8aaa049d3890805047e3af3e058e6ba620d8f94af`.
It contains package/browser setup, complete native input log and original sample
trace. Both Publish actions have exactly one trusted click; persisted/reloaded
shared parameters and the requested native-player stop boundary pass.

The preceding full probe `39994173184` times out in direct APT installation
before starting the browser. The corrected probe uses the already-verified
browser package producer and its established HTTPS mirror preference. Setup
logs are retained from before browser startup. It does not relax package
signatures, alter the test deadline or substitute a mocked runtime.

These successful runs do **not** explain or fix the earlier full-flow missing
click in `39990402820`. Regular smoke now passively records at most 32 native
pointer/click events inside its owned shared-parameter fixture. The existing
single post-click evaluation includes the current definition, frame time origin
and event snapshot if the strict one-trusted-click assertion fails. No extra
pre-click await, synthetic input, second click, retry, deadline increase or
qualifying assertion is introduced/removed. The actual complete local Verona
and subsequent eight native navigation cases exercise this diagnostic change.

## Native report qualification and open Verona input failure (2026-10-23)

`smoke:ui:original-workspace-files:built` now runs the complete existing file
journey followed by `smoke:ui:original-system-check-reports:built`. The existing
required workspace row still has its original command; no scenario is removed
and the complete workflow retains **89** gates. The report journey can also be
run independently for iteration. It uses actual protected SQLite, Original-19
XSD upload, 505 real report saves, native selection/download/confirmation,
RO/RW accounts, six theme/viewport captures, held-download logout and a real
deferred module failure/reload. Browser cases execute serially.

Local complete qualification passes **3,854 unit/frontend**, **173 API cases
each for Memory/File/SQLite**, **1,950 PostgreSQL**, and the unchanged full native
file journey plus the new full report journey. Policy passes **234 cases** with
one explicit GNU-timeout-only macOS skip, zero failures. Typecheck/production
pass, entry **468.39 kB**. Report controller ownership tests are required through
`test:frontend-state`; version/selection cases remain in unit and full PostgreSQL.
The qualification's owned PG schema/cluster and browser/API processes are closed.

This local result does not make the published predecessor green.
[Run 39990402820](https://github.com/jurei733/testcenter-rewrite/actions/runs/39990402820)
for `764619b5` fails its native Verona-player leaf `120542219940` at the second
shared-parameter Publish action: expected one trusted click for `publish-red`,
observed zero. The first `publish-blue` action passes. Its screenshot retains the
second definition with inherited blue/language parameters, so successful red
publication is unproven. No assertion, native click requirement or deadline is
relaxed, and a retry alone is not a fix. Other useful jobs are allowed to finish.

Failure artifact `12518211055` is independently downloaded and verified:
SHA256 `4a854702f6e81ed0dd3dbad6de8e518fa509b7580ee50895fc7263a1084319bc`,
members `rewrite-ui-quick.log` and `rewrite-ui-artifacts/failure.png`. A bounded
local reproduction uses the exact shared-parameter Player/ZIP and protected
runtime, adding diagnostic native pointer events and frame lifecycle records.
The bounded reproduction passes ten trials locally and in isolated Linux
[run 39993459075](https://github.com/jurei733/testcenter-rewrite/actions/runs/39993459075):
20 actual trusted Publish clicks, durable parameters and reload checks, with
owned cleanup. It does not reproduce or fix the full-prefix failure. A second
isolated probe now runs the complete original Verona journey with only native
input/frame diagnostics injected into an owned temporary copy. The actual smoke
source is SHA256-bound (`3e7013202716cb0dee80a6f69578fd3b1cf557a5a3abb674dd8a866949178cf2`)
and checked unchanged; assertions, full prefix and stop boundary are retained.
These probes and eventual complete-head qualification remain distinct from
the report-page checks. Never infer the overall run stopped from an observation
timeout, or cancel remaining useful jobs by moving the branch.

## Current finite-animation readiness and actual leaf rerun (2026-10-23)

Published `8e3d709c` first finishes
[run 39983754190](https://github.com/jurei733/testcenter-rewrite/actions/runs/39983754190)
with 87 successful jobs and two failures: the headed administration settings
smoke rejects a canceled Animation's `finished` Promise, and acceptance correctly
rejects that prerequisite. The downloaded diagnostic ZIP `12516775131` verifies
SHA256 `411fad6b515d051d8b7b4587108e4b23105ddd9c3eb2af78b5897c725b1d6b02`.
The stack identifies the finite-animation Promise barrier after both first-width
Primar captures. This is a browser animation cancellation, not an API fetch error.

A real Chromium negative control reproduces the old barrier's AbortError when
an existing effect is canceled. Settings readiness now observes the document's
current finite effects. Finished/idle effects and the previously excluded infinite
decoration permit readiness; a running or paused finite effect continues to block.
A replacement effect must finish too. A paused effect times out, and inspection
errors remain fatal. No animation is canceled by the helper, assertion skipped,
retry added, deadline increased or qualifying pixel comparison relaxed.

All **13** current native capture controls pass locally. The full protected
administration smoke passes its real directory/settings/asset/password/logout
flow and twelve theme/viewport diagnostic captures, then closes its owned API.
[Corrected native probe 39988853413](https://github.com/jurei733/testcenter-rewrite/actions/runs/39988853413)
passes 232 preceding Linux policy cases, four real Debian/APT controls, offline
restore in 8.375 s and all **13/13** headed browser controls. An initial isolated
probe rejects the extended command because its exact control inventory still
lists only the two earlier files; the expected inventory is extended, retaining
every previous control. Local current policy passes **233 / one explicit
GNU-timeout-only macOS skip**, with zero failures; Actionlint and diff checks pass.

A deliberately targeted rerun of the failed administration leaf also exercises
the already-published producer-attempt protocol against the real full workflow.
Attempt 2 restores `browser-system-…-1` and `rewrite-build-…-1`; logs bind
`producerRunAttempt=1 / consumerRunAttempt=2`, and the same build manifest verifies.
The full old administration leaf passes on that rerun, demonstrating that the
animation defect is intermittent. Acceptance then passes: all **89 distinct
executed gates** succeed without rebuilding successful producers or other leaves.
This does not qualify the new animation correction; its final publication still
requires a complete new-head run. Failure artifacts from attempt 1 remain intact.

The completed-run API additionally exposes two alias rows for that matrix leaf
with queued outer state, null runner and copied completed steps. The parent run
is terminal success, the actual leaf is successful and all 89 unique executed
gates are present. These duplicate metadata rows must not trigger another rerun.

## Full selected Systemcheck exports and actual Source baseline (2026-10-23)

The Original workspace report page downloads every report of all marked Checks.
The Rewrite's export previously injected the ordinary 100-record list default
and accepted only the first `checkId`. The new all-store regression first
reproduces 100 exported rows instead of 505. Exports now retain the complete
selected union; explicit limits apply after selection. Lists retain their page
bounds. Empty/malformed selections and protected RO/foreign-scope cases qualify
in the mandatory unit and PostgreSQL groups. `npm run test:system-check-reports`
provides a fresh-core focused iteration path.

Local application qualification passes **3,836 unit/frontend cases**, **173 full
API cases each in Memory/File/SQLite**, and the complete **1,949-case PostgreSQL
group**, with no failures/skips/cancellations. Owned PostgreSQL resources are
retired. Build/typecheck pass; initial production entry stays at **468.39 kB**
under the unchanged 470 kB budget.

A separate unmodified Source production Docker/Apache Oracle passes all nine
bounded groups in
[run 39988533872](https://github.com/jurei733/testcenter-rewrite/actions/runs/39988533872),
including real RW/RO grants, 505/504 full/selected reports, version-aware statistics,
selected deletion and token-bound revocation. Its independently verified receipt
and exact remaining permission/model differences are at the top of
`ORIGINAL-UI-PARITY.md`. The probe workflow is isolated from the production branch;
it does not replace any required application/Source gate or establish full
Source/Rewrite authorization equivalence.

## Bind partial reruns to the successful producer (2026-10-23)

[GitHub reruns](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/re-run-workflows-and-jobs)
retain the original event commit. A selected consumer can have a newer attempt
than its still-successful producer. Previously, the browser manifest compared
against the consumer attempt, so that partial rerun would fail. Full reruns
would also collide with existing immutable artifact names, as described by
[upload-artifact](https://github.com/actions/upload-artifact#not-uploading-to-the-same-artifact).

All build, browser-package, Source-reference and diagnostic artifacts now retain
an explicit producing-attempt suffix. Successful producers expose that attempt
as a job output. Every consumer explicitly selects its producer's output through
its actual `needs` dependency. No lookup by latest artifact, overwrite, cross-run
request or fallback is added. Earlier diagnostic and reference evidence remains
intact when a later attempt uploads its own files.

Browser restore validates that the referenced attempt is a canonical positive
safe integer no newer than the consumer. It then requires that exact producing
attempt in the unchanged manifest comparison. Commit, workflow run, lock/module,
Node/architecture, runner image, full initial inventory, actual package identities,
bytes and final dpkg/font oracle checks remain exact. A missing/wrong/future
attempt or changed base still fails before privileged installation. Expired
artifacts or a changed runner base require fresh producers; old runs keep their
old workflow code.

[Linux probe 39982638354](https://github.com/jurei733/testcenter-rewrite/actions/runs/39982638354)
uses the actual production composite. Initial attempt 1 passes all **232 policy
cases**, four native Debian/APT controls, the offline restore in **8.685 s** and
all seven headed Chromium capture controls. A real **consumer-only attempt 2**
retains the successful producer's original execution and output. Its log proves
`producerRunAttempt=1 / consumerRunAttempt=2`; offline restore passes in **10.115 s**
with the identical dpkg/font oracle, then all **7/7** headed controls pass. No
producer is rebuilt for that partial rerun. Re-executing the producer and its
dependent consumer in **attempt 3** also passes: **232 policy cases**, four native
controls, exact `producerRunAttempt=3 / consumerRunAttempt=3`, offline restore in
**16.816 s** and all **7/7** headed controls. The artifact listing independently
retains both producer-attempt names: IDs `12514500993` (attempt 1) and
`12513759146` (attempt 3). The older immutable artifact is not overwritten.
GitHub's rerun API requires the current-attempt job record; a prior-attempt job ID
returns 403, so rerun targets are resolved from the current job listing.

Local policy passes **231 cases / one explicit Linux-only GNU-timeout macOS
skip**, with no failures. Actionlint and diff checks pass. Every original scenario
and all 89 complete-workflow jobs remain. Actual shared-build/Source-reference
consumers and complete acceptance still require the final head's full Linux run;
the bounded native probe does not replace that qualification.

## Complete package-migration qualification (2026-10-23)

Published `44233b4b` completes
[run 39977337416](https://github.com/jurei733/testcenter-rewrite/actions/runs/39977337416)
with **89/89 successful jobs**, including every Original reference family,
store integration, browser, Docker and deployment gate. The shared producer,
offline native APT qualification and all actual browser consumers pass.
The downloaded artifact `12512395326` is independently rechecked: all 17
package sizes, SHA256 values, unique safe cache names and real Debian control
identities agree (25,937,806 package bytes). ZIP SHA256 is
`9fd7c9e6c80555894dd6b2553093e0951836e02d5858437b0d36f866bbf8e0e8`.

Observed elapsed time is **34:10**, with **4:39 Fast feedback** and **409.82
runner-minutes**. Across all 64 comparable browser setup steps, median setup is
**29 s**, versus **37 s** in the preceding run. This setup observation does not
establish a controlled complete speedup: the preceding failed run finished in
28:48 and used 411.27 runner-minutes, while queuing and journey timings differ.
Long repeated browser prefixes and the four-slot extended queue remain the main
throughput target. The new 32-case navigation observation below is separate from
this already-published run.

Full Linux acceptance of this commit does not establish complete product parity.
The formal status remains 29 done / 20 partial, with all eight broad visual rows
open. The newly added prestart Booklet detail test and navigation change still
require their own publication qualification.

## Remove an idle-network barrier from functional label checks (2026-10-23)

Completed Linux qualification job `120497596787` in
[run 39977337416](https://github.com/jurei733/testcenter-rewrite/actions/runs/39977337416)
takes 809 seconds, including 169.599 seconds between the current-label/config
marker and its next operator-session marker. These are complete functional
matrices, not an idle hang. The synthetic label matrix still waits for an initial
500 ms quiet-network interval before accessing the real login controls.

That initial navigation now waits for `domcontentloaded`. Existing Playwright
form actions, actual sign-in/resume responses, Player readiness, exact label
assertions, real native input, durable answers, navigation and reload checks
continue to establish readiness. All eight cases, both interfaces and both widths
remain. Headed cases remain serial; no focus concurrency, retry, skipped assertion,
longer deadline or reference-image change is introduced.

A local sequential comparison uses the same current helper, production API and
visible Chromium, with separate owned SQLite workspaces and fresh contexts for
every case. The baseline overrides only initial navigation back to `networkidle`.
Both arms pass **32/32 cases**: **77.649 s** baseline and **57.871 s** candidate
(**19.778 s / 25.5%** shorter for this matrix). Owned browser/API resources close.
This one local pair is a phase observation, not a controlled whole-pipeline or
Linux speed claim. The complete published package-migration run continues before
this navigation change is published; new-head Linux qualification remains required.

The five related helper tests, syntax and diff checks pass. CI policy again
passes 227 cases, with its one explicit Linux-only GNU-timeout macOS skip. This
change affects the smoke runner only; the previously qualified application,
production build and 468.39 kB entry are unchanged.

## Shared authenticated browser-system packages (2026-10-23)

Parent `b74d789e` completes
[run 39972857422](https://github.com/jurei733/testcenter-rewrite/actions/runs/39972857422)
with **87 successful and two failed jobs**. All existing application, Source,
store, Docker and deployment gates pass, including the canonical Syscheck fix.
The first offline prototype and acceptance fail; the corrected round trips below
establish the prerequisite for migration without treating that parent as green
complete acceptance. Its useful jobs finish before the next publication.

The Linux round trips in [probe 39975668866](https://github.com/jurei733/testcenter-rewrite/actions/runs/39975668866)
and [probe 39976348906](https://github.com/jurei733/testcenter-rewrite/actions/runs/39976348906)
pass on independent Ubuntu 24.04 runners. The producer installs the locked
33 Chromium/tools requirements through normal authenticated APT and retains its
17 downloaded Debian packages (25,937,806 bytes). The fresh consumer reproduces
the exact dpkg and native font catalogs without a network interface; locked
Chromium starts and all seven existing headed capture controls pass. Measured
preparation is 30.902 s / 18.344 s; offline restore is 10.344 s / 7.700 s,
including 10.135 s / 7.444 s native installation. These are setup observations, not a complete pipeline speedup.

The first full-run consumer fails with APT status 100 before any installation.
The corrected version retains the producer's original cache filenames as well
as each artifact's SHA256 basename, rechecks copied bytes and isolates APT's
repository sources/lists. APT can then resolve only verified local files and the
installed base, without competing repository entries. A new synthetic native
APT control initially assumed every empty cache would reproduce the first
failure; Linux disproves that assumption with isolated lists. The final control
verifies local-only URI acquisition and successful staged-cache resolution
without installing its fixture package. The exact first-run repository-selection
cause is not claimed independently proven.

All CI browser consumers now download the same-run artifact and restore the
qualified system environment before installing only locked Chromium. They no
longer repeat archive-index updates or remote OS-package downloads. The existing
87 application/reference jobs and all commands remain; two required package
producer/qualification jobs bring full acceptance to 89 jobs. The producer runs
parallel to the shared application build and gates browser consumers, including
Quick. Fast feedback does not wait for the separate offline qualification or
long browser matrix. Full new-head Linux qualification and a controlled complete
speed/cost comparison remain required.

The package profile comes from this lockfile installation's exact Playwright
Ubuntu 24.04 x64 native-dependency module. APT retains authenticated indexes,
existing official archive preference, fatal update errors and transport bounds;
no base packages may be removed. The [APT command contracts](https://manpages.debian.org/bookworm/apt/apt-get.8.en.html)
define download-only, no-download and no-remove behavior. Artifact verification
binds commit, run/attempt, lockfile, module bytes, Node/architecture, exact hosted
image and the entire initial dpkg inventory. Declared regular files, bounded
sizes, per-file hashes and actual Debian package/version/architecture must agree.
Symlinks, extra files, duplicate identities/cache names and unrepresented package
changes remain fatal. There is no cross-run or malformed-artifact fallback.

A fresh private APT cache receives only reverified declared files under the
producer's exact original basenames. Empty private source/list directories,
`--no-download` and a new network namespace exclude competing payloads. Native
APT retains its Pre-Depends/configuration ordering. Final dpkg state and native
font-catalog hash must equal the native oracle. Absolute privileged commands,
nonprompting sudo and a noninteractive environment retain fatal native status
without exporting raw credential-bearing configuration. Referenced five-minute
supervision plus fifteen-second kill grace covers both restore and Chromium.
Consumer failures do not retry into a different environment.

Local policy passes 227 cases with one explicit GNU-timeout-only macOS skip;
Actionlint and diff checks pass. The four actual Debian/local-APT controls and the complete seven browser capture
controls pass the second corrected Linux probe, with no skips. That probe also
passes all 229 preceding Linux policy cases. The actual production composite
also passes [probe 39976776791](https://github.com/jurei733/testcenter-rewrite/actions/runs/39976776791):
all 228 current Linux policy cases, four native Debian/APT controls, verified
offline restore in 8.123 s and all seven headed capture controls. It performs
no browser-system repository downloads in the consumer. Complete 89-job
new-publication qualification remains required before complete CI acceptance.
The broad application build remains at its preceding qualified 468.39 kB under
the unchanged 470 kB budget: this change affects CI setup only.

## Native/canonical Systemcheck correction (2026-10-23)

The `347b0746` Linux run finds the same canonical Systemcheck identity regression
in all four store integrations and the compatibility gate. Native resolution now
requires a native upload/replacement audit marker. Existing corpus assertions
remain unchanged, and a mixed canonical/native case now runs in the early unit
gate. Locally, all 3,814 unit/frontend cases, 172 complete API integrations each
for Memory/File/SQLite and the complete 1,940-case PostgreSQL integration group
pass without failures/skips/cancellations. Fresh production stays at 468.39 kB;
the Systemcheck browser prefix through report saving and the complete native-file
browser matrix pass. Owned browser/API/PostgreSQL fixtures are stopped.

That Linux run also confirms all three Compose modes pass with the bounded
readiness-attempt fix. Other useful jobs continue before the next publication;
the run must not be described as green complete acceptance.


## Atomic release activation (2026-10-23)

Manual activation now commits the target status, every superseded active status
and its matching activity event in one Memory/File/SQLite/PostgreSQL write
boundary. PostgreSQL shares the existing workspace-row lock used by source-file
reference mutations; parents are locked before Runs. File storage marks all
changed release sidecars dirty, so reopening retains the same active release.
The application no longer performs separate status/audit saves.

A captured revision detects intervening release edits, session changes and new
or changed Run lifecycles. A conflict returns 409 without partial activation.
The revision deliberately excludes answer autosaves and timer progress: these
remain independently writable and their committed bytes survive activation.
Existing open-run refusal, explicit force, immutable runtime snapshots, legacy
null actors and recovery from multiple previously active releases remain.
All clone preparation happens before Memory mutates its collections.

Fresh local validation passes **121 + 323 + 1,305 + 2,006 = 3,755 unit/frontend
cases**, with zero failures/skips/cancellations. Owned PostgreSQL passes all
**13** activation cases, including two independently connected writers actually
queued on the workspace lock and a late activation-audit trigger failure.
The owned cluster is stopped afterwards. Four existing HTTP activation/
re-entry journeys pass separately in Memory, File and SQLite (**12** total).
The production entry stays at **468.39 kB** under the unchanged 470 kB limit.
All **187 portable CI controls** and Actionlint pass; the two real-Linux controls
remain explicit macOS skips and mandatory Linux checks. The unchanged
`smoke:ui:activation-blocking-runtime:built` completes its entire existing prefix
through `open-blocking-run-in-runtime` and shuts down its owned browser/API.
This targeted prefix is not the later full-UI journey; new-head Linux
qualification remains separate.

This is a prerequisite for workspace-wide automatic Source-file publication.
Loose-file imports still produce staged releases. Live workspace compilation,
stable Source test identities, current monitors/Systemchecks and full native
workspace pages still require their own implementation and qualification.
Formal parity remains **29 done / 20 partial**, with all eight broad visual rows
open; this transaction change closes no broad parity row.

## Linux route fix passes; two dependency installations still time out (2026-10-23)

Published `1cbea314` [run 39803228626](https://github.com/jurei733/testcenter-rewrite/actions/runs/39803228626)
finishes with **84 successful jobs and three failures**. The participant-console
job `119912947437` passes all **44 loading markers** plus its five selected-
context compatibility cases. All five Source reference families, the native
file view, **3,719 Linux unit/frontend cases**, **188/188 Linux policy controls**,
PostgreSQL and deployment checks pass. This qualifies the bounded route fix;
the complete workflow fails.

Original exit-completeness job `119912945508` and participant-entry job
`119912945814` both exit **124** during the unchanged five-minute browser
dependency installer, before application tests start. Both use the selected
HTTPS Ubuntu archive and effective zero download limits. Their logged font
transfers still take tens of seconds per package; no configured cap or definitive
cause is established. Final acceptance correctly rejects these unexecuted tests.
Actual job timestamps measure **35:06 full / 6:06 Fast feedback / 449.62 runner-
minutes**. These are failed-run observations, not a complete-pipeline speedup.

Repeated native dependency downloads remain the next pipeline bottleneck. Any
same-run dependency snapshot must preserve the exact runner base, locked
Playwright version, package bytes and provenance, and prove offline installation
plus the unchanged browser/Source gates before replacing consumer setup.

## Resolve a cancelled-route cleanup stall (2026-10-22)

The native file-view publication `25425aa3` passes its new required browser row,
the five Source reference families, unit and policy jobs in
[run 39797255399](https://github.com/jurei733/testcenter-rewrite/actions/runs/39797255399).
Its participant-console job `119891749999` fails the existing 60-second phase
watchdog while awaiting `unrouteAll({behavior:'wait'})` after the native terminal
case. This run cannot qualify complete acceptance; other useful jobs continue.

A caught fetch/JSON failure before `fulfill` returned from its callback without
settling Playwright's separate route-handling promise. The terminal handlers now
explicitly abort that route. Only an observed browser cancellation is expected;
unexpected fetch errors and abort failures remain fatal. An already handled
route does not hide the original error. The phase/total watchdogs, durable
answer/clock assertions, command receipts and complete CI prerequisites remain.

The existing browser job now also exercises real Chromium cancellation and an
unexpected injected pre-fulfill error. It verifies both route drain
and error retention under five-second bounds, using its existing browser/API.
An independent negative control removes only the abort: the callback returns,
but real Playwright cleanup still hangs and the control rejects at its deadline.
Restoring the abort passes both cases. This does not add a CI job, dependency
installation, retry, ignored assertion or longer timeout.

The unmodified local browser journey can pass, confirming that one replay alone
cannot diagnose this intermittent cleanup failure. The repaired journey passes
all **44 phase markers**, including its new control. The final replay after a
fresh clean TypeScript core build also passes all 44 markers and shuts down its
owned API. All **186 portable policy controls**, Actionlint and whitespace
checks pass; the two real-Linux controls remain explicit macOS skips. The new
head still requires its own Linux qualification. This is a reliability fix; no
whole-pipeline speedup is inferred from an early failed run or a local replay.


## Full Linux checkpoint at d4e592cf (2026-10-22)

Published `d4e592cf` [run 39790219381](https://github.com/jurei733/testcenter-rewrite/actions/runs/39790219381)
finishes **86/86 jobs successfully**, including complete acceptance, all five
Source families, PostgreSQL, Docker/Compose and deployment checks. Actual Linux
logs pass **188/188 policy controls** and **121 + 322 + 1,270 + 1,992 = 3,705
unit/frontend cases**, with no skips or cancellations. Canonical guided import
review and both previously stalled login rows now complete.

Across actual job timestamps, elapsed full time is **30:51**, Fast feedback
**6:11**, and summed runner consumption **420.43 minutes**. The previous green
`375ea6de` run is **28:35 / 4:14 / 408.8 minutes**; these different publications
are observations rather than a controlled benchmark. Overall acceleration is
still not established. The 39.4% paired label-phase result remains scoped.
Both inspected login jobs report prior HTTP/HTTPS download limits as **null**,
not 128. Their HTTPS package downloads reach about **4,112–6,756 kB/s**, but the
old 113–133 kB/s episode's cause remains unproven. Explicit zero/default settings
are configuration verification, not proof of a fixed configured throttle.

This qualifies the published parent, not the native file-view changes below.
The current-run PNG archives have not been independently downloaded/rehashed in
this checkpoint; the mandatory current Source jobs pass, and the earlier
independently verified pixel evidence remains separately identified.

## Native workspace file gate (2026-10-22)

The broad matrix gains `ui-original-workspace-files`; the historical acceptance
prerequisites and Quick distribution remain. Its owned real API/browser checks
use the production build and Original-19 schemas for all five loose file types,
three themes, both widths and actual RW/RO sessions. They assert real snapshot/
roster outcomes, exact UTF-16/empty downloads, overwritten history, selection,
partial deletion, logout during a held download, and missing lazy-code recovery
through an explicit user Reload. The derived focused shard runs independently.

All **3,719 local unit/frontend cases**, the four strict-XSD journeys, fourteen
native file-browser cases, protected APIs in all four stores, **186 portable CI
policy controls** and Actionlint pass locally. Two actual-Linux controls remain
explicit macOS skips. The 470 kB initial production budget remains: the new
native view's first 480.67 kB build is rejected, shared date formatting is removed
from the entry graph, and the final 468.39 kB build passes. A temporary disposable
bundle-inspection build is not counted as qualification. Full Linux evidence for
these new changes is still pending; do not cancel the useful parent run to
publish an unfinished successor. Native Source file pixel comparison and the
complete four-tab workspace still remain open.

## Canonical candidate regression and slow HTTPS download (2026-10-22)

Published `e77c4fe5` [run 39783730393](https://github.com/jurei733/testcenter-rewrite/actions/runs/39783730393)
ends with **17 successful, four failed and six skipped jobs**. All five Source
reference jobs, strict Linux typechecking, **188/188 policy controls** and the
complete **3,704 unit/frontend cases** pass. This is an early failed run: the
extended matrix is skipped and full acceptance correctly fails.

Proof-of-work exposes a real import regression. The shared resolver drops valid
canonical standalone Unit drafts merely because importing them without a Booklet
runtime marked their import rejected. Guided review then incorrectly loses its
two/three-candidate ambiguity. Current-file-only filtering is now explicitly
limited to Source loose-file operations. Canonical review retains its failed
but valid draft candidates; accepted replacement history remains excluded.
The actual protected API regression sequence checks two candidates, three
candidates, stale selection rejection, exact chosen Unit runtime bytes, and a
separate Source-mode compile excluding those rejected drafts in all four stores.
The unchanged complete `quick/proof-of-work` browser row passes locally after the
fix (103,908 ms), including its original ambiguity assertions.

The Original-login job never reaches application startup: the full dependency
installer exits **124 after 305,030 ms**. HTTPS archive preference is effective,
but index downloads take **60 s for 7,936 kB (133 kB/s)** and packages **3m49s for
25.9 MB (113 kB/s)**. Another completed Original-admin-login installer in this
same run takes **17,986 ms**. This variability neither proves a configured cap
nor a general speedup; selecting HTTPS alone does not establish reliability.

Browser setup now logs only the preexisting numeric HTTP/HTTPS `Dl-Limit`
values (or null when absent), never proxy configuration or URLs. It explicitly
sets and verifies both values to APT's documented default **0 / unlimited**,
while retaining transport inactivity/retry bounds and the complete five-minute
installer deadline. The [APT transport manual](https://manpages.debian.org/trixie/apt/apt-transport-http.1.en.html)
defines this setting in kB/s and explains that a nonzero cap also serializes
server downloads. Provider/network throughput limits are unaffected. No actual
runner cap has yet been observed. Owned shell controls exercise an explicit
128 kB/s fixture, denied writes, ineffective values and proxy-secret exclusion;
the real Linux APT control additionally checks merging and a later download-limit
override. Actual new-head installation speed still requires Linux evidence.

## Prefer the existing HTTPS archive after a measured package stall (2026-10-22)

The `3cb179b8` [run 39779073869](https://github.com/jurei733/testcenter-rewrite/actions/runs/39779073869)
ends with **18 successful, three failed and six skipped jobs**. The full unit
suite, all five Source reference jobs and seven early browser rows succeed.
Original-login never reaches its application test: the complete browser
installer exits **124 after 305,121 ms**, correctly bounded by GNU timeout.
Fast feedback and acceptance reject the failed prerequisite. The larger matrix
is skipped; its unexecuted cases cannot qualify. Elapsed time **12:22** and
**69.1 runner-minutes** therefore describe a failed early run, not a faster
complete 86-job qualification.

The retained log locates the delay in fetching about 25.9 MB of packages from
the Azure archive, including font acquisitions spread across several minutes.
Transport inactivity bounds do not guarantee a short whole installation, and
the new total deadline alone does not fix the mirror behavior. The pinned runner's
[mirror source](https://github.com/actions/runner-images/blob/ubuntu24/20261012.334/images/ubuntu/scripts/build/configure-apt-sources.sh)
already contains the HTTPS Ubuntu archive and security archive behind Azure.
Browser setup now promotes those same existing HTTPS archives to priorities
one/two, retaining Azure as priority three. No archive is added or removed;
source suites, signature verification, TLS verification and the complete
dependency installer remain. APT's
[documented priority order](https://manpages.debian.org/trixie/apt/apt-transport-mirror.1.en.html)
tries the lowest number first rather than merely trusting line order.

The transformation accepts only the known three-archive runner profile and
fails closed on changed hosts, credential-bearing URLs, duplicate/missing
archives, extra options or unrecognized priorities. It prepares a temporary
file before the root installation, then verifies the installed bytes. This
avoids reading through a pipe while tee truncates the same input file. Five
controls qualify transformation/idempotence and malformed profiles; a real
composite-shell control with owned shims preserves preparation status 37,
denied-install status 51 and verification failure, without root/system writes.
All **186 portable policy controls** pass locally; the two actual-Linux controls
remain explicit macOS skips. The previous head already passes both on Linux
(182/182, zero skips). Real mirror selection and overall speed require the next
head's complete Linux run; no test retry or deadline increase is introduced.

## Current Linux failures and qualified corrections (2026-10-22)

The full `b9713c2b` [run 39769124218](https://github.com/jurei733/testcenter-rewrite/actions/runs/39769124218)
finishes with **82 successful jobs, three failures and one cancellation**. The
aggregate correctly rejects the two failed tests and the cancelled prerequisite.
Measured from actual job starts/completions, full time is **48:02**, Fast feedback
**13:01**, and consumed runner time **545.1 minutes**. These results do not prove
an overall pipeline speedup. The earlier local 39.4% improvement applies only to
the 52-case label phase below. Console-loading now passes all 43 loading and five
compatibility cases on Linux, with both owned APIs shut down; this is
non-recurrence, not an established cause/fix of its preceding timeout.

Native routes pass their seven cases before native tabs fail after document
load at a global `networkidle` wait. The old evidence does not identify the
outstanding connection. The driver now waits for DOM content and all five actual
native command bindings. An independent owned browser fixture must reject a
missing binding and accept complete bindings while a real background request
remains pending. This follows Playwright's
[explicit readiness guidance](https://playwright.dev/docs/api/class-page#page-wait-for-load-state).
All existing Run/answer/clock, tab ownership, exact journal replay and ACK checks
remain. The fresh full focused shard passes seven route and twelve tab cases;
the latter includes two additional driver controls. Failure upload is limited to
one bounded public JSON containing fixed check labels, error class and own-origin
request method/path. No error payloads, bodies, headers, queries, foreign URLs,
screenshots or private SQLite scratch directory are uploaded by this new step.
Two privacy/bounds controls include planted credential/query/error secrets.

Original exit fails its final confirmed return after held Resume context: an
absent Unit answer becomes `''`. Cancellation already preserves the exact state.
The retained trace proves that a log-only save has drained before the foreground
fallback unconditionally writes the unchanged empty draft. The fallback now
compares the draft with the effective saved/ephemeral response; actual changes,
including intentional clearing, still save exact bytes. Original's unchanged
`setupUnitDataPartsBuffer` and `closeAllBuffers` implementations at the pinned
source confirm that closing an empty buffer sends no answer update. Four of nine
new actual-method controls fail before the fix; all nine then pass. The native
Resume case now explicitly waits for the real log-only ACK before confirming
return, retaining its exact absent-answer assertion. Fresh production qualification
passes **37 Original exit cases, the missing-bundle fallback and six Rewrite
cases**, with owned API shutdown. All **1,992 frontend cases** and strict local
typechecking pass. These results require fresh Linux qualification.

The cancelled runtime-error-contract job never starts its application test:
browser dependency installation spends about 19.5 minutes in APT mirror fetching
until the existing 20-minute job bound. Browser setup now installs and verifies
APT's 15-second HTTP/HTTPS connection/data-inactivity timeouts and one failed-file
retry before the full Playwright dependency installer. These are
[transport bounds](https://manpages.ubuntu.com/manpages/noble/man1/apt-transport-https.1.html),
not a global step deadline or test retries. The installer additionally runs under
GNU timeout: five minutes, TERM, then at most fifteen seconds until KILL. Its own
nonzero status remains unchanged; timeout is fatal. Repositories, TLS verification and
signature checks remain. A subprocess control executes the actual composite
script with owned non-root shims, verifies all effective settings, propagates
denied writes and ineffective configuration, and excludes a planted proxy secret.
It makes no claim to qualify real Linux package installation. All **180 portable
CI policy controls**, workflow actionlint and whitespace checks pass locally.
Two additional actual-Linux controls are explicitly skipped on macOS and required
on Linux: real APT file merging (including old-file and later-override negative
controls), and the real GNU timeout wrapper preserving status 37 and bounding an
owned stuck installer. They change no system configuration or package state.
No application assertion, scenario or required prerequisite is removed or relaxed.

The first published setup implementation at `ddced4f8` fails its effective-value
check before browser installation. [Run 39777718361](https://github.com/jurei733/testcenter-rewrite/actions/runs/39777718361)
finishes with **six successful, fifteen failed and six skipped jobs**. Thirteen
browser jobs fail in this common setup; Fast feedback and acceptance correctly
reject their prerequisites. The production/Source builds, dependency audit,
Docker runtime and full **3,694 unit/frontend cases** succeed. No browser test
passes through the failed setup and this is not complete qualification.

The actual runner image is `ubuntu-24.04` version `20261012.334.1`. Its pinned
[configure-apt.sh](https://github.com/actions/runner-images/blob/ubuntu24/20261012.334/images/ubuntu/scripts/build/configure-apt.sh)
installs `zz-retries` with 15-second/one-retry bounds. The initial
`80-testcenter-ci-network` file therefore cannot apply the proposed 20-second/
two-retry values. The corrected file sorts after that runner file and retains
the stricter 15-second/one-retry profile. This does not itself establish a new
transport speed gain over that image; the independent whole-installer deadline
bounds a stall that transport settings alone cannot bound. The two real Linux
controls and actual package installation still need the next head's qualification.

At `627b5466`, the real Linux APT merge control passes, including both negative
cases. The GNU-timeout control stops its owned TERM-resistant child in 422 ms,
but its assertion initially expects a numeric shell status only. Bash can exec
its final command, so Node instead reports `status: null, signal: SIGKILL` when
the timeout group is killed. The follow-up accepts exactly that native fatal
signal or numeric 124/137 and still rejects spawn errors, success and all other
statuses/signals. This corrects the control's process-result interpretation;
it does not weaken the real installer bound or qualify that failed matrix.

## Run selected CI checks locally

From `rewrite-app`, `npm run ci:focus -- --list` lists the actual Quick,
extended-qualification and memory/SQLite workflow shards, plus `policy`,
`typecheck`, `unit`, `participant-auth`, `original-results` and
`system-check-reports`. Select one or several, for example:

```sh
npm run ci:focus -- --plan ui-participant-console original-login
npm run ci:focus -- ui-participant-console original-login
npm run ci:focus -- policy typecheck
npm run ci:focus -- participant-auth
npm run ci:focus -- unit
npm run ci:focus -- original-results
```

The runner reads `.github/workflows/rewrite-app-ci.yml` on each invocation and
keeps every command in the selected shard, including the second console
compatibility check and the third front-camera attachment check. It performs
one core build when only the explicitly listed unit/service suites are selected, or
one fresh production build for other build-dependent selections; policy and
no-emit type checking need none. There is no stale-build bypass. A failing build
or test stops the sequence and preserves its status. Per-command elapsed times
are printed for actual local measurements. No arbitrary shell input is accepted;
the runner executes existing npm scripts with separate arguments. Headed Quick
checks use `xvfb-run` on Linux. Install the normal locked dependencies, Chromium
and its host libraries first, as for existing standalone smoke scripts.

This is a focused local check, explicitly marked `completeAcceptance: false`.
It does not replace PostgreSQL, Docker/Compose, unchanged-Original references,
the remaining workflow shards or the full CI acceptance gate. Local platform and
fixture environment still matter. Listing/planning launches no build or test
and does not export inherited environment values. Twelve controls cover complete
workflow enumeration, command ordering, one-build reuse, failure propagation,
unknown selections, shell injection, secret-free planning and the exact failure
status from an actual npm-child subprocess. A real focused invocation freshly
builds production and passes all 43 loading and five context-compatibility cases,
with both owned APIs shut down.

The first full control run exposed a native `kill EPERM` during supervised
cleanup; its underlying host cause is not established by a later passing run.
Cleanup now attempts every remaining owned descendant/group even after a denied
signal, records only PID/signal/error-code evidence and still fails. Two added
controls verify denied-signal continuation and rejection of system/malformed
PIDs. All 175 CI policy controls subsequently pass. This does not resolve the
separate Linux console-operation timeout from run `39762727435`.

Diagnostic persistence now keeps one active atomic write and one pending latest
snapshot. Previously, every IPC phase/observation queued another fully serialized
copy behind the previous write; bounded record arrays did not bound that backlog.
A slow-writer control sends 20,000 updates while the first write is held and
requires just the first and latest snapshot, with no 20,000-copy serialization
queue. Write errors still reject their callers; a later cleanup write can retain
final evidence. Neither diagnostic observations nor coalesced writes renew a
phase or total deadline, and no assertion or scenario is removed.

All jobs now request `ubuntu-24.04`, matching the previously qualified baseline,
and the locked Chromium cache key includes that OS version. This prevents an
implicit OS-major change or cross-version browser-cache reuse during GitHub's
[October 19–November 19 migration of `ubuntu-latest` to Ubuntu 26.04](https://github.blog/changelog/2026-09-17-ubuntu-26-generally-available-and-latest-migration/).
The hosted image still receives GitHub's regular 24.04 image updates. Moving to
26.04 requires an explicit pipeline change and fresh qualification. The existing
console timeout is not attributed to an OS change without evidence.

The historical workflow-reported green run is
[`39187723764`](https://github.com/jurei733/testcenter-rewrite/actions/runs/39187723764)
at `d39d8d46`, measured from its 38 actual jobs: **42.9 minutes** from first job
start to final completion and **302.2 runner-minutes**. The Ops chain alone took
2,336 seconds; PostgreSQL UI took 1,177 seconds. These are observed baseline
times, not measurements of the new workflow. Its Quick log at job
`117853584730` also contains the masked HTTP login failure described below.
The 38 green job conclusions therefore do not establish complete acceptance.

The apparent green fast checkpoints at `3e93fcee` (251 seconds) and `7373b68a`
(269 seconds) are **invalid qualification measurements**. Inspection of the
actual Quick log found a failed Original HTTP login hidden by `tee`: GitHub's
implicit `bash -e` shell returned the logger's success. The follow-up explicitly
uses `shell: bash`, enabling `-e -o pipefail`. A subprocess regression reproduces
the old false green and requires the exact failing upstream status, 37, to
survive logging. The older workflow's explicit pipefail *inner* bash was also
insufficient because the *outer* `tee` pipeline still used implicit `bash -e`.
Neither earlier run establishes full release acceptance.

## Delete-dialog and cancellation qualification

The directory comparison now retains all previous 120 views and adds four
password/delete states per table/theme/width: **168 pairs plus 168 independent
Source repeats**. Six password characters must leave confirmation disabled;
seven must enable it, matching the pinned Source form. A valid cancellation must
send no candidate write, add no Source write and preserve both owned records.
Request evidence records only methods/paths, without bodies or authorization.

The first focused probe finds three workspace-delete differences while Source
reproduces all 28 views exactly: 4,963 pixels empty/invalid and 4,783 valid. The
product now uses Source's actual question and plural action label. An unused
Angular template variable is also removed; production build and no-emit typecheck
pass. All 1,966 frontend cases, 159 CI policy cases and the full protected native
administration/settings flow pass, including exact question/action copy, the
six/seven-character boundary, valid cancellation, wrong-password retention and
confirmed deletion cascades.

The first full comparison correctly aborts at the old adult/mobile user
re-selection state after 140 exact pairs/repeats: twelve Source image hashes
alternate between two values. Failure diagnostics now retain first/last actual
sampled PNGs, hashes, geometry and focus/animation metadata without promoting a
baseline. All six real headed controls pass, including an alternating canvas
that still fails at exactly twelve samples with matching diagnostic image hashes.
The fresh full production comparison passes **168 pairs / 168 Source repeats**,
with **504 independently checked native records**, 24 Source fixture writes and
exactly twelve confirmed candidate UI writes. No cancellation dispatches a write.
The initial Source instability is not structurally proved fixed and remains
fatal on recurrence. A fresh Linux head is still required for this expansion.

Published `405915b5` already passes its preceding **120 exact pairs/repeats** on
Linux, job `119289360211` in [run 39619514441](https://github.com/jurei733/testcenter-rewrite/actions/runs/39619514441).
Directory ZIP `12353948715` has SHA256
`b86bcc69e95bc7a5a77e56e4ebba99671d9325f929aa9544de41c01b3df91e0c`;
all 360 actual clear/visible PNG proofs independently verify. Its actual Source
producer is `37679a57eef6775d3943deb0ee90e1948c47604a`; six headed paint controls pass.
That run's typecheck job `119288890923` proves all 159 policy cases and all four
actual compiler controls on Linux, then successfully builds development output
at `dist/typecheck-development`. The full matrix has completed with **83 successful
jobs and three failures**: the Original sample in the run-detail prefix, the
missing-bundle Player-exit fallback, and the aggregate that correctly rejects
those failed prerequisites.

The preceding `375ea6de` run is fully green, **86/86**, at **28:35 full / 4:14 Fast
feedback / 408.8 runner-minutes**. Different runner conditions and expanded
coverage prevent attributing these timings solely to workflow ordering.

In the current 405915b5 matrix, run-detail job `119291243308` fails before its
specific review tail, in the shared `participant-original-sample-package` prefix.
The helper reports a matching Player notification, but the subsequent real API
predicate times out with `required-text-field` empty. The original sample's run
has exactly two successful save-progress POSTs (both HTTP 200, at 14:55:29.627Z
and 14:55:35.736Z); final state revision is 3. There is no demonstrated transport
failure or server 5xx. The current log does not retain those request/ACK bodies or
the real sample's native input/Start-command sequence, so it cannot distinguish
Player startup/reset, message correlation, capture and save-order causes.
The existing helper retries up to three times and matches any serialized unit
state containing the text; it does not check message source/session. No new retry,
timeout increase or product workaround has been added. The failure remains fatal
and needs correlated original-sample input/message/save/ACK evidence. This failed
full matrix cannot be treated as green merely because directory/typecheck pass.

Read-only diagnostics now record bounded native input events, actual frame and
document identity, Start/state notifications, narrowly projected save bodies,
delivery-correlated ACKs and response field clocks. Headers, query strings,
configuration, definitions and unrelated payload fields are excluded. Failure
artifacts retain only the sample JSON and iframe PNG for seven days. A real
headed control proves trusted input and current/imposter-frame discrimination
and verifies that eight planted transport/configuration secrets stay excluded.
It runs serially with the six existing headed paint controls to prevent shared
display interference. All seven controls pass; the complete common smoke prefix
also passes locally through sample save/resume and all eight navigation cases.
That successful local observation does not explain the earlier Linux failure.

The other failing Linux job, `119291242708`, passes all 36 Original exit cases,
then times out closing the missing-lazy-bundle fallback after Stay. Its previous
failure reporter still pointed to the preceding case. Each case now owns its
actual page/context, trace and network buffer, including fallback and Rewrite
cases. The click, assertion and deadlines remain unchanged. An isolated fallback
passes locally. The fresh full sequence also passes all 36 Original cases, the
missing-bundle fallback and six Rewrite cases with owned API shutdown. A fresh
Linux head still needs qualification; non-recurrence is not a structural fix.

A subsequent full local exit probe stops earlier at the exact saved-answer check
for `Sekundar-mobile-header-confirm`. The actual fill call requests two final
spaces, while the actual Player/save packet and HTTP 200 ACK contain one. SQLite
preserves exactly the received bytes. Four Player answer notifications precede
that write; the old failure packet retained only their count. New failure data
preserve actual native input types/values and Player values so the next failure
can distinguish input production from host/server capture. Exact whitespace
matching, trusted-input assertions and held-ACK/successor coverage are retained.
The fresh passing sequence records three trusted input events per multiline
fill in 35 cases and five in the deliberate held-ACK successor case, with exact
Player packet correspondence. The old fourth event cannot be attributed without
its missing native input data. Neither failure is claimed fixed through
diagnostic changes or a later pass.

## Console timeout observations without deadline renewal

Published `8e90c48e` run `39762727435` fails console-loading job `119776478694`
after its remote terminal/resume independence case passes. The independent
supervisor correctly records a phase timeout exactly 60 seconds after that
marker and terminates only its owned process tree. Artifact `12420036166` has
SHA256 `ebd6bbe2bf308b03d43c42ed9b48f12c9ae212bbfe05739a5bb230b84fbff633`.
It identifies the last completed case but cannot distinguish its final route
cleanup from the next native Resume, Player readiness or subsequent operation.
The failure remains fatal and its underlying cause is unproven.

The supervisor now records bounded operation observations separately from phase
progress. They never reset either the 60-second phase or eight-minute absolute
deadline. A real child subprocess emits repeated observations while stuck;
it still fails the original phase deadline with ordered diagnostic evidence.
All six supervisor controls and 161 CI policy cases pass. The complete local
production console-loading journey passes all 43 cases with the operation
markers and owned API shutdown. This successful observation is not a structural
fix for the earlier Linux timeout. No scenario retry, assertion removal,
held-route relaxation or deadline increase is introduced.

## Retain a real logo action during Resume context loading

Published `809d9b47` run `39759195568` reveals another common-prefix failure in
job `119762177912`: after resuming the same Starter card, clicking the logo
never opens the expected confirmation. The actual Original document and HTTP
evidence retain the resumed running Unit, with only the preceding
return-to-starter POST. The other controller's repeated 401 polling is expected
after credential rotation; it is not evidence that the actual Original page lost
its authorization.

A real protected SQLite/Chromium probe deterministically holds the resumed
current-state response. The UI already detaches the Starter and shows `running`
from its authorized console Run. Its logo handler accepts focus through that
projection, but the old exit method silently returns because its full Unit state
is still null. Releasing the actual response does not restore the lost click.
The probe fails before the change and passes against the new production build.

The exit method now reads the exact authorized Unit context for that projected
Run before planning confirmation. Session, Run, Unit, status and view-lifecycle
checks reject a replaced context; existing completeness/timer/leave-lock policy
and all later confirmation/action guards remain. Eleven actual-method controls
cover retained intent, stale replacements, invalid/completed projections,
missing context and propagated transport failure. All **1,983 frontend cases**,
strict no-emit typecheck and production build pass.

A permanent additional native exit case holds the real context response,
activates the actual logo, proves no early return write, then releases the
response. Cancel must preserve the exact running Run/responses; a later explicit
confirmation must return that same Run once. It supplements all 36 Original, six
Rewrite and missing-bundle cases. The full production native journey passes all
37 Original cases, six Rewrite cases and missing-bundle recovery, with owned API
shutdown. Fresh Linux qualification remains required. This does not claim to
explain either preceding `405915b5` sample-save or fallback-Stay failure. The
full headed Original entry prefix also passes the actual resumed-logo, Starter,
guarded logout and reentry sequence through `participant-entry-sign-in`,
followed by owned API shutdown.

The same `809d9b47` matrix also fails PostgreSQL UI job `119762177590` in the
existing serial label corpus: a visible/enabled/stable radio control times out
inside native scrolling before input. The prior main-page screenshot does not
show that independent context. It is not a demonstrated database failure or a
consequence of the subsequent, unpublished concurrency change. Case-specific
failure labels now identify the actual isolated journey. This remains fatal.

## Bounded parallel native label journeys

The full green `375ea6de` UI log identifies two long sequential phases: 132
seconds for Original test-controller cases and 127 seconds for current Unit
labels/configuration. The latter contains 32 synthetic independent label
journeys and 20 exact-current Original BookletConfig journeys. The main smoke
now permits at most two of these isolated cases concurrently in headless mode;
visible-browser runs remain serial. Every synthetic tuple has its own roster
login. Current Original cases share the exact Source roster across UI/width
variants, so those four groups remain serial; only different participant
accounts inside one group can overlap.

All existing real sign-in, Player input, persisted answer/types/clocks,
forward/backward navigation, reload restoration, label/metadata, credential
separation and browser-error checks remain. A failed worker stops new dispatch,
awaits its active peer's cleanup and preserves every in-flight failure. Six
controls cover exact-once/maximum-two execution, serial ordering, early failure,
peer cleanup before rejection, aggregate failures and invalid/empty inputs. No
whole scenario is retried or omitted.

One paired local protected SQLite/Chromium probe executes all **52 cases in each
mode**. Serial phases take **73.062 + 49.883 = 122.945 seconds**; bounded phases
use **41.193 + 33.316 = 74.509 seconds**, about **39.4% lower**. Both modes
retain the unchanged current Original fixtures and every actual response
assertion, and the owned API shuts down cleanly. This single
serial-then-parallel pair is sensitive to host/cache conditions and does not
prove full Linux wall time. All **1,983 frontend cases** and **160 CI policy
cases** pass. The complete common run-detail journey also passes locally through
its actual review tail, exact sample save/resume and both label corpora, with
owned API shutdown. A fresh complete Linux head is still required.

The preceding published `809d9b47` directory scope passes on Linux in job
`119759396101` of [run
39759195568](https://github.com/jurei733/testcenter-rewrite/actions/runs/39759195568):
**168 exact pairs / 168 independent Source repeats**. Its artifact `12418125499`
has SHA256 `0a75227edd7ab48ee120642292229bac59d36703957a5d70d34740a28b521b13`;
all **504 actual native image proofs** independently verify. The actual same-run
Source producer is `dc8771cde2c19f0447689669231c4c8463476b8b`. This bounded
reference success does not establish complete matrix acceptance or qualify the
subsequent parallel scheduling change.

The same 52 bounded-parallel native cases also pass against a fresh, owned,
socket-only PostgreSQL database with real protected sign-in and exact saved
response/restoration assertions. Both owned clusters are stopped afterwards.
This is separate from the older Linux serial-radio scroll failure; it does not
waive that failure or establish its cause.

## Non-emitting local type checks and isolated CI development output

`npm run typecheck` now runs the unchanged core project type check plus the real
Angular compiler with `--noEmit` and the app's existing strict TypeScript,
template and dependency-injection settings. It does not replace the production
web files. `npm run typecheck:ci` retains the complete earlier development build,
with identical inputs/options apart from `--output-path dist/typecheck-development`.
The required production build, style/bundle checks, all test groups and aggregate
dependencies remain. The immutable historical coverage baseline is preserved;
its policy accepts only this exact development-output relocation.

Four actual compiler subprocess controls accept a valid component, reject
TypeScript, template and injection errors with nonzero exit, and prove that
existing output survives without new emitted files. All **159 CI policy cases**
pass. The real app passes both commands; a paired local measurement observes
**13.473 seconds** for the no-emit path and **16.986 seconds** for the isolated full
development build. All **184 production files remain byte-identical after each**.
This single local comparison depends on cache/host conditions and does not
establish a Linux CI latency improvement. CI intentionally retains the full
existing build qualification, adding the compiler fault controls.

## Confirmed directory mutation qualification

The next directory comparison retains all 84 previous views and adds confirmed
role/name changes, retained-row edits and owner re-selection: **120 exact pairs
plus 120 independent Source repeats**. Only two narrowly validated Source PATCH
fixtures are writable; candidate actions use the real protected API. Every
candidate journey restores its owned starting name/platform role. An unrelated
dirty workspace permission must remain unsaved after the confirmed action.

A first actual Source probe found 4,854 desktop role and 2,982 rename pixels
changed in the candidate; all Source repeats were exact. The product now retains
the prior visible permission rows without a save owner, clears them on session
replacement/destruction and restores saved rights on re-selection. Temporary
Source Toast/Material notifications replace the permanent success paragraph.
The first complete local comparison isolated three 670-pixel mobile re-selection
differences. Direct geometry proves the reused candidate cell had `scrollLeft=24`
where Source had `0`. A permission-view generation now recreates rows on owner
selection and retains them during checkbox edits/selection clearing. All three
mobile re-selections now measure zero internal scroll in both builds.

Final production validation passes **120 exact pairs / 120 independent repeats**;
all **360 actual native PNG proofs** independently verify. The 24 Source fixture
writes are narrowly checked and their bodies/secrets are excluded from evidence.
All **34 controller, 1,966 frontend and 154 CI policy cases** pass, as do typecheck,
production build, Source byte verification and Actionlint. The complete protected
native administration/settings journey also passes, including retained-row edits,
actual role/name acknowledgements, wrong-password preservation, all 102 text
fields, eight image slots, reset/session gates and logout. Re-selection explicitly
waits for the retained DOM node to detach and the new saved checked state; the
initial immediate assertion correctly exposed that fresh view's asynchronous
rendering. No fixed delay or automatic scenario retry is added. A fresh Linux head
remains required; `375ea6de` qualifies the preceding 84-state dialog change.

At that checkpoint, the old `npm run typecheck` also wrote a development web
build. An accidentally overlapping local capture was explicitly terminated and
excluded. The final production comparison ran only after typecheck and production
build completed. The later no-emit local type check and isolated CI output above
remove that output collision; explicit production builds still precede consumers.

## Current directory/dialog checkpoint

Published `2dc47c98` completes [run 39608434842](https://github.com/jurei733/testcenter-rewrite/actions/runs/39608434842)
with **all 86 jobs successful**, including the directory reference, held-answer
exit, timer and all three Compose modes. Measured job timestamps give **29:13
full acceptance, 4:53 Fast feedback and 418.25 runner-minutes**. The earlier green
85-job baseline was 37:40 / 3:38 / 411.0 runner-minutes: full wall time is 8:27
shorter with broader coverage, while early feedback and compute did not improve.
Shared-runner conditions differ; the complete change cannot be attributed solely
to ordering. The unchanged timer fixture's prior socket reset does not recur;
no transport failure was ignored or retried.

The next UI change extends directory qualification from 36 to 84 views per build
and independent Source repeat. Source-derived fixes restore empty rename fields,
three-character workspace-name validation, native field sizing/paragraphs,
set/revoke confirmation titles and omitted empty content. Re-selecting a dirty
selected row no longer resets rights. Source initial/invalid/valid dialog states
and this repeated-selection behavior all pass locally at zero RGBA differences.
Sixteen complete Source files now pin these additional contracts. No previous
baseline scene or required job is removed; the matrix remains 86 jobs.

This local expansion requires fresh full CI. Existing successful 2dc results do
not prove the new UI head or cover submitted mutations, transient notices or
Source's retained right-table rows after clearing selection. Formal 29 done /
20 partial and all eight broad visual rows remain unchanged.

## Directory family and bounded Compose JSON polling

A fifth Source family adds 36 directory viewports and 36 independent repeats,
retaining the previous 19 Source tasks and every required aggregate. Eight pinned
DAO/service/component/template/CSS files establish the read-only DTO and rendering
contracts. Both directory and settings jobs require the six native capture fault
controls. Full job count is now 86. Local raw directory captures pass all 36 pairs
and repeats, with 108 independently checked native clear/style/steady-frame proofs;
actual Linux qualification remains required. Mutation/dialog/notice/stale-row and
full Original backend authorization scope stays open.

At `3cc27b63`, run `39603287361`, the supervised console job `119235173455`
passes all 43 loading and five compatibility cases on Linux. The previous
one-hour stall does not recur. This does not make the whole run green: Compose
Demo job `119235172733` exits with Node code 13 at its first readiness poll, and
timer job `119235173471` fails in scenario before cleanup with a `route.fetch`
socket hang-up. The failed timer POST does not appear in its retained API log;
no timer packet/receipt was captured. Another Player-exit case times out at its
held-ack browser predicate. None of these errors is ignored or retried here.

The Compose polling loop's wall-clock condition did not bound its individual
HTTP request or body parse. Its new helper keeps a referenced absolute 40-second
deadline through request, response headers and JSON completion; timeout aborts
that request and fails with its phase. It cancels the timer after success and
still retries temporary non-ready responses within the same existing overall
limit. Phase logs contain only path, attempt, phase and status, without headers
or response content. Readiness/config/schema assertions remain unchanged.

Real subprocess controls reproduce Node exit 13 with a handle-free stuck request
or JSON promise, and require the bounded helper to reach normal failure and
finally cleanup. Owned HTTP controls hold actual headers or partial JSON, verify
abort, and return success only after real 503/503/200 readiness. A successful
subprocess must exit without waiting for its old 60-second timer. These prove
local liveness and error propagation; the precise cause of the observed Compose
hang and the complete Docker result still require Linux evidence. Docker is
unavailable in this local environment.

### Held-answer route lifetime

The Player-exit failure at `119235172984` has retained trace ZIP SHA256
`a89090a3b9a11d1c4bc36904e3063a5b8ec61af653918b5378ca93f432a85d92`.
Its held-ACK scenario removes network interception at monotonic time 22,286.719;
the successor save starts at 22,288.751 and never receives a response. The first
ACK has already succeeded. This pinpoints premature fixture retirement during
Chromium's transition to ordinary dispatch; it does not establish a domain save
failure or justify weakening the immutable answer/clock assertions.

The fixture now keeps its route installed until every actual trusted input has
its corresponding Player packet and the real save drainer reports saved after
all acknowledgements. It then retires the route and freezes the exact last
acknowledged bytes. An additional assertion requires both held and successor
packets to traverse the still-installed route and exactly match the actual
acknowledgements. Native input/log correlation, differing-clock control,
byte-for-byte saved-state comparisons, all exit variants and failure propagation
remain unchanged. No replay, timeout increase or product behavior change is used.
Failure snapshots now retain save status and native packet count as well.

## Bounded loading qualification and observed queue timing

[Run 39567637347](https://github.com/jurei733/testcenter-rewrite/actions/runs/39567637347)
at `92433154` confirms the four longest extended checks actually start together
immediately after Fast feedback. The 20-check extended queue finishes in
**24:11**, compared with **33:51** in the preceding green run: an observed 9:40
reduction. Shared-runner conditions differ, so this is not isolated proof that
ordering alone caused the entire improvement. Fast feedback is 4:21 in this run.

The complete run is **not green**: 83 jobs succeed, loading/compatibility job
`119115511589` is cancelled after its 60-minute deadline and final acceptance
correctly fails. Its only scenario output is the artifact directory; it never
reports the first loading case. No retained failure images are available because
the old upload condition excludes cancellation. The 83 successful jobs finish
by 32:12 from the first start; that is not a complete-acceptance time.

The loading leaf now runs under an independent Node supervisor. Main-flow phase
messages record startup, content, browser launch, initial LOADING/Resume/held-view
steps, completed cases and final cleanup. A phase without progress fails after
60 seconds; an absolute eight-minute bound remains even if phase messages keep
arriving. The child exit status remains authoritative: normal failure status
37 is preserved, and any watchdog expiry returns failure. No retry or successful
fallback is introduced and no existing behavioral assertion is removed.

Before timeout termination, the parent atomically writes `supervision.json`
containing only owned entry/phase/process metadata. It snapshots descendants of
its own child, including detached Chromium-style children, sends TERM, and uses
PID plus process start time for forceful escalation. Independent-process tests
prove a blocked child event loop cannot stop evidence, phase and total limits
are fatal, detached children are stopped and an unrelated sentinel survives.
Environment, request bodies, credentials and scratch SQLite stores are excluded.
The existing narrowly scoped seven-day JSON/PNG upload also runs on cancellation.

The unmodified loading suite and the supervised loading suite both pass locally;
the supervised suite retains all cases and exits normally in 106 seconds.
This establishes the watchdog's local behavior, not the cause or resolution of
the intermittent Linux stall. A new Linux run must provide that evidence.

### Later Original-entry failure and directory selection alignment

[Run 39597348420](https://github.com/jurei733/testcenter-rewrite/actions/runs/39597348420)
at `e353d2be` ends with 17 successful jobs, three failures and six skipped groups.
All four Source reference families pass. The early proof-of-work browser fails
at the Original sign-in branch's first logo-return confirmation, which prevents
Fast feedback and therefore the later matrix from qualifying. The supervised
loading leaf never runs in this attempt; its real Linux behavior remains unproven.
The retained ZIP SHA256 is
`cf3cf5ebcbc5f3074731fff21b0c08cf40b3f2aaeec328d040e9e41659e1b13c`.
Its only screenshot is the older main browser page, whose access was rotated by
the second actual login. Those 401 responses do not establish why the separate
Original page failed to show its dialog. The full proof-of-work command passes
locally, including all admin/participant/second-code challenges and the same
Original entry/return/logout/reentry branch. No product workaround or readiness
assumption is justified by this intermittent observation.

The branch now retains an additional failure screenshot and bounded DOM/HTTP
status evidence from the **actual Original page before its context closes**,
with a main-flow phase label. It rethrows the original failure; no retries,
authentication injection, skipped assertions or alternate successful path are
introduced. Headers, response bodies and browser credential storage are excluded.
Public API snapshots can be cached; live-job observations now use a fresh query
and a no-cache request header before treating a stale queued response as a wait.

The pinned administration fixture also captures the actual mutation and directory
reload methods from both Source files. Same-run Source verification requires
those excerpts and the unchanged full-file SHA256. Source clears its selection
after acknowledged workspace rename and Superadmin-status changes; Rewrite now
also clears selection and pending permission drafts at those successful write
boundaries. Rejection preserves them, and an old-session acknowledgement cannot
clear a replacement session's selection. Name order and real tenant/UUID targets
remain intact. Native tests prove wrong-password recovery, disabled actions after
success, re-selection and unchanged durable rights for the discarded drafts.

Current local validation passes 29 administration-controller cases, 1,961 frontend
cases, 140 CI policy cases, complete typecheck, production build and the full native
administration/settings flow. The Source checkout remains unchanged. This is not
whole-directory visual parity: Source can retain its prior right-table rows after
clearing selection, while Rewrite's table currently derives from its selected
owner. That transient display, directory/dialog/notice pixels and broader backend
authorization still need their own paired references. No broad parity row closes.

## Measured long-journey scheduling

[Run 39562001420](https://github.com/jurei733/testcenter-rewrite/actions/runs/39562001420)
at `8935ff5e` finishes **all 85 jobs successfully**, including final acceptance.
Actual job timestamps measure **3:38 to Fast feedback, 37:40 to full completion,
and 411.0 runner-minutes**. This establishes the split-console workflow's green
baseline; it is slower overall than the earlier 33:40 / 399.3 runner-minute run
at `36113122`, with five additional jobs and stronger capture/exit coverage.

The longest extended scenarios started near the end: activation/roster warnings
846 seconds, JSON roster 716, exit completeness 616, and Verona Player 428.
The 20 extended rows now start in descending measured-duration order. The eight
early scenarios, all leaf commands, four-slot limit, separate native browser
runners and complete acceptance dependencies remain unchanged. Recorded per-job
seconds and the old ordering live in `scripts/fixtures/ci-browser-timings.json`.

A four-slot queue simulation over those same measured durations falls from
1,638 to 1,311 seconds, **5:27 (20%) of that isolated queue**. This is a scheduling
estimate, not measured CI acceleration: GitHub's shared runner availability,
setup and unrelated jobs can change the actual dispatch order and critical path.
A completed run of the new head is required to measure its real effect. No extra
runner concurrency or reduced scope is used to obtain the estimate.

## Independent console qualification jobs

The former `ui-participant-console` job serialized eight independent browser
commands. They now run in five isolated jobs: Source/runtime timer, Debug,
console loading/context compatibility, command completion, and native route/tabs.
The timer reference still precedes its runtime check. Each job restores the same
verified production build and runs at most two commands; no browsers compete for
native focus within the same runner. A policy test reconciles all eight prior
leaf commands exactly once across these shards. All remain required through the
existing matrix aggregate and final acceptance; no check is replaced by Fast
feedback. The 28 fast/extended scenarios and their four-slot extended limit stay
unchanged. This increases the full matrix from 81 to 85 jobs and adds setup cost;
the completed 85-job baseline and its timing are recorded above.

Timer failure evidence moves to its actual timer job. The isolated Debug job
retains only its JSON/PNG evidence for seven days, with SQLite scratch stores
outside the uploaded directory. The console loading upload stays scoped to its
own job. Failure isolation also allows the other checks to execute after an
earlier console check fails, instead of losing the remaining serial coverage.

## Settings renderer and immutable exit baseline

### Fresh native paint before every settings comparison

The Linux diagnostic at `94a7bb25`, job `119087970080`, preserves the failing
baseline while proving that the restored Primar/1280 General-bottom rendering
is exact across Source, Rewrite and an independent Source document. All three
complete RGBA hashes are
`be48eb5d24ed75c1573ee6c92599c803913e99fcc5686dbafe6feeac4f765bcd`.
The Source baseline itself changes two pixels after its witnessed full redraw;
Rewrite changes six. The background A/B/A test is not reversible and does not
justify changing product CSS. The artifact ZIP digest is
`878f9e63dd0dd6f304af26f5cc5f5972451dd3983e9320b43c3686b5c5fa48d0`.
This proves the fresh rendering for that view, not the remaining 23 views.

The same reference-independent native repaint now precedes every settings
baseline in both builds and the Source-repeat series. It records the original
geometry and exact root style attribute, witnesses a fully cleared opaque white
viewport, restores the root attribute, verifies unchanged geometry, and then
requires three equal complete visible PNGs. Each cleared frame and its SHA256
are retained separately. The hidden frame is never returned as a baseline.
Neither the repaint nor steady-frame sampling receives an expected image;
the final comparison still checks every RGBA channel with zero tolerance.
Diagnostic A/B/A sampling remains separately labelled and cannot replace a
baseline verdict. Original source files and the production application are
unchanged.

All 24 local Source/Rewrite comparisons and all 24 independent Source repeats
pass. All 72 capture records prove the fully cleared native frame, restored
root attribute and three steady visible frames, with hashes checked against
the retained PNGs. Six mandatory headed controls retain paint-change and
never-steady rejection, restore styles after failure, reject geometry changes
even during the hidden frame, and preserve a genuinely changed pixel as an
exact one-pixel difference after the actual baseline capture method. Fresh
Linux run `39562001420` also passes all 24 views and 24 repeats, all six
controls and all 72 capture proofs (artifact `12328985234`, SHA256
`3fd0715c08e9a42c88bc5ba93b191d6bc5845a49d2ed429bf98e182cacbc6c9f`).
No broad full-page parity row is closed by this bounded settings result.

### Observe all native Player inputs before freezing exit state

The actual `97a534a0` Linux exit failure in job `119076685007` compares a
first acknowledged packet with field clocks ending in 541 against a later
stored packet ending in 545. Its retained trace has two successful POSTs and
three distinct Player-log entries, with the same authored answer. This alone
cannot distinguish multiple native input events from duplicate processing.

The exit gate now observes actual trusted input events inside the owned Player
and its corresponding parent-window state notifications. Their ordered values
must match exactly. Unique accepted Player log IDs and their original
notification timestamps must match that notification stream, so choosing the
last acknowledgement cannot conceal duplicated message processing. After all
observed inputs have been handled and the real drainer is saved, the complete
stored response must equal the last actual acknowledged packet, including every
field clock. All later immutable cancellation/forbidden-exit assertions remain.

A mandatory native control holds the first successful answer ACK, performs real
End/Space/Backspace input to restore the exact same authored bytes, then releases
the ACK. It requires a separate later acknowledgement with newer field clocks.
The complete local exit gate passes all 36 Original presentations, six Rewrite
presentations and the fallback flows. Its ordinary fills actually emit three
trusted input events and three corresponding Player notifications, usually
coalesced into one save acknowledgement. The held case observes five inputs,
five notifications and two acknowledgements with different field clocks.
Linux validation of the new observers is
still required; the original trace does not yet prove which input path produced
its three notifications. The strengthened gate must expose that distinction.

### Isolated retained-paint diagnostics

Raw Linux images from `7b6090b7` distinguish an overhanging glyph from a
possibly retained pixel: `(39,440)` is white in the current General-bottom
view, but a failing Rewrite capture keeps the exact yellow LCD pixel present
at that coordinate beside the earlier warning label. Source's Images capture
sometimes retains the same pixel even though the label has moved. This is
stronger evidence than calling every differing pixel a current heading edge;
it suggests retained paint but does not yet prove the renderer's cause.

After each Primar/1280 General-bottom baseline, a separate diagnostic records
complete visible-heading/ancestor computed styles and font faces. It tests the
actual Source root background color with an A/B/A restoration, then witnesses a
fully cleared native viewport and a restored rendering. Original baseline PNGs
and their zero-tolerance verdicts have already been recorded and are never
replaced. A separate decoder compares the diagnostic Source, Rewrite and
independent Source-repeat images only after all baseline documents are closed.
These comparisons do not qualify acceptance. Root/surface style attributes and
layout must be restored, including when capture fails. Native scrollbar fade
may change during these diagnostics and remains visible in their own pixels.

Five mandatory headed-browser controls now include successful restoration,
restoration after a failed diagnostic, and a genuinely changed canvas pixel
that remains a one-pixel mismatch after both diagnostic procedures. No expected
Source image is passed to either procedure; no threshold, mask, renderer flag
or baseline-preparation change is introduced. Actual Linux diagnostic evidence
is still required before changing the capture method or production CSS.

### Atomic settings edits alongside the pipeline gates

Original settings saves now use a dedicated protected partial-update contract.
The general and assignment editors send their own fields; the text editor sends
only its changed keys, as Source's actual `changedData` handler does. They no
longer issue a preceding whole-settings GET for each save. The legacy endpoint
retains its required-title/full-text-map contract and omitted-warning clearing.
Both contracts compute their result against the latest state inside the store's
write boundary and commit the matching audit in that same boundary. SQLite uses
BEGIN IMMEDIATE, PostgreSQL shares the catalog/assignment advisory lock, and
File commits one isolated manifest; no settings edit can resurrect an asset
removed by the corresponding catalog writer.

The new mandatory unit/PostgreSQL regression covers a held editor overtaken by
another edit, combined-map limits, missing assets, exact File failure recovery,
late SQL audit rollback and two actually blocked independent PostgreSQL writers.
Protected HTTP checks cover concurrent key edits, missing authentication and a
delegated administrator's denial. A hash-verified fixture retains the actual
pinned Source controller, DAO, editor and DDL excerpts; the PostgreSQL oracle
executes Source's real meta SQL to verify preservation of omitted keys. It does
not claim to run the complete Source backend or its authorization stack.

The full local unit checkpoint passes 3,642 tests, the focused four-store/HTTP
checkpoint 24, and the four-store settings/Source SQL checkpoint 21. CI policy
passes 130 checks, including Source provenance substitutions and mandatory new
regression coverage. Typecheck, production web build and the protected native
administration/settings browser flow pass. The latter still exercises all 102
texts, eight image slots, legacy guards, cascade, roles and password/session
flows. The complete Memory, File and SQLite HTTP suites each pass 172 checks.
Same-commit remote qualification remains required.

Parent `7b6090b7` in
[run 39553564797](https://github.com/jurei733/testcenter-rewrite/actions/runs/39553564797)
still fails administration's strict renderer gate after matching the native
settings host and box model. The Source repeat differs by two pixels in one
view; Source/Rewrite differs by one to four pixels. Saved Linux images show
LCD-colored ink extending one pixel left of two headings in Source but absent
in Rewrite, with identical measured text/layout/styles and all neighboring
pixels equal. This narrows the observation but does not establish its cause.
No tolerance, mask, renderer flags or diagnostic waiver are introduced, and no
broad parity row is closed.

### Native settings structure and acknowledged participant observations

Run [39549352597](https://github.com/jurei733/testcenter-rewrite/actions/runs/39549352597)
at `ebc64f27` finishes with **79 successful / two failed jobs**: the strict
administration reference and its dependent final acceptance. Its Source repeat
matches 23 of 24 views; the remaining Primar 1280-pixel-wide initial images
view differs by one pixel.
Source/Rewrite still differs by one to four pixels. These separate failures do
not establish a shared cause and neither can be waived by the other.

The next settings change follows the actual Source DOM and cascade: the
settings component is an inline host directly containing its tab group, and
the Rewrite's universal border-box reset no longer applies inside the Original
administration root. Material's own explicit box-sizing rules still apply.
The protected production administration flow and all 24 local Source/Rewrite
comparisons plus all 24 independent Source repeats pass. Linux qualification
remains required, and no full-page parity row is closed by this result.

Participant gates now take their immutable debug-error baseline after the
actual second Player's LOADCOMPLETE and error-save acknowledgements. They
still compare the complete Run and parent, including revisions, answers and
clocks. The delayed-terminal scenario holds the first successful owned
`signed_in` runtime snapshot, allowing a legitimate preceding `launched` read
to finish unchanged. A real authenticated browser GET explicitly exercises
that leading read; four helper tests reject foreign participants, failed
responses and unexpected lifecycle states and verify that the held snapshot
remains independent of a newer active response. The browser uses its currently
accepted credential after takeover rather than the initial rotated token.
The complete local console gate passes 43 checks and the debug gate 16.

Both gates now honor the CI artifact directory while keeping their owned
SQLite stores in a separate scratch directory. A failed console job retains
only its JSON/PNG evidence for seven days; debug evidence uses the existing
qualification upload. Shutdown cancels its unused deadline timer instead of
keeping Node alive for five seconds after a clean API exit. The final local
frontend-state suite passes 1,953 checks, the CI policy suite 123, Actionlint
and the production frontend build pass. These results do not replace the
same-commit Linux, PostgreSQL and Docker acceptance matrix.

### Steady native viewport capture

The administration task also repeats every Source view in a third, independent
document after the actual Source/Rewrite series. All original comparisons and
images remain unchanged. Source-to-Source comparisons run only after the full
repeat series and are recorded separately; non-reproducible reference images
fail rather than qualifying a Rewrite result. No repeated image replaces the
original reference. Local validation passes all 24 Rewrite comparisons and all
24 Source repeats, with 18 independently witnessed phase documents. Linux
repeatability is still unproven and is the purpose of this diagnostic. The
81-job matrix, 19 Source tasks and zero-tolerance comparator were unchanged at
that checkpoint.

A local temporal control proves that the unchanged Source's first mobile date
field image can differ by eight pixels from its next five images, with identical
layout measurements and no UI input or DOM mutation. This is not evidence that
all prior Linux edge pixels have the same cause. Capture now measures first,
waits for rendering frames, and requires three consecutive identical complete
PNG byte streams. Every image must retain the original geometry; twelve
unsuccessful attempts fail. The helper receives no reference or Rewrite image,
so it cannot choose a frame to match the other build. Initial changed images
and frame hashes are retained; the final Source/Rewrite comparison still checks
every RGBA pixel with zero tolerance.

Both builds now use the same native page/viewport at each theme/width. Actual
protected Rewrite UI login supplies only its own origin's storage. Source's
fixture key is installed only at its separate origin, and its absence is
asserted at the Rewrite origin. This reduces visual-context creation from
twelve to six without removing any view. Source's body/window overflow owner
and text-container box models are restored in the scoped administration view.

The full local wrapper passes all 24 pairs, with 48 records proving three equal
frames. The real protected administration/settings flow also passes. Three
actual headed-browser controls cover a paint change after the first image,
continuously changing pixels and capture-side layout mutation; these controls
are mandatory before the administration Source family, with their artifacts
retained alongside it. All 122 CI policy checks and Actionlint pass. The other
Source tasks, 81-job matrix and full-acceptance requirements were unchanged at
that checkpoint.
Fresh Linux qualification is required; no broad parity row is closed.

The complete 81-job response for parent `6d87316a` records **78 successful /
three failed jobs**, including final acceptance. Besides administration,
the dialogs family fails its missing-version task: the immediate reload check
observes `#/t/1` instead of the restored `#/t/1/u/1`. Actual Source defers
`window.location.href = '/'` by 100 ms, so the old document's already-complete
network-idle state and still-visible dialog cannot prove reload completion.
The reference now requires a different `performance.timeOrigin`, the exact
original unit URL, and the recreated owned iframe before measuring the new
dialog. Existing URL/title/iframe/error assertions stay intact. Raw reload
diagnostics retain the two origins without changing the historical renderer
profile. Job-list inspection must request all pages (here `per_page=100`);
the connector's first-page job list alone does not prove complete acceptance.
All twelve local missing/unsupported Source cases pass, each with a different
document origin, the exact restored route and one recreated iframe. A separate
two-state corruption control after stable capture keeps the initial image exact,
changes one bottom-image RGBA pixel, and still exits 1 even though its diagnostic
image is exact. Neither the stability barrier nor diagnostics can waive a
changed baseline pixel.

Run [39503613658](https://github.com/jurei733/testcenter-rewrite/actions/runs/39503613658)
at `6f7b0239` completes with **79 successful / two failed jobs**. The corrected
Player-exit gate passes on Linux. The new administration reference fails its
strict pixel comparison, which correctly also fails final acceptance: all 24
views finish, but several Linux captures differ by one to four pixels at the
outer ink edge of headings. Local captures remain exact. The follow-up restores
Source's content-box model for the scoped h2/h4 headings; it is not yet proven
to resolve the Linux difference. Per-image diagnostics now retain the actual
heading text, layout/text rectangles and font/box styles, without increasing
the reference tolerance or including these verbose diagnostics in capture logs.

Follow-up `b5430c6d` in run `39542338492` still fails the administration family
with the same one-to-four-pixel pattern; the heading box model is therefore not
a demonstrated explanation. Its actual Linux geometry and text ranges match,
with inherited `color-scheme: light` versus `normal` and Source heading text
whitespace remaining different. The next change matches those Source values.
If the baseline still differs, a separately labelled diagnostic temporarily
copies Source heading-parent box models into the owned Rewrite page, captures
the result, and restores the original inline styles/layout. Its pixels and
verdict never replace the actual baseline comparison or qualify acceptance.
An isolated local corruption control changes exactly one captured RGBA pixel:
the baseline fails with one pixel while its separate diagnostic has zero, and
the command still exits 1 after restoring the page. The unchanged local family
passes all 24 pairs with equal hashes; all 15 heading text/style records match.

Run `39543317146` at `6d87316a` still fails administration, so matching the
heading whitespace/color scheme also does not establish a Linux fix. Its
separate parent-box diagnostic exactly matches the desktop initial Source,
while one Theming edge pixel remains at the bottom on desktop/mobile. The
follow-up restores Source's content-box only for the Material text-label and
content spans. An exploratory wider tab-container reset was not retained. Eight
local pixels at the date-field corners also appeared with the narrow change;
comparison with the earlier exact captures shows Source changing in one run
and Rewrite in the other. This does not establish a product-style regression.
A focused eight-view capture with actual date-field geometry/styles recorded
is exact, and the date input/container measurements match apart from the outer
flex row's box-sizing. The fixture now retains these measurements rather than
inferring a layout or timing cause from the pixels alone. Parent diagnostics now
record up to five ancestors, run only after the General bottom baseline, and
precede the mandatory fresh Images document. This keeps diagnostic repaints
from changing later baseline pixels in the same document.

The administration Source family adds 24 exact viewport comparisons in one
lockfile Chromium: both settings tabs, initial/bottom views, three themes and
desktop/mobile. It retains the existing 18 Source tasks and runs independently
of Fast feedback, using both verified same-run builds. Complete acceptance now
also requires this fourth reference family. Pixel/alpha/dimension failures stay
fatal; raw PNGs, geometry and hashes are retained for the same review window.

Parent `2878bcfc` finishes run `39496695102` with 78 successful jobs and a failed
Player-exit gate/final acceptance. The actual difference is one millisecond in
otherwise identical captured field clocks. Its old baseline only checked that
the answer was visible in SQLite, which can precede browser acknowledgement.
The fixture now waits for its real answer-save HTTP 200 and completed client
drainer before copying the exact answer/clock bytes. A held upstream ACK proves
the store/client ordering gap and then releases the actual response. All 36
Original exits, six Rewrite variants and missing-bundle recovery pass locally;
the original exact answer/clock, cancellation and timer assertions remain.
This closes that observation gap; current Linux qualification is still required.

## Build dependency audit

Run `39495831501` correctly fails the unchanged high-severity audit gate after
new advisory records identify Angular CLI's transitive MCP SDK 1.31.0 and
Angular Build's Vite 7.3.6. The root overrides pin only SDK 1.32.0 and Vite
7.3.7, with matching registry integrity in the lockfile; Angular versions,
the Original reference lock and the audit threshold stay unchanged. Remove
these overrides when the pinned Angular release carries compatible fixed
dependencies itself. A clean `npm ci` and fresh `npm audit` report zero known
vulnerabilities with the repaired lock. Both development/production builds,
all 3,624 unit/frontend checks and 117 CI policy checks pass. An actual Vite
dev server with a separate owned protected API carries a real browser sign-in
to the Original settings form; the complete production administration/settings
browser gate also passes with the patched install.

The primary advisories identify SDK 1.32.0 as the fix for
[cross-session experimental tasks](https://github.com/advisories/GHSA-22jm-h49p-29qw)
and [cross-origin HTTP/OAuth redirects](https://github.com/advisories/GHSA-6prh-2h8m-c8cw).
[Vite 7.3.7 fixes the inherited Windows editor argument issue](https://github.com/advisories/GHSA-698v-4r3x-3vcv).
These are development-tool dependencies; the Angular CLI MCP transport in this
locked release is stdio. The fix retains the gate rather than excluding the
packages or accepting a framework-major upgrade from `npm audit fix --force`.
Successful historical audits remain observations at their recorded time.

## Fast feedback

For a settings renderer iteration, compile the current Rewrite once with
`npm run build`. With the unchanged pinned Source checkout already compiled,
the following runs only the paired administration family. It retains all 24
pixel comparisons, Source manifest checks and actual protected Rewrite login;
it does not run the other families, databases or complete acceptance. Use the
actual absolute Source browser directory and a fresh evidence directory:

```sh
export GITHUB_SHA="$(git rev-parse HEAD)"
node scripts/original-browser-reference.mjs pack /absolute/path/to/unchanged-original
UI_SMOKE_HEADFUL=true \
ORIGINAL_BROWSER_REFERENCE_ROOT=/absolute/path/to/unchanged-original/frontend/dist/testcenter-frontend/browser \
ORIGINAL_BROWSER_CAPTURE_DIR=/absolute/path/to/new/administration-evidence \
node scripts/original-browser-reference.mjs capture administration
```

The wrapper manages the child commit and fixture environment. On headless Linux,
prefix the final command with `xvfb-run --auto-servernum`. It logs a short task
status and evidence path; complete measurements remain in `index.json` and the
per-image JSON/PNG artifacts, including heading diagnostics. This focused local
route supplements the unchanged mandatory CI matrix.

For local asset/settings iterations, `npm run test:application-assets` builds
only the TypeScript core and runs catalog/assignment rollback, real protected
HTTP and controller tests, without compiling Angular or starting a browser.
After an existing core build, use `npm run test:application-assets:built`.
Set `FIRST_SLICE_STORE=postgres` and an owned `FIRST_SLICE_POSTGRES_URL` to also
exercise the actual Source SQL foreign-key cascade, queued cross-connection
stale writes and PostgreSQL rollback. The same store/HTTP regressions remain
mandatory in `test:unit:built` and the full PostgreSQL integration runner.
The Source build verifier also checks their captured PHP/DDL provenance.
These focused commands supplement complete CI acceptance; they do not replace it.

`Fast feedback` requires the production build, development typecheck, CI policy,
dependency audit, complete unit/frontend/terminal-overlap tests and eight short
browser gates: bug reporting, real Original login, protected login, administrator
login, proof of work, Systemcheck, participant isolation/variants and real IB
restoration. These run before the long browser journeys can occupy runner slots.
A failure prevents expensive dependent jobs and still fails `CI acceptance`.

All 27 existing browser scenarios remain independently required. Original
administration adds an independent real-API gate, bringing the set to 28. The
20 extended scenarios run in `quick-extended` after fast feedback, with four concurrent slots, alongside
PostgreSQL, the broad matrix, deployability and the three Compose modes. Long
prefix journeys therefore do not block the first meaningful checkpoint or
serialize the start of the PostgreSQL flow. The cap leaves runner capacity for
the other qualification groups. Policy reconciles both tiers with the complete
local Quick command and all four local groups, requires every scenario exactly
once and requires both tiers for full acceptance. The Docker image gate builds
from source independently. `Fast feedback` alone is not release acceptance.

One production build supplies all host test jobs. The archive is only 3.3 MiB in
the local checkpoint. Built-script aliases retain each original test command
and environment. A source-pinned baseline command inventory checks that no prior
qualification was lost. The eight prior Ops gates are independent jobs; the new Original administration
flow also runs in the extended entry group. Every
existing scenario, both camera facings, native routes/tabs, controller references,
full browser flow, database adapter and deployment mode remains required.

Run [`39490598043`](https://github.com/jurei733/testcenter-rewrite/actions/runs/39490598043)
at `36113122` completes **all 80 jobs successfully**, including complete acceptance,
Source references, PostgreSQL, all browser tiers and Docker/Compose. From the
workflow start at 20:16:43 UTC, `Fast feedback` completes in **4:25** and final
workflow success in **33:40**. The actual jobs consume **399.3 runner-minutes**.
This is a qualified baseline for that commit, before the new atomic asset slice;
it does not establish production or complete-page visual acceptance.

The earlier **3–6 minute** fast estimate remains provisional. Actual run
`39446720581` demonstrates why putting every prefix journey in the first tier
was insufficient: even its successful runtime-error job took 400 seconds,
before considering queued jobs and the later PostgreSQL flow. The eight short
gates and cancelled idle timers address that critical path. The **20–25 minute**
complete estimate was not achieved by the qualified 33:40 run above. Queues and
cold downloads add time. Reusing host builds and suppressing duplicate feature
push/PR runs avoid redundant work, but do not establish a total compute saving:
399.3 runner-minutes exceeds the historical 302.2-minute, 38-job apparent-green
baseline, with wider coverage and corrected failure propagation. More parallel
jobs do not imply more test coverage.

Run `39446720581` qualifies the corrected Linux login, protected login, header,
Starter, Systemcheck, saved-report, attachment, variant and real IB restoration
gates. It is still a failed run, so it is not a complete timing baseline. Its
player-exit trace records Playwright completing a click while Material still
has `mdc-dialog--opening`; no trusted pointer event reaches the confirmation
button and no return request exists. The fixture now awaits Material's actual
opening lifecycle and rendered finite transitions before its native click.
The same barrier protects the reopened completeness dialog. It does not force
clicks, change animation durations, synthesize events or retry mutations.

Two other readiness conditions retain the exact restoration assertions. Runtime
error recovery waits for a new document `performance.timeOrigin` and the owned
Player's enabled answer input, which is enabled only after its real Verona
Start packet restores answer and progress. Shared-parameter navigation waits
for the second Player's actual `publish-red` definition: inherited `language=de`
alone can still be visible in the preceding iframe. Administrator captures
foreground the page before interaction, await the destination component after
navigation and wait for two rendering frames; capture errors remain fatal and
save viewport/component diagnostics in the uploaded failure artifacts. These
are fixture synchronization changes, not weaker application assertions.

Smoke deadlines now clear their losing timers on both success and rejection.
Previously a successful owned API shutdown still kept each child process alive
for ten seconds, repeated across runtime-error variants; header/exit cleanup
also retained five-second timers. `smoke-deadline.test.mjs` runs real subprocesses
to demonstrate that the old pattern remains alive and the replacement exits,
and verifies unchanged failure identity, timeout failure and cleanup escalation.
The shutdown limits and forced termination of stalled servers are retained.
This removes harness idle time; complete hosted speedup remains unmeasured.

## Artifact and credential boundaries

- Third-party Actions use immutable commit SHAs. Checkouts do not persist the
  GitHub credential. The workflow has only `contents: read`, no repository
  secrets, no privileged `pull_request_target` or `workflow_run` execution.
  The follow-up pins official checkout 7.0.1, setup-node 7.1.0, cache 6.1.0,
  download-artifact 8.0.2 and upload-artifact 7.0.2. Their inspected metadata
  declares Node 24 and retains every input used here. The observed hosted runner
  2.337.0 meets their minimum runner requirements; application jobs stay on
  Node 22. `ci-action-versions.json` records exact commits, release/source URLs,
  metadata hashes and accepted inputs. Artifact digest mismatch is explicitly
  fatal in the download action, before the application-level manifest check.
- Dependency installation uses the lockfile. The separate audit includes
  development dependencies and fails on high/critical findings. npm package
  caching retains the normal package-integrity checks, not installed modules.
- Chromium caching uses the exact OS, architecture and lockfile hash; system
  libraries are still installed. No browser binary is taken from a build artifact.
- Production artifacts are immutable, named by the exact tested SHA and downloaded
  from the **same workflow run**. There is no arbitrary run-ID/token override.
  Before extraction, the manifest checks commit, lockfile hash, Node major, OS,
  architecture and archive digest. Only the declared compiled/schema roots can
  be restored; links, special files, path escapes and symlink destinations fail.
- Archives contain no database, participant state, environment file, credential
  or installed modules. Generated schema bytes remain an ephemeral installation
  cache, not republished source. Build artifacts expire after one day. Existing
  bounded failure logs retain their seven-day policy.

Push runs cover `main`; pull requests cover every update, and merge queues plus
manual runs are supported. Composite-action changes trigger the workflow too.
Superseded runs are cancelled. No runtime tests are selected away by a broad
file-name heuristic. Full acceptance rejects every failed, skipped or cancelled
qualification group. Repositories requiring a single protected-branch check
should require **CI acceptance**, not the fast checkpoint. This change does not
alter repository branch-protection settings.

## Browser qualification that preserves failures

Quick runs visible Chromium in Xvfb, matching the mode used to collect the
pinned Source visual measurements. Playwright's system dependency installation
already installs Xvfb. `UI_SMOKE_HEADFUL=true` is respected by every Original
Quick geometry fixture, including exit completeness. The wrapper and logger
remain in the explicit pipefail shell; failed shard logs have distinct artifact
names and are retained for seven days.

The same unmodified Source build at `eedae41840cbe90e5547c0211da818bdf620f5aa`
reproduces both exit-dialog renderings with the installed Chromium: visible
height 139 at y=290.5, headless height 140 at y=290. A headless rewrite matched
the headless Source, while the stored reference describes visible Source.
The fix aligns browser modes and retains exact geometry/text/style assertions;
it does not introduce pixel tolerances or remove a comparison.

The newly visible HTTP initialization failure was an unconditional
`crypto.randomUUID()` in native controller identity creation. HTTP browsers
support `getRandomValues` but may omit `randomUUID`. Native owner and command
delivery IDs now use CSPRNG-generated RFC 4122 v4 bytes in that case. Existing
native UUID generation, durable retries, document ownership and HTTPS-only
proof-of-work policy are retained. Three new actual-source tests fail before
the fix; all four added identity cases pass afterward, including denied
session storage and native UUID preference. The real HTTP login smoke reports
any global initialization error before attempting credentials.

The Source-aligned local follow-up passes all 36 Original player-exit cases,
all six Rewrite exit variants and missing-chunk recovery. The Systemcheck gate
also passes again after its incoming Player observer is installed before the
owned check document loads; installing that observer late could miss the real
start packet. Its `logPolicy === "disabled"` assertion is retained.

Complete acceptance is still open: the newly observable exit-completeness
pixel check differs from its Source SHA in one case (10 RGBA channels, maximum
intensity difference 1). A fresh visible Source capture reproduces the stored
Source hash, so the assertion remains failing pending diagnosis. The earlier
PostgreSQL full-browser run also times out returning from a resumed Starter
card; this is not a successful release result. The workflow must expose these
failures and skip dependent long qualification rather than conceal them.

## Original reference on the qualification platform

The first truthful 27-scenario Linux run exposes more than the two initially
observed failures. Several exact Mac measurements differ from Linux's native
scrollbars, font metrics and rasterization. Changing the rewrite to match Mac
coordinates on Linux would not prove correspondence with the Original there.

`Pinned Original browser build` checks out the official
`iqb-berlin/testcenter` revision
`eedae41840cbe90e5547c0211da818bdf620f5aa`, verifies a clean tracked tree and
the exact frontend lock hash, and uses that frontend's normal production build.
Only its documented ignored environment file is generated from its own template.
It builds once. A same-run artifact supplies entry, dialog and Starter capture
jobs under the same Linux/Chromium/Xvfb mode as the rewrite. Its manifest binds
the consuming commit, Original revision, Node major, OS, architecture and every
compiled file; extra/missing/changed files and links are rejected before use.

The Source drivers retain their click, keyboard, request, unknown-route and
state assertions. Their explicit capture mode records the pinned Original's
actual geometry instead of comparing it to an unrelated Mac measurement.
This mode is restricted to the Source capture driver and never bypasses a
rewrite assertion. Single-case selectors, scenario flags and alternate browser
channels are cleared between captures. JSON and screenshots identify the
Source revision, browser version and renderer; close-button RGBA hashes are
decoded separately from the actual Source PNGs. Finite screenshot animations
are completed before geometry is sampled, so an entering tooltip cannot become
a new baseline. These are UI fixture references,
not proof of Original backend authentication.

The rewrite gates continue to require their existing comparisons while these
platform-specific references are qualified. The source jobs are also required
by complete acceptance. Collecting evidence does not itself close any full-page
Original UI acceptance row.

The first hosted capture at `629eea05`, run `39428558228`, passes the pinned
build and all three families (16 Source tasks). Its Linux tooltip width is
94.859375; its HTTPS notice is 719.078125 wide and 46 high. Those are exactly
the values rejected by the old Mac references in the rewrite jobs. The three
downloaded capture archives match their GitHub artifact SHA-256 digests.
This proves the calibration issue; consuming qualified Linux values remains
separate work, and the rewrite comparisons are still required.

The variant browser gate also contained a deterministic fixture race: a visible
resumed answer did not prove that the command's completion write had finished.
The final competing background save now follows the exact accepted command ID's
real completion response, retaining the earlier overlapping writes. The legacy
latest-by-updatedAt assertion and selected-Run/answer assertions remain strict.
Original uses its visible logo to return, the browser's reload for its raw-text
extension, and its visible paused panel; the hidden Rewrite toolbar/status is
not treated as an Original user control. The complete gate passes both renderer
modes locally, in both interfaces and all three non-saving entry modes, with
actual SQLite/authenticated requests and trace artifacts.

## Local verification

Use Node 22. Run `npm run test:ci-policy`, `npm audit --audit-level=high` and
Actionlint against the root workflow. Policy tests parse the actual workflow
and composite action, reconcile all prior commands and validate artifact
failures, including real corruption, stale source/lockfile and symlink cases.
The command inventory allows additional explicit test files while still
requiring every previous file; removing files or changing runner flags remains
a failure. This avoids blocking ordinary test additions during iteration.

To reproduce artifact reuse in a fresh checkout, first build with
`FIRST_SLICE_XML_SCHEMA_CACHE=.ci/xml-schemas`, then run
`GITHUB_SHA=<full-sha> node scripts/ci-build-artifact.mjs pack`. After `npm ci`
in a second checkout at that SHA and lockfile, set `CI_ARTIFACT_DIR` to that
archive directory and run the same command with `restore`. Run only `:built`
aliases against the restored outputs. The local checkpoint passed this fresh
consumer flow and all 16 authenticated attachment-text browser cases without
building that consumer's application.

For a focused local browser iteration, build once, then run
`npm run ci:browser:quick:entry:built` (or `system-check`, `participant`,
`content`). Use `CI=true UI_SMOKE_HEADFUL=true` for the Source visual mode on
a desktop; on Linux wrap the command in `xvfb-run --auto-servernum`. Keep the
compiled frontend immutable while browsers run: complete the production build
before starting consumers. Local `typecheck` now emits no frontend and CI's full
development check writes `dist/typecheck-development`; neither replaces this
production input. CI also isolates build directories between jobs and verifies
the immutable shared archive.

The complete Memory HTTP suite also passes 172/172 against the reused schema
cache. Remote Linux/PostgreSQL/Docker qualification and actual improved timing
remain pending until the new published workflow completes.


## Console fixture route ownership

The participant-console cell keeps both original browser entries. Its loading
fixture uses a separate owned route scope for each forced terminal-continuation
scenario. It releases the existing answer/runtime/state-effect/acknowledgement
gates and drains only that scenario's actual callbacks before resetting the Run.
The existing 20-second owned-route bound and 60/480-second supervisor bounds are
unchanged. Fixed scenario/operation phases and callback-stage observations locate
an actual pending request without extending a deadline or recording private
request fields. No controller production code or existing assertion is changed.

The concrete failure was job **121408913853** in
[complete CI 40272316050](https://github.com/jurei733/testcenter-rewrite/actions/runs/40272316050):
the child stopped at the global `unrouteAll({behavior:'wait'})` on the forced
terminal scenario's cleanup line. Its supervision artifact **12629131636** has
873,647 bytes, SHA-256
`4f484bb010dc76006d182a6bd006e7b3fb87de6ec56b65ff3b4185e8c403ca85`.
That stack proves the global wait was blocked; it does not identify every
historical Playwright callback responsible for that wait.

The route-ownership control now keeps an unrelated callback genuinely held while
an admitted owned callback completes and the owned scope drains. The unrelated
handler remains installed and its own response completes only after explicit
release. The separate unexpected-callback control must still abort its browser
request and make `drain()` fail. This prevents a cleanup fix from silently
ignoring actual fixture errors or canceling unrelated requests.

The complete local `npm run ci:focus -- ui-participant-console` entry performs a
fresh production build and retains both browser leaves. Its actual local phase
timings are **22,899ms build /111,628ms loading /13,307ms context compatibility**,
with all **43 loading checks, two embedded route controls and five context checks**
passing. The 24 relevant deadline/failure/drain/snapshot static controls also pass
without skips. Native Linux qualification and complete acceptance for the
follow-on head are separate gates; the verified scoped outcome follows below. No retry of the
unchanged failed commit is substituted for this changed implementation.

A one-time AST comparison against the failing parent also verifies that all
**192 assertion calls, 107 polling assertions and eleven check registrations**
in the loading fixture remain identical and in the same order. The change is
route ownership, bounded settlement and fixed operation evidence, not reduced
controller coverage.


[Native Linux console qualification 40275162618](https://github.com/jurei733/testcenter-rewrite/actions/runs/40275162618)
is terminal success on application `8fb766fb245bdbd6326a133b4e385df07b3781dc`,
tree `0325e373f6b4f3ecb1253186ace8e488945ca91c`. Wrapper
`43d8cf9e0e6df99b00583c95558bdad6e9c75a6c` adds exactly one fixed qualification
workflow; its parent, tree and scope are independently verified. Actual job span
is **4:32**, including audit zero, **282 CI-policy /24 static /four native archive
controls**, authenticated native browser material and both complete console
entries, with no skipped or canceled checks and no automatic retry. Fresh Linux
phase timings are **51,162ms build /117,879ms loading /14,734ms context compatibility**.
The forty-three loading checks, both embedded route controls and five context
checks remain required. This scoped timing does not establish a causal speedup
of complete CI; the failed parent's remaining 87 jobs passed.

Console artifact **12630385333** has 1,646,038 bytes, SHA-256
`fac055a3cf4a5b9a323b8c6c486d5af6c02b179cb2b15e89a79c3de5702d19bb`.
Safe archive paths, the exact complete forty-three-check inventory, successful
supervision and the actual native/remote no-op cases are independently checked.
Complete acceptance for the subsequently integrated head remains mandatory.


### Paired Starter viewport expansion (qualification pending)

The Starter reference family retains its four existing tasks and adds `starter-viewports`: 3 themes × 4 states (fresh, continuing/locked with custom button texts, long labels, review) × 4 viewports (1280×720, 390×844, 599×844, 600×844). Every case opens independent Source, Rewrite and Source-repeat contexts; all 48 complete comparisons and all 48 independent Source repeats must be pixel exact. The candidate signs in through its real protected API and schema-qualified Testtakers 18 fixtures. Source uses unchanged pinned frontend code with owned UI DTOs; this does not establish Source backend authorization. No browser flags, masks, thresholds or optional case selectors are introduced.

Six actual pixel fault controls alter a card border or move the introduction by one pixel, across all three desktop themes. Each must produce a nonzero full-viewport difference and return to exactly zero after restoration. The Starter family now also requires the existing native paint, layout and failure-diagnostic controls before capturing. All prior 21 Source tasks remain mandatory.

The default profile remains headful locked Chromium at DPR 1. The initial macOS run captured the first desktop pair/repeat exactly but the unchanged Original failed its mobile stability check: fractional card shadows changed despite constant layout. All sampled failing frames were retained. A separate full DPR 2 diagnostic had 48 exact pairs and 48 exact Original repeats; this additional profile does not replace or accept the failing default profile. A software-rendering diagnostic had five account-icon pixels different and was not adopted. Default Linux qualification and all broader Starter interaction/scroll flows remain pending; no broad parity row is closed by this addition.


The follow-up review-hover expansion adds the hovered review download button to every review case (all three themes and all four viewports), including the real automatic scroll needed to expose it. The driver therefore requires **60 complete pairs and 60 independent Source repeats**, while retaining all 48 initial views and all six fault controls. The unchanged Original must report no CSS transform on the hovered button. A separate Retina interaction probe first found 5,696 differing pixels confined to this button, with exact initial, scrolled, first-card-hover and all four independent Original repeats. The scoped Starter button hover rule removes the inherited one-pixel translation. Fresh production and complete default Linux qualification of this follow-up remain pending; the preceding Linux run has a different, explicitly recorded head.


The exact four-state Retina counterexample was rerun against fresh production after the scoped hover fix: all four Source/Rewrite views and all four independent Source repeats are now exact, with zero page errors and unknown Source requests. Evidence: `starter-interaction-fixed-20261026/starter-viewports.json` (76,465 bytes, SHA-256 `7eea43ad1ebc92706b89d0cfbda7aa996d940e987ad20e30e7e0fdcc352535b8`). This is a targeted causal check, separate from complete default-profile acceptance.


### Refresh broad scheduling from completed job timings (qualification pending)

The prior accepted complete run 40275946436 passed all 89 jobs in 30:08. Its longest broad UI job, `ui-full`, took 17:22 but started at 05:58:03 UTC, 8:01 after the Fast feedback gate completed (05:50:02). The broad matrix had placed it fourteenth. The updated order puts observed long jobs first using the separate complete receipt `scripts/fixtures/ci-shard-timings.json`; all 40 exact command/options/browser records, dependency gates, runner limits, fail-fast policy and acceptance requirements are preserved. No suite or input is shortened. The original historical timing receipt remains untouched, and its existing 15/16-slot scheduling model must still retain at least 300 seconds of improvement over its original baseline (the refreshed order models 515/414 seconds).

This is a queue-order optimization based on actual recent job durations. The simplified model for the latest 15/16-slot matrix alone predicts the same makespan; the observed delay also involves shared runner availability and other job families. No new whole-pipeline speedup is claimed. Validate the complete Starter/review implementation first, then run every integrated gate with the refreshed schedule. Preserve useful live qualifications to terminal completion. The prior complete baseline excludes the newly added Starter views, so any observed whole-run difference must disclose that changed workload and cannot establish isolated scheduling causality. A scoped run does not establish complete acceptance.


### Actual Starter scroll-observer readiness (qualification pending)

The 60-view native Linux follow-up 40300614363 was correctly rejected: all 60 Source/Rewrite pairs, all 12 hovered review views, all six fault controls and the four unchanged Source tasks passed, but one independent Original repeat (`Sekundar-mixed-desktop-initial`) differed by 8,224 pixels. Its complete retained geometry and images show an absent scroll-hint button despite the offscreen sentinel; the original and candidate both showed the button. This was an actual unstable Original state, rather than evidence of a remaining review-hover translation. Failure artifact 12641796164 has 19,831,030 bytes, SHA-256 `a2f7ec2d01ed093c58ac531eff77274c1241137e8db4c4a0dcf5e97c06d08f07`. No retry or integration of the failed qualification occurred.

The driver now obtains a fresh native IntersectionObserver result for the actual rendered sentinel and awaits the Original's corresponding scroll-button presence before capturing either implementation. It changes no Source code or UI state and introduces no sleep, pixel exception or timeout increase. Review views first scroll the real button into view, await this state, then perform and assert actual hover. Each capture records its observed sentinel/hover readiness. All 60 comparisons, 60 independent repeats and six real fault controls remain mandatory. Qualify this changed driver as a focused Linux scope, with a fresh pinned Source build, fresh candidate production, audit, provenance/policy and native capture controls; the four unchanged Source tasks and the existing functional Starter/advisory checks already completed successfully on the same production code in the preceding run. Every task remains in the subsequent complete integrated CI.


### Qualified native Starter scope and integrated scheduling candidate (2026-10-26)

The current application `58008337b1067ec84bee0f42b637715ac011f273`, tree `6bce61bbe0c51d7b2d4e03f6d5d754507c948465`, is now qualified by actual Linux run [40304608681](https://github.com/jurei733/testcenter-rewrite/actions/runs/40304608681), job 121510516354, on the verified wrapper-only successor `2245f6f3895c6e89f69a26994a2e90eead264c64`. Actual terminal outcome: success, **6:13** (10:05:12–10:11:25 UTC), fresh candidate production **33 seconds**, complete 60-view driver **3:44**. All **282 CI-policy, 46 Source provenance and 19 native capture controls** pass with no skips/cancellations; the locked candidate graph reports zero vulnerabilities. Authenticated native browser material and the fresh pinned Source build pass. All **60 complete pairs, 60 independent Original repeats, six actual fault controls and 36 actual hovered captures** pass at default headful DPR 1, with zero unknown requests or page errors. The earlier 60-view Source-state failure remains retained as rejected evidence. No Source code, timeout, image tolerance or expected frame was changed to obtain this result.

Artifact 12642455634 is independently downloaded and verified: **7,406,097 bytes**, ZIP SHA-256 `0344dbe55a780e80ed8e162ffb6ee071e416b6d523ecf41476d51eae3379f0c5`, 826 safe members with no private SQLite store. All **180 visible PNG/pixel hashes and 540 actual white clearing frames** match their captured receipts; every fault mutation is nonzero and every restoration exact. The 993,415-byte result JSON has SHA-256 `3a5d190843d2197defd6e350ca9b902f1654671feaad0c27b89614b78c00ecad`, including 180 native observer/hover readiness records and the verified 80-file Source manifest. The full decoded log is 269,930 bytes, SHA-256 `94f64b1078052d86769bad05e80b30dce6039f5aa9eccd5b5bac52d37f8e6368`.

This focused qualification is deliberately scoped to the changed complete-view driver and its controls. Existing Starter functional/advisory checks and all four other Source Starter tasks already passed in run 40300614363 on the same production code; the preceding 48-view family qualified in run 40299473135. All 22 Source tasks and all prior commands remain mandatory in complete integrated acceptance. The current scheduling candidate also preserves the entire parsed workflow except broad matrix order, verified directly against its parent; actual complete-run timing and acceptance of the integrated successor remain pending. The prior integrated baseline 40275946436 remains terminal89/89 success (4,404 unit/frontend, 2,646 PostgreSQL, all57 exit cases;30:08). No broad parity row closes:27done/22partial, all8broad visual rows open. No merge or deployment is included.


### Empty Starter information notices (qualification pending)

The empty-assignment Starter now uses the Original's centered information notice outside the card list, with its exact blue glyph, normal icon flex shrink and sanitized HTML/backtick rendering. The authored `login_noBookletsAvailable` value keeps its whitespace; empty string still uses the Original fallback. No HTML-sanitization bypass is introduced. A genuine protected no-assignment sign-in against strict Testtakers18 produces no cards, even though three content Booklets exist in the active release. The unchanged Source frontend uses owned matching claims and texts; this remains UI evidence, rather than Source backend authorization evidence.

A before/after Retina probe for Primar/default/desktop found **13,231 differing pixels before the fix and zero afterward**, with an exact independent Original repeat. The first default-DPR1 full run then passed 48 pairs and all60 Original repeats but rejected all12 long-text pairs: an extra fixed-icon shrink rule differed from the actual pinned MatIcon CSS. Removing that rule restores the Original's shrinking icon/line wrapping; a fresh-production causal probe passes all four actual Primar window sizes with exact independent repeats. The complete final60-view local run and native Linux qualification remain pending.

The new additive `starter-empty-viewports` task retains all22 preceding Source tasks and covers **three themes ×five empty states ×four viewports =60 complete pairs and60 independent Original repeats**: fallback, rich authored HTML, empty string, whitespace-only and long text. Each real candidate session uses protected APIs and schema-qualified CDATA text fixtures. Rich-text cases require actual strong/emphasis/linebreak/backtick output, a sanitized unsafe URL, removed script/event-handler attributes and no executed fixture marker. Six actual icon-color/one-pixel-position defects must fail the complete comparison and restore exactly. No threshold, browser alternate, expected-frame input or retry is added. All existing native capture controls and original nonempty Starter tasks remain mandatory. The live integrated parent CI40306142992 is preserved and excludes these unpublished empty-state changes; all8 broad visual rows remain open.


The final local default-profile matrix is now terminal0: **all60 complete empty-state pairs and60 fresh Source repeats are exact**, with all six actual pixel defects detected and all six restorations exact. All rich DOM/sanitization assertions pass; page errors and unknown Source requests are zero. Auth inventories are exactly120 Source sign-ins and60 real candidate sign-ins. Evidence `starter-empty-default-final-20261026/starter-viewports.json` is782,238bytes, SHA256 `ad10eea17bd49ea55dc118adf4cc003cce6df99afd3bc58cd3f7099eb6d2c10f`. Fresh production,46 Source provenance controls,281 CI-policy controls (one explicit macOS GNU-timeout omission),actionlint and diff checks pass. The code and driver still require focused native Linux qualification, then complete integrated CI. The already running parent complete run is preserved to terminal completion before starting the next remote qualification; no shortened full-acceptance claim is made.
