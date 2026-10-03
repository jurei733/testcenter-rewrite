// IQB Testcenter 19 CSV::build/cell dialect: UTF-8 BOM, semicolons, quoted
// non-null cells (including headers), doubled quotes and LF row boundaries.
export const originalReportCsvCell = (value: unknown): string => {
  if (value == null) return "";
  const text = typeof value === "boolean" ? (value ? "1" : "") : String(value);
  return `"${text.replace(/"/g, '""')}"`;
};

export const formatOriginalReportCsv = (
  columns: readonly string[],
  rows: ReadonlyArray<Readonly<Record<string, unknown>>>
): string => `\uFEFF${[
  columns.map(originalReportCsvCell).join(";"),
  ...rows.map(row => columns.map(column => originalReportCsvCell(row[column])).join(";"))
].join("\n")}`;
