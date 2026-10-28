import type {Element} from '@xmldom/xmldom';
import type {OriginalMonitorProfile} from '@testcenter-rewrite-app/contracts';
import {FirstSliceError} from './first-slice-error.js';
const children = (node: Element, tag: string): Element[] => {
  const result: Element[] = [];
  for (let child = node.firstChild; child; child = child.nextSibling) if (child.nodeType === 1 && (child as Element).tagName === tag) result.push(child as Element);
  return result;
};
const attribute = (node: Element, name: string) => node.getAttribute(name) ?? '';
/** Called only after server-side Original XML schema validation. Do not route
 * normalized migration profiles through this literal native representation. */
export function collectOriginalMonitorProfiles(root: Element, login: Element): OriginalMonitorProfile[] {
  const profiles = children(root, 'Profiles').flatMap(node => children(node, 'GroupMonitor')).flatMap(node => children(node, 'Profile'));
  return children(login, 'Profile').map(reference => {
    const id = attribute(reference, 'id'), matches = profiles.filter(profile => attribute(profile, 'id') === id);
    if (matches.length !== 1) throw new FirstSliceError(400, 'original_monitor_profile_invalid', 'The native monitor profile reference is ambiguous or missing.');
    const node = matches[0]!;
    return {id, label: attribute(node, 'label'), settings: {
      blockColumn: attribute(node, 'blockColumn'), unitColumn: attribute(node, 'unitColumn'), view: attribute(node, 'view'),
      groupColumn: attribute(node, 'groupColumn'), bookletColumn: attribute(node, 'bookletColumn'),
      bookletStatesColumns: attribute(node, 'bookletStatesColumns'), autoselectNextBlock: attribute(node, 'autoselectNextBlock') === 'no' ? 'no' : 'yes'
    }, filters: children(node, 'Filter').map(filter => ({target: attribute(filter, 'field'), value: attribute(filter, 'value'),
      subValue: attribute(filter, 'subValue'), label: attribute(filter, 'label'), type: attribute(filter, 'type'),
      not: attribute(filter, 'not').trim().toLowerCase() === 'true'})),
    filtersEnabled: {pending: attribute(node, 'filterPending'), locked: attribute(node, 'filterLocked')}};
  });
}
export function copyOriginalMonitorProfiles(profiles: OriginalMonitorProfile[]): OriginalMonitorProfile[] {
  const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
  const strings = (value: unknown, names: string[]) => object(value) && names.every(name => typeof value[name] === 'string');
  if (!Array.isArray(profiles) || profiles.some(profile => !strings(profile, ['id','label']) ||
    !strings(profile.settings, ['blockColumn','unitColumn','view','groupColumn','bookletColumn','bookletStatesColumns']) ||
    !['yes','no'].includes(profile.settings.autoselectNextBlock) || !strings(profile.filtersEnabled, ['pending','locked']) ||
    !Array.isArray(profile.filters) || profile.filters.some(filter => !strings(filter, ['target','value','subValue','label','type']) || typeof filter.not !== 'boolean'))) {
    throw new TypeError('Invalid private native monitor profiles.');
  }
  return profiles.map(profile => ({id: profile.id, label: profile.label, settings: {
    blockColumn: profile.settings.blockColumn, unitColumn: profile.settings.unitColumn, view: profile.settings.view,
    groupColumn: profile.settings.groupColumn, bookletColumn: profile.settings.bookletColumn,
    bookletStatesColumns: profile.settings.bookletStatesColumns, autoselectNextBlock: profile.settings.autoselectNextBlock
  }, filters: profile.filters.map(filter => ({target: filter.target, value: filter.value, subValue: filter.subValue,
    label: filter.label, type: filter.type, not: filter.not})),
    filtersEnabled: {pending: profile.filtersEnabled.pending, locked: profile.filtersEnabled.locked}}));
}
/** PHP compares two numeric strings numerically. Keep signed-int64 values exact;
 * only PHP's floating numeric strings use a floating comparison. */
export function originalMonitorProfileIdsEqual(left: string, right: string): boolean {
  if (left === right) return true;
  const numeric = (value: string) => /^[ \t\r\n\v\f]*[+-]?(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)(?:[eE][+-]?[0-9]+)?[ \t\r\n\v\f]*$/.test(value);
  if (!numeric(left) || !numeric(right)) return false;
  const integer = (value: string): bigint | null => {
    if (!/^[+-]?[0-9]+$/.test(value.trim())) return null;
    const parsed = BigInt(value.trim()); return parsed >= -9223372036854775808n && parsed <= 9223372036854775807n ? parsed : null;
  };
  const a = integer(left), b = integer(right);
  return a !== null && b !== null ? a === b : Number(left) === Number(right);
}
