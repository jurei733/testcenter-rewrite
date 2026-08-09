export const originalParticipantCustomTextDefaults = {
  booketlet_continueButtonLockedUnit: "Weiter",
  booklet_blockLockedByAfterLeave: "Block kann nicht noch einmal betreten werden",
  booklet_codeToEnterPrompt:
    "Bitte gib das Freigabewort ein, das angesagt wurde!",
  booklet_codeToEnterTitle:
    "Aufgabenblock ist gesperrt, Freigabewort benötigt",
  booklet_codeToEnterWarning:
    "Im Eingabefeld werden automatisch alle Buchstaben groß geschrieben.",
  booklet_console_warning:
    "Du bist offenbar ein richtiger Experte und hast die Konsole geöffnet. Klasse! *sarcastic clapping*\nGehe nun schnell zurück zum Test, du hast sonst nicht genug Zeit für die Aufgaben.",
  booklet_errormessage:
    "Leider gab es ein technisches Problem. Versuche Folgendes:\n\n1. Lade die Seite neu. Drücke dafür die Taste F5 oder am Tablet das Neu-Laden-Symbol oben rechts neben der Internetadresse.\n\nFunktioniert nicht? Dann...\n\n2. Melde dich mit deinen Zugangsdaten in einem anderen Browser neu an (Browser: Mozilla Firefox, Google Chrome, Apple Safari).\n\nFunktioniert auch nicht? Dann...\n\n3. Melde dich mit deinen Zugangsdaten an einem anderen Gerät neu an. Spreche das aber vorher mit der Lehrkraft bzw. Testleitung ab.",
  booklet_loading: "Bitte warten",
  booklet_loadingBlock: "Aufgabenblock wird geladen",
  booklet_loadingUnit: "Aufgabe wird geladen",
  booklet_lockedBlock: "Aufgabenzeit ist abgelaufen",
  booklet_lockedByAfterLeave: "Aufgabe kann nicht noch einmal betreten werden",
  booklet_msgNavigationDeniedText_presentationIncomplete:
    "Es müssen erst alle Audio-Dateien vollständig abgespielt werden und auf allen Seiten bis ganz nach unten gescrollt werden.",
  booklet_msgNavigationDeniedText_responsesIncomplete:
    "Es müssen erst alle Teilaufgaben bearbeitet werden.",
  booklet_msgNavigationDeniedTitle: "Aufgabe darf nicht verlassen werden",
  booklet_msgSoonTimeOver:
    "Du hast noch %s Minute(n) Zeit für die Bearbeitung der Aufgaben in diesem Abschnitt.",
  booklet_msgTimeOver: "Die Bearbeitung des Abschnittes ist beendet.",
  booklet_msgTimerCancelled:
    "Die Bearbeitung des Abschnittes wurde abgebrochen.",
  booklet_msgTimerStarted:
    "Die Bearbeitungszeit für diesen Abschnitt hat begonnen: ",
  booklet_pausedmessage: "Der Test wurde kurz angehalten.",
  booklet_requestFullscreen: "Soll das Vollbild aktiviert werden?",
  booklet_tasklisttitle: "Aufgaben",
  booklet_unitLoading: "Geladen",
  booklet_unitLoadingPending: "In der Warteschleife",
  booklet_unitLoadingUnknownProgress: "Wird geladen",
  "booklet_warningLeaveTextPrompt-testlet":
    "Du verlässt einen Bereich zu dem du später nicht zurückkehren kannst. Trotzdem weiterblättern?",
  "booklet_warningLeaveTextPrompt-unit":
    "Du verlässt eine Aufgabe zu der du später nicht zurückkehren kannst. Trotzdem weiterblättern?",
  booklet_warningLeaveTimerBlockTextPrompt:
    "Du verlässt einen zeitbeschränkten Bereich und kannst nicht zurückkehren. Trotzdem weiterblättern?",
  booklet_warningLeaveTimerBlockTitle: "Aufgabenabschnitt verlassen?",
  "booklet_warningLeaveTitle-testlet": "Aufgabenbereich verlassen?",
  "booklet_warningLeaveTitle-unit": "Aufgabe verlassen?",
  login_bookletSelectPromptMany:
    "Bitte klicke auf eine der Schaltflächen auf der linken Seite, um einen Test zu starten!",
  login_bookletSelectPromptNull:
    "Beendet. Es können keine weiteren Testhefte gestartet werden.",
  login_bookletSelectPromptOne:
    "Bitte klicke auf die Schaltfläche auf der linken Seite, um den Test zu starten!",
  login_codeInputPrompt: "Bitte Log-in eingeben, der auf dem Zettel steht!",
  login_codeInputTitle: "Log-in eingeben",
  login_pagesNaviPrompt: "Weitere Seiten:",
  login_subtitle: "Testauswahl",
  login_testEndButtonLabel: "Test beenden",
  login_testResumeButtonLabel: "Test fortsetzen",
  login_unsupportedBrowser:
    "Ihr Browser <strong>%s %s</strong> wird von dieser Anwendung leider nicht offiziell unterstützt. Dies kann möglicherweise zu Fehlfunktionen führen! <br> Bitte verwenden Sie eine aktuelle Version von Mozilla Firefox, Google Chrome, Microsoft Edge oder Apple Safari.",
  login_unsupportedBrowserBanner:
    "Ihr Browser %s %s ist veraltet und könnte zu Fehlern führen. Bitte verwenden Sie eine aktuelle Version."
} as const;

export type ParticipantCustomTextKey =
  keyof typeof originalParticipantCustomTextDefaults;

export const originalParticipantCustomTextKeys = Object.freeze(
  Object.keys(originalParticipantCustomTextDefaults) as ParticipantCustomTextKey[]
);

export const mergeParticipantCustomTextScopes = (
  globalCustomTexts: Readonly<Record<string, string>> | null | undefined,
  loginCustomTexts: Readonly<Record<string, string>> | null | undefined,
  bookletCustomTexts: Readonly<Record<string, string>> | null | undefined
): Record<string, string> => ({
  ...(globalCustomTexts ?? {}),
  ...(loginCustomTexts ?? {}),
  ...(bookletCustomTexts ?? {})
});

export const resolveParticipantCustomText = (
  customTexts: Readonly<Record<string, string>> | null | undefined,
  key: ParticipantCustomTextKey,
  fallback: string = originalParticipantCustomTextDefaults[key]
): string => customTexts?.[key]?.trim() || fallback;

export const formatOriginalCustomText = (
  template: string,
  replacements: readonly (string | number)[]
): string => {
  let replacementIndex = 0;
  return template.replace(/%s/g, placeholder => {
    if (replacementIndex >= replacements.length) {
      return placeholder;
    }
    const replacement = replacements[replacementIndex];
    replacementIndex += 1;
    return String(replacement);
  });
};

export const resolveAndFormatParticipantCustomText = (
  customTexts: Readonly<Record<string, string>> | null | undefined,
  key: ParticipantCustomTextKey,
  replacements: readonly (string | number)[],
  fallback: string = originalParticipantCustomTextDefaults[key]
): string =>
  formatOriginalCustomText(
    resolveParticipantCustomText(customTexts, key, fallback),
    replacements
  );
