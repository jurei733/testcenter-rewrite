import type { IncomingMessage } from "node:http";
import { TLSSocket } from "node:tls";
import { parseFragment, type DefaultTreeAdapterTypes } from "parse5";
import { originalXmlSchemaPolicy } from "@testcenter-rewrite-app/application";
import {
  SUPPORTED_VERONA_PLAYER_API_MAJOR_MAX,
  SUPPORTED_VERONA_PLAYER_API_MAJOR_MIN,
  originalTestcenterSupportedBrowsers,
  type ProofOfWorkScope
} from "@testcenter-rewrite-app/contracts";
import type { ApplicationSettings } from "@testcenter-rewrite-app/domain";

export const isOriginalSystemConfigPath = (path: string): boolean =>
  path === "/system/config" || path === "/api/system/config";

const noticeElements = new Set([
  "a", "abbr", "b", "blockquote", "br", "caption", "code", "dd", "del", "div", "dl",
  "dt", "em", "h1", "h2", "h3", "h4", "h5", "h6", "hr", "i", "li", "ol", "p",
  "pre", "s", "small", "span", "strong", "sub", "sup", "table", "tbody", "td",
  "th", "thead", "tr", "u", "ul"
]);
const ignoredNoticeElements = new Set(["script", "style", "template", "iframe", "object", "embed"]);
const noticeVoidElements = new Set(["br", "hr"]);
const escapeHtml = (text: string): string => text.replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

function publicNoticeLink(value: string): boolean {
  try {
    return ["http:", "https:", "mailto:", "tel:"].includes(
      new URL(value, "https://notice.invalid").protocol
    );
  } catch {
    return false;
  }
}

// Legacy Original clients trust these three notice fields as HTML.
function serializeNoticeNode(node: DefaultTreeAdapterTypes.ChildNode, depth: number): string {
  if (depth > 64) return "";
  if ("value" in node) return escapeHtml(node.value);
  if (!("tagName" in node) || node.namespaceURI !== "http://www.w3.org/1999/xhtml" ||
      ignoredNoticeElements.has(node.tagName)) return "";
  const name = node.tagName;
  const children = node.childNodes.map(child => serializeNoticeNode(child, depth + 1)).join("");
  if (!noticeElements.has(name)) return children;
  if (noticeVoidElements.has(name)) return `<${name}>`;
  const href = name === "a" ? node.attrs.find(attribute => attribute.name === "href")?.value : undefined;
  const link = href && publicNoticeLink(href) ? ` href="${escapeHtml(href)}"` : "";
  return `<${name}${link}>${children}</${name}>`;
}

const publicNoticeHtml = (html: string): string =>
  parseFragment(html).childNodes.map(node => serializeNoticeNode(node, 0)).join("");

function requestBaseUrl(request: IncomingMessage, pathname: string): string {
  const host = request.headers.host;
  if (!host || !/^(?:[a-z0-9.-]+|\[[a-f0-9:.]+\])(?::[0-9]+)?$/i.test(host)) return "";
  const protocol = request.socket instanceof TLSSocket && request.socket.encrypted ? "https" : "http";
  try {
    const origin = new URL(`${protocol}://${host}`).origin;
    return pathname === "/api/system/config" ? `${origin}/api` : origin;
  } catch {
    return "";
  }
}

function warningExpiration(expiresAt: string | null, timeZone: string): {day: string; hour: string} {
  const expiry = expiresAt ? new Date(expiresAt) : null;
  if (!expiry || !Number.isFinite(expiry.getTime())) return { day: "", hour: "" };
  const fields = new Intl.DateTimeFormat("en-CA", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23"
  }).formatToParts(expiry);
  const part = (type: Intl.DateTimeFormatPartTypes) => fields.find(field => field.type === type)!.value;
  return { day: `${part("year")}-${part("month")}-${part("day")}`, hour: part("hour") };
}

const nativeProtectionScope = {admin: "admin", participant: "login", second_code: "person"} as const;

export function projectOriginalSystemConfig(input: {
  request: IncomingMessage;
  pathname: string;
  settings: ApplicationSettings;
  commitSha: string | null;
  challengeScopes: readonly ProofOfWorkScope[];
  passwordPolicy: { minimumLength: number; pattern: string };
  timeZone: string;
}) {
  const {settings} = input;
  const warningExpiry = warningExpiration(settings.globalWarningExpiresAt, input.timeZone);
  const revision = input.commitSha && /^[0-9a-f]{7,40}$/i.test(input.commitSha)
    ? ` ${input.commitSha.slice(0, 12)}` : "";
  return {
    version: `Rewrite${revision}`,
    // The Original client stores its text subjects in a plain object.
    customTexts: Object.fromEntries(Object.entries(settings.customTexts)
      .filter(([key]) => !Object.hasOwn(Object.prototype, key))),
    appConfig: {
      appTitle: settings.appTitle,
      themeName: settings.themeName,
      legalNoticeHtml: publicNoticeHtml(settings.legalNoticeHtml),
      privacyNotice: publicNoticeHtml(settings.privacyNotice),
      accessibilityNotice: publicNoticeHtml(settings.accessibilityNotice),
      globalWarningText: settings.globalWarningText ?? "",
      globalWarningExpiredDay: warningExpiry.day,
      globalWarningExpiredHour: warningExpiry.hour
    },
    baseUrl: requestBaseUrl(input.request, input.pathname),
    bruteForceProtection: input.challengeScopes.map(scope => nativeProtectionScope[scope]),
    veronaPlayerApiVersionMin: SUPPORTED_VERONA_PLAYER_API_MAJOR_MIN,
    veronaPlayerApiVersionMax: SUPPORTED_VERONA_PLAYER_API_MAJOR_MAX,
    // The Original wire advertises the standard response profile it shipped.
    iqbStandardResponseTypeMin: 1,
    iqbStandardResponseTypeMax: 1,
    xmlSchemaVersions: originalXmlSchemaPolicy,
    // Rewrite resolves both native resource delivery and collaboration on its own origin.
    fileServiceUri: "",
    broadcastingServiceUri: "",
    supportedBrowsers: originalTestcenterSupportedBrowsers,
    passwordMinLength: input.passwordPolicy.minimumLength,
    passwordPattern: input.passwordPolicy.pattern
  };
}
