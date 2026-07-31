import type {
  AdminAuditEvent,
  AdminAuditEventType,
  AdminRole,
  AdminRoleAssignment,
  AdminSession,
  AdminSessionStatus,
  AdminUser,
  AdminUserStatus,
  ContentReleaseActivationReadiness,
  ContentRelease,
  ContentReleaseStatus,
  ImportJob,
  ImportJobStatus,
  MonitorRunCommandResult,
  MonitorRunCommandType,
  OpenMonitorRun,
  ParticipantRuntimeBooklet,
  ParticipantCurrentRunState,
  ParticipantRosterEntry,
  ParticipantSession,
  ParticipantSessionStatus,
  ParticipantRuntimeState,
  SourcePackage,
  SourcePackageStatus,
  SourcePackageContentStructure,
  Tenant,
  TestRun,
  Workspace,
  WorkspaceContentReleaseListItem,
  WorkspaceContentReleaseDetail,
  WorkspaceActivityEventListItem,
  WorkspaceImportJobDetail,
  WorkspaceImportJobListItem,
  WorkspaceDetailedResponse,
  WorkspaceGroupResultDeletion,
  WorkspaceParticipantSessionDetail,
  WorkspaceParticipantRosterItem,
  WorkspaceParticipantSessionListItem,
  WorkspaceReviewListItem,
  WorkspaceActivityEventType,
  WorkspaceActivitySubjectType,
  WorkspaceSourcePackageDetail,
  WorkspaceSourcePackageListItem,
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

export type ParsedParticipantRosterEntry = {
  loginKey: string;
  groupKey: string;
  bookletKey: string | null;
  bookletKeys?: string[];
  displayName: string | null;
  password?: string | null;
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
  ])
};

type RosterDelimitedHeader = {
  loginKey: number;
  groupKey: number | null;
  bookletKey: number | null;
  displayName: number | null;
  password: number | null;
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
    password: findRosterHeaderIndex(values, rosterHeaderAliases.password)
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

    return [
      {
        loginKey,
        groupKey: groupKey || `group:${loginKey}`,
        bookletKey,
        displayName,
        ...(password ? { password } : {})
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
      ...(entry.password
        ? { password: entry.password }
        : existingEntry.password
          ? { password: existingEntry.password }
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
  return !mode || mode.startsWith("run-");
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
    context: { groupKey: string | null; bookletKey: string | null }
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
    const mode = readJsonRosterString(objectValue, "mode", "loginMode", "testMode");
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
        ...(password ? { password } : {})
      });
      return;
    }

    const childContext = { groupKey, bookletKey };
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
        bookletKey
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
          : bookletKey
      });
    }
  };

  visit(parsed, { groupKey: null, bookletKey: null });
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

const parseParticipantRosterXmlText = (
  rosterText: string
): ParsedParticipantRosterEntry[] => {
  if (!rosterText.trim().startsWith("<")) {
    return [];
  }

  const entries: ParsedParticipantRosterEntry[] = [];
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
    if (
      !isParticipantRosterMode(
        readXmlAttribute(attributes, "mode", "loginMode", "testMode") ??
          readXmlChildText(content, "mode", "loginMode", "testMode")
      )
    ) {
      continue;
    }

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
      groupKey: groupKey || `group:${loginKey}`,
      ...withAdditionalBookletKeys([
        bookletKey,
        ...readXmlChildTexts(content, "booklet|bookletRef|booklet-ref|testlet|testletRef|testlet-ref")
      ]),
      displayName,
      ...(password ? { password } : {})
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
    if (
      !isParticipantRosterMode(
        readXmlAttribute(attributes, "mode", "loginMode", "testMode")
      )
    ) {
      continue;
    }

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
      groupKey: groupKey || `group:${loginKey}`,
      ...withAdditionalBookletKeys([
        bookletKey,
        ...readXmlChildTexts(content, "booklet|bookletRef|booklet-ref|testlet|testletRef|testlet-ref")
      ]),
      displayName,
      ...(password ? { password } : {})
    });
  }

  return mergeParsedParticipantRosterEntries(entries);
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
    currentSession: "/api/v1/admin/auth/current-session",
    listSessions: "/api/v1/admin/auth/sessions",
    revokeSession: "/api/v1/admin/auth/sessions/:adminSessionId",
    exportSessionsCsv: "/api/v1/admin/auth/sessions.csv",
    listUsers: "/api/v1/admin/users",
    createUser: "/api/v1/admin/users",
    updateUser: "/api/v1/admin/users/:adminUserId",
    resetPassword: "/api/v1/admin/users/:adminUserId/password",
    assignRole: "/api/v1/admin/users/:adminUserId/role-assignments",
    revokeRole:
      "/api/v1/admin/users/:adminUserId/role-assignments/:roleAssignmentId",
    exportUsersCsv: "/api/v1/admin/users.csv",
    listAuditEvents: "/api/v1/admin/audit-events",
    exportAuditEventsCsv: "/api/v1/admin/audit-events.csv"
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
    createSourcePackage: "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/source-packages",
    listSourcePackages: "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/source-packages",
    getSourcePackage:
      "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/source-packages/:sourcePackageId",
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
    exportLogCsv:
      "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/exports/logs.csv",
    exportReviewCsv:
      "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/exports/reviews.csv",
    listDetailedResponses:
      "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/responses/detailed",
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
    listContentReleases:
      "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/content-releases",
    exportContentReleasesCsv:
      "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/exports/content-releases.csv",
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
    getResource:
      "/api/v1/participant/sessions/:participantSessionId/resources/:resourcePath",
    saveProgress: "/api/v1/participant/test-runs/:testRunId/save-progress",
    unlockTestlet:
      "/api/v1/participant/test-runs/:testRunId/testlets/:testletKey/unlock",
    resumeSession: "/api/v1/participant/sessions/:participantSessionId/resume",
    resumeRun: "/api/v1/participant/test-runs/:testRunId/resume",
    completeRun: "/api/v1/participant/test-runs/:testRunId/complete"
  },
  monitor: {
    openRuns: "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/monitor/open-runs",
    issueRunCommand:
      "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/monitor/open-runs/:testRunId/commands"
  },
  system: {
    getRuntimeDiagnostics: "/diagnostics/runtime",
    getRuntimeConfig: "/diagnostics/config"
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

export type CreateImportJobRequest = {
  sourcePackageId: string;
};

export type RetrySourcePackageImportRequest = {
  fileName?: string;
  mediaType?: string;
  contentStructure?: SourcePackageContentStructure | null;
  sourceDocument?: SourceDocumentSource | null;
};

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

export type AdminUserListQuery = {
  username?: string;
  status?: AdminUserStatus;
  role?: AdminRole;
  tenantKey?: string;
  workspaceKey?: string;
  limit?: number;
};

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
};

export type PublicAdminUser = Omit<AdminUser, "passwordHash">;

export type PublicAdminSession = Omit<AdminSession, "token">;

export type PublicAdminRoleAssignment = AdminRoleAssignment;

export type BootstrapAdminUserRequest = {
  username: string;
  displayName?: string;
  password: string;
};

export type AdminSignInRequest = {
  username: string;
  password: string;
};

export type AdminRoleAssignmentRequest = {
  role: AdminRole;
  tenantKey?: string | null;
  workspaceKey?: string | null;
};

export type CreateAdminUserRequest = {
  username: string;
  displayName?: string;
  password: string;
  roleAssignments?: AdminRoleAssignmentRequest[];
};

export type UpdateAdminUserRequest = {
  displayName?: string;
  status?: AdminUserStatus;
};

export type ResetAdminUserPasswordRequest = {
  password: string;
};

export type AssignAdminRoleRequest = AdminRoleAssignmentRequest;

export type ParticipantLaunchRequest = {
  participantSessionId?: string;
  tenantKey?: string | null;
  workspaceKey?: string;
  loginKey?: string;
  groupKey?: string;
  bookletKey?: string;
  password?: string;
};

export type ImportParticipantRosterRequest = {
  rosterText: ParticipantRosterSource;
};

export type ResumeParticipantSessionRequest = {
  bookletKey?: string;
};

export type SaveTestRunProgressRequest = {
  currentUnitKey?: string | null;
  status: Extract<TestRun["status"], "running" | "paused">;
  unitResponse?: string | null;
  confirmTestletTimeLeave?: boolean;
};

export type UnlockParticipantTestletRequest = {
  code: string;
};

export type CompleteTestRunRequest = {
  confirmTestletTimeLeave?: boolean;
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

export type AdminUserDirectoryItem = {
  adminUser: PublicAdminUser;
  roleAssignments: PublicAdminRoleAssignment[];
};

export type ListAdminUsersResponse = {
  items: AdminUserDirectoryItem[];
};

export type CreateAdminUserResponse = AdminUserDirectoryItem;

export type UpdateAdminUserResponse = AdminUserDirectoryItem;

export type ResetAdminUserPasswordResponse = AdminUserDirectoryItem;

export type AssignAdminRoleResponse = AdminUserDirectoryItem;

export type RevokeAdminRoleResponse = AdminUserDirectoryItem;

export type ListAdminAuditEventsResponse = {
  items: AdminAuditEvent[];
};

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

export type CreateImportJobResponse = {
  importJob: ImportJob;
  stagedContentRelease: ContentRelease | null;
};

export type RetrySourcePackageImportResponse = {
  sourcePackage: SourcePackage;
  importJob: ImportJob;
  stagedContentRelease: ContentRelease | null;
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
  items: WorkspaceParticipantRosterItem[];
};

export type ListParticipantRosterResponse = {
  items: WorkspaceParticipantRosterItem[];
};

export type ListDetailedResponsesResponse = {
  items: WorkspaceDetailedResponse[];
};

export type CreateReviewRequest = {
  participantSessionId: string;
  testRunId: string;
  unitKey?: string | null;
  reviewerId: string;
  category: string;
  comment: string;
};

export type UpdateReviewRequest = {
  unitKey?: string | null;
  reviewerId?: string;
  category?: string;
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
  participantSessionId?: string;
  testRunId?: string;
  unitKey?: string;
  status?: TestRun["status"];
  limit?: number;
};

export type IssueMonitorRunCommandRequest = {
  commandType: MonitorRunCommandType;
  actorId?: string | null;
};

export type IssueMonitorRunCommandResponse = {
  command: MonitorRunCommandResult;
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
    httpTimeouts: {
      headersTimeoutMs: number;
      requestTimeoutMs: number;
      keepAliveTimeoutMs: number;
    };
    operatorAuthRequired: boolean;
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
      firstSliceOperatorAuthRequired: boolean;
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
