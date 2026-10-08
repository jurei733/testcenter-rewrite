export type OriginalReportFormat = "csv" | "json";

/** Testcenter 19 ReportFormat::fromAcceptHeader: first supported entry wins.
 * Parameters (including quality values) do not select the format. Wildcards,
 * missing and unknown entries fall back to the route's documented default.
 */
export const selectOriginalReportFormat = (
  acceptHeader: string | undefined,
  defaultFormat: OriginalReportFormat
): OriginalReportFormat => {
  for (const entry of (acceptHeader ?? "").split(",")) {
    const mediaType = entry.split(";", 1)[0]?.trim().toLowerCase();
    if (mediaType === "text/csv") return "csv";
    if (mediaType === "application/json") return "json";
  }
  return defaultFormat;
};
