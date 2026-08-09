import { participantExecutionModes as supportedParticipantExecutionModes } from "@testcenter-rewrite-app/domain";
import type {
  AdminAuditEvent,
  AdminAuditEventType,
  AdminRole,
  AdminRoleAssignment,
  AdminSession,
  AdminSessionStatus,
  AdminUser,
  AdminUserStatus,
  ApplicationSettings,
  ContentReleaseActivationReadiness,
  ContentRelease,
  ContentReleaseStatus,
  ImportJob,
  ImportJobStatus,
  MonitorRunCommandResult,
  MonitorRunCommandType,
  MonitorViewProfile,
  MonitorViewProfileFilter,
  OpenMonitorRun,
  OperationalLoginMigrationCandidate,
  ParticipantExecutionMode,
  ParticipantRuntimeBooklet,
  ParticipantTestLogEntryInput,
  ParticipantCurrentRunState,
  ParticipantRosterEntry,
  ParticipantSession,
  ParticipantSessionStatus,
  ParticipantRuntimeState,
  SourcePackage,
  SourcePackageStatus,
  SourcePackageContentStructure,
  WorkspaceFileType,
  SystemCheckReport,
  SystemCheckReportDeletion,
  SystemCheckReportEntry,
  SystemCheckReportStatistics,
  Tenant,
  TestRun,
  Workspace,
  WorkspaceDeletion,
  WorkspaceAttachment,
  WorkspaceContentReleaseListItem,
  WorkspaceContentReleaseDetail,
  WorkspaceActivityEventListItem,
  WorkspaceImportJobDetail,
  WorkspaceImportJobListItem,
  WorkspaceDetailedResponse,
  WorkspaceGroupResultsDeletion,
  WorkspaceGroupResultSummary,
  WorkspaceGroupResultDeletion,
  WorkspaceParticipantSessionDetail,
  WorkspaceParticipantRosterItem,
  WorkspaceParticipantSessionListItem,
  WorkspaceParticipantTestLogListItem,
  WorkspaceReviewListItem,
  WorkspaceReview,
  WorkspaceActivityEventType,
  WorkspaceActivitySubjectType,
  WorkspaceSourcePackageDetail,
  WorkspaceSourcePackageDeletion,
  WorkspaceSourcePackageDeletionReadiness,
  WorkspaceSourcePackageListItem,
  WorkspaceSystemCheck,
  WorkspaceStudyMonitorBookletDetail,
  WorkspaceStudyMonitorGroupDetail,
  WorkspaceStudyMonitorParticipantDetail,
  WorkspaceStudyMonitorParticipantMatrix,
  WorkspaceStudyMonitorRunDetail,
  WorkspaceStudyMonitorUnitDetail,
  WorkspaceStudyMonitorSummary,
  WorkspaceOverview
} from "@testcenter-rewrite-app/domain";

export * from "./verona-player.js";
export * from "./booklet-policy.js";
export * from "./browser-compatibility.js";
export * from "./monitor-event-stream.js";
export * from "./participant-event-stream.js";
export * from "./monitor-custom-texts.js";
export * from "./participant-custom-texts.js";

export type ParsedParticipantRosterEntry = {
  loginKey: string;
  executionMode?: ParticipantExecutionMode;
  groupKey: string;
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
  if (!value || !/^\d+$/.test(value)) {
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
    value.items
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
      bookletKey: string | null;
      validFrom: string | null;
      validTo: string | null;
      validForMinutes: number | null;
      customTexts: Record<string, string>;
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
    const explicitLoginKey = readJsonRosterString(
      objectValue,
      "loginKey",
      "login",
      "username",
      "userName",
      "code",
      "identifier"
    );
    const loginKey =
      explicitLoginKey ??
      (childValues.length === 0 ? readJsonRosterString(objectValue, "id") : null);
    const mode = readJsonRosterString(
      objectValue,
      "mode",
      "loginMode",
      "testMode",
      "executionMode"
    );
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
      entries.push({
        loginKey,
        ...(executionMode ? { executionMode } : {}),
        groupKey: groupKey || `group:${loginKey}`,
        bookletKey,
        displayName: combineRosterDisplayName(
          readJsonRosterString(
            objectValue,
            "displayName",
            "displayLabel",
            "label",
            "name",
            "fullName"
          ),
          readJsonRosterString(objectValue, "firstName", "firstname", "givenName"),
          readJsonRosterString(objectValue, "lastName", "lastname", "familyName")
        ),
        ...(password ? { password } : {}),
        ...(validFrom ? { validFrom } : {}),
        ...(validTo ? { validTo } : {}),
        ...(validForMinutes ? { validForMinutes } : {}),
        ...(Object.keys(customTexts).length > 0 ? { customTexts } : {})
      });
      return;
    }

    const childContext = {
      groupKey,
      bookletKey,
      validFrom,
      validTo,
      validForMinutes,
      customTexts
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
        bookletKey,
        validFrom,
        validTo,
        validForMinutes,
        customTexts
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
        customTexts
      });
    }
  };

  visit(parsed, {
    groupKey: null,
    bookletKey: null,
    validFrom: null,
    validTo: null,
    validForMinutes: null,
    customTexts: {}
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

    entries.push({
      loginKey,
      ...(executionMode ? { executionMode } : {}),
      groupKey: groupKey || `group:${loginKey}`,
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

    entries.push({
      loginKey,
      ...(executionMode ? { executionMode } : {}),
      groupKey: groupKey || `group:${loginKey}`,
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

export const parseOriginalTestcenterOperationalLogins = (
  rosterText: ParticipantRosterSource
): OriginalTestcenterOperationalLoginCandidate[] => {
  if (
    typeof rosterText !== "string" ||
    !rosterText.trimStart().startsWith("<")
  ) {
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

    candidates.push({
      loginKey,
      loginMode: loginMode as OriginalTestcenterOperationalLoginMode,
      groupKey,
      passwordRequired: Boolean(password),
      profileIds: uniqueProfileIds,
      monitorProfiles: uniqueProfileIds.flatMap(profileId => {
        const profile = monitorProfiles.get(profileId);
        return profile ? [profile] : [];
      }),
      customTexts: { ...customTexts },
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

export const productionApiRoutes = {
  admin: {
    bootstrap: "/api/v1/admin/auth/bootstrap",
    signIn: "/api/v1/admin/auth/sign-in",
    signOut: "/api/v1/admin/auth/sign-out",
    changeOwnPassword: "/api/v1/admin/auth/password",
    currentSession: "/api/v1/admin/auth/current-session",
    listSessions: "/api/v1/admin/auth/sessions",
    revokeSessions: "/api/v1/admin/auth/sessions:revoke",
    revokeSession: "/api/v1/admin/auth/sessions/:adminSessionId",
    exportSessionsCsv: "/api/v1/admin/auth/sessions.csv",
    listUsers: "/api/v1/admin/users",
    createUser: "/api/v1/admin/users",
    updateUser: "/api/v1/admin/users/:adminUserId",
    deleteUser: "/api/v1/admin/users/:adminUserId",
    resetPassword: "/api/v1/admin/users/:adminUserId/password",
    assignRole: "/api/v1/admin/users/:adminUserId/role-assignments",
    revokeRole:
      "/api/v1/admin/users/:adminUserId/role-assignments/:roleAssignmentId",
    exportUsersCsv: "/api/v1/admin/users.csv",
    listAuditEvents: "/api/v1/admin/audit-events",
    exportAuditEventsCsv: "/api/v1/admin/audit-events.csv",
    updateApplicationSettings: "/api/v1/admin/application-settings"
  },
  platform: {
    listTenants: "/api/v1/platform/tenants",
    exportTenantsCsv: "/api/v1/platform/tenants.csv",
    createTenant: "/api/v1/platform/tenants"
  },
  workspace: {
    createWorkspace: "/api/v1/tenants/:tenantKey/workspaces",
    listWorkspaces: "/api/v1/tenants/:tenantKey/workspaces",
    exportWorkspacesCsv: "/api/v1/tenants/:tenantKey/workspaces.csv",
    getWorkspaceOverview: "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey",
    updateWorkspace: "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey",
    deleteWorkspace: "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey",
    exportWorkspaceOverviewCsv:
      "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/exports/workspace-overview.csv",
    getStudyMonitorSummary:
      "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/study-monitor/summary",
    getStudyMonitorParticipantMatrix:
      "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/study-monitor/participants",
    getStudyMonitorParticipant:
      "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/study-monitor/participants/:loginKey",
    getStudyMonitorGroup:
      "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/study-monitor/groups/:groupKey",
    getStudyMonitorBooklet:
      "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/study-monitor/booklets/:bookletKey",
    getStudyMonitorUnit:
      "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/study-monitor/units/:unitKey",
    getStudyMonitorRun:
      "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/study-monitor/runs/:testRunId",
    listWorkspaceActivityEvents:
      "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/activity-events",
    listAttachments:
      "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/attachments",
    downloadAttachmentPagesPdf:
      "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/attachments/pages.pdf",
    getAttachment:
      "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/attachments/:attachmentId",
    downloadAttachmentPagePdf:
      "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/attachments/:attachmentId/page.pdf",
    uploadAttachmentFile:
      "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/attachments/:attachmentId/files",
    getAttachmentFile:
      "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/attachments/:attachmentId/files/:attachmentFileId",
    deleteAttachmentFile:
      "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/attachments/:attachmentId/files/:attachmentFileId",
    createSourcePackage: "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/source-packages",
    assembleSourcePackages:
      "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/source-package-assemblies",
    listSourcePackages: "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/source-packages",
    getSourcePackage:
      "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/source-packages/:sourcePackageId",
    downloadSourcePackage:
      "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/source-packages/:sourcePackageId/download",
    getSourcePackageDeletionReadiness:
      "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/source-packages/:sourcePackageId/deletion-readiness",
    deleteSourcePackage:
      "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/source-packages/:sourcePackageId",
    deleteSourcePackages:
      "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/source-package-deletions",
    replaceSourcePackage:
      "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/source-packages/:sourcePackageId/replacements",
    exportSourcePackagesCsv:
      "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/exports/source-packages.csv",
    retrySourcePackageImport:
      "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/source-packages/:sourcePackageId/retry-import",
    createImportJob: "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/import-jobs",
    listImportJobs: "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/import-jobs",
    getImportJob:
      "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/import-jobs/:importJobId",
    exportImportJobsCsv:
      "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/exports/import-jobs.csv",
    listParticipantSessions:
      "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/participant-sessions",
    getParticipantSession:
      "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/participant-sessions/:participantSessionId",
    exportParticipantSessionsCsv:
      "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/exports/participant-sessions.csv",
    importParticipantRoster:
      "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/participant-roster",
    listParticipantRoster:
      "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/participant-roster",
    exportParticipantRosterCsv:
      "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/exports/participant-roster.csv",
    exportStudyMonitorCsv:
      "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/exports/study-monitor.csv",
    exportStudyMonitorParticipantMatrixCsv:
      "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/exports/study-monitor-participants.csv",
    exportStudyMonitorRunCsv:
      "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/exports/study-monitor-runs/:testRunId.csv",
    exportOpenRunsCsv:
      "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/exports/open-runs.csv",
    exportResponseCsv:
      "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/exports/responses.csv",
    exportOriginalResultArchive:
      "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/exports/original-results.zip",
    exportLogCsv:
      "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/exports/logs.csv",
    exportActivityCsv:
      "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/exports/activity-events.csv",
    listParticipantTestLogs:
      "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/test-logs",
    exportReviewCsv:
      "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/exports/reviews.csv",
    listDetailedResponses:
      "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/responses/detailed",
    listGroupResults:
      "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/results/groups",
    listReviews:
      "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/reviews",
    createReview:
      "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/reviews",
    updateReview:
      "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/reviews/:reviewId",
    deleteReview:
      "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/reviews/:reviewId",
    deleteGroupResults:
      "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/results/groups/:groupKey",
    deleteGroupResultsBulk:
      "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/results/groups",
    listContentReleases:
      "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/content-releases",
    exportContentReleasesCsv:
      "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/exports/content-releases.csv",
    listSystemChecks:
      "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/system-checks",
    getSystemCheck:
      "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/system-checks/:checkId",
    saveSystemCheckReport:
      "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/system-checks/:checkId/reports",
    listSystemCheckReports:
      "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/system-check-reports",
    getSystemCheckReportStatistics:
      "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/system-check-reports/statistics",
    deleteSystemCheckReports:
      "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/system-check-reports",
    importSystemCheckReport:
      "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/system-check-reports/import",
    exportSystemCheckReportsCsv:
      "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/exports/system-check-reports.csv",
    exportSystemCheckReportsJson:
      "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/exports/system-check-reports.json",
    getContentRelease:
      "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/content-releases/:contentReleaseId",
    getContentReleaseActivationReadiness:
      "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/content-releases/:contentReleaseId/activation-readiness",
    activateContentRelease:
      "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/content-releases/:contentReleaseId/activate"
  },
  participant: {
    signIn: "/api/v1/participant/auth/sign-in",
    launch: "/api/v1/participant/starter:launch",
    getRuntimeState: "/api/v1/participant/sessions/:participantSessionId/runtime-state",
    getCurrentRunState:
      "/api/v1/participant/sessions/:participantSessionId/current-state",
    eventStream:
      "/api/v1/participant/sessions/:participantSessionId/events",
    getResource:
      "/api/v1/participant/sessions/:participantSessionId/resources/:resourcePath",
    saveProgress: "/api/v1/participant/test-runs/:testRunId/save-progress",
    saveTestLogs: "/api/v1/participant/test-runs/:testRunId/test-logs",
    selectAdaptiveState:
      "/api/v1/participant/test-runs/:testRunId/adaptive-states/:stateKey",
    listReviews: "/api/v1/participant/test-runs/:testRunId/reviews",
    createReview: "/api/v1/participant/test-runs/:testRunId/reviews",
    updateReview:
      "/api/v1/participant/test-runs/:testRunId/reviews/:reviewId",
    deleteReview:
      "/api/v1/participant/test-runs/:testRunId/reviews/:reviewId",
    unlockTestlet:
      "/api/v1/participant/test-runs/:testRunId/testlets/:testletKey/unlock",
    resumeSession: "/api/v1/participant/sessions/:participantSessionId/resume",
    resumeRun: "/api/v1/participant/test-runs/:testRunId/resume",
    completeRun: "/api/v1/participant/test-runs/:testRunId/complete"
  },
  monitor: {
    openRuns: "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/monitor/open-runs",
    eventStream:
      "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/monitor/events",
    issueRunCommands:
      "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/monitor/open-runs/commands",
    issueRunCommand:
      "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/monitor/open-runs/:testRunId/commands"
  },
  system: {
    getApplicationSettings: "/api/v1/system/application-settings",
    getRuntimeDiagnostics: "/diagnostics/runtime",
    getRuntimeConfig: "/diagnostics/config",
    getSystemCheckAccess: "/api/v1/system-check/access",
    downloadSpeedTestPackage: "/speed-test/random-package/:size",
    uploadSpeedTestPackage: "/speed-test/random-package"
  }
} as const;

export type CreateTenantRequest = {
  tenantKey: string;
  displayName: string;
};

export type CreateWorkspaceRequest = {
  workspaceKey: string;
  displayName: string;
};

export type UpdateWorkspaceRequest = {
  displayName: string;
};

export type DeleteWorkspaceRequest = {
  confirmation: string;
};

export type SourceDocumentSource =
  | string
  | Record<string, unknown>
  | unknown[];

export type CreateSourcePackageRequest = {
  fileName: string;
  mediaType: string;
  contentStructure?: SourcePackageContentStructure;
  sourceDocument?: SourceDocumentSource;
};

export type AssembleSourcePackagesRequest = {
  fileName: string;
  sourcePackageIds: string[];
};

export type CreateImportJobRequest = {
  sourcePackageId: string;
};

export type RetrySourcePackageImportRequest = {
  fileName?: string;
  mediaType?: string;
  contentStructure?: SourcePackageContentStructure | null;
  sourceDocument?: SourceDocumentSource | null;
};

export type DeleteSourcePackageRequest = {
  confirmation: string;
};

export type DeleteSourcePackagesRequest = {
  items: Array<{
    sourcePackageId: string;
    confirmation: string;
  }>;
};

export type SourcePackageBatchDeletionIssue = {
  sourcePackageId: string;
  fileName: string | null;
  error: string;
  message: string;
  details?: unknown;
};

export type ReplaceSourcePackageRequest = CreateSourcePackageRequest;

export type ActivateContentReleaseRequest = {
  activatedByActorId: string;
  forceActivation?: boolean;
};

export type ApiErrorResponse = {
  error: string;
  message: string;
  details?: unknown;
};

export type ActivateContentReleaseBlockedErrorDetails = {
  activeContentReleaseId: string;
  openRuns: OpenMonitorRun[];
};

export type WorkspaceActivityEventListQuery = {
  eventType?: WorkspaceActivityEventType;
  subjectType?: WorkspaceActivitySubjectType;
  subjectId?: string;
  limit?: number;
};

export type ParticipantSessionListQuery = {
  status?: ParticipantSessionStatus;
  groupKey?: string;
  loginKey?: string;
  bookletKey?: string;
  contentReleaseId?: string;
  limit?: number;
};

export type DetailedResponseListQuery = {
  loginKey?: string;
  groupKey?: string;
  groupKeys?: string[];
  bookletKey?: string;
  participantSessionId?: string;
  testRunId?: string;
  unitKey?: string;
  status?: TestRun["status"];
  limit?: number;
};

export type WorkspaceReviewListQuery = {
  loginKey?: string;
  groupKey?: string;
  groupKeys?: string[];
  bookletKey?: string;
  participantSessionId?: string;
  testRunId?: string;
  unitKey?: string;
  reviewerId?: string;
  category?: string;
  limit?: number;
};

export type SourcePackageListQuery = {
  status?: SourcePackageStatus;
  fileType?: WorkspaceFileType;
  mediaType?: string;
  fileName?: string;
  latestImportStatus?: ImportJobStatus;
  limit?: number;
};

export type ImportJobListQuery = {
  status?: ImportJobStatus;
  sourcePackageId?: string;
  limit?: number;
};

export type ContentReleaseListQuery = {
  status?: ContentReleaseStatus;
  importJobId?: string;
  sourcePackageId?: string;
  limit?: number;
};

export type SystemCheckReportListQuery = {
  checkId?: string;
  limit?: number;
};

export type SystemCheckSpeedTestUploadResponse = {
  requestTime: number;
  packageReceivedSize: number;
};

export type SaveSystemCheckReportRequest = {
  keyPhrase?: string;
  title?: string;
  responses?: unknown;
  environment: SystemCheckReportEntry[];
  network: SystemCheckReportEntry[];
  questionnaire: SystemCheckReportEntry[];
  unit: SystemCheckReportEntry[];
};

export type DeleteSystemCheckReportsRequest = {
  checkIds: string[];
  confirmation: string;
};

export type ImportSystemCheckReportRequest = {
  fileName: string;
  modifiedAt?: string;
  report: unknown;
};

export type AdminUserListQuery = {
  username?: string;
  status?: AdminUserStatus;
  accessStatus?: AdminUserAccessStatus;
  passwordChangeRequired?: boolean;
  role?: AdminRole;
  tenantKey?: string;
  workspaceKey?: string;
  limit?: number;
};

export type AdminUserAccessStatus = "available" | "scheduled" | "expired";

export type AdminSessionListQuery = {
  adminUserId?: string;
  status?: AdminSessionStatus;
  limit?: number;
};

export type AdminAuditEventListQuery = {
  eventType?: AdminAuditEventType;
  actorAdminUserId?: string;
  subjectAdminUserId?: string;
  limit?: number;
};

export type ParticipantSignInRequest = {
  tenantKey?: string;
  workspaceKey: string;
  loginKey: string;
  groupKey?: string;
  password?: string;
  participantCode?: string;
};

export type PublicAdminUser = Omit<AdminUser, "passwordHash">;

export type PublicAdminSession = Omit<AdminSession, "token">;

export type PublicAdminRoleAssignment = AdminRoleAssignment;

export type OperatorAccessMode =
  | "admin"
  | "admin_read_only"
  | "study_monitor"
  | "group_monitor"
  | "system_check"
  | "unassigned";

const isEnabledMonitorProfileFlag = (value: string): boolean =>
  ["1", "true", "on", "yes"].includes(value.trim().toLowerCase());

export type OpenMonitorRunSuperState =
  | "pending"
  | "locked"
  | "error"
  | "controller_terminated"
  | "connection_lost"
  | "paused"
  | "focus_lost"
  | "idle"
  | "connection_websocket"
  | "connection_polling"
  | "ok";

export const resolveOpenMonitorRunSuperState = (
  openRun: OpenMonitorRun,
  currentTimestamp = Date.now()
): OpenMonitorRunSuperState => {
  const testState = openRun.testState;
  if (testState.status === "pending" || openRun.status === "created") {
    return "pending";
  }
  if (testState.status === "locked" || openRun.locked) {
    return "locked";
  }
  if (testState.CONTROLLER === "ERROR") {
    return "error";
  }
  if (
    testState.CONTROLLER === "TERMINATED" ||
    testState.CONTROLLER === "TERMINATED_PAUSED"
  ) {
    return "controller_terminated";
  }
  if (testState.CONNECTION === "LOST") {
    return "connection_lost";
  }
  if (testState.CONTROLLER === "PAUSED" || openRun.status === "paused") {
    return "paused";
  }
  if (testState.FOCUS === "HAS_NOT") {
    return "focus_lost";
  }
  const lastActivityTimestamp = Date.parse(openRun.updatedAt);
  if (
    Number.isFinite(lastActivityTimestamp) &&
    currentTimestamp - lastActivityTimestamp > 5 * 60 * 1_000
  ) {
    return "idle";
  }
  if (testState.CONNECTION === "WEBSOCKET") {
    return "connection_websocket";
  }
  if (testState.CONNECTION === "POLLING") {
    return "connection_polling";
  }
  return "ok";
};

const monitorProfileFilterExcludesRun = (
  openRun: OpenMonitorRun,
  filter: MonitorViewProfileFilter,
  currentTimestamp: number
): boolean => {
  const scalarValue = Array.isArray(filter.value) ? "" : filter.value;
  const expected = filter.subValue || scalarValue;
  let subject: string;
  switch (filter.target) {
    case "groupName":
      subject = openRun.groupKey;
      break;
    case "personLabel":
      subject = openRun.participantRosterEntry?.displayName ?? openRun.loginKey;
      break;
    case "mode":
      subject = openRun.executionMode;
      break;
    case "bookletId":
      subject = openRun.bookletKey;
      break;
    case "bookletLabel":
      subject = openRun.bookletLabel ?? openRun.bookletKey;
      break;
    case "bookletSpecies":
      subject = openRun.bookletSpecies ?? "";
      break;
    case "unitId":
      subject = openRun.currentUnitKey ?? "";
      break;
    case "unitLabel":
      subject = openRun.currentUnitLabel ?? openRun.currentUnitKey ?? "";
      break;
    case "blockId":
      subject = openRun.currentBlockKey ?? "";
      break;
    case "blockLabel":
      subject = openRun.currentBlockLabel ?? openRun.currentBlockKey ?? "";
      break;
    case "state":
      subject = resolveOpenMonitorRunSuperState(openRun, currentTimestamp);
      break;
    case "testState":
      subject = openRun.testState[scalarValue] ?? "";
      break;
    case "bookletStates":
      subject = openRun.bookletStates[scalarValue] ?? "";
      break;
    default:
      return false;
  }

  let matches = false;
  if (Array.isArray(filter.value)) {
    matches = filter.value.includes(subject);
  } else if (filter.type === "substring") {
    matches = subject.includes(expected);
  } else if (filter.type === "regex") {
    try {
      matches = new RegExp(expected).test(subject);
    } catch {
      matches = false;
    }
  } else if (filter.type === "equal" || filter.type === "equals") {
    matches = subject === expected;
  }
  return filter.not ? !matches : matches;
};

export const filterOpenMonitorRunsByProfile = (
  openRuns: OpenMonitorRun[],
  profile: MonitorViewProfile | null,
  currentTimestamp = Date.now()
): OpenMonitorRun[] => {
  if (!profile) {
    return openRuns;
  }
  return openRuns.filter(openRun => {
    const superState = resolveOpenMonitorRunSuperState(
      openRun,
      currentTimestamp
    );
    if (
      isEnabledMonitorProfileFlag(profile.filtersEnabled.pending) &&
      superState === "pending"
    ) {
      return false;
    }
    if (
      isEnabledMonitorProfileFlag(profile.filtersEnabled.locked) &&
      superState === "locked"
    ) {
      return false;
    }
    return !profile.filters.some(filter =>
      monitorProfileFilterExcludesRun(openRun, filter, currentTimestamp)
    );
  });
};

export const resolveOperatorAccessMode = (
  roleAssignments: ReadonlyArray<
    Pick<AdminRoleAssignment, "role"> &
      Partial<Pick<AdminRoleAssignment, "accessMode">>
  >
): OperatorAccessMode => {
  if (
    roleAssignments.some(
      ({ role, accessMode }) =>
        role === "platform_admin" ||
        role === "tenant_admin" ||
        (role === "workspace_admin" && accessMode !== "read_only")
    )
  ) {
    return "admin";
  }
  if (roleAssignments.some(({ role }) => role === "workspace_admin")) {
    return "admin_read_only";
  }
  if (roleAssignments.some(({ role }) => role === "study_monitor")) {
    return "study_monitor";
  }
  if (roleAssignments.some(({ role }) => role === "group_monitor")) {
    return "group_monitor";
  }
  if (roleAssignments.some(({ role }) => role === "system_check")) {
    return "system_check";
  }
  return "unassigned";
};

export type BootstrapAdminUserRequest = {
  username: string;
  displayName?: string;
  password: string;
};

export type AdminSignInRequest = {
  username: string;
  password: string;
};

export const adminPasswordPolicy = {
  minimumLength: 8,
  maximumLength: 60
} as const;

export type ChangeAdminPasswordRequest = {
  password: string;
};

export type AdminAccessWindowErrorDetails = {
  accessStatus: "scheduled" | "expired";
  accessAt: string;
  customTexts: Record<string, string>;
};

export type AdminRoleAssignmentRequest = {
  role: AdminRole;
  accessMode?: AdminRoleAssignment["accessMode"] | "RW" | "RO";
  tenantKey?: string | null;
  workspaceKey?: string | null;
  groupKey?: string | null;
  monitorProfiles?: MonitorViewProfile[];
};

export type CreateAdminUserRequest = {
  username: string;
  displayName?: string;
  password: string;
  confirmationPassword?: string;
  customTexts?: Record<string, string>;
  validFrom?: string | null;
  validTo?: string | null;
  validForMinutes?: number | null;
  roleAssignments?: AdminRoleAssignmentRequest[];
};

export type UpdateAdminUserRequest = {
  displayName?: string;
  status?: AdminUserStatus;
  customTexts?: Record<string, string>;
  validFrom?: string | null;
  validTo?: string | null;
  validForMinutes?: number | null;
};

export type ResetAdminUserPasswordRequest = {
  password: string;
};

export type AssignAdminRoleRequest = AdminRoleAssignmentRequest & {
  confirmationPassword?: string;
};

export type RevokeAdminRoleRequest = {
  confirmationPassword?: string;
};

export type UpdateApplicationSettingsRequest = {
  appTitle: string;
  mainLogo?: string;
  themeName?: ApplicationSettings["themeName"];
  introHtml?: string;
  legalNoticeHtml?: string;
  customTexts?: Record<string, string>;
  globalWarningText?: string | null;
  globalWarningExpiresAt?: string | null;
};

export type ParticipantLaunchRequest = {
  participantSessionId?: string;
  tenantKey?: string | null;
  workspaceKey?: string;
  loginKey?: string;
  groupKey?: string;
  bookletKey?: string;
  password?: string;
  participantCode?: string;
};

export type ImportParticipantRosterRequest = {
  rosterText: ParticipantRosterSource;
};

export type ResumeParticipantSessionRequest = {
  bookletKey?: string;
};

export type SaveTestRunProgressRequest = {
  deliveryId?: string;
  currentUnitKey?: string | null;
  /** Unit receiving `unitResponse`; defaults to `currentUnitKey` for compatibility. */
  responseUnitKey?: string | null;
  status: Extract<TestRun["status"], "running" | "paused">;
  unitResponse?: string | null;
  confirmTestletTimeLeave?: boolean;
  confirmTestletLeaveLock?: boolean;
  logs?: Array<{
    unitKey?: string | null;
    originalUnitId?: string | null;
    entries: ParticipantTestLogEntryInput[];
  }>;
};

export type SaveParticipantTestLogsRequest = {
  deliveryId?: string;
  logs: Array<{
    unitKey?: string | null;
    originalUnitId?: string | null;
    entries: ParticipantTestLogEntryInput[];
  }>;
};

export type SelectParticipantAdaptiveStateRequest = {
  optionKey: string;
};

export type CreateParticipantReviewRequest = {
  unitKey?: string | null;
  page?: number | null;
  pageLabel?: string | null;
  reviewerId?: string;
  category?: string;
  categories?: string[];
  priority?: 0 | 1 | 2 | 3;
  comment: string;
};

export type UpdateParticipantReviewRequest = {
  unitKey?: string | null;
  page?: number | null;
  pageLabel?: string | null;
  reviewerId?: string;
  category?: string;
  categories?: string[];
  priority?: 0 | 1 | 2 | 3;
  comment?: string;
};

export type ParticipantTestLogListQuery = {
  loginKey?: string;
  groupKey?: string;
  bookletKey?: string;
  testRunId?: string;
  unitKey?: string;
  logKey?: string;
  limit?: number;
};

export type UnlockParticipantTestletRequest = {
  code: string;
};

export type CompleteTestRunRequest = {
  confirmTestletTimeLeave?: boolean;
  confirmTestletLeaveLock?: boolean;
};

export type CreateTenantResponse = {
  tenant: Tenant;
};

export type ListTenantsResponse = {
  items: Tenant[];
};

export type CreateWorkspaceResponse = {
  workspace: Workspace;
};

export type UpdateWorkspaceResponse = {
  workspace: Workspace;
};

export type DeleteWorkspaceResponse = {
  deletion: WorkspaceDeletion;
};

export type ListWorkspacesResponse = {
  items: Workspace[];
};

export type BootstrapAdminUserResponse = {
  adminUser: PublicAdminUser;
  roleAssignments: PublicAdminRoleAssignment[];
};

export type AdminSignInResponse = {
  adminUser: PublicAdminUser;
  adminSession: PublicAdminSession;
  roleAssignments: PublicAdminRoleAssignment[];
  sessionToken: string;
};

export type GetAdminCurrentSessionResponse = {
  adminUser: PublicAdminUser;
  adminSession: PublicAdminSession;
  roleAssignments: PublicAdminRoleAssignment[];
};

export type AdminSignOutResponse = {
  adminSession: PublicAdminSession;
};

export type ChangeAdminPasswordResponse = {
  adminUser: PublicAdminUser;
  revokedAdminSessionIds: string[];
};

export type AdminSessionDirectoryItem = {
  adminSession: PublicAdminSession;
  adminUser: PublicAdminUser;
  status: AdminSessionStatus;
};

export type ListAdminSessionsResponse = {
  items: AdminSessionDirectoryItem[];
};

export type RevokeAdminSessionResponse = {
  adminSession: PublicAdminSession;
};

export type RevokeAdminSessionsRequest = {
  adminSessionIds: string[];
};

export type RevokeAdminSessionsResponse = {
  requestedCount: number;
  adminSessions: PublicAdminSession[];
  failures: Array<{
    adminSessionId: string;
    statusCode: number;
    error: string;
    message: string;
    details: unknown;
  }>;
};

export type AdminUserDirectoryItem = {
  adminUser: PublicAdminUser;
  roleAssignments: PublicAdminRoleAssignment[];
};

export type ListAdminUsersResponse = {
  items: AdminUserDirectoryItem[];
};

export type CreateAdminUserResponse = AdminUserDirectoryItem;

export type UpdateAdminUserResponse = AdminUserDirectoryItem;

export type DeleteAdminUserResponse = {
  adminUserId: string;
  username: string;
  deletedRoleAssignmentCount: number;
  deletedSessionCount: number;
};

export type ResetAdminUserPasswordResponse = AdminUserDirectoryItem;

export type AssignAdminRoleResponse = AdminUserDirectoryItem;

export type RevokeAdminRoleResponse = AdminUserDirectoryItem;

export type ListAdminAuditEventsResponse = {
  items: AdminAuditEvent[];
};

export type GetApplicationSettingsResponse = {
  applicationSettings: ApplicationSettings;
};

export type UpdateApplicationSettingsResponse = GetApplicationSettingsResponse;

export type ListAttachmentsResponse = {
  items: WorkspaceAttachment[];
};

export type GetAttachmentResponse = {
  attachment: WorkspaceAttachment;
};

export type UploadAttachmentFileRequest = {
  fileName: string;
  mediaType: string;
  dataBase64: string;
};

export type UploadAttachmentFileResponse = GetAttachmentResponse;

export type DeleteAttachmentFileResponse = GetAttachmentResponse;

export type GetWorkspaceOverviewResponse = {
  workspaceOverview: WorkspaceOverview;
};

export type GetStudyMonitorSummaryResponse = {
  studyMonitorSummary: WorkspaceStudyMonitorSummary;
};

export type GetStudyMonitorParticipantMatrixResponse = {
  studyMonitorParticipantMatrix: WorkspaceStudyMonitorParticipantMatrix;
};

export type GetStudyMonitorParticipantResponse = {
  studyMonitorParticipant: WorkspaceStudyMonitorParticipantDetail;
};

export type GetStudyMonitorGroupResponse = {
  studyMonitorGroup: WorkspaceStudyMonitorGroupDetail;
};

export type GetStudyMonitorBookletResponse = {
  studyMonitorBooklet: WorkspaceStudyMonitorBookletDetail;
};

export type GetStudyMonitorUnitResponse = {
  studyMonitorUnit: WorkspaceStudyMonitorUnitDetail;
};

export type GetStudyMonitorRunResponse = {
  studyMonitorRun: WorkspaceStudyMonitorRunDetail;
};

export type ListWorkspaceActivityEventsResponse = {
  items: WorkspaceActivityEventListItem[];
};

export type CreateSourcePackageResponse = {
  sourcePackage: SourcePackage;
};

export type ParticipantRosterImportSummary = {
  sourceFileNames: string[];
  importedCount: number;
  updatedCount: number;
  operationalLoginCandidateCount: number;
};

export type AssembleSourcePackagesResponse = {
  sourcePackage: SourcePackage;
  assembledFrom: Array<{
    sourcePackageId: string;
    fileName: string;
    sizeBytes: number;
  }>;
  importJob: ImportJob;
  stagedContentRelease: ContentRelease | null;
  participantRosterImport?: ParticipantRosterImportSummary;
};

export type CreateImportJobResponse = {
  importJob: ImportJob;
  stagedContentRelease: ContentRelease | null;
  participantRosterImport?: ParticipantRosterImportSummary;
};

export type RetrySourcePackageImportResponse = {
  sourcePackage: SourcePackage;
  importJob: ImportJob;
  stagedContentRelease: ContentRelease | null;
  participantRosterImport?: ParticipantRosterImportSummary;
};

export type GetSourcePackageDeletionReadinessResponse = {
  deletionReadiness: WorkspaceSourcePackageDeletionReadiness;
};

export type DeleteSourcePackageResponse = {
  deletion: WorkspaceSourcePackageDeletion;
};

export type DeleteSourcePackagesResponse = {
  report: {
    requestedCount: number;
    deleted: WorkspaceSourcePackageDeletion[];
    didNotExist: SourcePackageBatchDeletionIssue[];
    notAllowed: SourcePackageBatchDeletionIssue[];
    wasUsed: SourcePackageBatchDeletionIssue[];
    errors: SourcePackageBatchDeletionIssue[];
  };
};

export type ReplaceSourcePackageResponse = {
  replacedSourcePackage: SourcePackage;
  replacementSourcePackage: SourcePackage;
  importJob: ImportJob;
  stagedContentRelease: ContentRelease | null;
  participantRosterImport?: ParticipantRosterImportSummary;
};

export type ListSourcePackagesResponse = {
  items: WorkspaceSourcePackageListItem[];
};

export type GetSourcePackageResponse = {
  sourcePackageDetail: WorkspaceSourcePackageDetail;
};

export type ListImportJobsResponse = {
  items: WorkspaceImportJobListItem[];
};

export type GetImportJobResponse = {
  importJobDetail: WorkspaceImportJobDetail;
};

export type ListParticipantSessionsResponse = {
  items: WorkspaceParticipantSessionListItem[];
};

export type GetParticipantSessionResponse = {
  participantSessionDetail: WorkspaceParticipantSessionDetail;
};

export type ImportParticipantRosterResponse = {
  importedCount: number;
  updatedCount: number;
  operationalLoginCandidates: OriginalTestcenterOperationalLoginCandidate[];
  items: WorkspaceParticipantRosterItem[];
};

export type ListParticipantRosterResponse = {
  items: WorkspaceParticipantRosterItem[];
  operationalLoginCandidates: OriginalTestcenterOperationalLoginCandidate[];
};

export type ListDetailedResponsesResponse = {
  items: WorkspaceDetailedResponse[];
};

export type ListGroupResultsResponse = {
  items: WorkspaceGroupResultSummary[];
};

export type CreateReviewRequest = {
  participantSessionId: string;
  testRunId: string;
  unitKey?: string | null;
  page?: number | null;
  pageLabel?: string | null;
  reviewerId: string;
  category?: string;
  categories?: string[];
  priority?: 0 | 1 | 2 | 3;
  comment: string;
};

export type UpdateReviewRequest = {
  unitKey?: string | null;
  page?: number | null;
  pageLabel?: string | null;
  reviewerId?: string;
  category?: string;
  categories?: string[];
  priority?: 0 | 1 | 2 | 3;
  comment?: string;
};

export type ListReviewsResponse = {
  items: WorkspaceReviewListItem[];
};

export type ReviewResponse = {
  item: WorkspaceReviewListItem;
};

export type DeleteReviewResponse = {
  deletedReviewId: string;
};

export type DeleteGroupResultsResponse = {
  deletion: WorkspaceGroupResultDeletion;
};

export type DeleteGroupResultsBulkRequest = {
  groupKeys: string[];
  confirmation: string;
};

export type DeleteGroupResultsBulkResponse = {
  deletion: WorkspaceGroupResultsDeletion;
};

export type ListContentReleasesResponse = {
  items: WorkspaceContentReleaseListItem[];
};

export type GetContentReleaseResponse = {
  contentReleaseDetail: WorkspaceContentReleaseDetail;
};

export type GetContentReleaseActivationReadinessResponse = {
  activationReadiness: ContentReleaseActivationReadiness;
};

export type ContentReleaseActivationSummary = {
  forced: boolean;
  previousActiveContentReleaseId: string | null;
  supersededOpenRunCount: number;
  supersededOpenRuns: OpenMonitorRun[];
};

export type ActivateContentReleaseResponse = {
  contentRelease: ContentRelease;
  activation: ContentReleaseActivationSummary;
};

export type ListSystemChecksResponse = {
  items: WorkspaceSystemCheck[];
};

export type SystemCheckAccessMode = "anonymous_key" | "login_required";

export type SystemCheckAuthorizedScope = {
  tenantKey: string;
  workspaceKey: string;
};

export type GetSystemCheckAccessResponse = {
  accessMode: SystemCheckAccessMode;
  authorizedScopes: SystemCheckAuthorizedScope[];
};

export type GetSystemCheckResponse = {
  systemCheck: WorkspaceSystemCheck;
};

export type SaveSystemCheckReportResponse = {
  report: SystemCheckReport;
};

export type ListSystemCheckReportsResponse = {
  items: SystemCheckReport[];
};

export type ListParticipantTestLogsResponse = {
  items: WorkspaceParticipantTestLogListItem[];
};

export type GetSystemCheckReportStatisticsResponse = {
  items: SystemCheckReportStatistics[];
};

export type DeleteSystemCheckReportsResponse = {
  deletion: SystemCheckReportDeletion;
};

export type ImportSystemCheckReportResponse = {
  report: SystemCheckReport;
  disposition: "imported" | "already_imported";
};

export type ParticipantSignInResponse = {
  participantSession: ParticipantSession;
  participantRosterEntry: ParticipantRosterEntry | null;
  booklets: ParticipantRuntimeBooklet[];
};

export type ParticipantLaunchResponse = {
  participantSession: ParticipantSession;
  participantRosterEntry: ParticipantRosterEntry | null;
  booklets: ParticipantRuntimeBooklet[];
  testRun: TestRun;
};

export type ParticipantRuntimeStateResponse = {
  runtimeState: ParticipantRuntimeState;
};

export type ParticipantCurrentRunStateResponse = {
  currentRunState: ParticipantCurrentRunState;
};

export type SaveTestRunProgressResponse = {
  testRun: TestRun;
};

export type SaveParticipantTestLogsResponse = {
  savedCount: number;
};

export type SelectParticipantAdaptiveStateResponse = {
  testRun: TestRun;
};

export type ListParticipantReviewsResponse = {
  items: WorkspaceReview[];
};

export type ParticipantReviewResponse = {
  review: WorkspaceReview;
};

export type DeleteParticipantReviewResponse = {
  deletedReviewId: string;
};

export type UnlockParticipantTestletResponse = {
  testRun: TestRun;
};

export type ResumeParticipantSessionResponse = {
  testRun: TestRun;
};

export type ResumeTestRunResponse = {
  testRun: TestRun;
};

export type CompleteTestRunResponse = {
  testRun: TestRun;
};

export type MonitorOpenRunsResponse = {
  items: OpenMonitorRun[];
};

export type MonitorOpenRunsQuery = {
  loginKey?: string;
  groupKey?: string;
  bookletKey?: string;
  bookletSpecies?: string;
  participantSessionId?: string;
  testRunId?: string;
  unitKey?: string;
  status?: TestRun["status"];
  limit?: number;
};

export type IssueMonitorRunCommandRequest = {
  commandType: MonitorRunCommandType;
  actorId?: string | null;
  targetUnitKey?: string | null;
  remainingSeconds?: number | null;
};

export type IssueMonitorRunCommandResponse = {
  command: MonitorRunCommandResult;
};

export type IssueMonitorRunCommandsRequest = IssueMonitorRunCommandRequest & {
  testRunIds: string[];
};

export type MonitorRunCommandFailure = {
  testRunId: string;
  statusCode: number;
  error: string;
  message: string;
  details: unknown;
};

export type IssueMonitorRunCommandsResponse = {
  requestedCount: number;
  succeededCount: number;
  failedCount: number;
  commands: MonitorRunCommandResult[];
  failures: MonitorRunCommandFailure[];
};

export type RuntimeOperationalEvent = {
  occurredAt: string;
  level: "info" | "error";
  event: string;
  details: Record<string, unknown>;
};

export type GetRuntimeDiagnosticsResponse = {
  phase: string;
  build: {
    commitSha: string | null;
    builtAt: string | null;
  };
  runtime: {
    startedAt: string;
    uptimeSeconds: number;
    lifecycle: {
      phase: "running" | "draining";
      shutdownRequestedAt: string | null;
    };
    activeRequests: number;
    totalRequests: number;
    completedRequests: number;
  };
  memory: {
    rssBytes: number;
    heapTotalBytes: number;
    heapUsedBytes: number;
    externalBytes: number;
    arrayBuffersBytes: number;
  };
  storage: {
    kind: string;
    schemaVersion: number | null;
    location: string | null;
  };
  recentEvents: RuntimeOperationalEvent[];
};

export type GetRuntimeConfigResponse = {
  phase: string;
  build: {
    commitSha: string | null;
    builtAt: string | null;
  };
  runtimeConfig: {
    port: number;
    shutdownDrainDelayMs: number;
    maxJsonBodyBytes: number;
    maxSourcePackageJsonBodyBytes: number;
    httpTimeouts: {
      headersTimeoutMs: number;
      requestTimeoutMs: number;
      keepAliveTimeoutMs: number;
    };
    operatorAuthRequired: boolean;
    adminLoginProtection: {
      maxFailures: number;
      failureWindowMs: number;
    };
    participantLoginProtection: {
      maxFailures: number;
      failureWindowMs: number;
    };
    storage: {
      kind: "memory" | "file" | "sqlite" | "postgres";
      location: string | null;
      schemaVersion: number | null;
    };
    environment: {
      firstSliceStore: string;
      firstSliceFilePresent: boolean;
      firstSliceSqliteFilePresent: boolean;
      firstSlicePostgresUrlPresent: boolean;
      firstSliceMaxJsonBodyBytesPresent: boolean;
      firstSliceMaxSourcePackageJsonBodyBytesPresent: boolean;
      firstSliceOperatorAuthRequired: boolean;
      firstSliceAdminLoginMaxFailuresPresent: boolean;
      firstSliceAdminLoginFailureWindowMsPresent: boolean;
      firstSliceParticipantLoginMaxFailuresPresent: boolean;
      firstSliceParticipantLoginFailureWindowMsPresent: boolean;
      firstSliceBootstrapDemo: boolean;
      httpHeadersTimeoutMsPresent: boolean;
      httpRequestTimeoutMsPresent: boolean;
      httpKeepAliveTimeoutMsPresent: boolean;
      appBuildShaPresent: boolean;
      appBuildTimestampPresent: boolean;
    };
  };
};

export const resolveRoutePath = (
  template: string,
  params: Record<string, string>
): string => {
  let path = template;

  for (const [key, value] of Object.entries(params)) {
    path = path.replace(`:${key}`, encodeURIComponent(value));
  }

  return path;
};
