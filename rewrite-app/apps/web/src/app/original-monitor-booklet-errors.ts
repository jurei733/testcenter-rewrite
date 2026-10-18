import type { OpenMonitorRun } from "@testcenter-rewrite-app/domain";

// Current Original renders these fixed diagnostics; former custom-text keys
// must not override them or appear in the configurable monitor catalog.
export function originalMonitorBookletErrorText(error: OpenMonitorRun["bookletError"]): string | null {
  switch (error) {
    case "missing-id": return "Fehler beim Lesen der Testheft-Datei: Kein Testheft zugeordnet.";
    case "missing-file": return "Fehler beim Lesen der Testheft-Datei: Datei nicht gefunden.";
    case "xml": return "Fehler beim Lesen der Testheft-Datei: Invalides XML-Format.";
    case "general": return "Fehler beim Lesen der Testheft-Datei.";
    default: return null;
  }
}
