import {
  PDFDocument, PDFHexString, PDFName, type PDFPage, type PDFRef, StandardFonts,
  degrees, drawText as drawPdfText, rgb
} from "pdf-lib";
import QRCode from "qrcode";

import type { WorkspaceAttachment } from "@testcenter-rewrite-app/domain";

const DEFAULT_LABEL_TEMPLATE = "%TESTTAKER% | %BOOKLET% | %UNIT% | %VAR%";
const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;
const PAGE_MARGIN = 56.69;
const POINTS_PER_MILLIMETER = 72 / 25.4;
// TCPDF's serialized A4 width and default cell metrics, independently checked
// against unmodified Source AttachmentTemplate output (TCPDF 6.10.0).
const ORIGINAL_PAGE_WIDTH = 595.276;
const ORIGINAL_CELL_MARGIN = 28.35;
const ORIGINAL_CELL_PADDING = 2.835;
// TCPDF rounds the 15-point cell height to six decimals in millimeters.
const ORIGINAL_LINE_HEIGHT = 5.291667 * POINTS_PER_MILLIMETER;
const ORIGINAL_BASELINE_FROM_TOP = 40.086;
const ORIGINAL_LINES_PER_PAGE = 50;
const ORIGINAL_LABEL_SIZE = 12;
const ORIGINAL_LABEL_FONT = PDFName.of("Helvetica");
const SOFT_HYPHEN = "\u00ad";
const NO_BREAK_SPACE = "\u00a0";
const UNICODE_SPACE = /[\p{White_Space}\p{Z}]/u;
const ORIGINAL_WRAP_SPACE = /(?!\u00a0)[\p{White_Space}\p{Z}]/u;
const ORIGINAL_HELVETICA_DEFAULT_WIDTH = 513;
const ORIGINAL_HELVETICA_UNMAPPED_BYTE_WIDTH = 500;
// WinAnsi bytes 0x80–0x9F. Unassigned bytes retain their control code.
const WIN_ANSI_HIGH_BYTES = "€\x81‚ƒ„…†‡ˆ‰Š‹Œ\x8dŽ\x8f\x90‘’“”•–—˜™š›œ\x9džŸ";
// TCPDF 6.10's built-in Helvetica positioning differs from AFM widths
// for these printable WinAnsi characters. Units are thousandths of an em.
const ORIGINAL_CHARACTER_WIDTHS: Readonly<Record<string, number>> = {
  "]": 277, "¡": 278, "«": 448, "°": 606, "²": 350, "³": 350, "¹": 350, "»": 448,
  "¼": 869, "½": 869, "¾": 879, "¿": 556, "Þ": 666, "æ": 896,
  "ì": 251, "í": 251, "î": 251, "ï": 251, "þ": 555,
  "€": 655, "Ÿ": 667, "ƒ": 278, "‹": 250, "›": 250, "œ": 938, "’": 221
};

// TCPDF passes authored Latin-1 bytes through and maps other characters to
// their WinAnsi byte where available. Use a byte string before building the
// PDF hex string so that control bytes cannot become PDF syntax.
const encodeOriginalLine = (line: string): string => {
  let encoded = "";
  for (const character of line) {
    if (character === SOFT_HYPHEN || character === "\ufffd") continue;
    if (character === NO_BREAK_SPACE) {
      encoded += " ";
    } else if (character.codePointAt(0)! <= 0xff) {
      encoded += character;
    } else {
      const index = WIN_ANSI_HIGH_BYTES.indexOf(character);
      encoded += index < 0 ? "?" : String.fromCharCode(0x80 + index);
    }
  }
  return encoded;
};

// TCPDF omits U+200B when serializing UTF-16 metadata strings.
const originalMetadataText = (text: string): string => text.replaceAll("\u200b", "");

// Bookmark labels pass through PHP strip_tags, including its handling of quoted
// angles, incomplete tags and spaced comparisons. The printed label is literal.
const stripBookmarkMarkup = (text: string): string => {
  const asciiSpace = /[\x09-\x0d ]/;
  let mode: "text" | "tag" | "comment" | "declaration" | "instruction" | "xml" = "text";
  let quote = "";
  let nested = 0;
  let parentheses = 0;
  let result = "";
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]!;
    const next = text[i + 1] ?? "";
    const previous = text[i - 1] ?? "";
    if (mode === "text") {
      if (char === "<" && !asciiSpace.test(next)) {
        if (text.startsWith("<!--", i)) {
          mode = "comment";
          i += 3;
        } else if (next === "?") {
          mode = i > 0 && text.slice(i + 2, i + 5).toLowerCase() === "xml" ? "xml" : "instruction";
          parentheses = 0;
        } else {
          mode = next === "!" && text.slice(i + 2, i + 9).toLowerCase() !== "doctype" ? "declaration" : "tag";
        }
      } else if (char !== "\0") {
        result += char;
      }
      continue;
    }
    if (mode === "comment") {
      if (char === ">" && text.slice(i - 2, i) === "--") mode = "text";
      continue;
    }
    const tag = mode === "tag" || mode === "xml";
    if ((char === '"' || char === "'") && (tag || previous !== "\\")) {
      if (!quote || quote === char) quote = quote ? "" : char;
    } else if (char === ">" && nested > 0) {
      nested -= 1;
    } else if (!quote) {
      if (tag && char === "<" && !asciiSpace.test(next)) nested += 1;
      if (mode === "instruction") {
        if (char === "(") parentheses += 1;
        if (char === ")") parentheses -= 1;
        if (char === ">" && previous === "?" && parentheses === 0) mode = "text";
      } else if (char === ">" && (mode !== "xml" || previous !== "-")) {
        mode = "text";
      }
    }
  }
  return result;
};

const originalBookmarkTitle = (label: string): string => {
  const text = stripBookmarkMarkup(label
    .replace(/<br[\x09-\x0d ]?\/>|<\/(?:blockquote|dd|dl|div|dt|h[1-6]|hr|li|ol|p|pre|ul|tcpdf|table|tr|td)>/gi, "\n")
    .replaceAll("\r", "")
    .replace(/\n+/g, "\n"));
  // The non-breaking-space exception applies to the start of each trim match.
  let start = 0;
  if (ORIGINAL_WRAP_SPACE.test(text[0] ?? "")) {
    while (UNICODE_SPACE.test(text[start] ?? "")) start += 1;
  }
  let end = text.length;
  while (end > start && UNICODE_SPACE.test(text[end - 1]!)) end -= 1;
  while (end < text.length && text[end] === NO_BREAK_SPACE) end += 1;
  return originalMetadataText(text.slice(start, end));
};

const toPdfSafeText = (value: string): string =>
  value
    .replace(/[\u2010-\u2015]/g, "-")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[^\u0020-\u007e\u00a0-\u00ff]/g, "?");

const applyAttachmentLabelTemplate = (
  attachment: WorkspaceAttachment,
  labelTemplate?: string | null,
  originalLayout = false
): string => {
  const replacements: Record<string, string> = {
    "%GROUP%": attachment.groupKey,
    "%TESTTAKER%": attachment.personLabel,
    "%BOOKLET%": attachment.bookletKey,
    "%UNIT%": attachment.unitKey,
    "%VAR%": attachment.variableId,
    "%LOGIN%": attachment.loginKey,
    "%CODE%": originalLayout ? attachment.participantCode ?? "" : attachment.attachmentId
  };
  return Object.entries(replacements).reduce(
    // PHP str_replace inserts values literally, including JavaScript $ tokens.
    (label, [placeholder, value]) => label.replaceAll(placeholder, () => value),
    originalLayout ? labelTemplate ?? DEFAULT_LABEL_TEMPLATE
      : labelTemplate?.trim() || DEFAULT_LABEL_TEMPLATE
  );
};

const wrapOriginalPdfText = (
  text: string,
  measureCharacter: (value: string) => number,
  measureEncodedLine: (value: string) => number
): string[] => {
  // Source preserves authored spaces/newlines and does not apply AFM kerning
  // or the Rewrite's four-line ellipsis. Its empty MultiCell prints a space.
  const characters = Array.from(text.replaceAll("\r", "") || " ");
  const slice = (start: number, end?: number): string => characters.slice(start, end).join("");
  const pageWidth = ORIGINAL_PAGE_WIDTH - ORIGINAL_CELL_MARGIN * 2;
  const maxWidth = pageWidth - ORIGINAL_CELL_PADDING * 2;
  const lines: string[] = [];
  let start = 0;
  let separator = -1;
  let width = 0;
  for (let index = 0; index < characters.length; index += 1) {
    const character = characters[index]!;
    if (character === "\n") {
      lines.push(slice(start, index));
      start = index + 1;
      separator = -1;
      width = 0;
      continue;
    }
    const hyphen = character === "-" && /\p{L}/u.test(characters[index - 1] ?? "")
      && /\p{L}/u.test(characters[index + 1] ?? "");
    width += measureCharacter(character);
    const softHyphen = character === SOFT_HYPHEN;
    const hyphenatedWidth = softHyphen && characters[index - 1] !== "-" ? width + measureCharacter("-") : width;
    if (ORIGINAL_WRAP_SPACE.test(character) || hyphen || (softHyphen && hyphenatedWidth <= maxWidth)) {
      separator = index;
    }
    if ((width <= maxWidth && !(softHyphen && hyphenatedWidth >= maxWidth)) || index === start) continue;

    let nextWordWidth = 0;
    if (separator >= start) {
      let wordStart = separator;
      while (wordStart < characters.length && ORIGINAL_WRAP_SPACE.test(characters[wordStart]!)) wordStart += 1;
      let wordEnd = wordStart;
      while (wordEnd < characters.length && !ORIGINAL_WRAP_SPACE.test(characters[wordEnd]!)) wordEnd += 1;
      nextWordWidth = measureEncodedLine(slice(wordStart, wordEnd));
    }
    if (separator >= start && nextWordWidth <= pageWidth) {
      const breakAtHyphen = characters[separator] === "-" || characters[separator] === SOFT_HYPHEN;
      const ending = breakAtHyphen && characters[separator - 1] !== "-" ? "-" : "";
      lines.push(slice(start, separator) + ending);
      start = separator + 1;
    } else {
      lines.push(slice(start, index));
      start = index;
    }
    index = start - 1;
    separator = -1;
    width = 0;
  }
  if (start < characters.length) lines.push(slice(start));
  return lines;
};

const wrapPdfText = (
  text: string,
  maxWidth: number,
  measure: (value: string) => number,
  maxLines = 4
): string[] => {
  const words = text.replace(/\s+/g, " ").trim().split(" ");
  const lines: string[] = [];
  let currentLine = "";
  const segments = words.flatMap(word => {
    if (measure(word) <= maxWidth) return [word];
    const parts: string[] = [];
    let part = "";
    for (const character of word) {
      if (part && measure(`${part}${character}`) > maxWidth) {
        parts.push(part);
        part = character;
      } else {
        part += character;
      }
    }
    if (part) parts.push(part);
    return parts;
  });
  for (const word of segments) {
    const candidate = currentLine ? `${currentLine} ${word}` : word;
    if (!currentLine || measure(candidate) <= maxWidth) {
      currentLine = candidate;
      continue;
    }
    lines.push(currentLine);
    currentLine = word;
  }
  if (currentLine) lines.push(currentLine);
  if (lines.length <= maxLines) return lines;

  const truncatedLines = lines.slice(0, maxLines);
  let finalLine = truncatedLines[maxLines - 1] ?? "";
  while (finalLine && measure(`${finalLine}...`) > maxWidth) {
    finalLine = finalLine.slice(0, -1);
  }
  truncatedLines[maxLines - 1] = `${finalLine}...`;
  return truncatedLines;
};

const drawOriginalAttachmentQr = (page: PDFPage, attachmentId: string): void => {
  const { modules } = QRCode.create(attachmentId, { errorCorrectionLevel: "L" });
  const left = 20 * POINTS_PER_MILLIMETER;
  const top = page.getHeight() - left;
  const moduleSize = 40 * POINTS_PER_MILLIMETER / modules.size;
  const dimension = moduleSize.toFixed(6);
  const operators = ["q", "0 0 0 rg"];

  // TCPDF fills each dark module at its PDF coordinates and leaves the
  // light modules transparent, including where the label crosses the QR.
  for (let row = 0; row < modules.size; row++) {
    const y = (top - row * moduleSize).toFixed(6);
    for (let column = 0; column < modules.size; column++) {
      if (modules.get(row, column)) {
        const x = (left + column * moduleSize).toFixed(6);
        operators.push(`${x} ${y} ${dimension} -${dimension} re f`);
      }
    }
  }

  operators.push("Q");
  const context = page.doc.context;
  const qr = context.flateStream(operators.join("\n") + "\n");
  page.node.addContentStream(context.register(qr));
};

export const createAttachmentPagesPdf = async (input: {
  attachments: WorkspaceAttachment[];
  labelTemplate?: string | null;
  layout?: "rewrite" | "original";
}): Promise<Buffer> => {
  if (input.attachments.length === 0) {
    throw new Error("At least one attachment is required for a QR page PDF.");
  }

  const pdf = await PDFDocument.create();
  const originalLayout = input.layout === "original";
  pdf.setCreator(originalLayout ? "IQB-Testcenter" : "IQB Testcenter Rewrite");
  pdf.setProducer("IQB Testcenter Rewrite");
  const documentTitle = input.attachments.length === 1
    ? applyAttachmentLabelTemplate(input.attachments[0]!, input.labelTemplate, originalLayout)
    : originalLayout
      ? [...new Set(input.attachments.map(attachment => attachment.groupLabel ?? attachment.groupKey))].join(", ")
      : `Attachment QR pages - ${input.attachments.length} requests`;
  pdf.setTitle(originalLayout ? originalMetadataText(documentTitle) : documentTitle);
  pdf.setSubject("Printable QR handoff pages for participant attachments");
  const regularFont = await pdf.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdf.embedFont(StandardFonts.HelveticaBold);
  const originalCharacters = new Set(regularFont.getCharacterSet());
  const byteWidths: number[] = [];
  const measureOriginalByte = (byte: number): number => {
    const cached = byteWidths[byte];
    if (cached !== undefined) return cached;
    const character = WIN_ANSI_HIGH_BYTES[byte - 0x80] ?? String.fromCharCode(byte);
    const units = ORIGINAL_CHARACTER_WIDTHS[character] ?? (originalCharacters.has(character.charCodeAt(0))
      ? regularFont.widthOfTextAtSize(character, 1000) : ORIGINAL_HELVETICA_UNMAPPED_BYTE_WIDTH);
    const width = units * ORIGINAL_LABEL_SIZE / 1000;
    byteWidths[byte] = width;
    return width;
  };
  // TCPDF wraps Unicode before converting the line to Helvetica's WinAnsi
  // encoding. Characters outside the legacy width table use its default width.
  const measureOriginalWrapCharacter = (character: string): number => {
    if (character === SOFT_HYPHEN) return 0;
    const code = character.codePointAt(0)!;
    return code <= 0xff ? measureOriginalByte(code)
      : ORIGINAL_HELVETICA_DEFAULT_WIDTH * ORIGINAL_LABEL_SIZE / 1000;
  };
  const measureOriginalLine = (line: string): number => {
    let width = 0;
    for (let index = 0; index < line.length; index += 1) width += measureOriginalByte(line.charCodeAt(index));
    return width;
  };
  const bookmarks: Array<{ title: string; page: PDFRef; height: number }> = [];

  for (const [index, attachment] of input.attachments.entries()) {
    let page = pdf.addPage([originalLayout ? ORIGINAL_PAGE_WIDTH : A4_WIDTH, A4_HEIGHT]);
    const authoredLabel = applyAttachmentLabelTemplate(attachment, input.labelTemplate, originalLayout);
    if (originalLayout) bookmarks.push({
      title: originalBookmarkTitle(authoredLabel), page: page.ref, height: page.getHeight()
    });
    // Unmodified Source AttachmentTemplate uses TCPDF's regular Helvetica 12.
    const labelSize = 16;
    const measureRewriteLine = (value: string): number => boldFont.widthOfTextAtSize(value, labelSize);
    const labelLines = originalLayout
      ? wrapOriginalPdfText(authoredLabel, measureOriginalWrapCharacter,
        line => measureOriginalLine(encodeOriginalLine(line))).map(encodeOriginalLine)
      : wrapPdfText(toPdfSafeText(authoredLabel), A4_WIDTH - PAGE_MARGIN * 2, measureRewriteLine);

    if (!originalLayout) page.drawText("Attachment capture page", {
      x: PAGE_MARGIN,
      y: A4_HEIGHT - PAGE_MARGIN,
      size: 10,
      font: regularFont,
      color: rgb(0.28, 0.34, 0.44)
    });
    labelLines.forEach((line, lineIndex) => {
      if (originalLayout) {
        if (lineIndex > 0 && lineIndex % ORIGINAL_LINES_PER_PAGE === 0) {
          page = pdf.addPage([ORIGINAL_PAGE_WIDTH, A4_HEIGHT]);
        }
        if (!line) return;
        const x = (page.getWidth() - measureOriginalLine(line)) / 2;
        const y = A4_HEIGHT - ORIGINAL_BASELINE_FROM_TOP - (lineIndex % ORIGINAL_LINES_PER_PAGE) * ORIGINAL_LINE_HEIGHT;
        const encoded = PDFHexString.of(Buffer.from(line, "latin1").toString("hex"));
        page.node.setFontDictionary(ORIGINAL_LABEL_FONT, regularFont.ref);
        page.pushOperators(...drawPdfText(encoded, {
          // TCPDF serializes glyph origins to six decimals.
          x: Number(x.toFixed(6)),
          y: Number(y.toFixed(6)),
          size: ORIGINAL_LABEL_SIZE, font: ORIGINAL_LABEL_FONT, color: rgb(0, 0, 0),
          rotate: degrees(0), xSkew: degrees(0), ySkew: degrees(0)
        }));
        return;
      }
      page.drawText(line, {
        x: (page.getWidth() - measureRewriteLine(line)) / 2,
        y: A4_HEIGHT - PAGE_MARGIN - 38 - lineIndex * 22,
        size: labelSize,
        font: boldFont,
        color: rgb(0.06, 0.09, 0.15)
      });
    });

    if (originalLayout) {
      drawOriginalAttachmentQr(page, attachment.attachmentId);
      continue;
    }

    const qrPng = await QRCode.toBuffer(attachment.attachmentId, {
      errorCorrectionLevel: "L",
      margin: 2,
      type: "png",
      width: 640
    });
    const qrImage = await pdf.embedPng(qrPng);
    const qrSize = 226.77;
    const qrX = (A4_WIDTH - qrSize) / 2;
    const qrY = A4_HEIGHT - PAGE_MARGIN - 38 - labelLines.length * 22 - qrSize - 40;
    page.drawRectangle({
      x: qrX - 8,
      y: qrY - 8,
      width: qrSize + 16,
      height: qrSize + 16,
      color: rgb(1, 1, 1),
      borderColor: rgb(0.84, 0.87, 0.92),
      borderWidth: 0.75
    });
    page.drawImage(qrImage, {
      x: qrX,
      y: qrY,
      width: qrSize,
      height: qrSize
    });

    const codeSize = 7.5;
    const codeLabelY = qrY - 52;
    const codeLines = wrapPdfText(
      attachment.attachmentId,
      A4_WIDTH - PAGE_MARGIN * 2,
      value => regularFont.widthOfTextAtSize(value, codeSize)
    );
    page.drawText("Attachment code", {
      x: PAGE_MARGIN,
      y: codeLabelY,
      size: 9,
      font: boldFont,
      color: rgb(0.28, 0.34, 0.44)
    });
    codeLines.forEach((line, lineIndex) => {
      page.drawText(line, {
        x: PAGE_MARGIN,
        y: codeLabelY - 15 - lineIndex * 11,
        size: codeSize,
        font: regularFont,
        color: rgb(0.12, 0.16, 0.23)
      });
    });
    page.drawText(
      toPdfSafeText(
        `${attachment.groupKey} / ${attachment.loginKey} - page ${index + 1} of ${input.attachments.length}`
      ),
      {
        x: PAGE_MARGIN,
        y: 32,
        size: 8,
        font: regularFont,
        color: rgb(0.4, 0.45, 0.54)
      }
    );
  }

  if (originalLayout) {
    const root = pdf.context.obj({ Type: "Outlines" });
    const rootRef = pdf.context.register(root);
    const entries = bookmarks.map(bookmark => pdf.context.obj({
      Title: PDFHexString.fromText(bookmark.title),
      Parent: rootRef,
      Dest: [bookmark.page, "XYZ", ORIGINAL_CELL_MARGIN, bookmark.height, null],
      F: 2,
      C: [0, 0.25098, 0.501961]
    }));
    const refs = entries.map(entry => pdf.context.register(entry));
    entries.forEach((entry, index) => {
      if (index > 0) entry.set(PDFName.of("Prev"), refs[index - 1]!);
      if (index < refs.length - 1) entry.set(PDFName.of("Next"), refs[index + 1]!);
    });
    root.set(PDFName.of("First"), refs[0]!);
    root.set(PDFName.of("Last"), refs[refs.length - 1]!);
    pdf.catalog.set(PDFName.of("Outlines"), rootRef);
    pdf.catalog.set(PDFName.of("PageMode"), PDFName.of("UseOutlines"));
  }

  return Buffer.from(await pdf.save());
};
