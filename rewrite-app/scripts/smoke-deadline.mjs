// A losing timeout must not keep a successful smoke process alive, or fire
// cleanup against an already closed resource while another scenario runs.
export async function raceWithSmokeDeadline(work, milliseconds, onTimeout) {
  let timer;
  try {
    return await Promise.race([work, new Promise((resolve, reject) => {
      timer = setTimeout(() => {
        try { resolve(onTimeout()); } catch (error) { reject(error); }
      }, milliseconds);
    })]);
  } finally {
    clearTimeout(timer);
  }
}
