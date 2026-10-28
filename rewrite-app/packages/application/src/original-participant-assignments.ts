import type {ParticipantBookletAssignment} from '@testcenter-rewrite-app/domain';

/** Source XMLFileTesttakers::collectTestNamesPerCode + SessionDAO's ASCII
 * array_change_key_case lookup. Common Booklets follow coded ones. When authored
 * code keys differ only in case, PHP retains the last complete bucket. */
export function selectOriginalParticipantAssignments(assignments: ParticipantBookletAssignment[], requestedCode: string | null | undefined): ParticipantBookletAssignment[] {
  const buckets = new Map<string, ParticipantBookletAssignment[]>(), common: ParticipantBookletAssignment[] = [];
  const add = (rows: ParticipantBookletAssignment[], assignment: ParticipantBookletAssignment) => {
    if (!rows.some(row => row.assignmentKey === assignment.assignmentKey)) rows.push(assignment);
  };
  for (const assignment of assignments) {
    if (!assignment.accessCodes?.length) { add(common, assignment); continue; }
    for (const code of assignment.accessCodes) {
      const rows = buckets.get(code) ?? []; add(rows, assignment); buckets.set(code, rows);
    }
  }
  if (!buckets.size) buckets.set('', common);
  else for (const rows of buckets.values()) for (const assignment of common) add(rows, assignment);
  const fold = (value: string) => value.replace(/[A-Z]/g, letter => letter.toLowerCase());
  const current = new Map([...buckets].map(([code, rows]) => [fold(code), rows]));
  return structuredClone(current.get(fold(requestedCode ?? '')) ?? []);
}
