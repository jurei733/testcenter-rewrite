import type { TestSession } from '../group-monitor.interfaces';

export interface TestSessionByDataTestId {
  [testId: string]: TestSession;
}
