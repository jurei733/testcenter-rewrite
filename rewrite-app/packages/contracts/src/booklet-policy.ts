import type {
  BookletLeaveRestriction,
  BookletNavigationDeniedReason,
  BookletPlayerEndPolicy,
  BookletRuntimePolicy,
  BookletUnitNavigationControls
} from "@testcenter-rewrite-app/domain";

const asRecord = (value: unknown): Record<string, unknown> | null =>
  typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;

const scalarString = (value: unknown): string => {
  if (typeof value === "string") {
    return value.trim();
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return "";
};

export const readBookletConfigValues = (value: unknown): Record<string, string> => {
  if (Array.isArray(value)) {
    return Object.fromEntries(
      value.flatMap(entry => {
        const record = asRecord(entry);
        if (!record) {
          return [];
        }
        const key = scalarString(record.key ?? record.name ?? record.id);
        const content = scalarString(
          record.value ?? record.content ?? record.text ?? record.textContent ?? record._
        );
        return key ? [[key, content] as const] : [];
      })
    );
  }

  const record = asRecord(value);
  if (!record) {
    return {};
  }
  const nestedEntries =
    record.Config ?? record.configEntries ?? record.entries ?? record.settings;
  const nested = nestedEntries ? readBookletConfigValues(nestedEntries) : {};
  const direct = Object.fromEntries(
    Object.entries(record).flatMap(([key, rawValue]) => {
      const isScalar =
        typeof rawValue === "string" ||
        typeof rawValue === "number" ||
        typeof rawValue === "boolean";
      return isScalar ? [[key, scalarString(rawValue)] as const] : [];
    })
  );
  return { ...direct, ...nested };
};

const configReader = (config: Record<string, string>) => {
  const values = new Map(
    Object.entries(config).map(([key, value]) => [key.toLowerCase(), value.trim()])
  );
  return (...keys: string[]): string => {
    for (const key of keys) {
      const value = values.get(key.toLowerCase());
      if (value) {
        return value;
      }
    }
    return "";
  };
};

const choice = <T extends string>(
  value: string,
  choices: readonly T[],
  fallback: T
): T => {
  const normalized = value.trim().toLowerCase();
  return choices.find(candidate => candidate.toLowerCase() === normalized) ?? fallback;
};

const on = (value: string, fallback = false): boolean => {
  if (!value) return fallback;
  return ["on", "true", "yes", "1", "full"].includes(value.toLowerCase());
};

const compileRestriction = (value: string): BookletLeaveRestriction => {
  switch (value.trim().toUpperCase()) {
    case "ALWAYS":
      return "always";
    case "ON":
    case "FORWARD":
      return "forward";
    default:
      return "off";
  }
};

const compilePlayerEnd = (value: string): BookletPlayerEndPolicy => {
  switch (value.trim().toUpperCase()) {
    case "OFF":
    case "NEVER":
      return "never";
    case "LAST_UNIT":
    case "ONLY_LAST_UNIT":
      return "last_unit";
    default:
      return "always";
  }
};

const compileUnitControls = (value: string): BookletUnitNavigationControls => {
  switch (value.trim().toUpperCase()) {
    case "OFF":
    case "HIDDEN":
    case "TRUE":
      return "hidden";
    case "FORWARD_ONLY":
      return "forward_only";
    default:
      return "both";
  }
};

const warningMinutes = (value: string): number[] =>
  [...new Set(
    value
      .split(/[;,\s]+/)
      .map(part => Number.parseFloat(part))
      .filter(minutes => Number.isFinite(minutes) && minutes >= 0)
  )].sort((left, right) => right - left);

export const compileBookletRuntimePolicy = (value: unknown): BookletRuntimePolicy => {
  const sourceConfig = readBookletConfigValues(value);
  const read = configReader(sourceConfig);
  const findSourceValue = (key: string): string | undefined => {
    const entry = Object.entries(sourceConfig).find(
      ([sourceKey]) => sourceKey.toLowerCase() === key.toLowerCase()
    );
    return entry?.[1];
  };
  const legacyUnitControls = read("unit_navibuttons");
  const modernUnitControlsHidden = read("navbar_unit_controls_hidden");
  const playerEnd = read("allow_player_to_terminate_test");
  const headerContent = read("header_content", "unit_screenheader")
    .replace(/^WITH_/, "")
    .replace(/_(?:TITLE|LABEL)$/, "");

  return {
    version: 1,
    sourceConfig,
    navigation: {
      requirePresentationComplete: compileRestriction(
        read("force_presentation_complete")
      ),
      requireResponseComplete: compileRestriction(read("force_response_complete")),
      unitMenuEnabled: on(read("toolbar_show_unit_list", "unit_menu"), false),
      unitControls: modernUnitControlsHidden
        ? compileUnitControls(modernUnitControlsHidden)
        : compileUnitControls(legacyUnitControls),
      playerEnd: compilePlayerEnd(playerEnd)
    },
    player: {
      logPolicy: choice(
        read("logPolicy"),
        ["disabled", "lean", "rich", "debug"] as const,
        "rich"
      ),
      pagingMode: choice(
        read("pagingMode"),
        ["separate", "concat-scroll", "concat-scroll-snap", "buttons"] as const,
        "separate"
      ),
      restoreCurrentPageOnReturn: on(read("restore_current_page_on_return"), false)
    },
    completion: {
      lockOnTermination: on(read("lock_test_on_termination"), false)
    },
    display: {
      headerContent: choice(
        headerContent,
        ["none", "booklet", "block", "unit"] as const,
        "none"
      ),
      unitTitle: on(read("toolbar_show_unit_title", "unit_title"), true),
      fullscreenPrompt: on(read("ask_for_fullscreen"), false),
      fullscreenButton: on(
        read("toolbar_show_fullscreen_button", "show_fullscreen_button"),
        false
      ),
      reloadButton: on(read("toolbar_show_reload_button"), false),
      silentMode: on(read("silent_mode"), false)
    },
    timing: {
      showTimeLeft: on(read("toolbar_show_time_left", "unit_show_time_left"), false),
      warningMinutes: warningMinutes(
        findSourceValue("unit_time_left_warnings") ?? "5,1"
      )
    }
  };
};

export const bookletNavigationDeniedReasons = (input: {
  policy: BookletRuntimePolicy;
  direction: "forward" | "backward";
  presentationProgress?: string | null;
  responseProgress?: string | null;
}): BookletNavigationDeniedReason[] => {
  const applies = (restriction: BookletLeaveRestriction): boolean =>
    restriction === "always" ||
    (restriction === "forward" && input.direction === "forward");
  const complete = (progress: string | null | undefined): boolean =>
    ["complete", "complete-and-valid"].includes(progress?.toLowerCase() ?? "");
  const reasons: BookletNavigationDeniedReason[] = [];

  if (
    applies(input.policy.navigation.requirePresentationComplete) &&
    !complete(input.presentationProgress)
  ) {
    reasons.push("presentation_incomplete");
  }
  if (
    applies(input.policy.navigation.requireResponseComplete) &&
    input.responseProgress &&
    !complete(input.responseProgress)
  ) {
    reasons.push("response_incomplete");
  }
  return reasons;
};
