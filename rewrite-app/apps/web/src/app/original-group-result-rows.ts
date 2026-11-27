import type {OriginalGroupResult} from '@testcenter-rewrite-app/contracts/original-group-results';

const metrics = ['bookletsStarted', 'numUnitsMin', 'numUnitsMax', 'numUnitsTotal', 'numUnitsAvg', 'lastChange'] as const;
const maxDateSeconds = 8_640_000_000_000;

export function readOriginalGroupResultRows(value: unknown): OriginalGroupResult[] {
  if (!Array.isArray(value)) throw new Error('Ungültige Ergebnisgruppen.');
  const names = new Set<string>();
  return value.map(row => {
    if (!row || typeof row !== 'object' || Array.isArray(row) ||
      typeof row.groupName !== 'string' || typeof row.groupLabel !== 'string' || names.has(row.groupName) ||
      metrics.some(key => typeof row[key] !== 'number' || !Number.isFinite(row[key]) || row[key] < 0) ||
      row.lastChange > maxDateSeconds) {
      throw new Error('Ungültige Ergebnisgruppe.');
    }
    names.add(row.groupName);
    return row as OriginalGroupResult;
  });
}
