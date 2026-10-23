// The unchanged sample appends its fetched resource using innerHTML +=, which
// replaces existing inputs. Visible form fields alone do not mean it is ready.
export async function waitForOriginalSampleResource(frame, content) {
  if (typeof content !== 'string' || !content.trim()) throw Error('Expected exact Original sample resource content.');
  await frame.locator('#unit').filter({hasText: content.trim()}).waitFor({timeout:30_000});
}
