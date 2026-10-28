import { originalParticipantCustomTextDefaults } from "./participant-custom-texts.js";

export const originalSystemCheckCustomTextDefaults = {
  "syscheck_questionsintro": "Bitte bearbeiten Sie die nachfolgenden Fragen.",
  "syscheck_questionsRequiredMessage": "Bitte prüfen Sie die Eingaben (unvollständig):",
  "syscheck_unitPrompt": "Bitte prüfen Sie die folgenden Aufgaben-Elemente",
  "syscheck_intro": "Dieser Systemcheck soll gewährleisten, dass das von Ihnen verwendete Endgerät für eine bestimmte Befragung oder Testung geeignet ist.",
  "syscheck_report_id": "Schul-ID",
  "syscheck_report_aboutPassword": "Nur berechtigten Personen ist das Speichern erlaubt. Bitte geben Sie unten das Systemcheck-Kennwort ein, das Sie von der Projektleitung erhalten haben!",
  "syscheck_report_aboutReportId": "Die ermittelten bzw. eingegebenen Informationen werden in der Datenbank so gespeichert, dass eine zusammenfassende Auswertung für eine bestimmte Studie möglich ist. Um den Bericht einem bestimmten Projekt oder einer Studie zuordnen zu können, geben Sie bitte einen kurzen Text ein, der dann als Titel für den Bericht verwendet wird!"
} as const;

export type SystemCheckCustomTextKey = keyof typeof originalSystemCheckCustomTextDefaults;
export type SystemCheckPresentationTextKey = SystemCheckCustomTextKey | "login_pagesNaviPrompt";

export const originalSystemCheckCustomTextKeys = /* @__PURE__ */ Object.freeze(
  /* @__PURE__ */ Object.keys(originalSystemCheckCustomTextDefaults) as SystemCheckCustomTextKey[]
);

export const resolveSystemCheckCustomText = (
  globalCustomTexts: Readonly<Record<string, string>> | null | undefined,
  checkCustomTexts: Readonly<Record<string, string>> | null | undefined,
  key: SystemCheckPresentationTextKey,
  fallback: string
): string => (
  checkCustomTexts?.[key] ?? globalCustomTexts?.[key] ??
  (key === "login_pagesNaviPrompt" ? originalParticipantCustomTextDefaults[key] : originalSystemCheckCustomTextDefaults[key])
) || fallback;
