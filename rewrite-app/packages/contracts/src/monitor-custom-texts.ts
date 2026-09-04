import { formatOriginalCustomText } from "./participant-custom-texts.js";

export const originalMonitorCustomTextDefaults = {
  gm_headline: "Gruppenüberwachung",
  gm_show_monitor: "Testgruppen-Überwachung",
  gm_show_test: "Testhefte anzeigen",
  gm_menu_filter: "Sitzungen ausblenden",
  gm_menu_cols: "Spalten",
  gm_menu_cols_states: "Zustände",
  gm_col_personLabel: "Teilnehmer",
  gm_col_state: "Aktivität",
  gm_col_groupName: "Gruppe",
  gm_col_bookletLabel: "Testheft",
  gm_col_blockLabel: "Block",
  gm_col_unitLabel: "Aufgabe",
  gm_view_full: "Vollständig",
  gm_view_medium: "Nur Blöcke",
  gm_view_small: "Kurz",
  gm_controls: "Test-Steuerung",
  gm_selection_info: "%s %s Test%s mit %s Testheft%s ausgewählt.",
  gm_selection_info_none: "Kein Test gewählt.",
  gm_control_resume: "Weiter",
  gm_control_pause: "Pause",
  gm_control_goto: "Springe zu",
  gm_control_unlock: "Test Entsperren",
  gm_control_goto_unlock_blocks_confirm_text:
    "Zeit wiederherstellen bei Sprung in zeitgesteuerten Block?",
  gm_control_goto_unlock_blocks_confirm_headline: "Sprung bestätigen",
  gm_control_unlock_success_warning:
    "ACHTUNG! Die betreffenden Browser und diese Testleiterkonsole müssen ggf. neu gestartet werden.",
  gm_control_finish_everything: "Testung beenden",
  gm_settings_tooltip: "Ansicht",
  gm_scroll_down: "Ganz nach unten",
  gm_hide_controls_tooltip: "Test-Steuerung verbergen",
  gm_control_unlock_tooltip: "Test Freigeben",
  gm_filter_locked: "gesperrte",
  gm_filter_pending: "nicht gestartete",
  gm_filter_target_mode: "Durchführungsmodus",
  gm_filter_target_bookletId: "Booklet-Id",
  gm_filter_target_unitId: "Aufgaben-Id",
  gm_filter_target_blockId: "Block-Id",
  gm_filter_target_bookletSpecies: "Testhefttyp",
  gm_filter_target_groupName: "Gruppe",
  gm_filter_target_testState: "Detaillierter Teststatus",
  gm_filter_target_bookletStates: "Testheft-Zustand",
  gm_filter_type_equal: "gleicht",
  gm_filter_type_substring: "enthält",
  gm_filter_type_regex: "matched regulären Ausdruck",
  gm_filter_not: "nicht",
  gm_codetoenter_unlock_tooltip: "Block wurde geöffnet",
  gm_timeleft_tooltip: "Verbleibende Zeit: %s von %s Minute(n)",
  gm_timeup_tooltip: "Zeit abgelaufen",
  gm_timemax_tooltip: "Zeitgesteuerter Block: %s Minute(n)",
  gm_booklet_error_missing_id: "Kein Testheft zugeordnet!",
  gm_booklet_error_missing_file: "Kein Zugriff auf Testheft-Datei!",
  gm_booklet_error_xml: "Konnte Testheft-Datei nicht lesen!",
  gm_booklet_error_general: "Fehler beim Zugriff auf Testheft-Datei!",
  gm_control_goto_tooltip: "Bitte Block auswählen",
  gm_multiple_booklet_species_warning:
    " - Die verwendeten Booklets sind zu unterschiedlich, um gemeinsam gesteuert zu werden.",
  gm_auto_checkall: "Alle Tests gleichzeitig steuern",
  gm_selection_text: "Überwachung starten",
  gm_selection_text_expired: "Gruppe abgelaufen seit %date.",
  gm_selection_text_scheduled: "Gruppe erst freigegeben ab %date."
} as const;

export type MonitorCustomTextKey = keyof typeof originalMonitorCustomTextDefaults;

export const originalMonitorCustomTextKeys = Object.freeze(
  Object.keys(originalMonitorCustomTextDefaults) as MonitorCustomTextKey[]
);

export const mergeMonitorCustomTextScopes = (
  globalCustomTexts: Readonly<Record<string, string>> | null | undefined,
  loginCustomTexts: Readonly<Record<string, string>> | null | undefined
): Record<string, string> => ({
  ...(globalCustomTexts ?? {}),
  ...(loginCustomTexts ?? {})
});

export const resolveMonitorCustomText = (
  customTexts: Readonly<Record<string, string>> | null | undefined,
  key: MonitorCustomTextKey,
  fallback: string = originalMonitorCustomTextDefaults[key]
): string => customTexts?.[key]?.trim() || fallback;

export const formatMonitorCustomText = (
  customTexts: Readonly<Record<string, string>> | null | undefined,
  key: MonitorCustomTextKey,
  replacements: ReadonlyArray<string | number>,
  fallback: string = originalMonitorCustomTextDefaults[key]
): string =>
  formatOriginalCustomText(
    resolveMonitorCustomText(customTexts, key, fallback),
    replacements
  );

export const formatMonitorDateCustomText = (
  customTexts: Readonly<Record<string, string>> | null | undefined,
  key: "gm_selection_text_expired" | "gm_selection_text_scheduled",
  date: string,
  fallback: string = originalMonitorCustomTextDefaults[key]
): string =>
  resolveMonitorCustomText(customTexts, key, fallback).replace(
    /(?:%|\$)date/g,
    date
  );
