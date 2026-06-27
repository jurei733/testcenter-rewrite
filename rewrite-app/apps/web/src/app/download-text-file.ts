export function downloadTextFile(input: {
  filename: string;
  mediaType: string;
  text: string;
}): void {
  const blob = new Blob([input.text], { type: input.mediaType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = input.filename;
  link.rel = "noopener";
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
