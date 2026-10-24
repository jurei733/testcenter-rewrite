// Status-only setup calls still own a finite HTTP body. Read it completely
// before advancing, without buffering large content releases or hiding errors.
export async function drainSmokeResponse(response) {
  if (!response.body) return;
  const reader = response.body.getReader();
  try {
    while (!(await reader.read()).done) { /* discard each received chunk */ }
  } finally {
    reader.releaseLock();
  }
}
