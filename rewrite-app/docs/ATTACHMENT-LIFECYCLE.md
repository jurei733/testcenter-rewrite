# Attachment request ownership

The manager now binds every asynchronous operation to the exact authenticated
operator, tenant and workspace that started it. A changed input invalidates the
old operation, clears its display and releases its loading state. A newer
operation owns its own loading/error/render continuation. Leaving the route
prevents old results, errors, downloads or change-detection calls from reaching
the destroyed view.

This applies to inventory reads, PDF downloads, image previews, upload encoding,
completed uploads/deletions and clipboard feedback. A file still being read after
the context changes cannot begin an upload. Already accepted server writes may
finish normally; their old client continuation cannot replace another scope's
view. Within one workspace, an older image preview cannot appear under a newly
selected attachment, and deleting the previous selection cannot clear the new
selection's preview. There is no additional storage or authorization engine.

## Evidence

- All 34 tests in `scripts/attachment-manager-lifecycle.test.mjs` execute the
  actual production component methods with controlled native/HTTP boundaries.
  They cover operator, tenant, workspace, readonly and destroyed-view changes,
  late success/failure, file encoding, competing request completion, selected
  image ownership, clipboard feedback and duplicate direct actions. On parent
  `3e93fcee`, 33 fail and one passes; none are cancelled.
- Four production Chromium/SQLite cases hold the actual authorized first
  workspace inventory response, change to a second authorized workspace, load
  its exact attachment, then release the old reply. Both interfaces at 1280/390
  pixels retain only the second workspace's data. The previous production
  frontend fails immediately because the old request leaves loading disabled;
  the server-backed response is released during cleanup without a retry.
- All 16 authenticated attachment text/PDF cases continue to pass, including
  exact default/empty/padded labels, real downloads and foreign-group denial.
  The standard attachment image flow and both synthetic rear/front camera
  flows pass through upload, preview and deletion. Physical cameras are a
  separate acceptance requirement.
- The complete frontend suite passes 1,910 checks; the production build remains
  469.88 kB under the unchanged 470 kB initial budget.

The longer hosted attachment gate exposed a separate presentation regression
from `4e797ea8`: the Rewrite's default `capture-image` type label had changed.
That default is restored, while Original uses its authored/customized German
label. The shared browser gate now identifies the actual capture type through
`data-attachment-type`, and the 16-case gate checks the exact displayed label
independently. No type, upload, authorization or saved-state assertion is removed.

These are bounded request-lifecycle and presentation corrections. The formal
30-complete/19-partial parity matrix and all eight full-page Original UI rows
remain open at the broader acceptance boundary.
