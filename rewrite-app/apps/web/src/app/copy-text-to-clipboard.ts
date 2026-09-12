export async function copyTextToClipboard(value: string): Promise<boolean> {
  const text = value.trim();
  if (!text) {
    return false;
  }

  const clipboard = globalThis.navigator?.clipboard;
  if (clipboard) {
    try {
      await writeTextWithTimeout(clipboard, text);
      return true;
    } catch {
      return copyTextToClipboardWithFallback(text);
    }
  }

  return copyTextToClipboardWithFallback(text);
}

function writeTextWithTimeout(
  clipboard: Clipboard,
  value: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeoutHandle = globalThis.setTimeout(() => {
      reject(new Error("Clipboard write timed out."));
    }, 1000);

    clipboard.writeText(value).then(
      () => {
        globalThis.clearTimeout(timeoutHandle);
        resolve();
      },
      error => {
        globalThis.clearTimeout(timeoutHandle);
        reject(error);
      }
    );
  });
}

function copyTextToClipboardWithFallback(value: string): boolean {
  const documentRef = globalThis.document;
  const textArea = documentRef?.createElement("textarea");
  if (!documentRef?.body || !textArea) {
    return false;
  }

  textArea.value = value;
  textArea.setAttribute("readonly", "true");
  textArea.style.position = "fixed";
  textArea.style.opacity = "0";
  documentRef.body.append(textArea);
  textArea.focus();
  textArea.select();
  textArea.setSelectionRange(0, value.length);
  let copied = false;
  try {
    copied = documentRef.execCommand("copy");
  } catch {
    copied = false;
  }
  textArea.remove();
  return copied;
}
