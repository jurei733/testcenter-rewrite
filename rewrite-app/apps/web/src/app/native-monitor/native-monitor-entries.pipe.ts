export type NativeMonitorEntry<T>={key:string;value:T};
type Compare<T>=(a:NativeMonitorEntry<T>,b:NativeMonitorEntry<T>)=>number;
/** Source uses string-keyed records. Cache each record's shallow view so unrelated
 * tables keep stable entries, including when keys are added or removed in place. */
export class NativeMonitorEntriesView {
 private readonly records=new WeakMap<object,{before:NativeMonitorEntry<unknown>[];result:NativeMonitorEntry<unknown>[];compare:unknown}>();
 readonly transform=<T>(value:Record<string,T>|null|undefined,compare?:Compare<T>|null):NativeMonitorEntry<T>[]|null=>{
  if(value==null)return null;
  const entries=Object.entries(value).map(([key,value])=>({key,value})),old=this.records.get(value);
  if(old&&compare===old.compare&&entries.length===old.before.length&&entries.every((entry,i)=>entry.key===old.before[i].key&&Object.is(entry.value,old.before[i].value)))return old.result as NativeMonitorEntry<T>[];
  const unchanged=old&&entries.length===old.before.length&&entries.every((entry,i)=>entry.key===old.before[i].key&&Object.is(entry.value,old.before[i].value));
  const result=unchanged?old.result as NativeMonitorEntry<T>[]:[...entries];
  if(compare!==null)result.sort(compare??((a,b)=>a.key===b.key?0:a.key<b.key?-1:1));
  this.records.set(value,{before:entries,result,compare});return result;
 };
}
