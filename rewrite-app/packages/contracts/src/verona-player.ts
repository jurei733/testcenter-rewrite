export const SUPPORTED_VERONA_PLAYER_API_MAJOR_MIN = 2;
export const SUPPORTED_VERONA_PLAYER_API_MAJOR_MAX = 6;

export type VeronaProgress =
  | "none"
  | "some"
  | "complete"
  | "complete-and-valid";

export type VeronaUnitState = {
  dataParts?: Record<string, string>;
  presentationProgress?: VeronaProgress;
  responseProgress?: VeronaProgress;
  unitStateDataType?: string;
  [key: string]: unknown;
};

export type VeronaPlayerState = {
  currentPage?: string | number;
  validPages?: Record<string, string> | Array<{ id: string; label?: string }>;
  [key: string]: unknown;
};

export type VeronaStateLogEntry = {
  key: string;
  timeStamp: number;
  content: string;
};

export const projectVeronaUnitStateLogs = (
  unitState: VeronaUnitState,
  timeStamp: number = Date.now()
): VeronaStateLogEntry[] => [
  {
    key: "PRESENTATION_PROGRESS",
    timeStamp,
    content: unitState.presentationProgress || ""
  },
  {
    key: "RESPONSE_PROGRESS",
    timeStamp,
    content: unitState.responseProgress || ""
  }
];

export type VeronaPageStateProjection = {
  pages: Array<{ id: string; label: string }>;
  currentPageIndex: number;
  logEntries: VeronaStateLogEntry[];
};

export const projectVeronaPageState = (
  playerState: VeronaPlayerState,
  timeStamp: number = Date.now()
): VeronaPageStateProjection => {
  const validPages = playerState.validPages;
  const pages = Array.isArray(validPages)
    ? validPages.flatMap(page => {
        const id = typeof page?.id === "string" ? page.id : "";
        const label =
          typeof page?.label === "string" && page.label ? page.label : id;
        return id ? [{ id, label }] : [];
      })
    : validPages && typeof validPages === "object"
      ? Object.entries(validPages).map(([id, label]) => ({
          id,
          label: typeof label === "string" && label ? label : id
        }))
      : [];
  const currentPage = playerState.currentPage;
  const currentPageId = currentPage == null ? "" : String(currentPage);
  const currentPageById = pages.findIndex(page => page.id === currentPageId);
  const currentPageIndex =
    currentPageById >= 0
      ? currentPageById
      : typeof currentPage === "number" &&
          Number.isSafeInteger(currentPage) &&
          currentPage >= 0 &&
          currentPage < pages.length
        ? currentPage
        : -1;
  return {
    pages,
    currentPageIndex,
    logEntries: [
      {
        key: "CURRENT_PAGE_NR",
        timeStamp,
        content: String(currentPage)
      },
      {
        key: "CURRENT_PAGE_ID",
        timeStamp,
        content: String(currentPageIndex)
      },
      {
        key: "PAGE_COUNT",
        timeStamp,
        content: String(pages.length)
      }
    ]
  };
};

export type VeronaPlayerConfig = {
  directDownloadUrl?: string;
  enabledNavigationTargets: Array<"next" | "previous" | "first" | "last" | "end">;
  logPolicy: "disabled" | "lean" | "rich" | "debug";
  pagingMode: "separate" | "concat-scroll" | "concat-scroll-snap" | "buttons";
  stateReportPolicy: "eager";
  unitNumber: number;
  unitCount?: number;
  unitTitle: string;
  unitId: string;
  startPage?: string | number;
};

export type VeronaStartUnitState = Omit<VeronaUnitState, "dataParts"> & {
  dataParts?: Record<string, unknown>;
};

export type VeronaStartCommand = {
  type: "vopStartCommand";
  sessionId: string;
  unitDefinition: string;
  unitDefinitionType?: string;
  unitState: VeronaStartUnitState;
  playerState?: VeronaPlayerState;
  playerConfig: VeronaPlayerConfig;
};

export type VeronaPlayerConfigChangedNotification = {
  type: "vopPlayerConfigChangedNotification";
  sessionId: string;
  playerConfig: VeronaPlayerConfig;
};

export type VeronaPageNavigationCommand = {
  type: "vopPageNavigationCommand";
  sessionId: string;
  target: string;
};

export type VeronaNavigationDeniedReason =
  | "presentationIncomplete"
  | "responsesIncomplete";

export type VeronaNavigationDeniedNotification = {
  type: "vopNavigationDeniedNotification";
  sessionId: string;
  reason: VeronaNavigationDeniedReason[];
};

export type VeronaReadyNotification = {
  type: "vopReadyNotification";
  apiVersion?: string;
  metadata?: {
    specVersion?: string;
    [key: string]: unknown;
  };
};

export type VeronaStateChangedNotification = {
  type: "vopStateChangedNotification";
  sessionId: string;
  unitState?: VeronaUnitState;
  playerState?: VeronaPlayerState;
  log?: Array<{ key: string; timeStamp: number; content: string }>;
};

export type VeronaNavigationRequestedNotification = {
  type: "vopUnitNavigationRequestedNotification";
  sessionId: string;
  target?: string;
  targetRelative?: string;
};

export type VeronaRelativeNavigationTarget =
  | "previous"
  | "next"
  | "first"
  | "last"
  | "end";

export type VeronaResolvedNavigationRequest =
  | { kind: "absolute"; unitKey: string }
  | { kind: "relative"; target: VeronaRelativeNavigationTarget };

const VERONA_RELATIVE_NAVIGATION_TARGETS = new Set<string>([
  "previous",
  "next",
  "first",
  "last",
  "end"
]);

/**
 * The Testcenter host uses `target` for an exact Unit id and `targetRelative`
 * for host navigation commands. Published Simple Player releases also sent
 * relative tokens through `target`, so known Booklet ids disambiguate that
 * legacy dialect. Keep absolute ids case-sensitive: XML ids and repeated-Unit
 * aliases are not command tokens.
 */
export const resolveVeronaNavigationRequest = (
  notification: VeronaNavigationRequestedNotification,
  knownUnitKeys?: readonly string[]
): VeronaResolvedNavigationRequest | null => {
  const absoluteTarget = notification.target?.trim();
  if (absoluteTarget) {
    const unitKey = absoluteTarget.replace(/^#/, "").trim();
    const legacyRelativeTarget = unitKey.toLowerCase();
    if (
      knownUnitKeys &&
      !knownUnitKeys.includes(unitKey) &&
      VERONA_RELATIVE_NAVIGATION_TARGETS.has(legacyRelativeTarget)
    ) {
      return {
        kind: "relative",
        target: legacyRelativeTarget as VeronaRelativeNavigationTarget
      };
    }
    return unitKey ? { kind: "absolute", unitKey } : null;
  }

  const relativeTarget = notification.targetRelative
    ?.trim()
    .replace(/^#/, "")
    .toLowerCase();
  return relativeTarget && VERONA_RELATIVE_NAVIGATION_TARGETS.has(relativeTarget)
    ? {
        kind: "relative",
        target: relativeTarget as VeronaRelativeNavigationTarget
      }
    : null;
};

export type VeronaRuntimeErrorNotification = {
  type: "vopRuntimeErrorNotification";
  sessionId?: string;
  code?: string;
  message?: string;
};

export type VeronaWindowFocusChangedNotification = {
  type: "vopWindowFocusChangedNotification";
  hasFocus: boolean;
};

export type VeronaIncomingNotification =
  | VeronaReadyNotification
  | VeronaStateChangedNotification
  | VeronaNavigationRequestedNotification
  | VeronaWindowFocusChangedNotification
  | VeronaRuntimeErrorNotification;

export type PersistedVeronaUnitResponse = {
  kind: "verona_unit_state";
  version: 1;
  unitState: VeronaUnitState;
  dataPartValueTypes?: Record<string, "string" | "json">;
  playerState?: VeronaPlayerState;
};

const asRecord = (value: unknown): Record<string, unknown> | null =>
  typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;

export const normalizeVeronaStateLogEntries = (
  value: unknown
): VeronaStateLogEntry[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap(entry => {
    const record = asRecord(entry);
    const key = typeof record?.key === "string" ? record.key.trim() : "";
    const timeStamp = Number(record?.timeStamp);
    const content = record?.content == null ? "" : String(record.content);
    if (
      !key ||
      key.length > 200 ||
      content.length > 32_768 ||
      !Number.isSafeInteger(timeStamp) ||
      timeStamp < 0 ||
      timeStamp > 8_640_000_000_000_000
    ) {
      return [];
    }
    return [{ key, timeStamp, content }];
  }).slice(-200);
};

const normalizeDataParts = (value: unknown): Record<string, string> | undefined => {
  const record = asRecord(value);
  if (!record) {
    return undefined;
  }

  const dataParts = Object.fromEntries(
    Object.entries(record).map(([key, content]) => [
      key,
      typeof content === "string" ? content : JSON.stringify(content)
    ])
  );
  return Object.keys(dataParts).length > 0 ? dataParts : undefined;
};

const readDataPartValueTypes = (
  value: unknown
): Record<string, "string" | "json"> | undefined => {
  const record = asRecord(value);
  if (!record) {
    return undefined;
  }
  const valueTypes = Object.fromEntries(
    Object.entries(record).flatMap(([key, type]) =>
      type === "string" || type === "json" ? [[key, type]] : []
    )
  ) as Record<string, "string" | "json">;
  return Object.keys(valueTypes).length > 0 ? valueTypes : undefined;
};

const inferDataPartValueTypes = (
  unitState: unknown
): Record<string, "string" | "json"> | undefined => {
  const dataParts = asRecord(asRecord(unitState)?.dataParts);
  if (!dataParts || Object.keys(dataParts).length === 0) {
    return undefined;
  }
  return Object.fromEntries(
    Object.entries(dataParts).map(([key, content]) => [
      key,
      typeof content === "string" ? "string" : "json"
    ])
  );
};

export const normalizeVeronaUnitState = (value: unknown): VeronaUnitState => {
  const record = asRecord(value) ?? {};
  const dataParts = normalizeDataParts(record.dataParts);
  return {
    ...record,
    ...(dataParts ? { dataParts } : {})
  };
};

export const serializeVeronaUnitResponse = (input: {
  unitState?: unknown;
  dataPartValueTypes?: Record<string, "string" | "json">;
  playerState?: unknown;
}): string => {
  const playerState = asRecord(input.playerState);
  const dataPartValueTypes = Object.prototype.hasOwnProperty.call(
    input,
    "dataPartValueTypes"
  )
    ? readDataPartValueTypes(input.dataPartValueTypes)
    : inferDataPartValueTypes(input.unitState);
  return JSON.stringify({
    kind: "verona_unit_state",
    version: 1,
    unitState: normalizeVeronaUnitState(input.unitState),
    ...(dataPartValueTypes ? { dataPartValueTypes } : {}),
    ...(playerState ? { playerState } : {})
  } satisfies PersistedVeronaUnitResponse);
};

export const mergeVeronaUnitResponse = (
  previousValue: string | null | undefined,
  update: {
    unitState?: unknown;
    playerState?: unknown;
  }
): string => {
  const previous = parseVeronaUnitResponse(previousValue);
  const previousUnitState = previous?.unitState ?? {};
  const updatedUnitState = asRecord(update.unitState);
  const previousDataParts = previousUnitState.dataParts;
  const updatedDataParts = normalizeDataParts(updatedUnitState?.dataParts);
  const mergedUnitState = updatedUnitState
    ? {
        ...previousUnitState,
        ...updatedUnitState
      }
    : previousUnitState;
  if (updatedUnitState && (previousDataParts || updatedDataParts)) {
    mergedUnitState.dataParts = {
      ...(previousDataParts ?? {}),
      ...(updatedDataParts ?? {})
    };
  } else if (
    updatedUnitState &&
    Object.prototype.hasOwnProperty.call(updatedUnitState, "dataParts")
  ) {
    delete mergedUnitState.dataParts;
  }
  const updatedDataPartValueTypes = inferDataPartValueTypes(update.unitState);
  return serializeVeronaUnitResponse({
    unitState: mergedUnitState,
    dataPartValueTypes: updatedDataPartValueTypes
      ? {
          ...(previous?.dataPartValueTypes ?? {}),
          ...updatedDataPartValueTypes
        }
      : previous?.dataPartValueTypes,
    playerState:
      update.playerState === undefined
        ? previous?.playerState
        : update.playerState
  });
};

export const parseVeronaUnitResponse = (
  value: string | null | undefined
): PersistedVeronaUnitResponse | null => {
  if (!value?.trim()) {
    return null;
  }

  try {
    const parsed = asRecord(JSON.parse(value));
    if (parsed?.kind !== "verona_unit_state" || parsed.version !== 1) {
      return null;
    }
    const dataPartValueTypes = readDataPartValueTypes(
      parsed.dataPartValueTypes
    );
    return {
      kind: "verona_unit_state",
      version: 1,
      unitState: normalizeVeronaUnitState(parsed.unitState),
      ...(dataPartValueTypes ? { dataPartValueTypes } : {}),
      ...(asRecord(parsed.playerState)
        ? { playerState: asRecord(parsed.playerState) as VeronaPlayerState }
        : {})
    };
  } catch {
    return null;
  }
};

export const readVeronaPlayerApiVersion = (value: unknown): string | null => {
  const message = asRecord(value);
  const metadata = asRecord(message?.metadata);
  const version = message?.apiVersion ?? metadata?.specVersion;
  return typeof version === "string" && version.trim() ? version.trim() : null;
};

export const isSupportedVeronaPlayerApiVersion = (version: string): boolean => {
  const major = Number.parseInt(version.split(".")[0] ?? "", 10);
  return (
    Number.isInteger(major) &&
    major >= SUPPORTED_VERONA_PLAYER_API_MAJOR_MIN &&
    major <= SUPPORTED_VERONA_PLAYER_API_MAJOR_MAX
  );
};

export const prepareVeronaUnitStateForPlayer = (
  value: VeronaUnitState,
  apiVersion: string,
  dataPartValueTypes?: Record<string, "string" | "json">
): VeronaStartUnitState => {
  const apiMajor = Number.parseInt(apiVersion.split(".")[0] ?? "", 10);
  if (!Number.isInteger(apiMajor) || apiMajor >= 4 || !value.dataParts) {
    return value;
  }

  return {
    ...value,
    dataParts: Object.fromEntries(
      Object.entries(value.dataParts).map(([key, content]) => {
        if (dataPartValueTypes?.[key] === "string") {
          return [key, content];
        }
        try {
          return [key, JSON.parse(content) as unknown];
        } catch {
          return [key, content];
        }
      })
    )
  };
};

export const parseVeronaIncomingNotification = (
  value: unknown
): VeronaIncomingNotification | null => {
  const message = asRecord(value);
  if (!message || typeof message.type !== "string") {
    return null;
  }

  switch (message.type) {
    case "vopReadyNotification":
      return message as VeronaReadyNotification;
    case "vopStateChangedNotification":
      return typeof message.sessionId === "string" &&
        (message.unitState === undefined || asRecord(message.unitState)) &&
        (message.playerState === undefined || asRecord(message.playerState)) &&
        (message.log === undefined || Array.isArray(message.log))
        ? (message as VeronaStateChangedNotification)
        : null;
    case "vopUnitNavigationRequestedNotification":
      return typeof message.sessionId === "string" &&
        (message.target === undefined || typeof message.target === "string") &&
        (message.targetRelative === undefined ||
          typeof message.targetRelative === "string")
        ? (message as VeronaNavigationRequestedNotification)
        : null;
    case "vopWindowFocusChangedNotification":
      return typeof message.hasFocus === "boolean"
        ? (message as VeronaWindowFocusChangedNotification)
        : null;
    case "vopRuntimeErrorNotification":
      return (message.sessionId === undefined ||
        typeof message.sessionId === "string") &&
        (message.code === undefined || typeof message.code === "string") &&
        (message.message === undefined || typeof message.message === "string")
        ? (message as VeronaRuntimeErrorNotification)
        : null;
    default:
      return null;
  }
};
