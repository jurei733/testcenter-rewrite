/** Literal native profile wire shape. Missing authored attributes stay empty. */
export type OriginalMonitorProfile = {
  id: string; label: string;
  settings: {blockColumn: string; unitColumn: string; view: string; groupColumn: string;
    bookletColumn: string; bookletStatesColumns: string; autoselectNextBlock: 'yes' | 'no'};
  filters: {target: string; value: string; subValue: string; label: string; type: string; not: boolean}[];
  filtersEnabled: {pending: string; locked: string};
};
