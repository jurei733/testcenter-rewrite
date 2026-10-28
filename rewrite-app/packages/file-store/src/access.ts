import { createHash, randomUUID } from "node:crypto";
import { hostname } from "node:os";
import { dirname, join, resolve } from "node:path";
import { lstat, mkdir, readlink, realpath, readdir, rm, writeFile } from "node:fs/promises";

type AccessKind = "reader" | "writer" | "maintenance";
type Registration = { name: string; kind: AccessKind; directory: string; release: () => Promise<void> };
const busy = (message: string) => Object.assign(new Error(message), { code: "FILE_STORE_BUSY" });
let namespacePromise: Promise<string> | undefined;
const namespace = () => namespacePromise ??= (async () => {
  let pidNamespace = "host";
  try { pidNamespace = await readlink("/proc/self/ns/pid"); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
  return createHash("sha256").update(`${hostname()}:${process.platform}:${pidNamespace}`).digest("hex");
})();
const directoryFor = async (filePath: string): Promise<string> => {
  const absolute = resolve(filePath);
  await mkdir(dirname(absolute), { recursive: true });
  const parent = await realpath(dirname(absolute));
  return join(parent, absolute.slice(dirname(absolute).length + 1) + ".actors");
};
const pattern = /^(reader|writer|maintenance)\.([a-f0-9]{64})\.([1-9][0-9]*)\.([a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12})\.lease$/;
const live = (pid: number): boolean => {
  try { process.kill(pid, 0); return true; }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ESRCH") return false;
    if ((error as NodeJS.ErrnoException).code === "EPERM") return true;
    throw error;
  }
};

const participants = async (directory: string): Promise<Array<{ name: string; kind: AccessKind }>> => {
  const result: Array<{ name: string; kind: AccessKind }> = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const match = pattern.exec(entry.name);
    if (!entry.isFile() || !match || match[2] !== await namespace()) {
      throw busy("File-store access belongs to an unknown process namespace or marker.");
    }
    const pid = Number(match[3]);
    if (!Number.isSafeInteger(pid)) throw busy("Invalid File-store process identity.");
    if (live(pid)) result.push({ name: entry.name, kind: match[1] as AccessKind });
    else await rm(join(directory, entry.name), { force: true });
  }
  return result;
};

export const registerFileStoreAccess = async (filePath: string, kind: AccessKind): Promise<Registration> => {
  const directory = await directoryFor(filePath);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  if (!(await lstat(directory)).isDirectory()) throw busy("File-store access metadata must be an ordinary directory.");
  const name = `${kind}.${await namespace()}.${process.pid}.${randomUUID()}.lease`;
  // Publish intent before looking for competitors. Every cooperative participant
  // observes our file, even if its contents have not been written yet.
  await writeFile(join(directory, name), "", { flag: "wx", mode: 0o600, flush: true });
  let released = false;
  const release = async () => {
    if (released) return;
    await rm(join(directory, name), { force: true });
    released = true;
  };
  try {
    const others = (await participants(directory)).filter(item => item.name !== name);
    const conflict = kind === "maintenance" ? others.length > 0
      : others.some(item => item.kind === "maintenance" || kind === "writer" && item.kind === "writer");
    if (conflict) throw busy("File-store maintenance or another writer is active.");
    return { name, kind, directory, release };
  } catch (error) { await release(); throw error; }
};

export const withFileStoreAccess = async <T>(filePath: string, kind: AccessKind, operation: () => Promise<T>): Promise<T> => {
  const registration = await registerFileStoreAccess(filePath, kind);
  try { return await operation(); }
  finally { await registration.release(); }
};

export const fileStoreTemporaryIdentity = async (filePath: string) => ({
  store: createHash("sha256").update(await directoryFor(filePath)).digest("hex"), namespace: await namespace()
});

export const isDeadFileStoreTemporary = async (filePath: string, name: string): Promise<boolean> => {
  const match = /^\.pending\.([a-f0-9]{64})\.([a-f0-9]{64})\.([1-9][0-9]*)\.([a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12})\.tmp$/.exec(name);
  if (!match) return false;
  const identity = await fileStoreTemporaryIdentity(filePath);
  const pid = Number(match[3]);
  return match[1] === identity.store && match[2] === identity.namespace && Number.isSafeInteger(pid) && !live(pid);
};

export const hasFileStoreReaders = async (filePath: string): Promise<boolean> => {
  const directory = await directoryFor(filePath);
  try { return (await participants(directory)).some(item => item.kind === "reader"); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    // Uncertain reader ownership must retain old versions.
    return true;
  }
};
