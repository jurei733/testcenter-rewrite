import { CodingSchemeFactory } from "@iqb/responses";
import { CodingScheme } from "@iqbspecs/coding-scheme";
import type { Response as IqbResponse } from "@iqbspecs/response/response.interface.js";
import type { BookletStateCondition, BookletStateVariableSource, ContentReleaseBookletEntry, ParticipantCurrentRunState, ParticipantDebugSnapshot, TestRun } from "@testcenter-rewrite-app/domain";
import { parseVeronaUnitResponse } from "./verona-player.js";

type AdaptiveResponseVariable = {
  id: string;
  status: string;
  value: unknown;
  code?: number;
  score?: number;
};

const adaptiveStatusOrder = [
  "UNSET",
  "NOT_REACHED",
  "DISPLAYED",
  "VALUE_CHANGED",
  "SOURCE_MISSING",
  "DERIVE_ERROR",
  "VALUE_DERIVED",
  "NO_CODING",
  "INVALID",
  "CODING_INCOMPLETE",
  "CODING_ERROR",
  "CODING_COMPLETE"
];

// Keep adaptive routing on the same IQB response generation as the current
// Original Testcenter. Its response-type match is case-sensitive and its
// package-level compatibility range is min=1/max=1; other generations remain
// available to the Player for persistence/restoration but must not affect
// Booklet State selection.
const adaptiveIqbStandardResponseMajorMin = 1;
const adaptiveIqbStandardResponseMajorMax = 1;

const adaptiveValueAsNumber = (value: unknown): number => {
  const truncate = (numberValue: number): number =>
    Math.floor(numberValue * 1_000_000) / 1_000_000;
  if (value === undefined || value === null) {
    return 0;
  }
  if (typeof value === "boolean") {
    return value ? 1 : 0;
  }
  if (Array.isArray(value)) {
    return value.length;
  }
  return truncate(Number(value));
};

const adaptiveValueAsComparable = (value: unknown): unknown => {
  // Match IqbVariableUtil.variableValueAsComparable at runtime, including its
  // deliberately shallow handling of malformed Player values. The Original
  // converts nullish values and arrays/booleans, but leaves every other value
  // untouched; coercing an object to an empty string could otherwise activate
  // an authored `Value equal=""` route.
  if (value == null) {
    return "null";
  }
  if (Array.isArray(value)) {
    return JSON.stringify([...value].sort());
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  return value;
};

const collectAdaptiveVariableKeys = (
  booklet: ContentReleaseBookletEntry
): Map<string, Set<string>> => {
  const variableKeysByUnitKey = new Map<string, Set<string>>();
  const registerVariable = (source: BookletStateVariableSource): void => {
    const variableKeys = variableKeysByUnitKey.get(source.unitKey) ?? new Set();
    variableKeys.add(source.variableKey);
    variableKeysByUnitKey.set(source.unitKey, variableKeys);
  };
  const registerCondition = (condition: BookletStateCondition): void => {
    const source = condition.source;
    if (
      source.type === "Code" ||
      source.type === "Value" ||
      source.type === "Status" ||
      source.type === "Score"
    ) {
      registerVariable(source);
    } else if (source.type === "Count") {
      source.conditions.forEach(registerCondition);
    } else if ("sources" in source) {
      source.sources.forEach(registerVariable);
    }
  };
  booklet.stateEntries?.forEach(state =>
    state.options.forEach(option => option.conditions.forEach(registerCondition))
  );
  return variableKeysByUnitKey;
};

export const resolveAdaptiveVariables = (
  booklet: ContentReleaseBookletEntry,
  testRun: TestRun
): Map<string, Map<string, AdaptiveResponseVariable>> => {
  const trackedVariablesByUnitKey = collectAdaptiveVariableKeys(booklet);
  for (const unitEntry of booklet.unitEntries) {
    const trackedVariableKeys = trackedVariablesByUnitKey.get(unitEntry.unitKey);
    if (!unitEntry.codingScheme || !trackedVariableKeys?.size) {
      continue;
    }
    try {
      const variableCodings = new CodingScheme(
        unitEntry.codingScheme
      ).variableCodings;
      for (const baseVariableKey of CodingSchemeFactory.getBaseVarsList(
        [...trackedVariableKeys],
        variableCodings
      )) {
        trackedVariableKeys.add(baseVariableKey);
      }
    } catch {
      // Import validation rejects invalid schemes. Keep the condition variables
      // usable for staged legacy data if an older snapshot still contains one.
    }
  }
  const variablesByUnitKey = new Map(
    [...trackedVariablesByUnitKey].map(([unitKey, variableKeys]) => [
      unitKey,
      new Map(
        [...variableKeys].map(variableKey => [
          variableKey,
          {
            id: variableKey,
            status: "UNSET",
            value: null
          } satisfies AdaptiveResponseVariable
        ])
      )
    ])
  );
  const suppliedResponsesByUnitKey = new Map<string, IqbResponse[]>();
  for (const [unitKey, response] of Object.entries(testRun.unitResponses)) {
    const parsedResponse = parseVeronaUnitResponse(response);
    const iqbStandardVersionMatch =
      parsedResponse?.unitState.unitStateDataType?.match(
        /iqb-standard@(\d+)/
      );
    const iqbStandardMajor = Number(iqbStandardVersionMatch?.[1]);
    if (
      !parsedResponse ||
      !iqbStandardVersionMatch ||
      iqbStandardMajor < adaptiveIqbStandardResponseMajorMin ||
      iqbStandardMajor > adaptiveIqbStandardResponseMajorMax
    ) {
      continue;
    }
    const variables = variablesByUnitKey.get(unitKey) ?? new Map();
    const suppliedResponses = suppliedResponsesByUnitKey.get(unitKey) ?? [];
    for (const dataPart of Object.values(
      parsedResponse.unitState.dataParts ?? {}
    )) {
      try {
        const values = JSON.parse(dataPart);
        if (!Array.isArray(values)) {
          continue;
        }
        for (const value of values) {
          if (
            typeof value !== "object" ||
            value === null ||
            typeof value.id !== "string" ||
            typeof value.status !== "string" ||
            !("value" in value)
          ) {
            continue;
          }
          if (!trackedVariablesByUnitKey.get(unitKey)?.has(value.id)) {
            continue;
          }
          // Original Testcenter tracks adaptive responses by variable ID, not by
          // subform. Preserve its data-part order: a later repeated ID replaces
          // the earlier subform value before server-side coding and routing.
          const suppliedResponse = {
            id: value.id,
            status: value.status as IqbResponse["status"],
            value: value.value as IqbResponse["value"],
            ...(typeof value.subform === "string"
              ? { subform: value.subform }
              : {}),
            ...(typeof value.code === "number" ? { code: value.code } : {}),
            ...(typeof value.score === "number" ? { score: value.score } : {})
          } satisfies IqbResponse;
          suppliedResponses.push(suppliedResponse);
          variables.set(value.id, {
            id: suppliedResponse.id,
            status: suppliedResponse.status,
            value: suppliedResponse.value,
            ...(suppliedResponse.code === undefined
              ? {}
              : { code: suppliedResponse.code }),
            ...(suppliedResponse.score === undefined
              ? {}
              : { score: suppliedResponse.score })
          });
        }
      } catch {
        // Invalid data parts remain persisted for player restoration, but cannot
        // participate in server-side adaptive decisions.
      }
    }
    variablesByUnitKey.set(unitKey, variables);
    suppliedResponsesByUnitKey.set(unitKey, suppliedResponses);
  }

  for (const unitEntry of booklet.unitEntries) {
    const trackedVariableKeys = trackedVariablesByUnitKey.get(unitEntry.unitKey);
    if (!unitEntry.codingScheme || !trackedVariableKeys?.size) {
      continue;
    }
    const variables = variablesByUnitKey.get(unitEntry.unitKey) ?? new Map();
    try {
      const variableCodings = new CodingScheme(
        unitEntry.codingScheme
      ).variableCodings;
      const baseVariableKeys = CodingSchemeFactory.getBaseVarsList(
        [...trackedVariableKeys],
        variableCodings
      );
      const baseVariableKeySet = new Set(baseVariableKeys);
      const suppliedResponses =
        suppliedResponsesByUnitKey.get(unitEntry.unitKey) ?? [];
      const suppliedBaseResponses = suppliedResponses.filter(response =>
        baseVariableKeySet.has(response.id)
      );
      const suppliedBaseVariableKeys = new Set(
        suppliedBaseResponses.map(response => response.id)
      );
      // Keep every ordered subform response for the IQB coding engine. The
      // adaptive read model remains ID-only and is populated from the coded
      // output below in its original last-write-wins order.
      const baseResponses = [
        ...suppliedBaseResponses,
        ...baseVariableKeys
          .filter(variableKey => !suppliedBaseVariableKeys.has(variableKey))
          .map(
            variableKey =>
              ({
                id: variableKey,
                status: "UNSET",
                value: null
              }) satisfies IqbResponse
          )
      ];
      // The current Original feeds only tracked base variables into the coder.
      // Player-supplied derived values remain persisted for restoration but
      // cannot override server-side derivation or adaptive routing.
      for (const codedVariable of CodingSchemeFactory.code(
        baseResponses,
        variableCodings
      )) {
        if (!trackedVariableKeys.has(codedVariable.id)) {
          continue;
        }
        variables.set(codedVariable.id, {
          id: codedVariable.id,
          status: codedVariable.status,
          value: codedVariable.value,
          ...(codedVariable.code === undefined
            ? {}
            : { code: codedVariable.code }),
          ...(codedVariable.score === undefined
            ? {}
            : { score: codedVariable.score })
        });
      }
      variablesByUnitKey.set(unitEntry.unitKey, variables);
    } catch {
      // Keep the player's raw variables available when a staged legacy scheme
      // cannot code an individual response payload.
    }
  }
  return variablesByUnitKey;
};

export const createAdaptiveConditionEvaluator = (variablesByUnitKey: Map<string, Map<string, AdaptiveResponseVariable>>) => {
  const readVariable = (
    source: BookletStateVariableSource
  ): AdaptiveResponseVariable | undefined =>
    variablesByUnitKey.get(source.unitKey)?.get(source.variableKey);
  const sourceAsNumber = (source: BookletStateVariableSource): number => {
    const variable = readVariable(source);
    if (!variable) {
      return Number.NaN;
    }
    switch (source.type) {
      case "Code":
        return variable.code ?? adaptiveValueAsNumber(source.defaultValue);
      case "Value":
        return adaptiveValueAsNumber(variable.value);
      case "Status":
        return Math.max(adaptiveStatusOrder.indexOf(variable.status), 0);
      case "Score":
        return variable.score ?? adaptiveValueAsNumber(source.defaultValue);
    }
  };
  const conditionSatisfied = (condition: BookletStateCondition): boolean => {
    const source = condition.source;
    let value: unknown;
    if (
      source.type === "Code" ||
      source.type === "Value" ||
      source.type === "Status" ||
      source.type === "Score"
    ) {
      const variable = readVariable(source);
      if (!variable) {
        return false;
      }
      if (condition.expression.type === "greaterThan" ||
          condition.expression.type === "lowerThan") {
        value = sourceAsNumber(source);
      } else if (source.type === "Code") {
        value = variable.code ?? adaptiveValueAsNumber(source.defaultValue);
      } else if (source.type === "Value") {
        value = adaptiveValueAsComparable(variable.value);
      } else if (source.type === "Status") {
        value = variable.status ??
          adaptiveStatusOrder.find(status => status === source.defaultValue) ??
          "UNSET";
      } else {
        value = variable.score ?? adaptiveValueAsNumber(source.defaultValue);
      }
    } else if (source.type === "Count") {
      value = source.conditions.filter(conditionSatisfied).length;
    } else {
      const aggregation = source as Extract<
        BookletStateCondition["source"],
        { type: "Sum" | "Median" | "Mean" }
      >;
      const values = aggregation.sources.map(sourceAsNumber);
      if (aggregation.type === "Sum") {
        value = values.reduce((sum: number, item: number) => sum + item, 0);
      } else if (aggregation.type === "Mean") {
        value = values.length > 0
          // Preserve the Original aggregator's evaluation order. Dividing each
          // summand before adding can differ from dividing the final sum at the
          // six-decimal truncation boundary used by adaptive comparisons.
          ? values.reduce(
              (mean: number, item: number) => mean + item / values.length,
              0
            )
          : Number.NaN;
      } else {
        const sorted = [...values].sort((left, right) => left - right);
        const middle = Math.floor(sorted.length / 2);
        value = sorted.length === 0
          ? Number.NaN
          : sorted.length % 2 === 0
            ? ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2
            : sorted[middle] ?? Number.NaN;
      }
    }
    let expected: string | number = condition.expression.value;
    if (typeof value === "number") {
      value = adaptiveValueAsNumber(value);
      expected = adaptiveValueAsNumber(expected);
    }
    switch (condition.expression.type) {
      case "equal":
        return value === expected ||
          (typeof value === "number" &&
            typeof expected === "number" &&
            Number.isNaN(value) &&
            Number.isNaN(expected));
      case "notEqual":
        return value !== expected;
      case "greaterThan":
        return adaptiveValueAsNumber(value) > adaptiveValueAsNumber(expected);
      case "lowerThan":
        return adaptiveValueAsNumber(value) < adaptiveValueAsNumber(expected);
    }
  };

  return conditionSatisfied;
};

export const evaluateAdaptiveStates = (
  booklet: ContentReleaseBookletEntry | undefined,
  testRun: TestRun
): ParticipantCurrentRunState["adaptiveStates"] => {
  if (!booklet?.stateEntries?.length) {
    return [];
  }
  const variablesByUnitKey = resolveAdaptiveVariables(booklet, testRun);
  const conditionSatisfied = createAdaptiveConditionEvaluator(variablesByUnitKey);

  return booklet.stateEntries.map(state => {
    const selected = state.options.find(option =>
      option.conditions.every(conditionSatisfied)
    ) ?? state.options.at(-1)!;
    const presetOptionKey = testRun.presetBookletStates?.[state.stateKey];
    const presetOption = presetOptionKey
      ? state.options.find(option => option.optionKey === presetOptionKey)
      : undefined;
    const overrideOptionKey = testRun.bookletStateOverrides?.[state.stateKey];
    const overrideOption = overrideOptionKey
      ? state.options.find(option => option.optionKey === overrideOptionKey)
      : undefined;
    const effectiveOption = overrideOption ?? presetOption ?? selected;
    return {
      stateKey: state.stateKey,
      displayLabel: state.displayLabel,
      optionKey: effectiveOption.optionKey,
      optionLabel: effectiveOption.displayLabel,
      automaticOptionKey: selected.optionKey,
      automaticOptionLabel: selected.displayLabel,
      overrideOptionKey: overrideOption?.optionKey ?? null,
      options: state.options.map(option => ({
        optionKey: option.optionKey,
        displayLabel: option.displayLabel
      }))
    };
  });
};

/** The same variable/coding/condition projection as adaptive routing, with no writes. */
export const buildParticipantDebugSnapshot = (
  sourceBooklet: ContentReleaseBookletEntry, testRun: TestRun
): ParticipantDebugSnapshot => {
  const booklet = structuredClone(sourceBooklet);
  const variables = resolveAdaptiveVariables(booklet, testRun);
  const satisfies = createAdaptiveConditionEvaluator(variables);
  return {
    scope: { tenantId: testRun.tenantId, workspaceId: testRun.workspaceId, participantSessionId: testRun.participantSessionId,
      testRunId: testRun.testRunId, contentReleaseId: testRun.contentReleaseId, bookletKey: testRun.bookletKey },
    booklet,
    variables: [...variables].map(([unitKey, values]) => {
      const unit = booklet.unitEntries.find(entry => entry.unitKey === unitKey);
      const ids = [...values.keys()];
      let baseVariableKeys = ids;
      if (unit?.codingScheme) {
        try { baseVariableKeys = CodingSchemeFactory.getBaseVarsList(ids, new CodingScheme(unit.codingScheme).variableCodings); } catch {}
      }
      return { unitKey, baseVariableKeys, variables: [...values.values()] };
    }),
    states: (booklet.stateEntries ?? []).map(state => ({ stateKey: state.stateKey,
      defaultOptionKey: testRun.presetBookletStates?.[state.stateKey] ?? state.options.at(-1)?.optionKey ?? null,
      options: state.options.map(option => {
        const conditions = option.conditions.map(condition => ({ condition, satisfied: satisfies(condition) }));
        return { optionKey: option.optionKey, firstUnsatisfiedCondition: conditions.findIndex(condition => !condition.satisfied), conditions };
      }) })),
    adaptiveStates: evaluateAdaptiveStates(booklet, testRun), conditionResults: null
  };
};

export const participantDebugVariableValue = (value: unknown, shorten = false): string => {
  const format = (item: unknown): string => item == null ? "null" : Array.isArray(item) ? item.map(format).join(", ") :
    typeof item === "string" ? `"${item}"` : String(item);
  const result = format(value);
  return shorten ? result.substring(0, 12) + (result.length > 13 ? "..." : "") : result;
};

export const participantDebugConditionText = (condition: BookletStateCondition): string => {
  const single = (source: BookletStateVariableSource): string => `${source.type} OF ${source.variableKey} FROM ${source.unitKey}`;
  const source = condition.source;
  const text = "sources" in source ? `${source.type} OF ${source.sources.map(item => `(${single(item)})`).join(" AND ")}` :
    source.type === "Count" ? `Count OF ${source.conditions.map(item => `(${participantDebugConditionText(item)})`).join(" AND ")}` : single(source);
  return `IF ${text} IS ${condition.expression.type} '${condition.expression.value}'`;
};

