// A closed HTTP socket does not mean its asynchronous handler has finished.
export const createRequestLifecycle = () => {
  const pending = new Set<Promise<unknown>>();
  return {
    wrap<Args extends unknown[], Result>(
      handler: (...args: Args) => Promise<Result>
    ): (...args: Args) => Promise<Result> {
      return (...args) => {
        const operation = handler(...args);
        pending.add(operation);
        const finish = () => { pending.delete(operation); };
        void operation.then(finish, finish);
        return operation;
      };
    },
    async drain(): Promise<void> {
      while (pending.size) await Promise.allSettled([...pending]);
    }
  };
};
