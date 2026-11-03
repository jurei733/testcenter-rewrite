import { isBooklet, type Testlet, type TestSession } from '../group-monitor.interfaces';

export class TestletvisiblePipe {
  // eslint-disable-next-line class-methods-use-this
  transform(session: TestSession, testlet: Testlet): boolean {
    if (!isBooklet(session.booklet)) return false;
    if (!testlet.restrictions.show) return true;
    const current = (session.bookletStates && session.bookletStates[testlet.restrictions.show.if]) ?
      session.bookletStates[testlet.restrictions.show.if] :
      session.booklet.states[testlet.restrictions.show.if].default;
    return current === testlet.restrictions.show.is;
  }
}
