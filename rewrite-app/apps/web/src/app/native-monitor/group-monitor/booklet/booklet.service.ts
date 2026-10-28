import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { map, shareReplay, tap } from 'rxjs/operators';
import { BackendService } from '../backend.service';
import {
  isBooklet, isUnit, type Booklet, type Testlet, type BookletError, type Unit, type BookletState, type BookletStateOption
} from '../group-monitor.interfaces';
import { BookletParserService } from '../../shared/services/booklet-parser.service';
import {
  BookletConfig, type BookletMetadata, type BookletStateDef, type BookletStateOptionDef, type ContextInBooklet, type TestletDef, type UnitDef
} from '../../shared/shared.module';

@Injectable()
export class BookletService extends BookletParserService<Unit, Testlet, BookletStateOption, BookletState, Booklet> {
  private readonly booklets: { [k: string]: Observable<Booklet | BookletError> } = {};

  constructor(private bs: BackendService) {
    super();
  }

  private accessIdentity: unknown;
  getBooklet(bookletName = ''): Observable<Booklet | BookletError> {
    if (this.accessIdentity !== this.bs.cacheIdentity) {
      for (const name of Object.keys(this.booklets)) delete this.booklets[name];
      this.accessIdentity = this.bs.cacheIdentity;
    }
    if (typeof this.booklets[bookletName] !== 'undefined') {
      return this.booklets[bookletName];
    }
    if (bookletName === '') {
      this.booklets[bookletName] = of<Booklet | BookletError>({ error: 'missing-id', species: null });
    } else {
      const request = this.bs.getBooklet(bookletName).pipe(
        map((response: string | BookletError) => (typeof response === 'string' ? this.parseXml(response) : response)),
        tap(booklet => {
          // Retry failures later; an old request must not evict a new access's cache.
          if (this.booklets[bookletName] === request) {
            if (isBooklet(booklet)) this.booklets[bookletName] = of(booklet);
            else delete this.booklets[bookletName];
          }
        }),
        shareReplay({ bufferSize: 1, refCount: true })
      );
      this.booklets[bookletName] = request;
    }
    return this.booklets[bookletName];
  }

  parseXml(xmlString: string): Booklet | BookletError {
    try {
      return this.parseBookletXml(xmlString);
    } catch (error) {
      return { error: 'xml', species: null };
    }
  }

  toBooklet(
    metadata: BookletMetadata,
    config: BookletConfig,
    customTexts: { [key: string]: string },
    states: { [key: string]: BookletState },
    units: Testlet
  ): Booklet {
    return {
      metadata,
      config,
      customTexts,
      states,
      units,
      species: this.getBookletSpecies(units)
    };
  }

  override toTestlet(testletDef: TestletDef<Testlet, Unit>, e: Element, context: ContextInBooklet<Testlet>): Testlet {
    return Object.assign(testletDef, {
      descendantCount: this.xmlCountChildrenOfTagNames(e, ['Unit']),
      blockId: `${context.localTestletIndex + 1}`,
      nextBlockId: `${context.localTestletIndex + 2}`
    });
  }

  // eslint-disable-next-line class-methods-use-this
  override toUnit(unitDef: UnitDef): Unit {
    return unitDef;
  }

  // eslint-disable-next-line class-methods-use-this
  override toBookletState(stateDef: BookletStateDef<BookletStateOption>): BookletState {
    const defaultOption = Object.values(stateDef.options).find(option => !option.conditions.length);
    return Object.assign(stateDef, {
      default: defaultOption?.id || Object.values(stateDef.options)[0].id
    });
  }

  // eslint-disable-next-line class-methods-use-this
  override toBookletStateOption(optionDef: BookletStateOptionDef): BookletStateOption {
    return optionDef;
  }

  // eslint-disable-next-line class-methods-use-this
  getBookletSpecies(units: Testlet): string {
    return `species: ${units.children.filter(testletOrUnit => !isUnit(testletOrUnit)).length}`;
  }
}
