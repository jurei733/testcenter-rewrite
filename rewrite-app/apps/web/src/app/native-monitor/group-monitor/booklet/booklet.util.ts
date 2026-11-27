import {
  type Booklet, isTestlet, isUnit, type Testlet
} from '../group-monitor.interfaces';
import type { UnitDef } from '../../shared/interfaces/booklet.interfaces';

export class BookletUtil {
  private static getFirstUnit(
    testlet: Testlet,
    ignoreTestlet: (testlet: Testlet) => boolean,
    inheritedTimer: Testlet | null = null
  ): {unit: UnitDef; timer: Testlet | null} | null {
    if (ignoreTestlet(testlet)) return null;
    const timer = inheritedTimer ?? (testlet.restrictions.timeMax?.minutes ? testlet : null);
    for (const child of testlet.children) {
      if (isUnit(child)) return {unit: child, timer};
      const destination = this.getFirstUnit(child, ignoreTestlet, timer);
      if (destination) return destination;
    }
    return null;
  }

  static getFirstUnitOfBlock(
    blockId: string,
    booklet: Booklet,
    ignoreTestlet: (testlet: Testlet) => boolean = () => false
  ): {unit: UnitDef; timer: Testlet | null} | null {
    for (let i = 0; i < booklet.units.children.length; i++) {
      const child = booklet.units.children[i];
      if (!isUnit(child) && (child.blockId === blockId)) {
        return BookletUtil.getFirstUnit(child, ignoreTestlet);
      }
    }
    return null;
  }

  static getBlockById(blockId: string, booklet: Booklet): Testlet {
    return <Testlet>booklet.units.children
      .filter(isTestlet)
      .reduce((found: Testlet | null, block: Testlet) => ((block.blockId === blockId) ? block : found), null);
  }
}
