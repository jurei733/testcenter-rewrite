// Stop assigning cases after a failure, but await every started case so its
// finally block closes its browser context before the caller retires the API.
export async function runBoundedSmokeCases(cases, concurrency, run) {
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 2) {
    throw new Error('Smoke case concurrency must be one or two.');
  }
  let next = 0;
  const failures = [];
  await Promise.all(Array.from({length: Math.min(concurrency, cases.length)}, async () => {
    while (!failures.length && next < cases.length) {
      const item = cases[next++];
      try { await run(item); } catch (error) { failures.push(error); }
    }
  }));
  if (failures.length === 1) throw failures[0];
  if (failures.length > 1) throw new AggregateError(failures, 'Independent smoke cases failed.');
}
