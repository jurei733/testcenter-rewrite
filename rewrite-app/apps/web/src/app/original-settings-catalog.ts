// IQB Testcenter eedae41840cbe90e5547c0211da818bdf620f5aa (MIT).
// Exact labels, authored defaults and insertion order from custom-texts.json.
export const originalSettingsCustomTextCatalog = [
  {
    "key": "login_sidepanel_title",
    "label": "Titel des seitlichen Infobereichs auf der Anmeldeseite",
    "defaultValue": "Willkommen im IQB‑Testcenter",
    "group": "login"
  },
  {
    "key": "login_sidepanel_subtitle",
    "label": "Untertitel des seitlichen Infobereichs auf der Anmeldeseite",
    "defaultValue": "Das IQB-Testcenter ist eine Anwendung des Instituts zur Qualitätsentwicklung im Bildungswesen (IQB) zur Durchführung digitaler Tests und Befragungen. Der Zugang ist mit den Zugangsdaten möglich, die Sie vorab erhalten haben.",
    "group": "login"
  },
  {
    "key": "login_subtitle",
    "label": "Titel für Starter-Seite",
    "defaultValue": "Testauswahl",
    "group": "login"
  },
  {
    "key": "login_testEndButtonLabel",
    "label": "Schalterbeschriftung für 'Test beenden'",
    "defaultValue": "Test beenden",
    "group": "login"
  },
  {
    "key": "login_testResumeButtonLabel",
    "label": "Schalterbeschriftung für 'Test fortsetzen'",
    "defaultValue": "Test fortsetzen",
    "group": "login"
  },
  {
    "key": "booklet_warningLeaveTimerBlockTextPrompt",
    "label": "Schalterbeschriftung für 'Zurück zum Test'",
    "defaultValue": "Du verlässt einen zeitbeschränkten Bereich und kannst nicht zurückkehren.",
    "group": "booklet"
  },
  {
    "key": "booklet_warningLeaveTitle-testlet",
    "label": "Titel für Warnung (Dialogbox) eines nur einmal betretbaren Bereiches.",
    "defaultValue": "Aufgabenbereich verlassen?",
    "group": "booklet"
  },
  {
    "key": "booklet_warningLeaveTitle-unit",
    "label": "Titel für Warnung (Dialogbox) einer nur einmal betretbaren Aufgabe.",
    "defaultValue": "Aufgabe verlassen?",
    "group": "booklet"
  },
  {
    "key": "booklet_warningLeaveTextPrompt-testlet",
    "label": "Text für Warnung (Dialogbox) eines nur einmal betretbaren Bereiches.",
    "defaultValue": "Du verlässt einen Bereich zu dem du später nicht zurückkehren kannst.",
    "group": "booklet"
  },
  {
    "key": "booklet_warningLeaveTextPrompt-unit",
    "label": "Text für Warnung (Dialogbox) eines nur einmal betretbaren Bereiches.",
    "defaultValue": "Du verlässt eine Aufgabe zu der du später nicht zurückkehren kannst.",
    "group": "booklet"
  },
  {
    "key": "booklet_blockLockedByAfterLeave",
    "label": "Block kann nicht noch einmal betreten werden",
    "defaultValue": "Block kann nicht noch einmal betreten werden",
    "group": "booklet"
  },
  {
    "key": "booklet_lockedByAfterLeave",
    "label": "Aufgabe kann nicht noch einmal betreten werden",
    "defaultValue": "Aufgabe kann nicht noch einmal betreten werden",
    "group": "booklet"
  },
  {
    "key": "login_bookletSelectPromptNull",
    "label": "Nachricht für den Fall, dass Booklet(s) beendet wurden und keine weiteren zur Verfügung stehen",
    "defaultValue": "Beendet. Es können keine weiteren Testhefte gestartet werden.",
    "group": "login"
  },
  {
    "key": "login_pagesNaviPrompt",
    "label": "Aufforderungstext, weitere Seiten einer Unit auszuwählen, z. B. 'Wähle hier andere Seiten dieser Aufgabe:'",
    "defaultValue": "Weitere Seiten:",
    "group": "login"
  },
  {
    "key": "login_bookletSelectPromptOne",
    "label": "Aufforderung, den einen gefundenen Test anzuklicken (auf Schalter klicken)",
    "defaultValue": "Bitte klicke auf die Schaltfläche auf der linken Seite, um den Test zu starten!",
    "group": "login"
  },
  {
    "key": "login_bookletSelectPromptMany",
    "label": "Aufforderung, aus der Liste der gefundenen Tests einen auszusuchen (auf Schalter klicken)",
    "defaultValue": "Bitte klicke auf eine der Schaltflächen auf der linken Seite, um einen Test zu starten!",
    "group": "login"
  },
  {
    "key": "login_codeInputPrompt",
    "label": "Aufforderung, Code einzugeben (bei einem zweistufigen Login-Prozess)",
    "defaultValue": "Bitte Log-in eingeben, der auf dem Zettel steht!",
    "group": "login"
  },
  {
    "key": "login_codeInputTitle",
    "label": "Titel des Eingabeformulares für den Code",
    "defaultValue": "Log-in eingeben",
    "group": "login"
  },
  {
    "key": "login_codeInputErrorTitle",
    "label": "Titelzeile des Fehlertext bei falscher Codeinegabe",
    "defaultValue": "Ups, falscher Code!",
    "group": "login"
  },
  {
    "key": "login_codeInputErrorBody",
    "label": "Haupttext des Fehlertext bei falscher Codeinegabe",
    "defaultValue": "Versuche es noch einmal.",
    "group": "login"
  },
  {
    "key": "login_unsupportedBrowser",
    "label": "Warnung-Banner, wenn ein nicht unterstützer Browser verwendet wird. Ersetzungen (%s): Browser-Name, Browser-Version.",
    "defaultValue": "Ihr Browser %s %s ist veraltet und könnte zu Fehlern führen. Bitte verwenden Sie eine aktuelle Version.",
    "group": "login"
  },
  {
    "key": "booklet_msgNavigationDeniedTitle",
    "label": "Titel der Nachricht, dass nicht weitergeblättert werden kann, solange die Aufgabe nicht vollständig bearbeitet / gesehen worden ist.",
    "defaultValue": "Aufgabe darf nicht verlassen werden",
    "group": "booklet"
  },
  {
    "key": "booklet_msgNavigationDeniedText_presentationIncomplete",
    "label": "Text der Nachricht, dass nicht weitergeblättert werden kann, solange die Aufgabe nicht vollständig gesehen worden ist.",
    "defaultValue": "Es müssen erst alle Audio-Dateien vollständig abgespielt werden und auf allen Seiten bis ganz nach unten gescrollt werden.",
    "group": "booklet"
  },
  {
    "key": "booklet_msgNavigationDeniedText_responsesIncomplete",
    "label": "Titel der Nachricht, dass nicht weitergeblättert werden kann, solange die Aufgabe nicht vollständig bearbeitet worden ist.",
    "defaultValue": "Es müssen erst alle Teilaufgaben bearbeitet werden.",
    "group": "booklet"
  },
  {
    "key": "booklet_codeToEnterTitle",
    "label": "Dialogbox für die Eingabe eines Freigabewortes",
    "defaultValue": "Aufgabenblock ist gesperrt, Freigabewort benötigt",
    "group": "booklet"
  },
  {
    "key": "booklet_codeToEnterPrompt",
    "label": "Dialogbox für die Eingabe eines Freigabewortes: Aufforderung für die Eingabe eines Freigabewortes",
    "defaultValue": "Bitte gib das Freigabewort ein, das angesagt wurde!",
    "group": "booklet"
  },
  {
    "key": "booklet_msgTimerStarted",
    "label": "Nachricht, dass der Timer für die Bearbeitung eines Abschnittes gestartet wurde",
    "defaultValue": "Die Bearbeitungszeit für diesen Abschnitt hat begonnen: ",
    "group": "booklet"
  },
  {
    "key": "booklet_msgTimerCancelled",
    "label": "Nachricht, dass die Bearbeitung eines Abschnittes mit Timer abgebrochen wurde",
    "defaultValue": "Die Bearbeitung des Abschnittes wurde abgebrochen.",
    "group": "booklet"
  },
  {
    "key": "booklet_msgSoonTimeOver",
    "label": "Nachricht, dass für die Bearbeitung eines Abschnittes noch x min Zeit ist",
    "defaultValue": "Du hast noch %s Minute(n) Zeit für die Bearbeitung der Aufgaben in diesem Abschnitt.",
    "group": "booklet"
  },
  {
    "key": "booklet_msgTimeOver",
    "label": "Nachricht, dass die Bearbeitungszeit für einen Abschnitt abgelaufen ist.",
    "defaultValue": "Die Bearbeitung des Abschnittes ist beendet.",
    "group": "booklet"
  },
  {
    "key": "booklet_warningLeaveTimerBlockTitle",
    "label": "Titel für Warnung (Dialogbox) vor dem vorzeitigen Verlassen eines Abschnittes mit Timer",
    "defaultValue": "Aufgabenabschnitt verlassen?",
    "group": "booklet"
  },
  {
    "key": "booklet_tasklisttitle",
    "label": "Titel für die Auflistung der Aufgaben (Schalter)",
    "defaultValue": "Aufgaben",
    "group": "booklet"
  },
  {
    "key": "syscheck_questionsintro",
    "label": "Aufforderung, die Fragen (Questionnaire) zu beantworten",
    "defaultValue": "Bitte bearbeiten Sie die nachfolgenden Fragen.",
    "group": "syscheck"
  },
  {
    "key": "booklet_errormessage",
    "label": "Nachricht an die Testperson, wenn ein schwerer Fehler aufgetreten ist",
    "defaultValue": "Leider gab es ein technisches Problem. Versuche Folgendes:\n\n1. Lade die Seite neu. Drücke dafür die Taste F5 oder am Tablet das Neu-Laden-Symbol oben rechts neben der Internetadresse.\n\nFunktioniert nicht? Dann...\n\n2. Melde dich mit deinen Zugangsdaten in einem anderen Browser neu an (Browser: Mozilla Firefox, Google Chrome, Apple Safari).\n\nFunktioniert auch nicht? Dann...\n\n3. Melde dich mit deinen Zugangsdaten an einem anderen Gerät neu an. Spreche das aber vorher mit der Lehrkraft bzw. Testleitung ab.",
    "group": "booklet"
  },
  {
    "key": "booklet_pausedmessage",
    "label": "Nachricht an die Testperson, wenn der Test vom System unterbrochen wurde",
    "defaultValue": "Der Test wurde kurz angehalten.",
    "group": "booklet"
  },
  {
    "key": "booklet_loading",
    "label": "Test wird geladen",
    "defaultValue": "Bitte warten",
    "group": "booklet"
  },
  {
    "key": "booklet_lockedBlock",
    "label": "Zeit von zeitgesteuertem Aufgabenblock ist abgelaufen",
    "defaultValue": "Aufgabenzeit ist abgelaufen",
    "group": "booklet"
  },
  {
    "key": "booklet_requestFullscreen",
    "label": "Text für Dialogfeld 'Vollbild aktivieren?'",
    "defaultValue": "Soll das Vollbild aktiviert werden?",
    "group": "booklet"
  },
  {
    "key": "syscheck_questionsRequiredMessage",
    "label": "Nachricht an die Testperson, wenn einige Fragen, die als 'required' markiert sind, nicht beantwortet wurden",
    "defaultValue": "Bitte prüfen Sie die Eingaben (unvollständig):",
    "group": "syscheck"
  },
  {
    "key": "booklet_starterStartTestButtonLabel",
    "label": "Hauptmenü: Beschriftung für den Knopf um Test zu starten",
    "defaultValue": "Starten",
    "group": "booklet"
  },
  {
    "key": "booklet_starterContinueTestButtonLabel",
    "label": "Hauptmenü: Beschriftung für den Knopf um Test fortzusetzen",
    "defaultValue": "Weiter",
    "group": "booklet"
  },
  {
    "key": "booklet_starterViewTestButtonLabel",
    "label": "Hauptmenü: Beschriftung für den Knopf um Test anzusehen",
    "defaultValue": "Ansehen",
    "group": "booklet"
  },
  {
    "key": "booklet_starterLockedTestButtonLabel",
    "label": "Hauptmenü: Beschriftung für den Knopf bei gesperrtem Test",
    "defaultValue": "Fertig",
    "group": "booklet"
  },
  {
    "key": "syscheck_unitPrompt",
    "label": "Titelzeile über der Aufgabe",
    "defaultValue": "Bitte prüfen Sie die folgenden Aufgaben-Elemente",
    "group": "syscheck"
  },
  {
    "key": "syscheck_intro",
    "label": "Text auf der ersten Seite des Systemchecks",
    "defaultValue": "Dieser Systemcheck soll gewährleisten, dass das von Ihnen verwendete Endgerät für eine bestimmte Befragung oder Testung geeignet ist.",
    "group": "syscheck"
  },
  {
    "key": "syscheck_report_id",
    "label": "Dialog 'Bericht senden': Platzhalter für das ID-Eingabefeld vor dem Senden des Berichts",
    "defaultValue": "Schul-ID",
    "group": "syscheck"
  },
  {
    "key": "syscheck_report_aboutPassword",
    "label": "Dialog 'Bericht senden': Text über das Passworteingabefeld",
    "defaultValue": "Nur berechtigten Personen ist das Speichern erlaubt. Bitte geben Sie unten das Systemcheck-Kennwort ein, das Sie von der Projektleitung erhalten haben!",
    "group": "syscheck"
  },
  {
    "key": "syscheck_report_aboutReportId",
    "label": "Dialog 'Bericht senden': Text über das Passworteingabefeld",
    "defaultValue": "Die ermittelten bzw. eingegebenen Informationen werden in der Datenbank so gespeichert, dass eine zusammenfassende Auswertung für eine bestimmte Studie möglich ist. Um den Bericht einem bestimmten Projekt oder einer Studie zuordnen zu können, geben Sie bitte einen kurzen Text ein, der dann als Titel für den Bericht verwendet wird!",
    "group": "syscheck"
  },
  {
    "key": "gm_headline",
    "label": "Überschrift: Gruppenmonitor",
    "defaultValue": "Gruppenüberwachung",
    "group": "gm"
  },
  {
    "key": "gm_show_monitor",
    "label": "Titel für Monitorfunktion",
    "defaultValue": "Testgruppen-Überwachung",
    "group": "gm"
  },
  {
    "key": "gm_show_test",
    "label": "Titel für Testüberprüfung",
    "defaultValue": "Testhefte anzeigen",
    "group": "gm"
  },
  {
    "key": "gm_menu_filter",
    "label": "Menüeintrag: Sitzungen ausblenden",
    "defaultValue": "Sitzungen ausblenden",
    "group": "gm"
  },
  {
    "key": "gm_menu_cols",
    "label": "Menüeintrag: Spalten",
    "defaultValue": "Spalten",
    "group": "gm"
  },
  {
    "key": "gm_menu_cols_states",
    "label": "Spalte: Booklet-Zustände",
    "defaultValue": "Zustände",
    "group": "gm"
  },
  {
    "key": "gm_col_personLabel",
    "label": "Spalte: Teilnehmer",
    "defaultValue": "Teilnehmer",
    "group": "gm"
  },
  {
    "key": "gm_col_state",
    "label": "Spalte: Aktivität",
    "defaultValue": "Aktivität",
    "group": "gm"
  },
  {
    "key": "gm_col_groupName",
    "label": "Spalte: Gruppe",
    "defaultValue": "Gruppe",
    "group": "gm"
  },
  {
    "key": "gm_col_bookletLabel",
    "label": "Spalte: Testheft",
    "defaultValue": "Testheft",
    "group": "gm"
  },
  {
    "key": "gm_col_blockLabel",
    "label": "Spalte: Block",
    "defaultValue": "Block",
    "group": "gm"
  },
  {
    "key": "gm_col_unitLabel",
    "label": "Spalte: Aufgabe",
    "defaultValue": "Aufgabe",
    "group": "gm"
  },
  {
    "key": "gm_view_full",
    "label": "Ansicht: Vollständig",
    "defaultValue": "Vollständig",
    "group": "gm"
  },
  {
    "key": "gm_view_medium",
    "label": "Ansicht: Nur Blöcke",
    "defaultValue": "Nur Blöcke",
    "group": "gm"
  },
  {
    "key": "gm_view_small",
    "label": "Ansicht: Kurz",
    "defaultValue": "Kurz",
    "group": "gm"
  },
  {
    "key": "gm_controls",
    "label": "Überschrift: Test-Steuerung",
    "defaultValue": "Test-Steuerung",
    "group": "gm"
  },
  {
    "key": "gm_selection_info",
    "label": "Information gewählte Tests. Text-Substitutionen: (Alle/''), Anzahl, (''/s), Anzahl, (''/e)",
    "defaultValue": "%s %s Test%s mit %s Testheft%s ausgewählt.",
    "group": "gm"
  },
  {
    "key": "gm_selection_info_none",
    "label": "Information gewählte Tests: Keiner",
    "defaultValue": "Kein Test gewählt.",
    "group": "gm"
  },
  {
    "key": "gm_control_resume",
    "label": "Control: weiter",
    "defaultValue": "Weiter",
    "group": "gm"
  },
  {
    "key": "gm_control_pause",
    "label": "Control: pause",
    "defaultValue": "Pause",
    "group": "gm"
  },
  {
    "key": "gm_control_goto",
    "label": "Control: Springe zu Block",
    "defaultValue": "Springe zu",
    "group": "gm"
  },
  {
    "key": "gm_control_unlock",
    "label": "Control: Entsperren",
    "defaultValue": "Test Entsperren",
    "group": "gm"
  },
  {
    "key": "gm_control_goto_unlock_blocks_confirm_text",
    "label": "Control: Springe zu Block - soll Zeit wiederhergestellt werden?",
    "defaultValue": "Zeit wiederherstellen bei Sprung in zeitgesteuerten Block?",
    "group": "gm"
  },
  {
    "key": "gm_control_goto_unlock_blocks_confirm_headline",
    "label": "Control: Springe zu Block - soll Zeit wiederhergestellt werden? - Überschrift",
    "defaultValue": "Sprung bestätigen",
    "group": "gm"
  },
  {
    "key": "gm_control_unlock_success_warning",
    "label": "Wird angezeigt, wenn Tests entsperrt wurden",
    "defaultValue": "ACHTUNG! Die betreffenden Browser und diese Testleiterkonsole müssen ggf. neu gestartet werden.",
    "group": "gm"
  },
  {
    "key": "gm_control_finish_everything",
    "label": "Control: Testung beenden",
    "defaultValue": "Testung beenden",
    "group": "gm"
  },
  {
    "key": "gm_settings_tooltip",
    "label": "Control: Ansicht",
    "defaultValue": "Ansicht",
    "group": "gm"
  },
  {
    "key": "gm_scroll_down",
    "label": "Control: Ganz nach unten",
    "defaultValue": "Ganz nach unten",
    "group": "gm"
  },
  {
    "key": "gm_hide_controls_tooltip",
    "label": "Tooltip: Test-Steuerung verbergen",
    "defaultValue": "Test-Steuerung verbergen",
    "group": "gm"
  },
  {
    "key": "gm_control_unlock_tooltip",
    "label": "Tooltip: Freigeben",
    "defaultValue": "Test Freigeben",
    "group": "gm"
  },
  {
    "key": "gm_filter_locked",
    "label": "Filter: gesperrte ausblenden",
    "defaultValue": "gesperrte",
    "group": "gm"
  },
  {
    "key": "gm_filter_pending",
    "label": "Filter: nicht gestartete ausblenden",
    "defaultValue": "nicht gestartete",
    "group": "gm"
  },
  {
    "key": "gm_filter_target_mode",
    "label": "Benutzerdefinierter Filter: Ziel - Modus",
    "defaultValue": "Durchführungsmodus",
    "group": "gm"
  },
  {
    "key": "gm_filter_target_bookletId",
    "label": "Benutzerdefinierter Filter: Ziel - TestheftId",
    "defaultValue": "Booklet-Id",
    "group": "gm"
  },
  {
    "key": "gm_filter_target_unitId",
    "label": "Benutzerdefinierter Filter: Ziel - Aufgaben-Id",
    "defaultValue": "Aufgaben-Id",
    "group": "gm"
  },
  {
    "key": "gm_filter_target_blockId",
    "label": "Benutzerdefinierter Filter: Ziel - Block-Id",
    "defaultValue": "Block-Id",
    "group": "gm"
  },
  {
    "key": "gm_filter_target_bookletSpecies",
    "label": "Benutzerdefinierter Filter: Ziel -Testhefttyp",
    "defaultValue": "Testhefttyp",
    "group": "gm"
  },
  {
    "key": "gm_filter_target_groupName",
    "label": "Benutzerdefinierter Filter: Ziel - Gruppe",
    "defaultValue": "Gruppe",
    "group": "gm"
  },
  {
    "key": "gm_filter_target_testState",
    "label": "Benutzerdefinierter Filter: Ziel - detaillierter Teststatus",
    "defaultValue": "Detaillierter Teststatus",
    "group": "gm"
  },
  {
    "key": "gm_filter_target_bookletStates",
    "label": "Benutzerdefinierter Filter: Ziel - Testheft-Adaptivität-Zustand",
    "defaultValue": "Testheft-Zustand",
    "group": "gm"
  },
  {
    "key": "gm_filter_type_equal",
    "label": "Benutzerdefinierter Filter: Typ - gleicht",
    "defaultValue": "gleicht",
    "group": "gm"
  },
  {
    "key": "gm_filter_type_substring",
    "label": "Benutzerdefinierter Filter: Typ - enthält",
    "defaultValue": "enthält",
    "group": "gm"
  },
  {
    "key": "gm_filter_type_regex",
    "label": "Benutzerdefinierter Filter: Typ - Regulärer Ausdruck",
    "defaultValue": "matched regulären Ausdruck",
    "group": "gm"
  },
  {
    "key": "gm_filter_not",
    "label": "Benutzerdefinierter Filter: Nicht",
    "defaultValue": "nicht",
    "group": "gm"
  },
  {
    "key": "gm_codetoenter_unlock_tooltip",
    "label": "Tooltip Passwort-geschützter Bereich geöffnet",
    "defaultValue": "Block wurde geöffnet",
    "group": "gm"
  },
  {
    "key": "gm_timeleft_tooltip",
    "label": "Tooltip zeitgesteuerter Block: verbleibende Zeit. Ersetzungen (%s): Verbleibende Minuten, Minuten gesamt",
    "defaultValue": "Verbleibende Zeit: %s von %s Minute(n)",
    "group": "gm"
  },
  {
    "key": "gm_timeup_tooltip",
    "label": "Tooltip zeitgesteuerter Block: Zeit abgelaufen",
    "defaultValue": "Zeit abgelaufen",
    "group": "gm"
  },
  {
    "key": "gm_timemax_tooltip",
    "label": "Tooltip zeitgesteuerter Block: Noch nicht gestartet. Ersetzung (%s): Minutenzahl, ",
    "defaultValue": "Zeitgesteuerter Block: %s Minute(n)",
    "group": "gm"
  },
  {
    "key": "gm_control_goto_tooltip",
    "label": "Tooltip über dem 'Springe zu'-Knopf, der erscheint, wenn kein Block gewählt ist",
    "defaultValue": "Bitte Block auswählen",
    "group": "gm"
  },
  {
    "key": "gm_multiple_booklet_species_warning",
    "label": "Tooltip über dem 'Immer alle Auswählen'-Schalter, der erscheint, wenn dieser deaktiviert ist",
    "defaultValue": " - Die verwendeten Booklets sind zu unterschiedlich, um gemeinsam gesteuert zu werden.",
    "group": "gm"
  },
  {
    "key": "gm_auto_checkall",
    "label": "Der 'Immer alle Auswählen'-Schalter",
    "defaultValue": "Alle Tests gleichzeitig steuern",
    "group": "gm"
  },
  {
    "key": "gm_selection_text",
    "label": "Der Text im Button bei Auswahl der Testleitungskonsole",
    "defaultValue": "Überwachung starten",
    "group": "gm"
  },
  {
    "key": "gm_selection_text_expired",
    "label": "Der Text im Button bei Auswahl der Testleitungskonsole, wenn die Gruppe abgelaufen ist. $date wird gegen das Ablaufdatum ersetzt.",
    "defaultValue": "Gruppe abgelaufen seit %date.",
    "group": "gm"
  },
  {
    "key": "gm_selection_text_scheduled",
    "label": "Der Text im Button bei Auswahl der Testleitungskonsole, wenn die noch nicht freigegeben abgelaufen ist. $date wird gegen das Freigabedatum ersetzt.",
    "defaultValue": "Gruppe erst freigegeben ab %date.",
    "group": "gm"
  }
] as const;
