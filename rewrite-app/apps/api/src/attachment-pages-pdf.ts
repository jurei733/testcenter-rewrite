import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import QRCode from "qrcode";

import type { WorkspaceAttachment } from "@testcenter-rewrite-app/domain";

const DEFAULT_LABEL_TEMPLATE = "%TESTTAKER% | %BOOKLET% | %UNIT% | %VAR%";
const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;
const PAGE_MARGIN = 56.69;

const toPdfSafeText = (value: string): string =>
  value
    .replace(/[\u2010-\u2015]/g, "-")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[^\u0020-\u007e\u00a0-\u00ff]/g, "?");

const applyAttachmentLabelTemplate = (
  attachment: WorkspaceAttachment,
  labelTemplate?: string | null
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
    labelTemplate?.trim() || DEFAULT_LABEL_TEMPLATE
  );
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
}): Promise<Buffer> => {
  if (input.attachments.length === 0) {
    throw new Error("At least one attachment is required for a QR page PDF.");
  }

  const pdf = await PDFDocument.create();
  pdf.setCreator("IQB Testcenter Rewrite");
  pdf.setProducer("IQB Testcenter Rewrite");
  pdf.setTitle(
    input.attachments.length === 1
      ? applyAttachmentLabelTemplate(
          input.attachments[0]!,
          input.labelTemplate
        )
      : `Attachment QR pages - ${input.attachments.length} requests`
  );
  pdf.setSubject("Printable QR handoff pages for participant attachments");
  const regularFont = await pdf.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdf.embedFont(StandardFonts.HelveticaBold);

  for (const [index, attachment] of input.attachments.entries()) {
    const page = pdf.addPage([A4_WIDTH, A4_HEIGHT]);
    const label = toPdfSafeText(
      applyAttachmentLabelTemplate(attachment, input.labelTemplate)
    );
    const labelSize = 16;
    const labelLines = wrapPdfText(
      label,
      A4_WIDTH - PAGE_MARGIN * 2,
      value => boldFont.widthOfTextAtSize(value, labelSize)
    );

    page.drawText("Attachment capture page", {
      x: PAGE_MARGIN,
      y: A4_HEIGHT - PAGE_MARGIN,
      size: 10,
      font: regularFont,
      color: rgb(0.28, 0.34, 0.44)
    });
    labelLines.forEach((line, lineIndex) => {
      const lineWidth = boldFont.widthOfTextAtSize(line, labelSize);
      page.drawText(line, {
        x: (A4_WIDTH - lineWidth) / 2,
        y: A4_HEIGHT - PAGE_MARGIN - 38 - lineIndex * 22,
        size: labelSize,
        font: boldFont,
        color: rgb(0.06, 0.09, 0.15)
      });
    });

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
    const codeLines = wrapPdfText(
      attachment.attachmentId,
      A4_WIDTH - PAGE_MARGIN * 2,
      value => regularFont.widthOfTextAtSize(value, codeSize)
    );
    page.drawText("Attachment code", {
      x: PAGE_MARGIN,
      y: qrY - 52,
      size: 9,
      font: boldFont,
      color: rgb(0.28, 0.34, 0.44)
    });
    codeLines.forEach((line, lineIndex) => {
      page.drawText(line, {
        x: PAGE_MARGIN,
        y: qrY - 67 - lineIndex * 11,
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

  return Buffer.from(await pdf.save());
};
