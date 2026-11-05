# Native Test-state recovery protocol

This is an increment toward durable native saving, not whole-Testcenter parity.
The native Unit journal keeps its existing format and delivery fingerprints.

`GET /test/:id` opts in with `X-Native-State-Protocol: 1`. Its Original JSON body
and `firstStart` semantics stay unchanged. `X-Native-State-Base` carries version,
server revision and control epoch. Initialization changes server metadata only;
it does not manufacture a Test-state timestamp. Legacy callers do not opt in.

The controller captures each Test-state event synchronously before updating its
cache or Subject. Source buffer timers and grouping remain in the controller.
The journal freezes the actual dispatched body, delivery UUID and causal base
before the first HTTP attempt. Test logs are persisted before dispatch too.
Storage failures retain previous data and surface through the owning run.

Each document owns a separate localStorage bucket protected by a Web Lock.
Storage keys contain the SHA256 of the captured actor capability and the exact
native signed-int64 Test ID, never the raw capability. A live tab's buckets are
not replayed by another tab. Reload releases the old leases; recovery orders
packets by causal predecessor even when the client clock moved backwards.

State PATCHes include `X-Native-Delivery-Id` and `X-Native-State-Base`. A base may
name the preceding state UUID. All four stores read the predecessor receipt
inside the same parent/Run mutation boundary as the current receipt and effects.
A missing predecessor returns425 without committing anything. Accepted retries
return their stored outcome without applying state or appending history again.

The server checks individual field versions and a separate control epoch.
Navigation, controller status, timers and Testlet/Unit locks require a current
control epoch. Direct native locks and monitor unlocks advance it on every call,
including repeated equal values. Independent parameters can still be accepted
when control fields are superseded. Every Source state-log entry is retained;
only applicable positive-clock entries change saved state. An all-superseded
packet leaves the Run and its Test timestamps unchanged.

A predecessor carries only its successfully applied causal field versions and
control base. Its global revision may include another writer's changes and must
never authorize those foreign fields in a descendant. Source per-request clock
semantics remain available for requests without a causal base. Existing accepted
Unit and Test delivery fingerprints remain unchanged for those older packets.

An opted-in native command ACK returns a current metadata snapshot even when the
Test is locked. It reads no Unit responses or saved Test state. Only events
captured after that successful ACK use this command context. If Source groups
earlier and later events in one request, bounded context segments preserve their
individual causal bases without splitting or rewriting the Source body. Obsolete
earlier entries remain in history; they cannot borrow a newer command's base.
An obsolete earlier segment does not prevent a successfully applied current
command from completing. A superseded current segment still requires reload.
Conditional CONNECTION polling changes timestamps without advancing a lock epoch.

The HTTP outcome header is bounded: version, revision, control epoch and
supersession flags. The full causal map stays in the receipt. An accepted but
superseded normal write is acknowledged locally and asks the participant to
reload. Recovery accepts that outcome, then re-reads authoritative Test data
before the Player starts. It does not rebase old packets to that newer snapshot.

Terminal completion retains the journal through view destruction under the same
actor and grant. It captures the completion log only after successful command
execution. Exhausted retries leave the packet recoverable; actor retirement
prevents further sends. The existing Starter completion barrier remains in use.

Still required: worker/IndexedDB delivery, draining while Test GET returns423,
multi-Unit/current-Unit-first and cross-Run recovery, interrupted drains, native
large payload and quota UI acceptance, plus the full49 functional and8 visual
requirements. Local native-browser checks do not establish whole-project visual
parity or Linux CI qualification. Merge and deployment remain separate gates.
