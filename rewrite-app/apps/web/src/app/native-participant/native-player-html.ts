const lottie122DownloadBase = 'new URL(t,parent.location.origin)';
const lottie122Sha256 = '6a46febd83579359d943788c9eea3634ec46b55b04507f19448ffa0ca54d43a0';

export async function prepareNativePlayerHtml(html: string): Promise<string> {
  if (!html.includes(lottie122DownloadBase) || !globalThis.crypto?.subtle) return html;
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(html));
  const sha256 = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
  if (sha256 !== lottie122Sha256) return html;

  // Lottie 1.2.2 reads its parent's origin before fetching avatar.json.
  // The host sends an absolute download URL, so the sandboxed Player needs no base.
  return html.replace(lottie122DownloadBase, 'new URL(t)');
}
