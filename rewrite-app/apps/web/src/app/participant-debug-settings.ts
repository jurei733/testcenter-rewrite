import type { ParticipantExecutionModeDefinition } from "@testcenter-rewrite-app/domain";

// BookletConfigData / TestModeData at Original ee2ab9ab64bd91209ef8534bbe6005838024e46d.
const defaults: Readonly<Record<string, string>> = {
  loading_mode: "LAZY",
  logPolicy: "rich",
  browserBehaviour: "standard",
  pagingMode: "separate",
  force_presentation_complete: "OFF",
  force_response_complete: "OFF",
  unit_time_left_warnings: "5,1",
  show_end_button_in_player: "OFF",
  restore_current_page_on_return: "OFF",
  allow_player_to_terminate_test: "ON",
  lock_test_on_termination: "OFF",
  ask_for_fullscreen: "OFF",
  unit_responses_buffer_time: "5000",
  unit_state_buffer_time: "6000",
  test_state_buffer_time: "1000",
  header_hidden: "FALSE",
  header_content: "BOOKLET_LABEL",
  navbar_unit_label: "INDEX",
  navbar_unit_controls_hidden: "FALSE",
  navbar_page_label: "INDEX",
  navbar_page_controls_hidden: "FALSE",
  navbar_backward_button: "HIDDEN",
  navbar_forward_button: "HIDDEN",
  toolbar_unit_label: "LABEL",
  toolbar_show_unit_list: "FALSE",
  toolbar_show_fullscreen_button: "FALSE",
  toolbar_show_reload_button: "FALSE",
  toolbar_show_time_left: "FALSE",
  silent_mode: "FALSE",
  page_navibuttons: "INDEX",
  unit_navibuttons: "INDEX",
  unit_menu: "OFF",
  unit_screenheader: "EMPTY",
  toolbar_show_unit_title: "TRUE",
  unit_title: "ON",
  unit_show_time_left: "OFF",
  show_fullscreen_button: "OFF",
  show_reload_button: "OFF",
  ui_mode: "ALL",
};

export const participantDebugConfigEntries = (config: Record<string, string>): Array<[string, string]> =>
  Object.entries(defaults).map(([key, fallback]) => [key, config[key] ?? fallback]);

export const participantDebugModeEntries = (mode: ParticipantExecutionModeDefinition): Array<[string, string]> => [
  ["alwaysNewSession", String(mode.alwaysNewSession)],
  ["canReview", String(mode.canReview)],
  ["saveResponses", String(mode.saveResponses)],
  ["forceTimeRestrictions", String(mode.forceTimeRestrictions)],
  ["forceNaviRestrictions", String(mode.forceNaviRestrictions)],
  ["monitorable", String(mode.monitorable)],
  ["showCode", String(mode.showCode)],
  ["showTimeLeft", String(mode.showTimeLeft)],
  ["showUnitMenu", String(mode.showUnitMenu)],
  ["receiveRemoteCommands", String(mode.receiveRemoteCommands)],
  ["canChangeStateOptions", String(mode.canChangeStateOptions)],
  ["lockAfterFailedLogins", "false"], ["modeId", mode.mode.toUpperCase()], ["modeLabel", mode.label]
];
