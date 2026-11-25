import type { SystemCheckReport } from "@testcenter-rewrite-app/domain";
import type { OriginalReportFormat } from "@testcenter-rewrite-app/contracts";

import { formatOriginalReportCsv } from "./original-report-csv.js";
import { encodeOriginalReportJson } from "./original-workspace-report-wire.js";

export const originalSystemCheckSections = ["environment", "network", "questionnaire", "unit"] as const;
export type OriginalSystemCheckSections = Partial<Record<
  typeof originalSystemCheckSections[number], Array<Record<string, unknown>>
>>;

type RecordWithWireData = {
  report: SystemCheckReport;
  nativeSections?: OriginalSystemCheckSections;
};
type FileEntry = { id: string; label: string; value: string };

export function originalSystemCheckDigest(report: SystemCheckReport): { os: string; browser: string } {
  const value = (label: string) => {
    const entry = report.environment.find(entry => entry.label === label)?.value;
    if (typeof entry === "boolean") return entry ? "1" : "";
    return String(entry ?? "");
  };
  return {
    os: value("Betriebssystem") + " " + value("Betriebssystemversion"),
    browser: value("Browser") + " " + value("Browserversion")
  };
}

export type OriginalSystemCheckReportOverview = {
  id: string;
  count: number;
  label: string;
  details: { os: Record<string, number>; browser: Record<string, number> };
};

export function summarizeOriginalSystemCheckReports(records: RecordWithWireData[]): OriginalSystemCheckReportOverview[] {
  const groups = new Map<string, OriginalSystemCheckReportOverview>();
  for (const {report} of records) {
    let group = groups.get(report.checkId);
    if (!group) {
      group = {id: report.checkId, count: 0, label: report.checkLabel, details: {
        os: Object.create(null), browser: Object.create(null)
      }};
      groups.set(report.checkId, group);
    }
    group.count++;
    const {os, browser} = originalSystemCheckDigest(report);
    group.details.os[os] = (group.details.os[os] ?? 0) + 1;
    group.details.browser[browser] = (group.details.browser[browser] ?? 0) + 1;
  }
  return [...groups.values()];
}

export function formatOriginalSystemCheckReports(
  records: RecordWithWireData[],
  format: OriginalReportFormat,
  fileData: (report: SystemCheckReport) => FileEntry[]
): string {
  if (!records.length) return "";
  if (format === "json") {
    return encodeOriginalReportJson(records.map(({report, nativeSections}) => ({
      keyPhrase: "",
      title: report.title,
      environment: nativeSections?.environment ?? report.environment,
      network: nativeSections?.network ?? report.network,
      questionnaire: nativeSections?.questionnaire ?? report.questionnaire,
      unit: nativeSections?.unit ?? report.unit,
      date: report.sourceDate,
      responses: report.responses,
      checkId: report.checkId,
      checkLabel: report.checkLabel,
      fileData: fileData(report)
    })));
  }

  const headers = new Set<string>();
  const rows = records.map(({report}) => {
    const answers = report.responses;
    const empty = answers == null || answers === "" || answers === "0" || answers === false ||
      answers === 0 || (Array.isArray(answers) && answers.length === 0);
    const row = new Map<string, unknown>([
      ["Titel", report.title],
      ["SysCheck-Id", report.checkId],
      ["SysCheck", report.checkLabel],
      ["Responses", empty ? "" : encodeOriginalReportJson(answers)]
    ]);
    for (const entry of [...fileData(report), ...originalSystemCheckSections.flatMap(section => report[section])]) {
      row.set(entry.label, entry.value);
    }
    for (const header of row.keys()) headers.add(header);
    return Object.fromEntries(row);
  });
  return formatOriginalReportCsv([...headers], rows);
}
