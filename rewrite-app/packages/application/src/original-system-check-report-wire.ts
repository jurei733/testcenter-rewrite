import type { SystemCheckReport } from "@testcenter-rewrite-app/domain";
import type { OriginalReportFormat } from "@testcenter-rewrite-app/contracts";

import { formatOriginalReportCsv } from "./original-report-csv.js";
import { encodeOriginalReportJson } from "./original-workspace-report-wire.js";

export const originalSystemCheckSections = ["environment", "network", "questionnaire", "unit"] as const;
export type OriginalSystemCheckSections = Partial<Record<
  typeof originalSystemCheckSections[number], Array<Record<string, unknown>>
>>;

const deprecatedSections = ["envData", "netData", "questData", "unitData"] as const;
type ReportEntry = { label: string; value: string | number | boolean | null };
type ImportSection = typeof deprecatedSections[number] | typeof originalSystemCheckSections[number] | "fileData";
export type OriginalSystemCheckImportDocument = Partial<Record<ImportSection, ReportEntry[]>> & {
  title?: string;
  checkId?: string;
  checkLabel?: string;
  date?: string;
  responses?: unknown;
  keyPhrase?: "";
};

type RecordWithWireData = {
  report: SystemCheckReport;
  nativeSections?: OriginalSystemCheckSections;
  nativeImportDocument?: OriginalSystemCheckImportDocument;
};
type FileEntry = { id: string; label: string; value: string };

const importSections = new Set<string>([...deprecatedSections, ...originalSystemCheckSections, "fileData"]);
const scalar = (value: unknown) => value === null || typeof value === "string" ||
  typeof value === "boolean" || typeof value === "number" && Number.isFinite(value);

function importEntries(value: unknown): ReportEntry[] | undefined {
  if (!Array.isArray(value) || value.length > 200) return undefined;
  return value.flatMap(candidate => {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return [];
    const entry = candidate as Record<string, unknown>;
    if (typeof entry.label !== "string" || !scalar(entry.value)) return [];
    return [Object.fromEntries(Object.entries(entry).filter(([key, field]) =>
      ["id", "type", "label", "value", "warning"].includes(key) && scalar(field)
    )) as ReportEntry];
  });
}

export function captureOriginalSystemCheckImport(source: Record<string, unknown>): OriginalSystemCheckImportDocument {
  const document = new Map<string, unknown>();
  for (const [key, value] of Object.entries(source)) {
    if (key === "keyPhrase") document.set(key, "");
    else if (key === "responses") document.set(key, value);
    else if (["title", "checkId", "checkLabel", "date"].includes(key) && typeof value === "string") document.set(key, value);
    else if (importSections.has(key)) {
      const entries = importEntries(value);
      if (entries !== undefined) document.set(key, entries);
    }
  }
  return Object.fromEntries(document);
}

export function originalSystemCheckReportIdentity({report,nativeImportDocument}: RecordWithWireData) {
  if (!nativeImportDocument) return {id:report.checkId,label:report.checkLabel,title:report.title};
  const value = (value: string | undefined) => value && value !== "0" ? value : "--";
  return {id:value(nativeImportDocument.checkId),label:value(nativeImportDocument.checkLabel),
    title:value(nativeImportDocument.title)};
}

export function originalSystemCheckReportFields(
  {report,nativeImportDocument}: RecordWithWireData, fileData: FileEntry[]
): ReportEntry[] {
  if (!nativeImportDocument) return [...fileData, ...originalSystemCheckSections.flatMap(section => report[section])];
  const from = (section: ImportSection) => nativeImportDocument[section] ?? [];
  return [...deprecatedSections.flatMap(from), ...from("fileData"), ...fileData,
    ...originalSystemCheckSections.flatMap(from)];
}

export function originalSystemCheckDigest(report: SystemCheckReport, document?: OriginalSystemCheckImportDocument): { os: string; browser: string } {
  const entries = document ? document.environment ?? [] : report.environment;
  const value = (label: string) => {
    const entry = entries.find(entry => entry.label === label)?.value;
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
  for (const record of records) {
    const {id,label} = originalSystemCheckReportIdentity(record);
    let group = groups.get(id);
    if (!group) {
      group = {id, count: 0, label, details: {
        os: Object.create(null), browser: Object.create(null)
      }};
      groups.set(id, group);
    }
    group.count++;
    const {os, browser} = originalSystemCheckDigest(record.report, record.nativeImportDocument);
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
    return encodeOriginalReportJson(records.map(({report, nativeSections, nativeImportDocument}) => nativeImportDocument ? ({
      ...nativeImportDocument,
      fileData: [...(nativeImportDocument.fileData ?? []), ...fileData(report)]
    }) : ({
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
  const rows = records.map(record => {
    const {report,nativeImportDocument} = record;
    const {id,label,title} = originalSystemCheckReportIdentity(record);
    const answers = nativeImportDocument ? nativeImportDocument.responses : report.responses;
    const empty = answers == null || answers === "" || answers === "0" || answers === false ||
      answers === 0 || (Array.isArray(answers) && answers.length === 0);
    const row = new Map<string, unknown>([
      ["Titel", title],
      ["SysCheck-Id", id],
      ["SysCheck", label],
      ["Responses", empty ? "" : encodeOriginalReportJson(answers)]
    ]);
    for (const entry of originalSystemCheckReportFields(record,fileData(report))) {
      row.set(entry.label, entry.value);
    }
    for (const header of row.keys()) headers.add(header);
    return Object.fromEntries(row);
  });
  return formatOriginalReportCsv([...headers], rows);
}
