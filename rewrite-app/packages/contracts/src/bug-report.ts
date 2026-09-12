export const BUG_REPORT_MAX_TITLE_LENGTH = 200;
export const BUG_REPORT_MAX_TAG_LENGTH = 50;
export const BUG_REPORT_MAX_REPORT_LENGTH = 32_768;

export type BugReportConfigResponse = {
  enabled: boolean;
  target: string | null;
};

export type SubmitBugReportRequest = {
  title: string;
  tag: string;
  report: string;
};

export type SubmitBugReportResponse = {
  success: true;
  message: string;
  issueUrl: string;
};

export type BugReportContext = {
  errorId: string;
  label: string;
  message: string;
  timestamp: string;
  url: string;
  userAgent: string;
  buildRef?: string | null;
  details?: string | null;
  stack?: string | null;
  previousErrors?: string[];
};

const secretKeyPattern =
  /((?:"|')?(?:password|passwd|pwd|pw|token|authorization|cookie|secret|api[_-]?key)(?:"|')?\s*[:=]\s*)(?:"[^"]*"|'[^']*'|[^\s,;&}]+)/gi;
const bearerPattern = /\bBearer\s+[^\s,;]+/gi;
const jwtPattern = /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g;
const urlPattern = /https?:\/\/[^\s<>"']+/gi;
const sensitiveHeaderPattern =
  /(\b(?:authorization|proxy-authorization|cookie|set-cookie)\s*:\s*)[^\r\n]*/gi;

const stripUrlCredentialsAndParameters = (value: string): string => {
  const trailingPunctuation = value.match(/[),.;:!?]+$/)?.[0] ?? "";
  const candidate = trailingPunctuation
    ? value.slice(0, -trailingPunctuation.length)
    : value;
  try {
    const url = new URL(candidate);
    url.username = "";
    url.password = "";
    url.search = "";
    url.hash = "";
    return `${url.toString()}${trailingPunctuation}`;
  } catch {
    return value;
  }
};

export const redactBugReportText = (value: string): string =>
  value
    .replace(urlPattern, stripUrlCredentialsAndParameters)
    .replace(sensitiveHeaderPattern, "$1[REDACTED]")
    .replace(bearerPattern, "Bearer [REDACTED]")
    .replace(jwtPattern, "[REDACTED]")
    .replace(secretKeyPattern, "$1[REDACTED]");

const section = (label: string, value: string | null | undefined): string[] =>
  value?.trim() ? [`## ${label}`, value.trim(), ""] : [];

export const buildBugReportText = (context: BugReportContext): string => {
  const content = [
    "# Testcenter error report",
    "",
    `Error ID: ${context.errorId}`,
    `Type: ${context.label}`,
    `Timestamp: ${context.timestamp}`,
    `Build: ${context.buildRef?.trim() || "unknown"}`,
    `URL: ${context.url}`,
    `Browser / device: ${context.userAgent}`,
    "",
    ...section("Message", context.message),
    ...section("Details", context.details),
    ...section("Stack", context.stack),
    ...(context.previousErrors?.length
      ? ["## Previous errors", ...context.previousErrors.map(error => `- ${error}`), ""]
      : [])
  ].join("\n");

  return redactBugReportText(content).slice(0, BUG_REPORT_MAX_REPORT_LENGTH);
};
