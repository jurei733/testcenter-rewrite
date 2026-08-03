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

export type VeronaPlayerConfig = {
  directDownloadUrl?: string;
  enabledNavigationTargets: Array<"next" | "previous" | "first" | "last" | "end">;
  logPolicy: "disabled" | "lean" | "rich" | "debug";
  pagingMode: "separate" | "concat-scroll" | "concat-scroll-snap" | "buttons";
  stateReportPolicy: "eager";
  unitNumber: number;
  unitTitle: string;
  unitId: string;
  startPage?: string | number;
};

export type VeronaStartCommand = {
  type: "vopStartCommand";
  sessionId: string;
  unitDefinition: string;
  unitDefinitionType?: string;
  unitState: VeronaUnitState;
  playerConfig: VeronaPlayerConfig;
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
  playerState?: VeronaPlayerState;
};

const asRecord = (value: unknown): Record<string, unknown> | null =>
  typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;

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
  playerState?: unknown;
}): string => {
  const playerState = asRecord(input.playerState);
  return JSON.stringify({
    kind: "verona_unit_state",
    version: 1,
    unitState: normalizeVeronaUnitState(input.unitState),
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
  return serializeVeronaUnitResponse({
    unitState:
      update.unitState === undefined ? previous?.unitState : update.unitState,
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
    return {
      kind: "verona_unit_state",
      version: 1,
      unitState: normalizeVeronaUnitState(parsed.unitState),
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
      return typeof message.sessionId === "string"
        ? (message as VeronaStateChangedNotification)
        : null;
    case "vopUnitNavigationRequestedNotification":
      return typeof message.sessionId === "string"
        ? (message as VeronaNavigationRequestedNotification)
        : null;
    case "vopWindowFocusChangedNotification":
      return typeof message.hasFocus === "boolean"
        ? (message as VeronaWindowFocusChangedNotification)
        : null;
    case "vopRuntimeErrorNotification":
      return message as VeronaRuntimeErrorNotification;
    default:
      return null;
  }
};
