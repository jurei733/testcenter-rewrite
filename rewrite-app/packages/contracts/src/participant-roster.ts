import {
  participantCodeInputTypes,
  participantExecutionModes as supportedParticipantExecutionModes
} from "@testcenter-rewrite-app/domain";
import type {
  AdminRole,
  MonitorViewProfile,
  MonitorViewProfileFilter,
  OperationalLoginMigrationCandidate,
  ParticipantCodeInputType,
  ParticipantExecutionMode,
  ParticipantViewSettings
} from "@testcenter-rewrite-app/domain";

export type ParsedParticipantRosterEntry = {
  loginKey: string;
  executionMode?: ParticipantExecutionMode;
  groupKey: string;
  groupLabel?: string | null;
  bookletKey: string | null;
  bookletKeys?: string[];
  bookletStatePresets?: Record<string, Record<string, string>>;
  bookletAssignments?: Array<{
    assignmentKey: string;
    bookletKey: string;
    statePreset: Record<string, string>;
    accessCodes?: string[];
  }>;
  displayName: string | null;
  password?: string | null;
  validFrom?: string | null;
  validTo?: string | null;
  validForMinutes?: number | null;
  customTexts?: Record<string, string>;
  viewSettings?: ParticipantViewSettings;
  /** Original asset filenames keyed by the Testtakers 18.0 slot name. */
  assetAssignments?: Record<string, string>;
};

export const originalTestcenterOperationalLoginModes = [
  "monitor-group",
  "monitor-study",
  "sys-check-login"
] as const;

export type OriginalTestcenterOperationalLoginMode =
  OperationalLoginMigrationCandidate["loginMode"];

export type OriginalTestcenterMonitorProfileFilter = MonitorViewProfileFilter;

export type OriginalTestcenterMonitorProfile = MonitorViewProfile;

export type OriginalTestcenterOperationalLoginCandidate =
  OperationalLoginMigrationCandidate;

export type OriginalTestcenterMonitorRoleDraft = {
  role: Extract<AdminRole, "group_monitor" | "study_monitor">;
  groupKey: string | null;
};

export type OriginalTestcenterOperationalRoleDraft = {
  role: Extract<AdminRole, "group_monitor" | "study_monitor" | "system_check">;
  groupKey: string | null;
};

export const mapOriginalTestcenterOperationalLoginToAdminRole = (
  candidate: OriginalTestcenterOperationalLoginCandidate
): OriginalTestcenterOperationalRoleDraft | null => {
  if (candidate.loginMode === "sys-check-login") {
    return { role: "system_check", groupKey: null };
  }
  if (candidate.loginMode === "monitor-study") {
    return { role: "study_monitor", groupKey: null };
  }
  if (candidate.loginMode === "monitor-group" && candidate.groupKey) {
    return { role: "group_monitor", groupKey: candidate.groupKey };
  }
  return null;
};

export const mapOriginalTestcenterOperationalLoginToMonitorRole = (
  candidate: OriginalTestcenterOperationalLoginCandidate
): OriginalTestcenterMonitorRoleDraft | null => {
  const draft = mapOriginalTestcenterOperationalLoginToAdminRole(candidate);
  return draft?.role === "group_monitor" || draft?.role === "study_monitor"
    ? { role: draft.role, groupKey: draft.groupKey }
    : null;
};

export type ParticipantRosterSource =
  | string
  | Record<string, unknown>
  | unknown[];

const splitRosterLine = (line: string): string[] => {
  const delimiter = line.includes("\t")
    ? "\t"
    : line.includes(";")
      ? ";"
      : ",";
  return line.split(delimiter).map(value => value.trim());
};

const normalizeRosterHeaderName = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");

const rosterHeaderAliases = {
  loginKey: new Set([
    "loginkey",
    "login",
    "username",
    "user",
    "userid",
    "userkey",
    "code",
    "identifier"
  ]),
  groupKey: new Set([
    "groupkey",
    "group",
    "groupid",
    "groupname",
    "class",
    "classname"
  ]),
  groupLabel: new Set(["grouplabel", "groupdisplaylabel", "classlabel"]),
  bookletKey: new Set([
    "bookletkey",
    "booklet",
    "bookletid",
    "testlet",
    "testletid"
  ]),
  displayName: new Set([
    "displayname",
    "displaylabel",
    "fullname",
    "name",
    "participantname",
    "studentname",
    "label"
  ]),
  password: new Set([
    "password",
    "pw",
    "passwort",
    "kennwort",
    "secret",
    "accesscode",
    "accesskey"
  ]),
  executionMode: new Set(["mode", "loginmode", "testmode", "executionmode"]),
  validFrom: new Set(["validfrom", "accessvalidfrom", "availablefrom"]),
  validTo: new Set(["validto", "accessvalidto", "availableto", "validuntil"]),
  validForMinutes: new Set([
    "validfor",
    "validforminutes",
    "accessvalidforminutes"
  ])
};

type RosterDelimitedHeader = {
  loginKey: number;
  groupKey: number | null;
  groupLabel: number | null;
  bookletKey: number | null;
  displayName: number | null;
  password: number | null;
  executionMode: number | null;
  validFrom: number | null;
  validTo: number | null;
  validForMinutes: number | null;
};

const findRosterHeaderIndex = (
  headerValues: string[],
  aliases: Set<string>
): number | null => {
  const index = headerValues.findIndex(value =>
    aliases.has(normalizeRosterHeaderName(value))
  );
  return index >= 0 ? index : null;
};

const readRosterDelimitedHeader = (
  values: string[]
): RosterDelimitedHeader | null => {
  if (values.length < 2) {
    return null;
  }

  const loginKeyIndex = findRosterHeaderIndex(
    values,
    rosterHeaderAliases.loginKey
  );
  if (loginKeyIndex === null) {
    return null;
  }

  return {
    loginKey: loginKeyIndex,
    groupKey: findRosterHeaderIndex(values, rosterHeaderAliases.groupKey),
    groupLabel: findRosterHeaderIndex(values, rosterHeaderAliases.groupLabel),
    bookletKey: findRosterHeaderIndex(values, rosterHeaderAliases.bookletKey),
    displayName: findRosterHeaderIndex(values, rosterHeaderAliases.displayName),
    password: findRosterHeaderIndex(values, rosterHeaderAliases.password),
    executionMode: findRosterHeaderIndex(
      values,
      rosterHeaderAliases.executionMode
    ),
    validFrom: findRosterHeaderIndex(values, rosterHeaderAliases.validFrom),
    validTo: findRosterHeaderIndex(values, rosterHeaderAliases.validTo),
    validForMinutes: findRosterHeaderIndex(
      values,
      rosterHeaderAliases.validForMinutes
    )
  };
};

const readRosterDelimitedValue = (
  values: string[],
  index: number | null
): string | null => {
  if (index === null) {
    return null;
  }
  return normalizeRosterTextValue(values[index]);
};

const parseRosterValidForMinutes = (
  value: string | null | undefined
): number | null => {
  if (!value || !/^[+-]?\d+$/.test(value)) {
    return null;
  }
  const minutes = Number(value);
  return Number.isSafeInteger(minutes) && minutes > 0 ? minutes : null;
};

const parseDelimitedRosterRows = (
  rosterText: string
): ParsedParticipantRosterEntry[] => {
  const rows = rosterText
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line && !line.startsWith("#"))
    .map(splitRosterLine);

  const header = rows.length > 0 ? readRosterDelimitedHeader(rows[0] ?? []) : null;
  const dataRows = header ? rows.slice(1) : rows;

  return dataRows.flatMap(values => {
    const loginKey = header
      ? readRosterDelimitedValue(values, header.loginKey)
      : normalizeRosterTextValue(values[0]);
    if (!loginKey) {
      return [];
    }

    if (!header && normalizeRosterHeaderName(loginKey) === "loginkey") {
      return [];
    }

    const groupKey = header
      ? readRosterDelimitedValue(values, header.groupKey)
      : normalizeRosterTextValue(values[1]);
    const groupLabel = header
      ? readRosterDelimitedValue(values, header.groupLabel)
      : null;
    const bookletKey = header
      ? readRosterDelimitedValue(values, header.bookletKey)
      : normalizeRosterTextValue(values[2]);
    const displayName = header
      ? readRosterDelimitedValue(values, header.displayName)
      : normalizeRosterTextValue(values[3]);
    const password = header
      ? readRosterDelimitedValue(values, header.password)
      : normalizeRosterTextValue(values[4]);
    const executionMode = header
      ? normalizeParticipantExecutionMode(
          readRosterDelimitedValue(values, header.executionMode)
        )
      : null;
    const validFrom = header
      ? readRosterDelimitedValue(values, header.validFrom)
      : null;
    const validTo = header
      ? readRosterDelimitedValue(values, header.validTo)
      : null;
    const validForValue = header
      ? readRosterDelimitedValue(values, header.validForMinutes)
      : null;
    const validForMinutes = parseRosterValidForMinutes(validForValue);

    return [
      {
        loginKey,
        groupKey: groupKey || `group:${loginKey}`,
        ...(groupLabel ? { groupLabel } : {}),
        bookletKey,
        displayName,
        ...(executionMode ? { executionMode } : {}),
        ...(password ? { password } : {}),
        ...(validFrom ? { validFrom } : {}),
        ...(validTo ? { validTo } : {}),
        ...(validForMinutes && validForMinutes > 0 ? { validForMinutes } : {})
      }
    ];
  });
};

const decodeXmlText = (value: string): string =>
  value
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");

const parseXmlAttributes = (rawAttributes: string): Record<string, string> => {
  const attributes: Record<string, string> = {};

  for (const match of rawAttributes.matchAll(
    /([a-zA-Z_:][\w:.-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g
  )) {
    attributes[match[1]] = decodeXmlText(match[2] ?? match[3] ?? "");
  }

  return attributes;
};

const readXmlAttribute = (
  attributes: Record<string, string>,
  ...candidateNames: string[]
): string | undefined => {
  for (const candidateName of candidateNames) {
    const exactValue = attributes[candidateName];
    if (exactValue !== undefined) {
      return exactValue;
    }
  }

  const normalizedEntries = Object.entries(attributes).map(([key, value]) => [
    key.toLowerCase(),
    value
  ]);
  for (const candidateName of candidateNames) {
    const normalizedName = candidateName.toLowerCase();
    const match = normalizedEntries.find(([key]) => {
      const localName = key.split(":").at(-1) ?? key;
      return key === normalizedName || localName === normalizedName;
    });
    if (match) {
      return match[1];
    }
  }

  return undefined;
};

const parseOriginalTestcenterXmlBoolean = (
  value: string | undefined
): boolean => {
  const normalizedValue = value?.trim().toLowerCase();
  return normalizedValue === "true" || normalizedValue === "1";
};

const readXmlChildText = (
  content: string,
  ...candidateTagNames: string[]
): string | undefined => {
  for (const tagName of candidateTagNames) {
    const match = content.match(
      new RegExp(
        `<((?:[a-zA-Z_][\\w.-]*:)?${tagName})\\b[^>]*>([\\s\\S]*?)<\\/\\1>`,
        "i"
      )
    );
    const value = match?.[2]?.replace(/<[^>]+>/g, "").trim();
    if (value) {
      return decodeXmlText(value);
    }
  }
  return undefined;
};

const readXmlChildTexts = (
  content: string,
  tagNames: string
): string[] =>
  Array.from(
    content.matchAll(
      new RegExp(
        `<((?:[a-zA-Z_][\\w.-]*:)?(?:${tagNames}))\\b[^>]*>([\\s\\S]*?)<\\/\\1>`,
        "gi"
      )
    )
  )
    .map(match =>
      normalizeRosterTextValue(
        decodeXmlText((match[2] ?? "").replace(/<[^>]+>/g, "").trim())
      )
    )
    .filter((value): value is string => Boolean(value));

const normalizeParticipantCodeInputType = (
  value: string | null | undefined
): ParticipantCodeInputType | null => {
  const normalized = normalizeRosterTextValue(value);
  return normalized &&
    (participantCodeInputTypes as readonly string[]).includes(normalized)
    ? (normalized as ParticipantCodeInputType)
    : null;
};

const readXmlParticipantViewSettings = (
  content: string
): ParticipantViewSettings | undefined => {
  const match = content.match(
    /<(?:[a-zA-Z_][\w.-]*:)?viewsettings\b[^>]*?(?:\/>|>([\s\S]*?)<\/(?:[a-zA-Z_][\w.-]*:)?viewsettings>)/i
  );
  if (!match) {
    return undefined;
  }
  const viewSettingsContent = match[1] ?? "";
  const theme = normalizeRosterTextValue(
    readXmlChildText(viewSettingsContent, "theme")
  );
  const codeInputContent = viewSettingsContent.match(
    /<(?:[a-zA-Z_][\w.-]*:)?codeinput\b[^>]*>([\s\S]*?)<\/(?:[a-zA-Z_][\w.-]*:)?codeinput>/i
  )?.[1];
  const codeInputType = codeInputContent
    ? normalizeParticipantCodeInputType(
        readXmlChildText(codeInputContent, "type")
      )
    : null;
  const lengthValue = codeInputContent
    ? normalizeRosterTextValue(readXmlChildText(codeInputContent, "length"))
    : null;
  const parsedLength =
    lengthValue && /^\+?\d+$/.test(lengthValue)
      ? Number(lengthValue)
      : Number.NaN;
  const length =
    Number.isSafeInteger(parsedLength) && parsedLength >= 3
      ? parsedLength
      : undefined;
  return {
    ...(theme ? { theme } : {}),
    ...(codeInputType
      ? {
          codeInput: {
            type: codeInputType,
            ...(length === undefined ? {} : { length })
          }
        }
      : {})
  };
};

const readXmlAssetAssignments = (
  content: string
): Record<string, string> => {
  const section = content.match(
    /<((?:[a-zA-Z_][\w.-]*:)?assetassignments)\b[^>]*>([\s\S]*?)<\/\1>/i
  )?.[2];
  if (!section) {
    return {};
  }
  return Object.fromEntries(
    Array.from(
      section.matchAll(
        /<((?:[a-zA-Z_][\w.-]*:)?asset)\b([^>]*)>([\s\S]*?)<\/\1>/gi
      )
    ).flatMap(match => {
      const slot = normalizeRosterTextValue(
        readXmlAttribute(parseXmlAttributes(match[2] ?? ""), "slot")
      );
      const originalName = normalizeRosterTextValue(
        decodeXmlText((match[3] ?? "").replace(/<[^>]+>/g, "").trim())
      );
      return slot && originalName ? [[slot, originalName] as const] : [];
    })
  );
};

const parseBookletStatePreset = (
  value: string | undefined
): Record<string, string> => {
  if (!value) {
    return {};
  }
  return Object.fromEntries(
    value.split(/[;,]/).flatMap(tuple => {
      const separatorIndex = tuple.indexOf(":");
      if (separatorIndex < 1) {
        return [];
      }
      const stateKey = tuple.slice(0, separatorIndex).trim();
      const optionKey = tuple.slice(separatorIndex + 1).trim();
      return stateKey && optionKey ? [[stateKey, optionKey]] : [];
    })
  );
};

const buildBookletAssignmentKey = (
  bookletKey: string,
  statePreset: Record<string, string>
): string => {
  const stateTuples = Object.entries(statePreset).map(
    ([stateKey, optionKey]) => `${stateKey}:${optionKey}`
  );
  return stateTuples.length > 0
    ? `${bookletKey}#${stateTuples.join(";")}`
    : bookletKey;
};

const mergeBookletAssignments = (
  ...assignmentLists: Array<
    NonNullable<ParsedParticipantRosterEntry["bookletAssignments"]>
  >
): NonNullable<ParsedParticipantRosterEntry["bookletAssignments"]> => {
  const assignmentsByKey = new Map<
    string,
    NonNullable<ParsedParticipantRosterEntry["bookletAssignments"]>[number]
  >();
  for (const assignment of assignmentLists.flat()) {
    const existing = assignmentsByKey.get(assignment.assignmentKey);
    const accessCodes = [
      ...new Set(
        [...(existing?.accessCodes ?? []), ...(assignment.accessCodes ?? [])]
          .map(code => code.trim())
          .filter(Boolean)
      )
    ];
    assignmentsByKey.set(assignment.assignmentKey, {
      ...(existing ?? assignment),
      ...assignment,
      statePreset: {
        ...(existing?.statePreset ?? {}),
        ...assignment.statePreset
      },
      ...(accessCodes.length > 0 ? { accessCodes } : {})
    });
  }
  return Array.from(assignmentsByKey.values());
};

const readXmlBookletAssignments = (
  content: string
): NonNullable<ParsedParticipantRosterEntry["bookletAssignments"]> => {
  const assignments = Array.from(
    content.matchAll(
      /<((?:[a-zA-Z_][\w.-]*:)?(?:booklet|bookletRef|booklet-ref|testlet|testletRef|testlet-ref))\b([^>]*)>([\s\S]*?)<\/\1>/gi
    )
  ).flatMap(match => {
    const bookletKey = normalizeRosterTextValue(
      decodeXmlText((match[3] ?? "").replace(/<[^>]+>/g, "").trim())
    );
    if (!bookletKey) {
      return [];
    }
    const attributes = parseXmlAttributes(match[2] ?? "");
    const statePreset = parseBookletStatePreset(
      readXmlAttribute(attributes, "state", "states")
    );
    const accessCodes = [
      ...new Set(
        (readXmlAttribute(attributes, "codes") ?? "")
          .split(/\s+/)
          .map(code => code.trim())
          .filter(Boolean)
      )
    ];
    return [{
      assignmentKey: buildBookletAssignmentKey(bookletKey, statePreset),
      bookletKey,
      statePreset,
      ...(accessCodes.length > 0 ? { accessCodes } : {})
    }];
  });
  return mergeBookletAssignments(assignments);
};

const readXmlBookletStatePresets = (
  content: string
): Record<string, Record<string, string>> => {
  const presets: Record<string, Record<string, string>> = {};
  for (const assignment of readXmlBookletAssignments(content)) {
    if (
      Object.keys(assignment.statePreset).length > 0 &&
      !presets[assignment.bookletKey]
    ) {
      presets[assignment.bookletKey] = assignment.statePreset;
    }
  }
  return presets;
};

const withAdditionalBookletKeys = (
  bookletKeys: Array<string | null | undefined>
): Pick<ParsedParticipantRosterEntry, "bookletKey" | "bookletKeys"> => {
  const normalizedBookletKeys = [
    ...new Set(bookletKeys.map(normalizeRosterTextValue).filter(Boolean))
  ] as string[];
  return {
    bookletKey: normalizedBookletKeys[0] ?? null,
    ...(normalizedBookletKeys.length > 1
      ? { bookletKeys: normalizedBookletKeys }
      : {})
  };
};

const mergeParsedParticipantRosterEntries = (
  entries: ParsedParticipantRosterEntry[]
): ParsedParticipantRosterEntry[] => {
  const mergedEntries = new Map<string, ParsedParticipantRosterEntry>();

  for (const entry of entries) {
    const existingEntry = mergedEntries.get(entry.loginKey);
    if (!existingEntry) {
      mergedEntries.set(entry.loginKey, entry);
      continue;
    }

    const bookletAssignment = withAdditionalBookletKeys([
      ...(existingEntry.bookletKeys ?? [existingEntry.bookletKey]),
      ...(entry.bookletKeys ?? [entry.bookletKey])
    ]);
    mergedEntries.set(entry.loginKey, {
      ...existingEntry,
      ...bookletAssignment,
      groupKey: entry.groupKey || existingEntry.groupKey,
      ...(entry.groupLabel
        ? { groupLabel: entry.groupLabel }
        : existingEntry.groupLabel
          ? { groupLabel: existingEntry.groupLabel }
          : {}),
      displayName: entry.displayName ?? existingEntry.displayName,
      ...((existingEntry.bookletAssignments || entry.bookletAssignments)
        ? {
            bookletAssignments: mergeBookletAssignments(
              existingEntry.bookletAssignments ?? [],
              entry.bookletAssignments ?? []
            )
          }
        : {}),
      ...((existingEntry.bookletStatePresets || entry.bookletStatePresets)
        ? {
            bookletStatePresets: {
              ...(existingEntry.bookletStatePresets ?? {}),
              ...(entry.bookletStatePresets ?? {})
            }
          }
        : {}),
      ...(entry.password
        ? { password: entry.password }
        : existingEntry.password
          ? { password: existingEntry.password }
          : {}),
      ...(entry.validFrom
        ? { validFrom: entry.validFrom }
        : existingEntry.validFrom
          ? { validFrom: existingEntry.validFrom }
          : {}),
      ...(entry.validTo
        ? { validTo: entry.validTo }
        : existingEntry.validTo
          ? { validTo: existingEntry.validTo }
          : {}),
      ...(entry.validForMinutes
        ? { validForMinutes: entry.validForMinutes }
        : existingEntry.validForMinutes
          ? { validForMinutes: existingEntry.validForMinutes }
          : {}),
      ...((existingEntry.customTexts || entry.customTexts)
        ? {
            customTexts: {
              ...(existingEntry.customTexts ?? {}),
              ...(entry.customTexts ?? {})
            }
          }
        : {}),
      ...((existingEntry.viewSettings || entry.viewSettings)
        ? {
            viewSettings: {
              ...(existingEntry.viewSettings ?? {}),
              ...(entry.viewSettings ?? {}),
              ...((existingEntry.viewSettings?.codeInput ||
                entry.viewSettings?.codeInput)
                ? {
                    codeInput: {
                      ...(existingEntry.viewSettings?.codeInput ?? {}),
                      ...(entry.viewSettings?.codeInput ?? {})
                    } as NonNullable<ParticipantViewSettings["codeInput"]>
                  }
                : {})
            }
          }
        : {}),
      ...((existingEntry.assetAssignments || entry.assetAssignments)
        ? {
            assetAssignments: {
              ...(existingEntry.assetAssignments ?? {}),
              ...(entry.assetAssignments ?? {})
            }
          }
        : {})
    });
  }

  return Array.from(mergedEntries.values());
};

const readXmlChildAttribute = (
  content: string,
  tagNames: string,
  ...candidateAttributeNames: string[]
): string | undefined => {
  const match = content.match(
    new RegExp(
      `<((?:[a-zA-Z_][\\w.-]*:)?(?:${tagNames}))\\b([^>]*?)(?:\\/?>|>[\\s\\S]*?<\\/\\1>)`,
      "i"
    )
  );
  if (!match) {
    return undefined;
  }

  return readXmlAttribute(parseXmlAttributes(match[2] ?? ""), ...candidateAttributeNames);
};

const normalizeRosterTextValue = (value: string | undefined | null): string | null => {
  const normalizedValue = value?.trim();
  return normalizedValue ? normalizedValue : null;
};

const isParticipantRosterMode = (value: string | undefined | null): boolean => {
  const mode = normalizeRosterTextValue(value)?.toLowerCase();
  return !mode || normalizeParticipantExecutionMode(mode) !== null;
};

const participantExecutionModes = new Set<ParticipantExecutionMode>(
  supportedParticipantExecutionModes
);

const normalizeParticipantExecutionMode = (
  value: string | undefined | null
): ParticipantExecutionMode | null => {
  const mode = normalizeRosterTextValue(value)?.toLowerCase();
  return mode && participantExecutionModes.has(mode as ParticipantExecutionMode)
    ? (mode as ParticipantExecutionMode)
    : null;
};

const combineRosterDisplayName = (
  displayName: string | null,
  firstName: string | null,
  lastName: string | null
): string | null => {
  if (displayName) {
    return displayName;
  }

  const combinedName = [firstName, lastName].filter(Boolean).join(" ").trim();
  return combinedName || null;
};

const asRosterObject = (value: unknown): Record<string, unknown> | null =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const readRosterObjectValue = (
  value: unknown,
  ...candidateNames: string[]
): string | null => {
  if (typeof value === "string" || typeof value === "number") {
    return normalizeRosterTextValue(String(value));
  }

  const objectValue = asRosterObject(value);
  if (!objectValue) {
    return null;
  }

  return readJsonRosterString(objectValue, ...candidateNames);
};

const readJsonRosterString = (
  value: Record<string, unknown>,
  ...candidateNames: string[]
): string | null => {
  for (const candidateName of candidateNames) {
    const candidateValue = value[candidateName];
    if (candidateValue !== undefined) {
      return readRosterObjectValue(
        candidateValue,
        "key",
        "id",
        "identifier",
        "ref",
        "code",
        "name",
        "label"
      );
    }
  }

  const normalizedEntries = Object.entries(value).map(([key, entryValue]) => [
    key.toLowerCase(),
    entryValue
  ] as const);
  for (const candidateName of candidateNames) {
    const normalizedName = candidateName.toLowerCase();
    const match = normalizedEntries.find(([key]) => key === normalizedName);
    if (match) {
      return readRosterObjectValue(
        match[1],
        "key",
        "id",
        "identifier",
        "ref",
        "code",
        "name",
        "label"
      );
    }
  }

  return null;
};

const readJsonParticipantViewSettings = (
  value: Record<string, unknown>
): ParticipantViewSettings | undefined => {
  const viewSettings = asRosterObject(
    value.viewSettings ?? value.ViewSettings ?? value["view-settings"]
  );
  if (!viewSettings) {
    return undefined;
  }
  const theme = readJsonRosterString(viewSettings, "theme", "themeName");
  const codeInput = asRosterObject(
    viewSettings.codeInput ?? viewSettings.CodeInput ?? viewSettings["code-input"]
  );
  const codeInputType = codeInput
    ? normalizeParticipantCodeInputType(
        readJsonRosterString(codeInput, "type", "inputType")
      )
    : null;
  const lengthValue = codeInput
    ? readJsonRosterString(codeInput, "length", "size")
    : null;
  const length =
    lengthValue && /^\d+$/.test(lengthValue) && Number(lengthValue) >= 3
      ? Number(lengthValue)
      : undefined;
  return {
    ...(theme ? { theme } : {}),
    ...(codeInputType
      ? {
          codeInput: {
            type: codeInputType,
            ...(length === undefined ? {} : { length })
          }
        }
      : {})
  };
};

const readJsonRosterEntries = (...values: unknown[]): unknown[] => {
  for (const value of values) {
    if (Array.isArray(value)) {
      return value;
    }
    if (asRosterObject(value)) {
      return [value];
    }
  }
  return [];
};

const readJsonRosterCustomTexts = (
  value: Record<string, unknown>
): Record<string, string> => {
  const customTextsValue = Object.entries(value).find(([key]) =>
    ["customtexts", "custom-texts", "custom_texts"].includes(key.toLowerCase())
  )?.[1];
  if (customTextsValue === undefined) {
    return {};
  }

  const readEntries = (candidate: unknown): Array<readonly [string, string]> => {
    if (Array.isArray(candidate)) {
      return candidate.flatMap(entry => {
        const objectEntry = asRosterObject(entry);
        if (!objectEntry) {
          return [];
        }
        const key = readJsonRosterString(
          objectEntry,
          "key",
          "id",
          "name",
          "identifier"
        );
        const text = readJsonRosterString(
          objectEntry,
          "value",
          "text",
          "defaultValue",
          "defaultvalue",
          "content"
        );
        return key && text ? [[key, text] as const] : [];
      });
    }

    const objectCandidate = asRosterObject(candidate);
    if (!objectCandidate) {
      return [];
    }
    const nestedEntries = Object.entries(objectCandidate).find(([key]) =>
      ["customtext", "custom-text", "items", "entries"].includes(
        key.toLowerCase()
      )
    )?.[1];
    if (nestedEntries !== undefined) {
      return readEntries(nestedEntries);
    }
    return Object.entries(objectCandidate).flatMap(([key, entryValue]) => {
      const normalizedKey = normalizeRosterTextValue(key);
      const normalizedText =
        typeof entryValue === "string" || typeof entryValue === "number"
          ? normalizeRosterTextValue(String(entryValue))
          : asRosterObject(entryValue)
            ? readJsonRosterString(
                entryValue as Record<string, unknown>,
                "value",
                "text",
                "defaultValue",
                "defaultvalue",
                "content"
              )
            : null;
      return normalizedKey && normalizedText
        ? [[normalizedKey, normalizedText] as const]
        : [];
    });
  };

  return Object.fromEntries(readEntries(customTextsValue));
};

const readJsonAssetAssignments = (
  value: Record<string, unknown>
): Record<string, string> => {
  const candidate = Object.entries(value).find(([key]) =>
    ["assetassignment", "assetassignments", "asset-assignment"].includes(
      key.toLowerCase()
    )
  )?.[1];
  if (candidate === undefined) {
    return {};
  }
  const candidateObject = asRosterObject(candidate);
  const assignments = Array.isArray(candidate)
    ? candidate
    : candidateObject && readJsonRosterString(candidateObject, "slot")
      ? [candidateObject]
      : [];
  if (assignments.length > 0) {
    return Object.fromEntries(
      assignments.flatMap(assignment => {
        const objectAssignment = asRosterObject(assignment);
        if (!objectAssignment) {
          return [];
        }
        const slot = readJsonRosterString(objectAssignment, "slot", "name", "key");
        const originalName = readJsonRosterString(
          objectAssignment,
          "value",
          "originalName",
          "fileName",
          "filename",
          "asset"
        );
        return slot && originalName ? [[slot, originalName] as const] : [];
      })
    );
  }
  return candidateObject
    ? Object.fromEntries(
        Object.entries(candidateObject).flatMap(([slot, originalName]) => {
          const normalizedSlot = normalizeRosterTextValue(slot);
          const normalizedOriginalName =
            typeof originalName === "string"
              ? normalizeRosterTextValue(originalName)
              : null;
          return normalizedSlot && normalizedOriginalName
            ? [[normalizedSlot, normalizedOriginalName] as const]
            : [];
        })
      )
    : {};
};

const readJsonBookletAssignments = (
  value: Record<string, unknown>
): NonNullable<ParsedParticipantRosterEntry["bookletAssignments"]> =>
  mergeBookletAssignments(
    readJsonRosterEntries(value.booklets, value.Booklets).flatMap(candidate => {
      const booklet = asRosterObject(candidate);
      if (!booklet) {
        return [];
      }
      const bookletKey = readJsonRosterString(
        booklet,
        "id",
        "bookletKey",
        "bookletId",
        "key",
        "identifier",
        "ref"
      );
      if (!bookletKey) {
        return [];
      }
      const statePreset = parseBookletStatePreset(
        readJsonRosterString(booklet, "state", "states") ?? undefined
      );
      const accessCodes = [
        ...new Set(
          (readJsonRosterString(booklet, "codes", "accessCodes") ?? "")
            .split(/\s+/)
            .map(code => code.trim())
            .filter(Boolean)
        )
      ];
      return [{
        assignmentKey: buildBookletAssignmentKey(bookletKey, statePreset),
        bookletKey,
        statePreset,
        ...(accessCodes.length > 0 ? { accessCodes } : {})
      }];
    })
  );

const readJsonRosterChildValues = (
  value: Record<string, unknown>
): unknown[] => [
  ...readJsonRosterEntries(
    value.participants,
    value.participant,
    value.testtakers,
    value.testtaker,
    value["test-takers"],
    value["test-taker"],
    value.people,
    value.persons,
    value.person,
    value.students,
    value.student,
    value.users,
    value.user,
    value.examinees,
    value.examinee,
    value.entries,
    value.items,
    value.logins,
    value.login
  ),
  ...readJsonRosterEntries(value.groups, value.group, value.classes, value.class),
  ...readJsonRosterEntries(
    value.booklets,
    value.booklet,
    value.testlets,
    value.testlet
  ),
  ...readJsonRosterEntries(value.roster, value.testtakersRoster)
];

const parseParticipantRosterJsonValue = (
  parsed: unknown
): ParsedParticipantRosterEntry[] => {
  const entries: ParsedParticipantRosterEntry[] = [];
  const visit = (
    candidate: unknown,
    context: {
      groupKey: string | null;
      groupLabel: string | null;
      bookletKey: string | null;
      validFrom: string | null;
      validTo: string | null;
      validForMinutes: number | null;
      customTexts: Record<string, string>;
      assetAssignments: Record<string, string>;
    }
  ): void => {
    if (Array.isArray(candidate)) {
      candidate.forEach(item => visit(item, context));
      return;
    }

    const objectValue = asRosterObject(candidate);
    if (!objectValue) {
      return;
    }

    const childValues = readJsonRosterChildValues(objectValue);
    const mode = readJsonRosterString(
      objectValue,
      "mode",
      "loginMode",
      "testMode",
      "executionMode"
    );
    const explicitLoginKey = readJsonRosterString(
      objectValue,
      "loginKey",
      "login",
      "username",
      "userName",
      "code",
      "identifier"
    );
    const canonicalLoginName =
      !explicitLoginKey && mode
        ? readJsonRosterString(objectValue, "name")
        : null;
    const loginKey =
      explicitLoginKey ??
      canonicalLoginName ??
      (childValues.length === 0 ? readJsonRosterString(objectValue, "id") : null);
    const executionMode = normalizeParticipantExecutionMode(mode);
    const groupKey =
      readJsonRosterString(
        objectValue,
        "groupKey",
        "group",
        "groupId",
        "groupName",
        "class",
        "className"
      ) ?? context.groupKey;
    const groupLabel =
      readJsonRosterString(objectValue, "groupLabel", "groupDisplayLabel", "classLabel") ??
      context.groupLabel;
    const bookletKey =
      readJsonRosterString(
        objectValue,
        "bookletKey",
        "booklet",
        "bookletId",
        "testlet",
        "testletId"
      ) ?? context.bookletKey;
    const validFrom =
      readJsonRosterString(objectValue, "validFrom", "valid-from", "accessValidFrom") ??
      context.validFrom;
    const validTo =
      readJsonRosterString(
        objectValue,
        "validTo",
        "valid-to",
        "validUntil",
        "accessValidTo"
      ) ?? context.validTo;
    const validForValue = readJsonRosterString(
      objectValue,
      "validFor",
      "valid-for",
      "validForMinutes",
      "accessValidForMinutes"
    );
    const parsedValidForMinutes = parseRosterValidForMinutes(validForValue);
    const validForMinutes = parsedValidForMinutes ?? context.validForMinutes;
    const customTexts = {
      ...context.customTexts,
      ...readJsonRosterCustomTexts(objectValue)
    };
    const assetAssignments = {
      ...context.assetAssignments,
      ...readJsonAssetAssignments(objectValue)
    };
    const viewSettings = readJsonParticipantViewSettings(objectValue);

    if (loginKey) {
      if (!isParticipantRosterMode(mode)) {
        return;
      }
      const password = readJsonRosterString(
        objectValue,
        "password",
        "pw",
        "passwort",
        "kennwort",
        "secret",
        "accessCode",
        "accessKey"
      );
      const bookletAssignments = readJsonBookletAssignments(objectValue);
      const bookletStatePresets = Object.fromEntries(
        bookletAssignments.flatMap(assignment =>
          Object.keys(assignment.statePreset).length > 0
            ? [[assignment.bookletKey, assignment.statePreset] as const]
            : []
        )
      );
      entries.push({
        loginKey,
        ...(executionMode ? { executionMode } : {}),
        groupKey: groupKey || `group:${loginKey}`,
        ...(groupLabel ? { groupLabel } : {}),
        ...withAdditionalBookletKeys([
          bookletKey,
          ...bookletAssignments.map(assignment => assignment.bookletKey)
        ]),
        ...(bookletAssignments.length > 0 ? { bookletAssignments } : {}),
        ...(Object.keys(bookletStatePresets).length > 0
          ? { bookletStatePresets }
          : {}),
        displayName: combineRosterDisplayName(
          readJsonRosterString(
            objectValue,
            "displayName",
            "displayLabel",
            "label",
            "fullName"
          ) ??
            (canonicalLoginName
              ? null
              : readJsonRosterString(objectValue, "name")),
          readJsonRosterString(objectValue, "firstName", "firstname", "givenName"),
          readJsonRosterString(objectValue, "lastName", "lastname", "familyName")
        ),
        ...(password ? { password } : {}),
        ...(validFrom ? { validFrom } : {}),
        ...(validTo ? { validTo } : {}),
        ...(validForMinutes ? { validForMinutes } : {}),
        ...(Object.keys(customTexts).length > 0 ? { customTexts } : {}),
        ...(viewSettings ? { viewSettings } : {}),
        ...(Object.keys(assetAssignments).length > 0
          ? { assetAssignments }
          : {})
      });
      return;
    }

    const childContext = {
      groupKey,
      groupLabel,
      bookletKey,
      validFrom,
      validTo,
      validForMinutes,
      customTexts,
      assetAssignments
    };
    for (const childValue of readJsonRosterEntries(
      objectValue.participants,
      objectValue.participant,
      objectValue.testtakers,
      objectValue.testtaker,
      objectValue["test-takers"],
      objectValue["test-taker"],
      objectValue.people,
      objectValue.persons,
      objectValue.person,
      objectValue.students,
      objectValue.student,
      objectValue.users,
      objectValue.user,
      objectValue.examinees,
      objectValue.examinee,
      objectValue.entries,
      objectValue.items,
      objectValue.logins,
      objectValue.login,
      objectValue.roster,
      objectValue.testtakersRoster
    )) {
      visit(childValue, childContext);
    }

    for (const childValue of readJsonRosterEntries(
      objectValue.groups,
      objectValue.group,
      objectValue.classes,
      objectValue.class
    )) {
      const childObject = asRosterObject(childValue);
      visit(childValue, {
        groupKey: childObject
          ? readJsonRosterString(
              childObject,
              "groupKey",
              "group",
              "groupId",
              "groupName",
              "class",
              "className",
              "key",
              "id",
              "identifier",
              "ref"
            ) ?? groupKey
          : groupKey,
        groupLabel: childObject
          ? readJsonRosterString(
              childObject,
              "groupLabel",
              "groupDisplayLabel",
              "classLabel",
              "displayLabel",
              "label"
            ) ?? groupLabel
          : groupLabel,
        bookletKey,
        validFrom,
        validTo,
        validForMinutes,
        customTexts,
        assetAssignments
      });
    }

    for (const childValue of readJsonRosterEntries(
      objectValue.booklets,
      objectValue.booklet,
      objectValue.testlets,
      objectValue.testlet
    )) {
      const childObject = asRosterObject(childValue);
      visit(childValue, {
        groupKey,
        groupLabel,
        bookletKey: childObject
          ? readJsonRosterString(
              childObject,
              "bookletKey",
              "booklet",
              "bookletId",
              "testlet",
              "testletId",
              "key",
              "id",
              "identifier",
              "ref"
            ) ?? bookletKey
          : bookletKey,
        validFrom,
        validTo,
        validForMinutes,
        customTexts,
        assetAssignments
      });
    }
  };

  visit(parsed, {
    groupKey: null,
    groupLabel: null,
    bookletKey: null,
    validFrom: null,
    validTo: null,
    validForMinutes: null,
    customTexts: {},
    assetAssignments: {}
  });
  return entries;
};

const parseParticipantRosterJsonText = (
  rosterText: string
): ParsedParticipantRosterEntry[] => {
  const trimmedRosterText = rosterText.trim();
  if (!trimmedRosterText.startsWith("{") && !trimmedRosterText.startsWith("[")) {
    return [];
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmedRosterText);
  } catch {
    return [];
  }

  return parseParticipantRosterJsonValue(parsed);
};

type XmlRosterContextRange = {
  start: number;
  end: number;
  value: string;
};

type XmlAssetAssignmentContextRange = {
  start: number;
  end: number;
  value: Record<string, string>;
};

const collectXmlGroupAssetAssignmentRanges = (
  rosterText: string
): XmlAssetAssignmentContextRange[] =>
  Array.from(
    rosterText.matchAll(
      /<((?:[a-zA-Z_][\w.-]*:)?group)\b[^>]*>([\s\S]*?)<\/\1>/gi
    )
  ).flatMap(match => {
    const start = match.index ?? 0;
    const groupContent = match[2] ?? "";
    const contentBeforeFirstLogin = groupContent.split(
      /<(?:[a-zA-Z_][\w.-]*:)?login\b/i,
      1
    )[0] ?? "";
    const value = readXmlAssetAssignments(contentBeforeFirstLogin);
    return Object.keys(value).length > 0
      ? [{ start, end: start + match[0].length, value }]
      : [];
  });

const findNearestXmlAssetAssignments = (
  ranges: XmlAssetAssignmentContextRange[],
  offset: number
): Record<string, string> =>
  ranges
    .filter(range => range.start < offset && range.end > offset)
    .sort((left, right) => left.end - left.start - (right.end - right.start))[0]
    ?.value ?? {};

const collectXmlRosterContextRanges = (
  rosterText: string,
  tagNames: string,
  ...candidateAttributeNames: string[]
): XmlRosterContextRange[] => {
  const ranges: XmlRosterContextRange[] = [];
  const stack: Array<{
    tagName: string;
    start: number;
    value: string | null;
  }> = [];

  for (const match of rosterText.matchAll(
    new RegExp(
      `<(/?)((?:[a-zA-Z_][\\w.-]*:)?(?:${tagNames}))\\b([^>]*?)(/?)>`,
      "gi"
    )
  )) {
    const offset = match.index;
    if (offset === undefined) {
      continue;
    }

    const isClosingTag = Boolean(match[1]);
    const tagName = (match[2] ?? "").split(":").at(-1)?.toLowerCase() ?? "";
    const rawAttributes = match[3] ?? "";
    const isSelfClosingTag = Boolean(match[4]) || rawAttributes.trimEnd().endsWith("/");

    if (!isClosingTag && !isSelfClosingTag) {
      stack.push({
        tagName,
        start: offset,
        value: normalizeRosterTextValue(
          readXmlAttribute(
            parseXmlAttributes(rawAttributes),
            ...candidateAttributeNames
          )
        )
      });
      continue;
    }

    if (!isClosingTag) {
      continue;
    }

    let stackIndex = -1;
    for (let index = stack.length - 1; index >= 0; index -= 1) {
      if (stack[index]?.tagName === tagName) {
        stackIndex = index;
        break;
      }
    }
    if (stackIndex < 0) {
      continue;
    }

    const entry = stack.splice(stackIndex, 1)[0];
    if (!entry?.value) {
      continue;
    }

    const end = offset + match[0].length;
    const content = rosterText.slice(entry.start, end);
    if (
      content.match(
        /<(?:[a-zA-Z_][\w.-]*:)?(?:testtaker|test-taker|participant|person|student|user|examinee|login)\b/i
      )
    ) {
      ranges.push({
        start: entry.start,
        end,
        value: entry.value
      });
    }
  }

  return ranges;
};

const findNearestXmlRosterContextValue = (
  ranges: XmlRosterContextRange[],
  offset: number
): string | null => {
  const matchingRanges = ranges
    .filter(range => range.start < offset && range.end > offset)
    .sort(
      (left, right) =>
        left.end - left.start - (right.end - right.start)
    );
  return matchingRanges[0]?.value ?? null;
};

const parseXmlRosterCustomTexts = (
  rosterText: string
): Record<string, string> => {
  const section = rosterText.match(
    /<((?:[a-zA-Z_][\w.-]*:)?customtexts)\b[^>]*>([\s\S]*?)<\/\1>/i
  )?.[2];
  if (!section) {
    return {};
  }
  return Object.fromEntries(
    Array.from(
      section.matchAll(
        /<((?:[a-zA-Z_][\w.-]*:)?customtext)\b([^>]*)>([\s\S]*?)<\/\1>/gi
      )
    ).flatMap(match => {
      const key = normalizeRosterTextValue(
        readXmlAttribute(parseXmlAttributes(match[2] ?? ""), "key")
      );
      if (!key) {
        return [];
      }
      return [[key, decodeXmlText((match[3] ?? "").trim())] as const];
    })
  );
};

const parseParticipantRosterXmlText = (
  rosterText: string
): ParsedParticipantRosterEntry[] => {
  if (!rosterText.trim().startsWith("<")) {
    return [];
  }

  const entries: ParsedParticipantRosterEntry[] = [];
  const customTexts = parseXmlRosterCustomTexts(rosterText);
  const groupContextRanges = collectXmlRosterContextRanges(
    rosterText,
    "group|groupRef|group-ref|class|classRef|class-ref",
    "groupKey",
    "key",
    "id",
    "identifier",
    "ref",
    "name",
    "label"
  );
  const groupLabelContextRanges = collectXmlRosterContextRanges(
    rosterText,
    "group|groupRef|group-ref|class|classRef|class-ref",
    "groupLabel",
    "groupDisplayLabel",
    "classLabel",
    "displayLabel",
    "label"
  );
  const groupAssetAssignmentRanges =
    collectXmlGroupAssetAssignmentRanges(rosterText);
  const bookletContextRanges = collectXmlRosterContextRanges(
    rosterText,
    "booklet|bookletRef|booklet-ref|testlet|testletRef|testlet-ref",
    "bookletKey",
    "key",
    "id",
    "identifier",
    "ref",
    "name",
    "label"
  );
  const validFromContextRanges = collectXmlRosterContextRanges(
    rosterText,
    "group|groupRef|group-ref|class|classRef|class-ref",
    "validFrom",
    "valid-from"
  );
  const validToContextRanges = collectXmlRosterContextRanges(
    rosterText,
    "group|groupRef|group-ref|class|classRef|class-ref",
    "validTo",
    "valid-to",
    "validUntil"
  );
  const validForContextRanges = collectXmlRosterContextRanges(
    rosterText,
    "group|groupRef|group-ref|class|classRef|class-ref",
    "validFor",
    "valid-for",
    "validForMinutes"
  );
  const readXmlAccessWindow = (
    attributes: Record<string, string>,
    entryOffset: number
  ): Pick<
    ParsedParticipantRosterEntry,
    "validFrom" | "validTo" | "validForMinutes"
  > => {
    const validFrom = normalizeRosterTextValue(
      readXmlAttribute(attributes, "validFrom", "valid-from")
    ) ?? findNearestXmlRosterContextValue(validFromContextRanges, entryOffset);
    const validTo = normalizeRosterTextValue(
      readXmlAttribute(attributes, "validTo", "valid-to", "validUntil")
    ) ?? findNearestXmlRosterContextValue(validToContextRanges, entryOffset);
    const validForValue = normalizeRosterTextValue(
      readXmlAttribute(attributes, "validFor", "valid-for", "validForMinutes")
    ) ?? findNearestXmlRosterContextValue(validForContextRanges, entryOffset);
    const validForMinutes = parseRosterValidForMinutes(validForValue);
    return {
      ...(validFrom ? { validFrom } : {}),
      ...(validTo ? { validTo } : {}),
      ...(validForMinutes ? { validForMinutes } : {})
    };
  };
  for (const match of rosterText.matchAll(
    /<((?:[a-zA-Z_][\w.-]*:)?(?:testtaker|test-taker|participant|person|student|user|examinee))\b([^>]*?)(?:\/>|>([\s\S]*?)<\/\1>)/gi
  )) {
    const entryOffset = match.index ?? 0;
    const attributes = parseXmlAttributes(match[2] ?? "");
    const content = match[3] ?? "";
    const loginKey = normalizeRosterTextValue(
      readXmlAttribute(
        attributes,
        "loginKey",
        "login",
        "username",
        "userName",
        "code",
        "identifier",
        "id"
      ) ?? readXmlChildText(content, "loginKey", "login", "username", "code", "id")
    );
    if (!loginKey) {
      continue;
    }
    const rawExecutionMode =
      readXmlAttribute(attributes, "mode", "loginMode", "testMode") ??
      readXmlChildText(content, "mode", "loginMode", "testMode");
    if (!isParticipantRosterMode(rawExecutionMode)) {
      continue;
    }
    const executionMode = normalizeParticipantExecutionMode(rawExecutionMode);

    const groupKey = normalizeRosterTextValue(
      readXmlAttribute(
        attributes,
        "groupKey",
        "group",
        "groupId",
        "groupName",
        "class",
        "className"
      ) ??
        readXmlChildAttribute(
          content,
          "group|groupRef|group-ref|class|classRef|class-ref",
          "groupKey",
          "key",
          "id",
          "identifier",
          "ref",
          "name"
        ) ??
        readXmlChildText(content, "groupKey", "group", "groupId", "groupName", "class")
    ) ?? findNearestXmlRosterContextValue(groupContextRanges, entryOffset);
    const groupLabel = normalizeRosterTextValue(
      readXmlAttribute(
        attributes,
        "groupLabel",
        "groupDisplayLabel",
        "classLabel"
      ) ??
        readXmlChildAttribute(
          content,
          "group|groupRef|group-ref|class|classRef|class-ref",
          "groupLabel",
          "groupDisplayLabel",
          "classLabel",
          "displayLabel",
          "label"
        )
    ) ?? findNearestXmlRosterContextValue(groupLabelContextRanges, entryOffset);
    const bookletKey = normalizeRosterTextValue(
      readXmlAttribute(
        attributes,
        "bookletKey",
        "booklet",
        "bookletId",
        "testlet",
        "testletId"
      ) ??
        readXmlChildAttribute(
          content,
          "booklet|bookletRef|booklet-ref|testlet|testletRef|testlet-ref",
          "bookletKey",
          "key",
          "id",
          "identifier",
          "ref",
          "name"
        ) ??
        readXmlChildText(
          content,
          "bookletKey",
          "booklet",
          "bookletId",
          "testlet",
          "testletId"
        )
    ) ?? findNearestXmlRosterContextValue(bookletContextRanges, entryOffset);
    const displayName = combineRosterDisplayName(
      normalizeRosterTextValue(
        readXmlAttribute(
          attributes,
          "displayName",
          "displayLabel",
          "label",
          "name",
          "fullName"
        ) ??
          readXmlChildText(
            content,
            "displayName",
            "displayLabel",
            "label",
            "name",
            "fullName"
          )
      ),
      normalizeRosterTextValue(
        readXmlAttribute(attributes, "firstName", "firstname", "givenName") ??
          readXmlChildText(content, "firstName", "firstname", "givenName")
      ),
      normalizeRosterTextValue(
        readXmlAttribute(attributes, "lastName", "lastname", "familyName") ??
          readXmlChildText(content, "lastName", "lastname", "familyName")
      )
    );
    const password = normalizeRosterTextValue(
      readXmlAttribute(
        attributes,
        "password",
        "pw",
        "passwort",
        "kennwort",
        "secret",
        "accessCode",
        "accessKey"
      ) ?? readXmlChildText(content, "password", "pw", "passwort", "kennwort")
    );
    const viewSettings = readXmlParticipantViewSettings(content);
    const assetAssignments = {
      ...findNearestXmlAssetAssignments(
        groupAssetAssignmentRanges,
        entryOffset
      ),
      ...readXmlAssetAssignments(content)
    };

    entries.push({
      loginKey,
      ...(executionMode ? { executionMode } : {}),
      groupKey: groupKey || `group:${loginKey}`,
      ...(groupLabel ? { groupLabel } : {}),
      ...withAdditionalBookletKeys([
        bookletKey,
        ...readXmlChildTexts(content, "booklet|bookletRef|booklet-ref|testlet|testletRef|testlet-ref")
      ]),
      ...(() => {
        const bookletAssignments = readXmlBookletAssignments(content);
        const bookletStatePresets = readXmlBookletStatePresets(content);
        return {
          ...(bookletAssignments.length > 0 ? { bookletAssignments } : {}),
          ...(Object.keys(bookletStatePresets).length > 0
            ? { bookletStatePresets }
            : {})
        };
      })(),
      displayName,
      ...(password ? { password } : {}),
      ...(Object.keys(customTexts).length > 0 ? { customTexts } : {}),
      ...(viewSettings ? { viewSettings } : {}),
      ...(Object.keys(assetAssignments).length > 0
        ? { assetAssignments }
        : {}),
      ...readXmlAccessWindow(attributes, entryOffset)
    });
  }

  for (const match of rosterText.matchAll(
    /<((?:[a-zA-Z_][\w.-]*:)?Login)\b([^>]*?)(?:\/>|>([\s\S]*?)<\/\1>)/gi
  )) {
    const entryOffset = match.index ?? 0;
    const attributes = parseXmlAttributes(match[2] ?? "");
    const content = match[3] ?? "";
    const loginKey = normalizeRosterTextValue(
      readXmlAttribute(
        attributes,
        "loginKey",
        "login",
        "username",
        "userName",
        "code",
        "identifier",
        "id",
        "name"
      )
    );
    if (!loginKey) {
      continue;
    }
    const rawExecutionMode = readXmlAttribute(
      attributes,
      "mode",
      "loginMode",
      "testMode"
    );
    if (!isParticipantRosterMode(rawExecutionMode)) {
      continue;
    }
    const executionMode = normalizeParticipantExecutionMode(rawExecutionMode);

    const groupKey =
      normalizeRosterTextValue(
        readXmlAttribute(
          attributes,
          "groupKey",
          "group",
          "groupId",
          "groupName",
          "class",
          "className"
        )
      ) ?? findNearestXmlRosterContextValue(groupContextRanges, entryOffset);
    const groupLabel = findNearestXmlRosterContextValue(
      groupLabelContextRanges,
      entryOffset
    );
    const bookletKey = normalizeRosterTextValue(
      readXmlAttribute(
        attributes,
        "bookletKey",
        "booklet",
        "bookletId",
        "testlet",
        "testletId"
      ) ??
        readXmlChildAttribute(
          content,
          "booklet|bookletRef|booklet-ref|testlet|testletRef|testlet-ref",
          "bookletKey",
          "key",
          "id",
          "identifier",
          "ref"
        ) ??
        readXmlChildText(
          content,
          "bookletKey",
          "booklet",
          "bookletId",
          "testlet",
          "testletId"
        )
    );
    const displayName = combineRosterDisplayName(
      normalizeRosterTextValue(
        readXmlAttribute(
          attributes,
          "displayName",
          "displayLabel",
          "label",
          "fullName"
        )
      ),
      normalizeRosterTextValue(
        readXmlAttribute(attributes, "firstName", "firstname", "givenName")
      ),
      normalizeRosterTextValue(
        readXmlAttribute(attributes, "lastName", "lastname", "familyName")
      )
    );
    const password = normalizeRosterTextValue(
      readXmlAttribute(
        attributes,
        "password",
        "pw",
        "passwort",
        "kennwort",
        "secret",
        "accessCode",
        "accessKey"
      ) ?? readXmlChildText(content, "password", "pw", "passwort", "kennwort")
    );
    const viewSettings = readXmlParticipantViewSettings(content);
    const assetAssignments = {
      ...findNearestXmlAssetAssignments(
        groupAssetAssignmentRanges,
        entryOffset
      ),
      ...readXmlAssetAssignments(content)
    };

    entries.push({
      loginKey,
      ...(executionMode ? { executionMode } : {}),
      groupKey: groupKey || `group:${loginKey}`,
      ...(groupLabel ? { groupLabel } : {}),
      ...withAdditionalBookletKeys([
        bookletKey,
        ...readXmlChildTexts(content, "booklet|bookletRef|booklet-ref|testlet|testletRef|testlet-ref")
      ]),
      ...(() => {
        const bookletAssignments = readXmlBookletAssignments(content);
        const bookletStatePresets = readXmlBookletStatePresets(content);
        return {
          ...(bookletAssignments.length > 0 ? { bookletAssignments } : {}),
          ...(Object.keys(bookletStatePresets).length > 0
            ? { bookletStatePresets }
            : {})
        };
      })(),
      displayName,
      ...(password ? { password } : {}),
      ...(Object.keys(customTexts).length > 0 ? { customTexts } : {}),
      ...(viewSettings ? { viewSettings } : {}),
      ...(Object.keys(assetAssignments).length > 0
        ? { assetAssignments }
        : {}),
      ...readXmlAccessWindow(attributes, entryOffset)
    });
  }

  return mergeParsedParticipantRosterEntries(entries);
};

const parseOriginalTestcenterMonitorProfiles = (
  rosterText: string
): Map<string, OriginalTestcenterMonitorProfile> => {
  const profilesContent = rosterText.match(
    /<((?:[a-zA-Z_][\w.-]*:)?profiles)\b[^>]*>([\s\S]*?)<\/\1>/i
  )?.[2];
  const groupMonitorContent = profilesContent?.match(
    /<((?:[a-zA-Z_][\w.-]*:)?groupmonitor)\b[^>]*>([\s\S]*?)<\/\1>/i
  )?.[2];
  const profiles = new Map<string, OriginalTestcenterMonitorProfile>();
  if (!groupMonitorContent) {
    return profiles;
  }

  for (const match of groupMonitorContent.matchAll(
    /<((?:[a-zA-Z_][\w.-]*:)?profile)\b([^>]*?)(?:\/>|>([\s\S]*?)<\/\1>)/gi
  )) {
    const attributes = parseXmlAttributes(match[2] ?? "");
    const profileId = normalizeRosterTextValue(
      readXmlAttribute(attributes, "id")
    );
    if (!profileId || profiles.has(profileId)) {
      continue;
    }
    const content = match[3] ?? "";
    const filters: OriginalTestcenterMonitorProfileFilter[] = Array.from(
      content.matchAll(
        /<(?:[a-zA-Z_][\w.-]*:)?filter\b([^>]*?)(?:\/>|>[\s\S]*?<\/(?:[a-zA-Z_][\w.-]*:)?filter>)/gi
      ),
      filterMatch => {
        const filterAttributes = parseXmlAttributes(filterMatch[1] ?? "");
        return {
          target: readXmlAttribute(filterAttributes, "field")?.trim() || "personLabel",
          value: readXmlAttribute(filterAttributes, "value")?.trim() || "",
          subValue:
            readXmlAttribute(filterAttributes, "subValue")?.trim() || null,
          label: readXmlAttribute(filterAttributes, "label")?.trim() || "",
          type: readXmlAttribute(filterAttributes, "type")?.trim() || "equal",
          not: parseOriginalTestcenterXmlBoolean(
            readXmlAttribute(filterAttributes, "not")
          )
        };
      }
    );
    profiles.set(profileId, {
      profileId,
      label: readXmlAttribute(attributes, "label")?.trim() || "",
      settings: {
        blockColumn:
          readXmlAttribute(attributes, "blockColumn")?.trim() || "show",
        unitColumn:
          readXmlAttribute(attributes, "unitColumn")?.trim() || "show",
        view: readXmlAttribute(attributes, "view")?.trim() || "medium",
        groupColumn:
          readXmlAttribute(attributes, "groupColumn")?.trim() || "hide",
        bookletColumn:
          readXmlAttribute(attributes, "bookletColumn")?.trim() || "show",
        bookletStatesColumns:
          readXmlAttribute(attributes, "bookletStatesColumns")?.trim() || "",
        autoselectNextBlock:
          readXmlAttribute(attributes, "autoselectNextBlock")?.trim() === "no"
            ? "no"
            : "yes"
      },
      filters,
      filtersEnabled: {
        pending:
          readXmlAttribute(attributes, "filterPending")?.trim() || "no",
        locked: readXmlAttribute(attributes, "filterLocked")?.trim() || "no"
      }
    });
  }
  return profiles;
};

const parseOriginalTestcenterOperationalLoginsJsonValue = (
  value: unknown
): OriginalTestcenterOperationalLoginCandidate[] => {
  const root = asRosterObject(value);
  if (!root) {
    return [];
  }
  const customTexts = readJsonRosterCustomTexts(root);
  const profileRoot = asRosterObject(root.profiles ?? root.Profiles);
  const monitorProfiles = new Map<string, OriginalTestcenterMonitorProfile>();
  if (profileRoot) {
    for (const candidate of readJsonRosterEntries(
      profileRoot.groupMonitor,
      profileRoot.GroupMonitor
    )) {
      const profile = asRosterObject(candidate);
      const profileId = profile
        ? readJsonRosterString(profile, "id", "profileId")
        : null;
      if (!profile || !profileId || monitorProfiles.has(profileId)) {
        continue;
      }
      const filters = readJsonRosterEntries(
        profile.filters,
        profile.filter
      ).flatMap(candidateFilter => {
        const filter = asRosterObject(candidateFilter);
        if (!filter) {
          return [];
        }
        const rawNot = filter.not;
        return [{
          target: readJsonRosterString(filter, "field", "target") ?? "personLabel",
          value: readJsonRosterString(filter, "value") ?? "",
          subValue: readJsonRosterString(filter, "subValue") ?? null,
          label: readJsonRosterString(filter, "label") ?? "",
          type: readJsonRosterString(filter, "type") ?? "equal",
          not:
            rawNot === true ||
            rawNot === 1 ||
            (typeof rawNot === "string" &&
              ["1", "true", "yes"].includes(rawNot.toLowerCase()))
        }];
      });
      monitorProfiles.set(profileId, {
        profileId,
        label: readJsonRosterString(profile, "label") ?? "",
        settings: {
          blockColumn: readJsonRosterString(profile, "blockColumn") ?? "show",
          unitColumn: readJsonRosterString(profile, "unitColumn") ?? "show",
          view: readJsonRosterString(profile, "view") ?? "medium",
          groupColumn: readJsonRosterString(profile, "groupColumn") ?? "hide",
          bookletColumn: readJsonRosterString(profile, "bookletColumn") ?? "show",
          bookletStatesColumns:
            readJsonRosterString(profile, "bookletStatesColumns") ?? "",
          autoselectNextBlock:
            readJsonRosterString(profile, "autoselectNextBlock") === "no"
              ? "no"
              : "yes"
        },
        filters,
        filtersEnabled: {
          pending: readJsonRosterString(profile, "filterPending") ?? "no",
          locked: readJsonRosterString(profile, "filterLocked") ?? "no"
        }
      });
    }
  }

  return readJsonRosterEntries(
    root.groups,
    root.group,
    root.classes,
    root.class
  ).flatMap(candidateGroup => {
    const group = asRosterObject(candidateGroup);
    if (!group) {
      return [];
    }
    const groupKey = readJsonRosterString(
      group,
      "id",
      "groupKey",
      "groupId",
      "key"
    );
    const groupLabel = readJsonRosterString(
      group,
      "groupLabel",
      "groupDisplayLabel",
      "classLabel",
      "displayLabel",
      "label"
    );
    const groupAssets = readJsonAssetAssignments(group);
    const validFrom = readJsonRosterString(group, "validFrom", "valid-from");
    const validTo = readJsonRosterString(group, "validTo", "valid-to");
    const validForMinutes = parseRosterValidForMinutes(
      readJsonRosterString(
        group,
        "validFor",
        "valid-for",
        "validForMinutes"
      )
    );
    return readJsonRosterEntries(group.logins, group.login).flatMap(
      candidateLogin => {
        const login = asRosterObject(candidateLogin);
        const loginMode = login
          ? readJsonRosterString(login, "mode", "loginMode", "testMode")
          : null;
        if (
          !login ||
          !loginMode ||
          !(originalTestcenterOperationalLoginModes as readonly string[]).includes(
            loginMode
          )
        ) {
          return [];
        }
        const loginKey = readJsonRosterString(
          login,
          "name",
          "loginKey",
          "login",
          "username"
        );
        if (!loginKey) {
          return [];
        }
        const profileIds = [
          ...new Set(
            readJsonRosterEntries(login.profiles, login.profile).flatMap(
              candidateProfile => {
                const profile = asRosterObject(candidateProfile);
                const profileId = profile
                  ? readJsonRosterString(profile, "id", "profileId", "ref")
                  : null;
                return profileId ? [profileId] : [];
              }
            )
          )
        ];
        const resolvedProfiles = profileIds.flatMap(profileId => {
          const profile = monitorProfiles.get(profileId);
          return profile ? [profile] : [];
        });
        const viewSettings = asRosterObject(
          login.viewSettings ?? login.ViewSettings ?? login["view-settings"]
        );
        const importedVisibility = viewSettings
          ? readJsonRosterString(viewSettings, "monitorBookletVisibility")
          : null;
        const monitorBookletVisibility =
          importedVisibility === "collapsed" || importedVisibility === "hidden"
            ? importedVisibility
            : "visible";
        const assetAssignments = {
          ...groupAssets,
          ...readJsonAssetAssignments(login)
        };
        return [{
          loginKey,
          loginMode:
            loginMode as OriginalTestcenterOperationalLoginCandidate["loginMode"],
          groupKey,
          ...(groupLabel ? { groupLabel } : {}),
          passwordRequired: Boolean(
            readJsonRosterString(
              login,
              "pw",
              "password",
              "secret",
              "accessKey"
            )
          ),
          profileIds,
          monitorProfiles: resolvedProfiles,
          monitorBookletVisibility,
          customTexts: { ...customTexts },
          ...(Object.keys(assetAssignments).length > 0
            ? { assetAssignments }
            : {}),
          unresolvedProfileIds: profileIds.filter(
            profileId => !monitorProfiles.has(profileId)
          ),
          ...(validFrom ? { validFrom } : {}),
          ...(validTo ? { validTo } : {}),
          ...(validForMinutes ? { validForMinutes } : {})
        }];
      }
    );
  });
};

export const parseOriginalTestcenterOperationalLogins = (
  rosterText: ParticipantRosterSource
): OriginalTestcenterOperationalLoginCandidate[] => {
  if (typeof rosterText !== "string") {
    return parseOriginalTestcenterOperationalLoginsJsonValue(rosterText);
  }
  const trimmedRosterText = rosterText.trimStart();
  if (trimmedRosterText.startsWith("{") || trimmedRosterText.startsWith("[")) {
    try {
      return parseOriginalTestcenterOperationalLoginsJsonValue(
        JSON.parse(trimmedRosterText)
      );
    } catch {
      return [];
    }
  }
  if (!trimmedRosterText.startsWith("<")) {
    return [];
  }

  const groupContextRanges = collectXmlRosterContextRanges(
    rosterText,
    "group|groupRef|group-ref|class|classRef|class-ref",
    "groupKey",
    "key",
    "id",
    "identifier",
    "ref",
    "name",
    "label"
  );
  const groupLabelContextRanges = collectXmlRosterContextRanges(
    rosterText,
    "group|groupRef|group-ref|class|classRef|class-ref",
    "groupLabel",
    "groupDisplayLabel",
    "classLabel",
    "displayLabel",
    "label"
  );
  const groupAssetAssignmentRanges =
    collectXmlGroupAssetAssignmentRanges(rosterText);
  const validFromContextRanges = collectXmlRosterContextRanges(
    rosterText,
    "group|groupRef|group-ref|class|classRef|class-ref",
    "validFrom",
    "valid-from"
  );
  const validToContextRanges = collectXmlRosterContextRanges(
    rosterText,
    "group|groupRef|group-ref|class|classRef|class-ref",
    "validTo",
    "valid-to",
    "validUntil"
  );
  const validForContextRanges = collectXmlRosterContextRanges(
    rosterText,
    "group|groupRef|group-ref|class|classRef|class-ref",
    "validFor",
    "valid-for",
    "validForMinutes"
  );
  const operationalModes = new Set<string>(
    originalTestcenterOperationalLoginModes
  );
  const monitorProfiles = parseOriginalTestcenterMonitorProfiles(rosterText);
  const customTexts = parseXmlRosterCustomTexts(rosterText);
  const candidates: OriginalTestcenterOperationalLoginCandidate[] = [];

  for (const match of rosterText.matchAll(
    /<((?:[a-zA-Z_][\w.-]*:)?login)\b([^>]*?)(?:\/>|>([\s\S]*?)<\/\1>)/gi
  )) {
    const entryOffset = match.index ?? 0;
    const attributes = parseXmlAttributes(match[2] ?? "");
    const content = match[3] ?? "";
    const loginMode = normalizeRosterTextValue(
      readXmlAttribute(attributes, "mode", "loginMode")
    )?.toLowerCase();
    if (!loginMode || !operationalModes.has(loginMode)) {
      continue;
    }
    const loginKey = normalizeRosterTextValue(
      readXmlAttribute(attributes, "name", "login", "loginKey", "username")
    );
    if (!loginKey) {
      continue;
    }
    const password = normalizeRosterTextValue(
      readXmlAttribute(attributes, "password", "pw", "passwort", "kennwort")
    );
    const groupKey = findNearestXmlRosterContextValue(
      groupContextRanges,
      entryOffset
    );
    const groupLabel = findNearestXmlRosterContextValue(
      groupLabelContextRanges,
      entryOffset
    );
    const validFrom = findNearestXmlRosterContextValue(
      validFromContextRanges,
      entryOffset
    );
    const validTo = findNearestXmlRosterContextValue(
      validToContextRanges,
      entryOffset
    );
    const validForMinutes = parseRosterValidForMinutes(
      findNearestXmlRosterContextValue(validForContextRanges, entryOffset)
    );
    const profileIds = Array.from(
      content.matchAll(
        /<(?:[a-zA-Z_][\w.-]*:)?profile\b([^>]*?)(?:\/>|>[\s\S]*?<\/(?:[a-zA-Z_][\w.-]*:)?profile>)/gi
      ),
      profileMatch =>
        normalizeRosterTextValue(
          readXmlAttribute(parseXmlAttributes(profileMatch[1] ?? ""), "id", "ref")
        )
    ).filter((profileId): profileId is string => Boolean(profileId));
    const uniqueProfileIds = Array.from(new Set(profileIds));
    const viewSettingsMatch = content.match(
      /<(?:[a-zA-Z_][\w.-]*:)?viewsettings\b([^>]*?)(?:\/?>)/i
    );
    const importedVisibility = viewSettingsMatch
      ? readXmlAttribute(
          parseXmlAttributes(viewSettingsMatch[1] ?? ""),
          "monitorBookletVisibility"
        )?.trim() ??
        normalizeRosterTextValue(
          readXmlChildText(content, "monitorBookletVisibility")
        )
      : undefined;
    const monitorBookletVisibility =
      importedVisibility === "collapsed" || importedVisibility === "hidden"
        ? importedVisibility
        : "visible";
    const assetAssignments = {
      ...findNearestXmlAssetAssignments(
        groupAssetAssignmentRanges,
        entryOffset
      ),
      ...readXmlAssetAssignments(content)
    };

    candidates.push({
      loginKey,
      loginMode: loginMode as OriginalTestcenterOperationalLoginMode,
      groupKey,
      ...(groupLabel ? { groupLabel } : {}),
      passwordRequired: Boolean(password),
      profileIds: uniqueProfileIds,
      monitorProfiles: uniqueProfileIds.flatMap(profileId => {
        const profile = monitorProfiles.get(profileId);
        return profile ? [profile] : [];
      }),
      monitorBookletVisibility,
      customTexts: { ...customTexts },
      ...(Object.keys(assetAssignments).length > 0
        ? { assetAssignments }
        : {}),
      unresolvedProfileIds: uniqueProfileIds.filter(
        profileId => !monitorProfiles.has(profileId)
      ),
      ...(validFrom ? { validFrom } : {}),
      ...(validTo ? { validTo } : {}),
      ...(validForMinutes ? { validForMinutes } : {})
    });
  }

  return candidates;
};

export const parseParticipantRosterText = (
  rosterText: ParticipantRosterSource
): ParsedParticipantRosterEntry[] => {
  if (typeof rosterText !== "string") {
    return mergeParsedParticipantRosterEntries(
      parseParticipantRosterJsonValue(rosterText)
    );
  }

  const trimmedRosterText = rosterText.trimStart();
  const jsonEntries = parseParticipantRosterJsonText(rosterText);
  if (
    jsonEntries.length > 0 ||
    trimmedRosterText.startsWith("{") ||
    trimmedRosterText.startsWith("[")
  ) {
    return mergeParsedParticipantRosterEntries(jsonEntries);
  }

  const xmlEntries = parseParticipantRosterXmlText(rosterText);
  if (xmlEntries.length > 0 || trimmedRosterText.startsWith("<")) {
    return xmlEntries;
  }

  return parseDelimitedRosterRows(rosterText);
};
