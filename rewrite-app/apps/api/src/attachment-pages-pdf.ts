import { PDFDocument, PDFHexString, PDFName, type PDFRef, StandardFonts, rgb } from "pdf-lib";
import QRCode from "qrcode";

import type { WorkspaceAttachment } from "@testcenter-rewrite-app/domain";

const DEFAULT_LABEL_TEMPLATE = "%TESTTAKER% | %BOOKLET% | %UNIT% | %VAR%";
const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;
const PAGE_MARGIN = 56.69;
// TCPDF's serialized A4 width and default cell metrics, independently checked
// against unmodified Source AttachmentTemplate output (TCPDF 6.10.0).
const ORIGINAL_PAGE_WIDTH = 595.276;
const ORIGINAL_CELL_MARGIN = 28.35;
const ORIGINAL_CELL_PADDING = 2.835;
const ORIGINAL_LINE_HEIGHT = 15;
const ORIGINAL_BASELINE_FROM_TOP = 40.086;
const ORIGINAL_LINES_PER_PAGE = 50;

const originalBookmarkTitle = (label: string): string => label
  .replace(/<br\s?\/>|<\/(?:blockquote|dd|dl|div|dt|h[1-6]|hr|li|ol|p|pre|ul|tcpdf|table|tr|td)>/gi, "\n")
  .replaceAll("\r", "")
  .replace(/\n+/g, "\n")
  .replace(/<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<\/?[A-Za-z][^>]*>/g, "")
  .trim();

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
    "%CODE%": attachment.attachmentId
  };
  return Object.entries(replacements).reduce(
    (label, [placeholder, value]) => label.replaceAll(placeholder, value),
    originalLayout ? labelTemplate ?? DEFAULT_LABEL_TEMPLATE
      : labelTemplate?.trim() || DEFAULT_LABEL_TEMPLATE
  );
};

const wrapOriginalPdfText = (
  text: string,
  measureCharacter: (value: string) => number
): string[] => {
  // Source preserves authored spaces/newlines and does not apply AFM kerning
  // or the Rewrite's four-line ellipsis. Its empty MultiCell prints a space.
  const value = text.replaceAll("\r", "") || " ";
  const pageWidth = ORIGINAL_PAGE_WIDTH - ORIGINAL_CELL_MARGIN * 2;
  const maxWidth = pageWidth - ORIGINAL_CELL_PADDING * 2;
  const lines: string[] = [];
  let start = 0;
  let separator = -1;
  let width = 0;
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index]!;
    if (character === "\n") {
      lines.push(value.slice(start, index));
      start = index + 1;
      separator = -1;
      width = 0;
      continue;
    }
    const hyphen = character === "-" && /[A-Za-z]/.test(value[index - 1] ?? "")
      && /[A-Za-z]/.test(value[index + 1] ?? "");
    if (character === " " || hyphen) separator = index;
    width += measureCharacter(character);
    if (width <= maxWidth || index === start) continue;

    const nextWord = separator < start ? "" : value.slice(separator + 1).split(/\s/, 1)[0]!;
    const nextWordWidth = Array.from(nextWord).reduce((sum, part) => sum + measureCharacter(part), 0);
    if (separator >= start && nextWordWidth <= pageWidth) {
      lines.push(value.slice(start, separator + (value[separator] === "-" ? 1 : 0)));
      start = separator + 1;
    } else {
      lines.push(value.slice(start, index));
      start = index;
    }
    index = start - 1;
    separator = -1;
    width = 0;
  }
  if (start < value.length) lines.push(value.slice(start));
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
  pdf.setTitle(
    input.attachments.length === 1
      ? applyAttachmentLabelTemplate(
          input.attachments[0]!,
          input.labelTemplate,
          originalLayout
        )
      : `Attachment QR pages - ${input.attachments.length} requests`
  );
  pdf.setSubject("Printable QR handoff pages for participant attachments");
  const regularFont = await pdf.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdf.embedFont(StandardFonts.HelveticaBold);
  const bookmarks: Array<{ title: string; page: PDFRef; height: number }> = [];

  for (const [index, attachment] of input.attachments.entries()) {
    const mm = 72 / 25.4;
    let page = pdf.addPage([originalLayout ? ORIGINAL_PAGE_WIDTH : A4_WIDTH, A4_HEIGHT]);
    const authoredLabel = applyAttachmentLabelTemplate(attachment, input.labelTemplate, originalLayout);
    if (originalLayout) bookmarks.push({
      title: originalBookmarkTitle(authoredLabel), page: page.ref, height: page.getHeight()
    });
    const label = originalLayout
      ? authoredLabel.replaceAll("\r", "").split("\n").map(toPdfSafeText).join("\n")
      : toPdfSafeText(authoredLabel);
    // Unmodified Source AttachmentTemplate uses TCPDF's regular Helvetica 12.
    const labelSize = originalLayout ? 12 : 16;
    const labelFont = originalLayout ? regularFont : boldFont;
    const characterWidths = new Map<string, number>();
    const measureOriginalCharacter = (character: string): number => {
      const cached = characterWidths.get(character);
      if (cached !== undefined) return cached;
      const width = regularFont.widthOfTextAtSize(character, labelSize);
      characterWidths.set(character, width);
      return width;
    };
    const measureLine = (value: string): number => originalLayout
      ? Array.from(value).reduce((width, character) => width + measureOriginalCharacter(character), 0)
      : labelFont.widthOfTextAtSize(value, labelSize);
    const labelLines = originalLayout ? wrapOriginalPdfText(label, measureOriginalCharacter)
      : wrapPdfText(label, A4_WIDTH - PAGE_MARGIN * 2, measureLine);

    if (!originalLayout) page.drawText("Attachment capture page", {
      x: PAGE_MARGIN,
      y: A4_HEIGHT - PAGE_MARGIN,
      size: 10,
      font: regularFont,
      color: rgb(0.28, 0.34, 0.44)
    });
    labelLines.forEach((line, lineIndex) => {
      if (originalLayout && lineIndex > 0 && lineIndex % ORIGINAL_LINES_PER_PAGE === 0) {
        page = pdf.addPage([ORIGINAL_PAGE_WIDTH, A4_HEIGHT]);
      }
      if (originalLayout && !line) return;
      const lineWidth = measureLine(line);
      page.drawText(line, {
        x: (page.getWidth() - lineWidth) / 2,
        y: originalLayout
          ? A4_HEIGHT - ORIGINAL_BASELINE_FROM_TOP - (lineIndex % ORIGINAL_LINES_PER_PAGE) * ORIGINAL_LINE_HEIGHT
          : A4_HEIGHT - PAGE_MARGIN - 38 - lineIndex * 22,
        size: labelSize,
        font: labelFont,
        color: originalLayout ? rgb(0, 0, 0) : rgb(0.06, 0.09, 0.15)
      });
    });

    const qrPng = await QRCode.toBuffer(attachment.attachmentId, {
      errorCorrectionLevel: "L",
      margin: originalLayout ? 0 : 2,
      type: "png",
      width: 640
    });
    const qrImage = await pdf.embedPng(qrPng);
    // Current Original AttachmentTemplate: A4, QRCODE,L, 20/20/40/40 mm.
    // PDF coordinates start at the bottom; retain the Rewrite layout by default.
    const qrSize = originalLayout ? 40 * mm : 226.77;
    const qrX = originalLayout ? 20 * mm : (A4_WIDTH - qrSize) / 2;
    const qrY = originalLayout ? A4_HEIGHT - 60 * mm
      : A4_HEIGHT - PAGE_MARGIN - 38 - labelLines.length * 22 - qrSize - 40;
    if (!originalLayout) page.drawRectangle({
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

    // Source prints the authored label and QR, without the Rewrite handoff
    // caption, repeated attachment code or page footer.
    if (originalLayout) continue;

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
