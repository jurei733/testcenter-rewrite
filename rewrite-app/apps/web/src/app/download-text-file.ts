export function downloadTextFile(input: {
  filename: string;
  mediaType: string;
  text: string;
}): void {
  const blob = new Blob([input.text], { type: input.mediaType });
  downloadBlobFile({
    filename: input.filename,
    blob
  });
}

export function downloadBlobFile(input: {
  filename: string;
  blob: Blob;
}): void {
  const url = URL.createObjectURL(input.blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = input.filename;
  link.rel = "noopener";
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  // Keep both the anchor and its object URL alive while the browser processes
  // the synthetic navigation. Under load Chromium can defer the blob download
  // beyond the current task, so immediate removal still cancels it.
  setTimeout(() => {
    link.remove();
    URL.revokeObjectURL(url);
  }, 60_000);
}

export function downloadDataUrlFile(input: {
  filename: string;
  dataUrl: string;
}): boolean {
  const match = input.dataUrl.match(/^data:([^,]*?)(;base64)?,([\s\S]*)$/);
  if (!match) {
    return false;
  }

  const mediaType = match[1] || "application/octet-stream";
  const isBase64 = Boolean(match[2]);
  const payload = match[3] ?? "";
  const bytes = isBase64
    ? Uint8Array.from(atob(payload.replace(/\s+/g, "")), character =>
        character.charCodeAt(0)
      )
    : new TextEncoder().encode(decodeURIComponent(payload));

  downloadBlobFile({
    filename: input.filename,
    blob: new Blob([bytes], { type: mediaType })
  });
  return true;
}
