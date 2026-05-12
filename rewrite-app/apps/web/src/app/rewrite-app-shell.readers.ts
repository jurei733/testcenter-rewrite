export const prettyPrintJson = (value: unknown, fallback: string): string => {
  if (value == null) {
    return fallback;
  }
  if (typeof value === "string") {
    return value;
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return fallback;
  }
};

export const readUnknownValue = (value: unknown, path: string[]): unknown => {
  let current: unknown = value;
  for (const segment of path) {
    if (!current || typeof current !== "object" || !(segment in current)) {
      return null;
    }
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
};

export const readStringValue = (value: unknown, path: string[]): string | null => {
  const scalar = readUnknownValue(value, path);
  return typeof scalar === "string" ? scalar : null;
};

export const readNumberValue = (value: unknown, path: string[]): number | null => {
  const scalar = readUnknownValue(value, path);
  return typeof scalar === "number" ? scalar : null;
};

export const readScalarValue = (value: unknown, path: string[]): string | null => {
  const scalar = readUnknownValue(value, path);
  if (scalar == null) {
    return null;
  }
  return typeof scalar === "string" || typeof scalar === "number"
    ? String(scalar)
    : null;
};
