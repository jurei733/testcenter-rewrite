import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { lstat, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";

export const buildRoots = ["dist", "apps/api/dist", ...[
  "domain", "contracts", "application", "memory-store", "file-store", "sqlite-store", "postgres-store"
].map(name => `packages/${name}/dist`), ".ci/xml-schemas"];
const digest = value => createHash("sha256").update(value).digest("hex");
export function validateArchivePaths(paths) {
  if (!paths.length) throw Error("Empty CI build archive");
  for (const path of paths) {
    if (path.startsWith("/") || path.includes("\\") || path.split("/").includes("..") ||
      !buildRoots.some(root => path === root || path.startsWith(root + "/"))) {
      throw Error(`Unexpected CI build archive path: ${path}`);
    }
  }
}
export function validateManifest(manifest, expected) {
  for (const field of ["commit", "lockSha256", "nodeMajor", "platform", "arch"]) {
    if (manifest[field] !== expected[field]) throw Error(`CI build ${field} mismatch`);
  }
  if (manifest.version !== 1 || !/^[a-f0-9]{64}$/.test(manifest.archiveSha256)) throw Error("Invalid CI build manifest");
}
export async function buildArtifact(mode, root, directory, commit) {
  if (!/^[a-f0-9]{40}$/.test(commit || "")) throw Error("An exact Git commit SHA is required");
  const expected = { commit, lockSha256: digest(await readFile(join(root, "package-lock.json"))),
    nodeMajor: process.versions.node.split(".")[0], platform: process.platform, arch: process.arch };
  const archive = join(directory, "build.tar.gz"), manifestPath = join(directory, "manifest.json");
  if (mode === "pack") {
    for (const path of buildRoots) await stat(join(root, path));
    await mkdir(directory, { recursive: true });
    execFileSync("tar", ["-czf", archive, ...buildRoots], { cwd: root, env: { ...process.env, COPYFILE_DISABLE: "1" } });
    await writeFile(manifestPath, JSON.stringify({ version: 1, ...expected, archiveSha256: digest(await readFile(archive)) }) + "\n");
  } else if (mode === "restore") {
    if ((await stat(archive)).size > 256 * 1024 * 1024) throw Error("CI build archive exceeds 256 MiB");
    const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
    validateManifest(manifest, expected);
    if (digest(await readFile(archive)) !== manifest.archiveSha256) throw Error("CI build archive digest mismatch");
    const paths = execFileSync("tar", ["-tzf", archive], { encoding: "utf8", maxBuffer: 8 * 1024 * 1024 }).trim().split("\n");
    validateArchivePaths(paths);
    const listing = execFileSync("tar", ["-tvzf", archive], { encoding: "utf8", maxBuffer: 8 * 1024 * 1024 });
    if (listing.split("\n").filter(Boolean).some(line => !["-", "d"].includes(line[0]))) throw Error("CI build archive contains a link or special file");
    for (const path of buildRoots) {
      const segments = path.split("/");
      for (let length = 1; length <= segments.length; length++) {
        try {
          const entry = await lstat(join(root, ...segments.slice(0, length)));
          if (!entry.isDirectory() || entry.isSymbolicLink()) throw Error("Unsafe CI build destination");
        } catch (error) { if (error.code !== "ENOENT") throw error; }
      }
    }
    execFileSync("tar", ["-xzf", archive, "--no-same-owner", "--no-same-permissions"], { cwd: root });
    for (const path of buildRoots) await stat(join(root, path));
  } else throw Error("Expected pack or restore");
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await buildArtifact(process.argv[2], process.cwd(), resolve(process.env.CI_ARTIFACT_DIR || "../.ci-artifacts"), process.env.GITHUB_SHA);
  console.log(`CI build artifact ${process.argv[2]} verified for ${process.env.GITHUB_SHA}`);
}
