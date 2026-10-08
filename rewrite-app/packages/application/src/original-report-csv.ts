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

export const formatOriginalParticipantLogEntry = (log: {
  unitKey: string | null; logKey: string; logContent: string; originalTimestamp?: 0;
}): string => {
  // TestController::updateTestState quotes the key, not the server value.
  if (log.originalTimestamp === 0 && log.unitKey === null && log.logKey === "CONNECTION") {
    return `${JSON.stringify(log.logKey)} : ${log.logContent}`;
  }
  return log.logContent
    ? `${log.logKey}${log.unitKey ? " = " : " : "}${JSON.stringify(log.logContent)}`
    : log.logKey;
};
