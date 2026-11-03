import type { Testlet, TestSession } from '../group-monitor.interfaces';

export class IsCodeClearPipe {
  // eslint-disable-next-line class-methods-use-this
  transform(testSession: TestSession, testlet: Testlet) {
    return testSession.clearedCodes && testSession.clearedCodes.includes(testlet.id);
  }
}