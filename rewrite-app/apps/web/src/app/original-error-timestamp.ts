// Source uses DatePipe's fixed en-US medium format in the browser's local zone.
// Format its exact fields with the platform API; Intl's literal spacing differs
// between browsers, so retain Source's punctuation and ordinary space before AM/PM.
export function originalErrorTimestamp(timestamp: number): string {
  const fields = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
    year: "numeric", month: "short", day: "numeric", hour: "numeric",
    minute: "2-digit", second: "2-digit", hour12: true
  }).formatToParts(timestamp).map(part => [part.type, part.value]));
  return `${fields.month} ${fields.day}, ${fields.year}, ${fields.hour}:${fields.minute}:${fields.second} ${fields.dayPeriod}`;
}
