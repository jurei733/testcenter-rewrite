import type {ContentRelease, ContentReleaseRuntimeSnapshot, ImportJob, ImportJobDiagnostic,
  SourcePackage, Workspace, WorkspaceActivityEvent, WorkspaceFileAvailability} from '@testcenter-rewrite-app/domain';
import type {FirstSliceRepository} from './index.js';
import {buildWorkspaceFileCatalog, selectCurrentWorkspaceFiles, type WorkspaceCatalogInput} from './workspace-file-catalog.js';
import {createWorkspaceFilePublicationRevision} from './workspace-file-publication.js';
import {FirstSliceError} from './first-slice-error.js';
import {createContentReleaseActivationRevision} from './content-release-activation.js';

type Scope = Pick<Workspace, 'tenantId' | 'workspaceId'>;
export type {WorkspaceFileAvailability} from '@testcenter-rewrite-app/domain';
type Compilation = {
  sourcePackage: SourcePackage;
  runtimeSnapshot: ContentReleaseRuntimeSnapshot | null;
  diagnostics: ImportJobDiagnostic[];
  members: Array<{sourcePackageId: string; fileName: string; sizeBytes: number}>;
};
type Current = {
  revision: string;
  compilation: Compilation | null;
  diagnostics: ImportJobDiagnostic[];
};

/** The persisted release is a fixed origin, not a new test identity for every
 * file edit. Only private runtime projections resolve current file contents. */
export function createWorkspaceFileRuntime(deps: {
  repository: FirstSliceRepository;
  project: (source: SourcePackage) => WorkspaceCatalogInput;
  compile: (sources: SourcePackage[], scope: Scope) => Compilation;
  now: () => string;
  id: () => string;
}) {
  const {repository} = deps;
  const cache = new Map<string, {revision: string; current: Current; bytes: number}>();
  let retainedBytes = 0;
  const ignored = (sourcePackageId: string, fileName: string): ImportJobDiagnostic => ({
    severity: 'warning', code: 'workspace_file_root_ignored',
    message: `Workspace file '${fileName}' has unavailable runtime dependencies and is ignored.`,
    details: {sourcePackageId}
  });
  const read = async (scope: Scope, requireArchive = false): Promise<Current> => {
    const [sources, activityEvents] = await Promise.all([
      repository.listSourcePackagesByWorkspace(scope.tenantId, scope.workspaceId),
      repository.listWorkspaceActivityEventsByWorkspace(scope.tenantId, scope.workspaceId)
    ]);
    const revision = createWorkspaceFilePublicationRevision({sourcePackages: sources, activityEvents});
    const key = JSON.stringify([scope.tenantId, scope.workspaceId]);
    const cached = cache.get(key);
    if (cached?.revision === revision && (!requireArchive || cached.current.compilation?.sourcePackage.sourceDocument)) {
      cache.delete(key); cache.set(key, cached);
      return structuredClone(cached.current);
    }
    const currentSources = selectCurrentWorkspaceFiles(sources, activityEvents)
      .filter(source => source.status !== 'rejected');
    const byId = new Map(currentSources.map(source => [source.sourcePackageId, source]));
    const projectedFiles = currentSources.map(deps.project);
    const projectedById = new Map(projectedFiles.map(source => [source.sourcePackageId,source]));
    const catalog = buildWorkspaceFileCatalog(projectedFiles, {requireDependencies: true});
    const roots = catalog.items.filter(file => file.fileType === 'Booklet' || file.fileType === 'SysCheck');
    const included = new Map<string, SourcePackage>();
    const diagnostics: ImportJobDiagnostic[] = [];
    let single: Compilation | null = null, accepted = 0;
    for (const root of roots) {
      const ids = new Set([root.sourcePackageId, ...root.dependencies.map(value => value.sourcePackageId)]);
      if (catalog.items.some(file => ids.has(file.sourcePackageId) && file.unresolvedReferences.length)) {
        diagnostics.push(ignored(root.sourcePackageId, root.fileName)); continue;
      }
      const members = [...ids].flatMap(id => byId.has(id) ? [byId.get(id)!] : []);
      let compiled: Compilation;
      try { compiled = deps.compile(members, scope); }
      catch { diagnostics.push(ignored(root.sourcePackageId, root.fileName)); continue; }
      if (!compiled.runtimeSnapshot || compiled.diagnostics.some(value => value.severity === 'error')) {
        diagnostics.push(ignored(root.sourcePackageId, root.fileName)); continue;
      }
      accepted++; single = compiled;
      for (const source of members) included.set(source.sourcePackageId, source);
      diagnostics.push(...compiled.diagnostics);
    }
    let compilation: Compilation | null = null;
    try {
      compilation = accepted === 1 ? single : accepted > 1 ? deps.compile([...included.values()], scope) : null;
      if (compilation?.diagnostics.some(value => value.severity === 'error')) {
        diagnostics.push(...compilation.diagnostics); compilation = null;
      }
    } catch {
      diagnostics.push({severity: 'error', code: 'workspace_file_compilation_failed',
        message: 'The current workspace files could not be compiled.'});
    }
    if (compilation?.runtimeSnapshot) {
      // Source XMLFile keeps Label node text exactly. Canonical presentation may
      // trim/fallback; retain the physical native value separately for new Tests.
      const nativeLabels = new Map(catalog.items.filter(file => file.fileType === 'Booklet' &&
        projectedById.get(file.sourcePackageId)?.sourceText?.trimStart().startsWith('<'))
        .map(file => [file.metadata.identifier,file.metadata.label]));
      compilation = {...compilation,runtimeSnapshot:{...compilation.runtimeSnapshot,
        bookletEntries:compilation.runtimeSnapshot.bookletEntries.map(booklet => {
          const raw = nativeLabels.get(booklet.bookletKey.replace(/[a-z]/g,letter=>letter.toUpperCase()));
          return raw === undefined || raw === booklet.displayLabel ? booklet : {...booklet,originalBookletLabel:raw};
        })}};
    }
    const current: Current = {revision, compilation, diagnostics};
    // Never retain the temporary archive across runtime reads. It is needed
    // only once when the durable origin is created, and can be rebuilt then.
    const retained: Current = {...current, compilation: compilation ? {...compilation, sourcePackage: {...compilation.sourcePackage, sourceDocument: null}} : null};
    const bytes = Buffer.byteLength(JSON.stringify(retained), 'utf8');
    const old = cache.get(key);
    if (old) {retainedBytes -= old.bytes; cache.delete(key);}
    if (bytes <= 64 * 1024 * 1024) {
      cache.set(key, {revision, current: structuredClone(retained), bytes}); retainedBytes += bytes;
      while (cache.size > 16 || retainedBytes > 64 * 1024 * 1024) {
        const first = cache.keys().next().value!;
        retainedBytes -= cache.get(first)!.bytes; cache.delete(first);
      }
    }
    return current;
  };
  const projectRelease = async (release: ContentRelease): Promise<ContentRelease> => {
    const origin = release.runtimeSnapshot.workspaceFilePublication;
    if (!origin) return release;
    const current = await read(release);
    if (current.diagnostics.some(value => value.severity === 'error')) {
      throw new FirstSliceError(409, 'workspace_file_runtime_unavailable', 'The current workspace files could not be made available.');
    }
    return {...release, runtimeSnapshot: {
      ...(current.compilation?.runtimeSnapshot ?? {bookletEntries: []}), workspaceFilePublication: origin
    }};
  };
  const ensureAvailable = async (workspace: Workspace): Promise<WorkspaceFileAvailability> => {
    // Capture the activation revision before compilation, so a later manual
    // activation cannot be silently overwritten by a fresh post-compile read.
    const expectedActivationRevision = await repository.getContentReleaseActivationRevision(workspace.tenantId, workspace.workspaceId);
    const releases = await repository.listContentReleasesByWorkspace(workspace.tenantId, workspace.workspaceId);
    const origin = releases.find(release => release.runtimeSnapshot.workspaceFilePublication);
    const current = await read(workspace, !origin);
    const result = (status: WorkspaceFileAvailability['status'], release: ContentRelease | null = null,
      importJobId: string | null = null): WorkspaceFileAvailability => ({status, revision: current.revision,
      contentReleaseId: release?.contentReleaseId ?? null, importJobId, diagnostics: current.diagnostics});
    if (current.diagnostics.some(value => value.severity === 'error')) return result('failed');
    if (origin?.status === 'active') return result('available', origin);
    if (!current.compilation?.runtimeSnapshot) return result('not_ready');
    const previous = releases.find(release => release.status === 'active') ?? null;
    const stamp = deps.now();
    const event = (eventType: WorkspaceActivityEvent['eventType'], subjectType: WorkspaceActivityEvent['subjectType'],
      subjectId: string, details: WorkspaceActivityEvent['details']): WorkspaceActivityEvent => ({
      activityEventId: deps.id(), tenantId: workspace.tenantId, workspaceId: workspace.workspaceId,
      eventType, subjectType, subjectId, actorId: null, occurredAt: stamp, summary: 'Workspace files made available.', details
    });
    if (origin) {
      const committed = await repository.commitContentReleaseActivation({tenantId: workspace.tenantId,
        workspaceId: workspace.workspaceId, contentReleaseId: origin.contentReleaseId, activatedAt: stamp,
        expectedRevision: expectedActivationRevision,
        activityEvent: event('content_release_activated', 'content_release', origin.contentReleaseId, {
          previousActiveContentReleaseId: previous?.contentReleaseId ?? null, publicationMode: 'workspace_files', retainedSessions: true
        })});
      return result(committed ? 'available' : 'conflict', committed ? origin : null);
    }
    const compiled = current.compilation;
    const source = compiled.sourcePackage;
    const job: ImportJob = {importJobId: deps.id(), tenantId: workspace.tenantId, workspaceId: workspace.workspaceId,
      sourcePackageId: source.sourcePackageId, status: 'completed', createdAt: stamp, finishedAt: stamp, diagnostics: current.diagnostics};
    const release: ContentRelease = {contentReleaseId: deps.id(), tenantId: workspace.tenantId, workspaceId: workspace.workspaceId,
      importJobId: job.importJobId, releaseLabel: 'Live workspace files', createdAt: stamp, activatedAt: stamp, status: 'active',
      runtimeSnapshot: {...compiled.runtimeSnapshot!, workspaceFilePublication: {revision: current.revision, sourcePackageId: source.sourcePackageId}}};
    const committed = await repository.publishWorkspaceFiles({sourcePackage: {...source, status: 'accepted'}, importJob: job,
      contentRelease: release, expectedWorkspaceFileRevision: current.revision, expectedActiveContentReleaseId: previous?.contentReleaseId ?? null,
      expectedActiveContentReleaseRevision: createContentReleaseActivationRevision({
        contentReleases: releases.filter(value => value.status === 'active'), participantSessions: [], testRuns: []
      }),
      activityEvents: [event('source_package_assembled', 'source_package', source.sourcePackageId, {
        assemblyMode: 'workspace_files', workspaceFileRevision: current.revision, sourcePackages: compiled.members,
        importJobId: job.importJobId, contentReleaseId: release.contentReleaseId
      }), event('import_job_completed', 'import_job', job.importJobId, {sourcePackageId: source.sourcePackageId, contentReleaseId: release.contentReleaseId}),
      event('content_release_activated', 'content_release', release.contentReleaseId, {
        previousActiveContentReleaseId: previous?.contentReleaseId ?? null, publicationMode: 'workspace_files', retainedSessions: true
      })]});
    if (committed) return result('available', release, job.importJobId);
    // Another first writer may have committed the same workspace origin.
    const winner = (await repository.listContentReleasesByWorkspace(workspace.tenantId, workspace.workspaceId))
      .find(value => value.status === 'active' && value.runtimeSnapshot.workspaceFilePublication);
    return result(winner ? 'available' : 'conflict', winner ?? null);
  };
  return {read, projectRelease, ensureAvailable};
}
