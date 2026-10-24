import type { BookletStateCondition, BookletStateVariableSource, ParticipantDebugSnapshot } from "@testcenter-rewrite-app/domain";
import { createAdaptiveConditionEvaluator } from "./participant-debug-runtime.js";

export type ParticipantDebugXmlNode = {
  nodeType: number; nodeName: string; childNodes: ArrayLike<ParticipantDebugXmlNode>;
  getAttribute?: (name: string) => string | null;
};
const children = (node: ParticipantDebugXmlNode): ParticipantDebugXmlNode[] => Array.from(node.childNodes).filter(child => child.nodeType === 1);
const scalarTypes = ["Code", "Value", "Status", "Score"] as const;

/** Source BookletParserService.parseIf; shared by the native browser and API XML adapters. */
export const parseParticipantDebugConditionElement = (root: ParticipantDebugXmlNode): BookletStateCondition[] => {
  if (root.nodeName !== "If") throw new Error(`Wrong root tag: '${root.nodeName}'. Should be <If>.`);
  const scalar = (node: ParticipantDebugXmlNode): BookletStateVariableSource => ({
    type: node.nodeName as BookletStateVariableSource["type"], variableKey: node.getAttribute?.("of") || "",
    unitKey: node.getAttribute?.("from") || "", defaultValue: node.getAttribute?.("or") || "0"
  });
  const parse = (node: ParticipantDebugXmlNode, depth: number): BookletStateCondition[] => {
    if (depth > 32) throw new Error("Condition nesting exceeds 32 levels.");
    const direct = children(node);
    const sourceElement = direct.filter(child => [...scalarTypes, "Sum", "Median", "Mean", "Count"].includes(child.nodeName)).at(-1);
    const expression = direct.find(child => child.nodeName === "Is");
    if (!expression) throw new Error("Missing field: 'Is'");
    if (!sourceElement) return [];
    let source: BookletStateCondition["source"];
    if ((scalarTypes as readonly string[]).includes(sourceElement.nodeName)) source = scalar(sourceElement);
    else if (sourceElement.nodeName === "Count") source = { type: "Count", conditions: children(sourceElement)
      .filter(child => child.nodeName === "If").flatMap(child => parse(child, depth + 1)) };
    else source = { type: sourceElement.nodeName as "Sum" | "Median" | "Mean", sources: children(sourceElement)
      .filter(child => (scalarTypes as readonly string[]).includes(child.nodeName)).map(scalar) };
    return (["equal", "notEqual", "greaterThan", "lowerThan"] as const).flatMap(type => {
      const value = expression.getAttribute?.(type);
      return value == null ? [] : [{ source, expression: { type, value } }];
    });
  };
  return parse(root, 0);
};

export const evaluateParticipantDebugConditions = (snapshot: ParticipantDebugSnapshot, conditions: BookletStateCondition[]): boolean[] => {
  const knownUnits = new Set(snapshot.booklet.unitEntries.map(unit => unit.unitKey));
  const validate = (condition: BookletStateCondition): void => {
    const source = condition.source;
    if (source.type === "Count") source.conditions.forEach(validate);
    else for (const scalar of "sources" in source ? source.sources : [source]) {
      if (!knownUnits.has(scalar.unitKey)) throw new Error(`Unknown Unit alias '${scalar.unitKey}'.`);
    }
  };
  conditions.forEach(validate);
  const satisfies = createAdaptiveConditionEvaluator(new Map(snapshot.variables.map(unit => [unit.unitKey,
    new Map(unit.variables.map(variable => [variable.id, variable]))])));
  return conditions.map(satisfies);
};
