import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import type { AddressInfo } from "node:net";
import { deflateRawSync } from "node:zlib";

import { createProductionApiServer } from "./index.js";

let server: Awaited<ReturnType<typeof createProductionApiServer>>;

let baseUrl = "";

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

type ZipCompressionMethod = 0 | 8;
type ZipFixtureEntry = {
  fileName: string;
  content: string;
  compressionMethod?: ZipCompressionMethod;
  compressedContent?: Buffer;
  uncompressedSize?: number;
};

const createZipBase64 = (
  entries: ZipFixtureEntry[],
  options: { compressionMethod?: ZipCompressionMethod } = {}
): string => {
  const localFileHeaders: Buffer[] = [];
  const centralDirectoryHeaders: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const compressionMethod =
      entry.compressionMethod ?? options.compressionMethod ?? 0;
    const fileName = Buffer.from(entry.fileName, "utf8");
    const uncompressedContent = Buffer.from(entry.content, "utf8");
    const content =
      entry.compressedContent ??
      (compressionMethod === 8
        ? deflateRawSync(uncompressedContent)
        : uncompressedContent);
    const uncompressedSize = entry.uncompressedSize ?? uncompressedContent.length;
    const localHeader = Buffer.alloc(30 + fileName.length);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0x0800, 6);
    localHeader.writeUInt16LE(compressionMethod, 8);
    localHeader.writeUInt32LE(0, 10);
    localHeader.writeUInt32LE(0, 14);
    localHeader.writeUInt32LE(content.length, 18);
    localHeader.writeUInt32LE(uncompressedSize, 22);
    localHeader.writeUInt16LE(fileName.length, 26);
    fileName.copy(localHeader, 30);
    localFileHeaders.push(localHeader, content);

    const centralDirectoryHeader = Buffer.alloc(46 + fileName.length);
    centralDirectoryHeader.writeUInt32LE(0x02014b50, 0);
    centralDirectoryHeader.writeUInt16LE(20, 4);
    centralDirectoryHeader.writeUInt16LE(20, 6);
    centralDirectoryHeader.writeUInt16LE(0x0800, 8);
    centralDirectoryHeader.writeUInt16LE(compressionMethod, 10);
    centralDirectoryHeader.writeUInt32LE(0, 12);
    centralDirectoryHeader.writeUInt32LE(0, 16);
    centralDirectoryHeader.writeUInt32LE(content.length, 20);
    centralDirectoryHeader.writeUInt32LE(uncompressedSize, 24);
    centralDirectoryHeader.writeUInt16LE(fileName.length, 28);
    centralDirectoryHeader.writeUInt32LE(offset, 42);
    fileName.copy(centralDirectoryHeader, 46);
    centralDirectoryHeaders.push(centralDirectoryHeader);

    offset += localHeader.length + content.length;
  }

  const centralDirectoryOffset = offset;
  const centralDirectory = Buffer.concat(centralDirectoryHeaders);
  const endOfCentralDirectory = Buffer.alloc(22);
  endOfCentralDirectory.writeUInt32LE(0x06054b50, 0);
  endOfCentralDirectory.writeUInt16LE(entries.length, 8);
  endOfCentralDirectory.writeUInt16LE(entries.length, 10);
  endOfCentralDirectory.writeUInt32LE(centralDirectory.length, 12);
  endOfCentralDirectory.writeUInt32LE(centralDirectoryOffset, 16);

  return Buffer.concat([
    ...localFileHeaders,
    centralDirectory,
    endOfCentralDirectory
  ]).toString("base64");
};

type JsonResponse<T> = {
  status: number;
  body: T;
};

const requestJsonAt = async <T>(
  rootUrl: string,
  path: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: unknown;
  }
): Promise<JsonResponse<T>> => {
  const response = await fetch(rootUrl + path, {
    method: init?.method ?? "GET",
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {})
    },
    body:
      init?.body === undefined ? undefined : JSON.stringify(init.body)
  });
  return {
    status: response.status,
    body: (await response.json()) as T
  };
};

const requestJson = async <T>(
  path: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: unknown;
  }
): Promise<JsonResponse<T>> => requestJsonAt<T>(baseUrl, path, init);

const requestText = async (
  path: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
  }
): Promise<{ status: number; body: string; contentType: string | null }> => {
  const response = await fetch(baseUrl + path, {
    method: init?.method ?? "GET",
    headers: init?.headers
  });
  return {
    status: response.status,
    body: await response.text(),
    contentType: response.headers.get("content-type")
  };
};

const requestTextAt = async (
  rootUrl: string,
  path: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
  }
): Promise<{ status: number; body: string; contentType: string | null }> => {
  const response = await fetch(rootUrl + path, {
    method: init?.method ?? "GET",
    headers: init?.headers
  });
  return {
    status: response.status,
    body: await response.text(),
    contentType: response.headers.get("content-type")
  };
};

const assertPostgresLocationRedacted = (
  label: string,
  location: string | null
): void => {
  if (!location || !/^postgres(?:ql)?:\/\//.test(location)) {
    return;
  }

  const source = process.env.FIRST_SLICE_POSTGRES_URL;
  if (!source) {
    return;
  }

  const sourceUrl = new URL(source);
  const redactedUrl = new URL(location);

  if (sourceUrl.username) {
    assert.equal(redactedUrl.username, "REDACTED", `${label} must redact username.`);
  }

  if (sourceUrl.password) {
    assert.equal(redactedUrl.password, "REDACTED", `${label} must redact password.`);
  }
};

const assertSecurityHeaders = (response: Response): void => {
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(response.headers.get("referrer-policy"), "no-referrer");
  assert.equal(response.headers.get("x-frame-options"), "SAMEORIGIN");
  assert.equal(
    response.headers.get("permissions-policy"),
    "camera=(), geolocation=(), microphone=()"
  );
};

const closeServer = async (
  targetServer: Awaited<ReturnType<typeof createProductionApiServer>>
): Promise<void> => {
  await new Promise<void>((resolve, reject) => {
    targetServer.close(error => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
};

const createIsolatedServer = async (
  environment: Record<string, string>
): Promise<{
  server: Awaited<ReturnType<typeof createProductionApiServer>>;
  baseUrl: string;
}> => {
  const previousEnvironment = new Map(
    Object.keys(environment).map(key => [key, process.env[key]])
  );

  try {
    for (const [key, value] of Object.entries(environment)) {
      process.env[key] = value;
    }
    const isolatedServer = await createProductionApiServer();
    await new Promise<void>(resolve => {
      isolatedServer.listen(0, "127.0.0.1", () => resolve());
    });
    const address = isolatedServer.address() as AddressInfo;
    return {
      server: isolatedServer,
      baseUrl: `http://127.0.0.1:${address.port}`
    };
  } finally {
    for (const [key, value] of previousEnvironment) {
      if (value == null) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
};

before(async () => {
  server = await createProductionApiServer();
  await new Promise<void>(resolve => {
    server.listen(0, "127.0.0.1", () => resolve());
  });
  const address = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  await closeServer(server);
});

test("admin bootstrap and bearer session lifecycle", async () => {
  const bootstrap = await requestJson<{
    adminUser: {
      adminUserId: string;
      username: string;
      displayName: string;
      status: string;
      passwordHash?: string;
    };
    roleAssignments: Array<{
      roleAssignmentId: string;
      adminUserId: string;
      role: string;
      tenantId: string | null;
      workspaceId: string | null;
    }>;
  }>("/api/v1/admin/auth/bootstrap", {
    method: "POST",
    body: {
      username: "Integration.Admin",
      displayName: "Integration Admin",
      password: "integration-secret"
    }
  });

  assert.equal(bootstrap.status, 201);
  assert.equal(bootstrap.body.adminUser.username, "integration.admin");
  assert.equal(bootstrap.body.adminUser.displayName, "Integration Admin");
  assert.equal(bootstrap.body.adminUser.status, "active");
  assert.equal(bootstrap.body.adminUser.passwordHash, undefined);
  assert.equal(bootstrap.body.roleAssignments.length, 1);
  assert.equal(bootstrap.body.roleAssignments[0]?.role, "platform_admin");
  assert.equal(
    bootstrap.body.roleAssignments[0]?.adminUserId,
    bootstrap.body.adminUser.adminUserId
  );
  assert.equal(bootstrap.body.roleAssignments[0]?.tenantId, null);
  assert.equal(bootstrap.body.roleAssignments[0]?.workspaceId, null);

  const duplicateBootstrap = await requestJson<{ error: string }>(
    "/api/v1/admin/auth/bootstrap",
    {
      method: "POST",
      body: {
        username: "Second.Admin",
        password: "integration-secret"
      }
    }
  );

  assert.equal(duplicateBootstrap.status, 409);
  assert.equal(duplicateBootstrap.body.error, "admin_bootstrap_already_completed");

  const rejectedSignIn = await requestJson<{ error: string }>(
    "/api/v1/admin/auth/sign-in",
    {
      method: "POST",
      body: {
        username: "integration.admin",
        password: "wrong-secret"
      }
    }
  );

  assert.equal(rejectedSignIn.status, 401);
  assert.equal(rejectedSignIn.body.error, "admin_credentials_invalid");

  const signIn = await requestJson<{
    adminUser: { adminUserId: string; username: string };
    adminSession: { adminSessionId: string; token?: string; revokedAt: string | null };
    roleAssignments: Array<{ role: string }>;
    sessionToken: string;
  }>("/api/v1/admin/auth/sign-in", {
    method: "POST",
    body: {
      username: "integration.admin",
      password: "integration-secret"
    }
  });

  assert.equal(signIn.status, 200);
  assert.equal(signIn.body.adminUser.adminUserId, bootstrap.body.adminUser.adminUserId);
  assert.equal(typeof signIn.body.sessionToken, "string");
  assert.ok(signIn.body.sessionToken.length > 20);
  assert.equal(signIn.body.adminSession.token, undefined);
  assert.equal(signIn.body.adminSession.revokedAt, null);
  assert.equal(signIn.body.roleAssignments[0]?.role, "platform_admin");

  const missingSession = await requestJson<{ error: string }>(
    "/api/v1/admin/auth/current-session"
  );

  assert.equal(missingSession.status, 401);
  assert.equal(missingSession.body.error, "admin_session_missing");

  const currentSession = await requestJson<{
    adminUser: { adminUserId: string; username: string };
    adminSession: { adminSessionId: string; token?: string; revokedAt: string | null };
    roleAssignments: Array<{ role: string }>;
  }>("/api/v1/admin/auth/current-session", {
    headers: {
      authorization: `Bearer ${signIn.body.sessionToken}`
    }
  });

  assert.equal(currentSession.status, 200);
  assert.equal(
    currentSession.body.adminSession.adminSessionId,
    signIn.body.adminSession.adminSessionId
  );
  assert.equal(currentSession.body.adminSession.token, undefined);
  assert.equal(currentSession.body.adminSession.revokedAt, null);
  assert.equal(currentSession.body.roleAssignments[0]?.role, "platform_admin");

  const missingSessionListSession = await requestJson<{ error: string }>(
    "/api/v1/admin/auth/sessions"
  );

  assert.equal(missingSessionListSession.status, 401);
  assert.equal(missingSessionListSession.body.error, "admin_session_missing");

  const adminSessions = await requestJson<{
    items: Array<{
      adminSession: {
        adminSessionId: string;
        adminUserId: string;
        token?: string;
        revokedAt: string | null;
      };
      adminUser: { adminUserId: string; username: string; passwordHash?: string };
      status: string;
    }>;
  }>("/api/v1/admin/auth/sessions?status=active&limit=1", {
    headers: {
      authorization: `Bearer ${signIn.body.sessionToken}`
    }
  });

  assert.equal(adminSessions.status, 200);
  assert.equal(adminSessions.body.items.length, 1);
  assert.equal(
    adminSessions.body.items[0]?.adminSession.adminSessionId,
    signIn.body.adminSession.adminSessionId
  );
  assert.equal(adminSessions.body.items[0]?.adminSession.token, undefined);
  assert.equal(adminSessions.body.items[0]?.adminUser.passwordHash, undefined);
  assert.equal(adminSessions.body.items[0]?.status, "active");

  const secondSignIn = await requestJson<{
    sessionToken: string;
    adminSession: { adminSessionId: string; token?: string; revokedAt: string | null };
  }>("/api/v1/admin/auth/sign-in", {
    method: "POST",
    body: {
      username: "integration.admin",
      password: "integration-secret"
    }
  });

  assert.equal(secondSignIn.status, 200);
  assert.notEqual(secondSignIn.body.sessionToken, signIn.body.sessionToken);

  const missingAdminSessionRevokeSession = await requestJson<{ error: string }>(
    `/api/v1/admin/auth/sessions/${secondSignIn.body.adminSession.adminSessionId}`,
    { method: "DELETE" }
  );

  assert.equal(missingAdminSessionRevokeSession.status, 401);
  assert.equal(missingAdminSessionRevokeSession.body.error, "admin_session_missing");

  const selfSessionRevoke = await requestJson<{ error: string }>(
    `/api/v1/admin/auth/sessions/${signIn.body.adminSession.adminSessionId}`,
    {
      method: "DELETE",
      headers: {
        authorization: `Bearer ${signIn.body.sessionToken}`
      }
    }
  );

  assert.equal(selfSessionRevoke.status, 409);
  assert.equal(
    selfSessionRevoke.body.error,
    "admin_self_session_revoke_forbidden"
  );

  const revokedOtherSession = await requestJson<{
    adminSession: { adminSessionId: string; token?: string; revokedAt: string | null };
  }>(`/api/v1/admin/auth/sessions/${secondSignIn.body.adminSession.adminSessionId}`, {
    method: "DELETE",
    headers: {
      authorization: `Bearer ${signIn.body.sessionToken}`
    }
  });

  assert.equal(revokedOtherSession.status, 200);
  assert.equal(
    revokedOtherSession.body.adminSession.adminSessionId,
    secondSignIn.body.adminSession.adminSessionId
  );
  assert.equal(revokedOtherSession.body.adminSession.token, undefined);
  assert.equal(typeof revokedOtherSession.body.adminSession.revokedAt, "string");

  const revokedOtherSessionCurrent = await requestJson<{ error: string }>(
    "/api/v1/admin/auth/current-session",
    {
      headers: {
        authorization: `Bearer ${secondSignIn.body.sessionToken}`
      }
    }
  );

  assert.equal(revokedOtherSessionCurrent.status, 401);
  assert.equal(revokedOtherSessionCurrent.body.error, "admin_session_invalid");

  const revokedAdminSessions = await requestJson<{
    items: Array<{ adminSession: { adminSessionId: string }; status: string }>;
  }>("/api/v1/admin/auth/sessions?status=revoked", {
    headers: {
      authorization: `Bearer ${signIn.body.sessionToken}`
    }
  });

  assert.equal(revokedAdminSessions.status, 200);
  assert.equal(
    revokedAdminSessions.body.items.some(
      item =>
        item.adminSession.adminSessionId ===
          secondSignIn.body.adminSession.adminSessionId &&
        item.status === "revoked"
    ),
    true
  );

  const adminSessionsCsvResponse = await fetch(
    `${baseUrl}/api/v1/admin/auth/sessions.csv?status=revoked`,
    {
      headers: {
        authorization: `Bearer ${signIn.body.sessionToken}`,
        accept: "text/csv"
      }
    }
  );
  const adminSessionsCsvBody = await adminSessionsCsvResponse.text();

  assert.equal(adminSessionsCsvResponse.status, 200);
  assertSecurityHeaders(adminSessionsCsvResponse);
  assert.match(
    adminSessionsCsvResponse.headers.get("content-type") ?? "",
    /text\/csv/
  );
  assert.match(
    adminSessionsCsvResponse.headers.get("content-disposition") ?? "",
    /admin-sessions\.csv/
  );
  assert.match(
    adminSessionsCsvBody,
    /^"adminSessionId","adminUserId","username","displayName","userStatus","sessionStatus","createdAt","expiresAt","revokedAt"/
  );
  assert.match(adminSessionsCsvBody, /"revoked"/);
  assert.equal(adminSessionsCsvBody.includes(secondSignIn.body.sessionToken), false);

  const missingAdminSessionsCsvSession = await requestJson<{ error: string }>(
    "/api/v1/admin/auth/sessions.csv"
  );

  assert.equal(missingAdminSessionsCsvSession.status, 401);
  assert.equal(missingAdminSessionsCsvSession.body.error, "admin_session_missing");

  const missingAdminSessionRevokeTarget = await requestJson<{ error: string }>(
    "/api/v1/admin/auth/sessions/missing-session",
    {
      method: "DELETE",
      headers: {
        authorization: `Bearer ${signIn.body.sessionToken}`
      }
    }
  );

  assert.equal(missingAdminSessionRevokeTarget.status, 404);
  assert.equal(
    missingAdminSessionRevokeTarget.body.error,
    "admin_session_not_found"
  );

  const invalidAdminSessionStatus = await requestJson<{ error: string }>(
    "/api/v1/admin/auth/sessions?status=unsupported",
    {
      headers: {
        authorization: `Bearer ${signIn.body.sessionToken}`
      }
    }
  );

  assert.equal(invalidAdminSessionStatus.status, 400);
  assert.equal(
    invalidAdminSessionStatus.body.error,
    "admin_session_status_invalid"
  );

  const invalidAdminSessionLimit = await requestJson<{ error: string }>(
    "/api/v1/admin/auth/sessions?limit=0",
    {
      headers: {
        authorization: `Bearer ${signIn.body.sessionToken}`
      }
    }
  );

  assert.equal(invalidAdminSessionLimit.status, 400);
  assert.equal(invalidAdminSessionLimit.body.error, "admin_session_limit_invalid");

  const missingDirectorySession = await requestJson<{ error: string }>(
    "/api/v1/admin/users"
  );

  assert.equal(missingDirectorySession.status, 401);
  assert.equal(missingDirectorySession.body.error, "admin_session_missing");

  const missingAuditSession = await requestJson<{ error: string }>(
    "/api/v1/admin/audit-events"
  );

  assert.equal(missingAuditSession.status, 401);
  assert.equal(missingAuditSession.body.error, "admin_session_missing");

  const adminUsers = await requestJson<{
    items: Array<{
      adminUser: { adminUserId: string; username: string; passwordHash?: string };
      roleAssignments: Array<{ roleAssignmentId: string; role: string }>;
    }>;
  }>("/api/v1/admin/users", {
    headers: {
      authorization: `Bearer ${signIn.body.sessionToken}`
    }
  });

  assert.equal(adminUsers.status, 200);
  assert.equal(adminUsers.body.items.length, 1);
  assert.equal(
    adminUsers.body.items[0]?.adminUser.adminUserId,
    bootstrap.body.adminUser.adminUserId
  );
  assert.equal(adminUsers.body.items[0]?.adminUser.username, "integration.admin");
  assert.equal(adminUsers.body.items[0]?.adminUser.passwordHash, undefined);
  assert.equal(
    adminUsers.body.items[0]?.roleAssignments[0]?.role,
    "platform_admin"
  );

  const selfRevokePlatformRole = await requestJson<{ error: string }>(
    `/api/v1/admin/users/${bootstrap.body.adminUser.adminUserId}/role-assignments/${adminUsers.body.items[0]?.roleAssignments[0]?.roleAssignmentId}`,
    {
      method: "DELETE",
      headers: {
        authorization: `Bearer ${signIn.body.sessionToken}`
      }
    }
  );

  assert.equal(selfRevokePlatformRole.status, 409);
  assert.equal(
    selfRevokePlatformRole.body.error,
    "admin_self_revoke_platform_role_forbidden"
  );

  const adminTenantKey = "admin-directory-tenant";
  const adminWorkspaceKey = "admin-directory-workspace";
  await requestJson("/api/v1/platform/tenants", {
    method: "POST",
    body: { tenantKey: adminTenantKey, displayName: "Admin Directory Tenant" }
  });
  await requestJson(`/api/v1/tenants/${adminTenantKey}/workspaces`, {
    method: "POST",
    body: {
      workspaceKey: adminWorkspaceKey,
      displayName: "Admin Directory Workspace"
    }
  });

  const listedTenants = await requestJson<{
    items: Array<{ tenantKey: string; displayName: string }>;
  }>("/api/v1/platform/tenants");

  assert.equal(listedTenants.status, 200);
  assert.equal(
    listedTenants.body.items.some(
      tenant =>
        tenant.tenantKey === adminTenantKey &&
        tenant.displayName === "Admin Directory Tenant"
    ),
    true
  );

  const listedWorkspaces = await requestJson<{
    items: Array<{ workspaceKey: string; displayName: string }>;
  }>(`/api/v1/tenants/${adminTenantKey}/workspaces`);

  assert.equal(listedWorkspaces.status, 200);
  assert.equal(listedWorkspaces.body.items.length, 1);
  assert.equal(listedWorkspaces.body.items[0]?.workspaceKey, adminWorkspaceKey);
  assert.equal(
    listedWorkspaces.body.items[0]?.displayName,
    "Admin Directory Workspace"
  );

  const createdAdminUser = await requestJson<{
    adminUser: {
      adminUserId: string;
      username: string;
      displayName: string;
      status: string;
      passwordHash?: string;
    };
    roleAssignments: Array<{
      roleAssignmentId: string;
      role: string;
      tenantId: string | null;
      workspaceId: string | null;
    }>;
  }>("/api/v1/admin/users", {
    method: "POST",
    headers: {
      authorization: `Bearer ${signIn.body.sessionToken}`
    },
    body: {
      username: "Workspace.Admin",
      displayName: "Workspace Admin",
      password: "workspace-secret",
      roleAssignments: [
        {
          role: "workspace_admin",
          tenantKey: adminTenantKey,
          workspaceKey: adminWorkspaceKey
        }
      ]
    }
  });

  assert.equal(createdAdminUser.status, 201);
  assert.equal(createdAdminUser.body.adminUser.username, "workspace.admin");
  assert.equal(createdAdminUser.body.adminUser.displayName, "Workspace Admin");
  assert.equal(createdAdminUser.body.adminUser.status, "active");
  assert.equal(createdAdminUser.body.adminUser.passwordHash, undefined);
  assert.equal(createdAdminUser.body.roleAssignments.length, 1);
  assert.equal(createdAdminUser.body.roleAssignments[0]?.role, "workspace_admin");
  assert.equal(typeof createdAdminUser.body.roleAssignments[0]?.tenantId, "string");
  assert.equal(
    typeof createdAdminUser.body.roleAssignments[0]?.workspaceId,
    "string"
  );

  const duplicateRoleAssignment = await requestJson<{
    roleAssignments: Array<{ role: string }>;
  }>(
    `/api/v1/admin/users/${createdAdminUser.body.adminUser.adminUserId}/role-assignments`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${signIn.body.sessionToken}`
      },
      body: {
        role: "workspace_admin",
        tenantKey: adminTenantKey,
        workspaceKey: adminWorkspaceKey
      }
    }
  );

  assert.equal(duplicateRoleAssignment.status, 200);
  assert.equal(
    duplicateRoleAssignment.body.roleAssignments.filter(
      roleAssignment => roleAssignment.role === "workspace_admin"
    ).length,
    1
  );

  const assignedTenantRole = await requestJson<{
    roleAssignments: Array<{ roleAssignmentId: string; role: string }>;
  }>(
    `/api/v1/admin/users/${createdAdminUser.body.adminUser.adminUserId}/role-assignments`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${signIn.body.sessionToken}`
      },
      body: {
        role: "tenant_admin",
        tenantKey: adminTenantKey
      }
    }
  );

  assert.equal(assignedTenantRole.status, 200);
  const tenantRoleAssignmentId = assignedTenantRole.body.roleAssignments.find(
    roleAssignment => roleAssignment.role === "tenant_admin"
  )?.roleAssignmentId;
  assert.ok(
    tenantRoleAssignmentId,
    "Expected tenant admin role assignment to be created."
  );
  assert.equal(
    assignedTenantRole.body.roleAssignments.filter(
      roleAssignment => roleAssignment.role === "tenant_admin"
    ).length,
    1
  );

  const revokedTenantRole = await requestJson<{
    roleAssignments: Array<{ roleAssignmentId: string; role: string }>;
  }>(
    `/api/v1/admin/users/${createdAdminUser.body.adminUser.adminUserId}/role-assignments/${tenantRoleAssignmentId}`,
    {
      method: "DELETE",
      headers: {
        authorization: `Bearer ${signIn.body.sessionToken}`
      }
    }
  );

  assert.equal(revokedTenantRole.status, 200);
  assert.equal(
    revokedTenantRole.body.roleAssignments.some(
      roleAssignment => roleAssignment.role === "tenant_admin"
    ),
    false
  );
  assert.equal(
    revokedTenantRole.body.roleAssignments.some(
      roleAssignment => roleAssignment.role === "workspace_admin"
    ),
    true
  );

  const missingTenantRoleRevoke = await requestJson<{ error: string }>(
    `/api/v1/admin/users/${createdAdminUser.body.adminUser.adminUserId}/role-assignments/${tenantRoleAssignmentId}`,
    {
      method: "DELETE",
      headers: {
        authorization: `Bearer ${signIn.body.sessionToken}`
      }
    }
  );

  assert.equal(missingTenantRoleRevoke.status, 404);
  assert.equal(
    missingTenantRoleRevoke.body.error,
    "admin_role_assignment_not_found"
  );

  const resetPassword = await requestJson<{
    adminUser: { adminUserId: string; username: string; passwordHash?: string };
  }>(`/api/v1/admin/users/${createdAdminUser.body.adminUser.adminUserId}/password`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${signIn.body.sessionToken}`
    },
    body: { password: "workspace-secret-reset" }
  });

  assert.equal(resetPassword.status, 200);
  assert.equal(
    resetPassword.body.adminUser.adminUserId,
    createdAdminUser.body.adminUser.adminUserId
  );
  assert.equal(resetPassword.body.adminUser.passwordHash, undefined);

  const oldPasswordSignIn = await requestJson<{ error: string }>(
    "/api/v1/admin/auth/sign-in",
    {
      method: "POST",
      body: {
        username: "workspace.admin",
        password: "workspace-secret"
      }
    }
  );

  assert.equal(oldPasswordSignIn.status, 401);
  assert.equal(oldPasswordSignIn.body.error, "admin_credentials_invalid");

  const resetPasswordSignIn = await requestJson<{ sessionToken: string }>(
    "/api/v1/admin/auth/sign-in",
    {
      method: "POST",
      body: {
        username: "workspace.admin",
        password: "workspace-secret-reset"
      }
    }
  );

  assert.equal(resetPasswordSignIn.status, 200);
  assert.ok(resetPasswordSignIn.body.sessionToken.length > 20);

  const selfDisable = await requestJson<{ error: string }>(
    `/api/v1/admin/users/${bootstrap.body.adminUser.adminUserId}`,
    {
      method: "PATCH",
      headers: {
        authorization: `Bearer ${signIn.body.sessionToken}`
      },
      body: { status: "disabled" }
    }
  );

  assert.equal(selfDisable.status, 409);
  assert.equal(selfDisable.body.error, "admin_self_disable_forbidden");

  const disabledAdminUser = await requestJson<{
    adminUser: { displayName: string; status: string };
  }>(`/api/v1/admin/users/${createdAdminUser.body.adminUser.adminUserId}`, {
    method: "PATCH",
    headers: {
      authorization: `Bearer ${signIn.body.sessionToken}`
    },
    body: {
      displayName: "Disabled Workspace Admin",
      status: "disabled"
    }
  });

  assert.equal(disabledAdminUser.status, 200);
  assert.equal(
    disabledAdminUser.body.adminUser.displayName,
    "Disabled Workspace Admin"
  );
  assert.equal(disabledAdminUser.body.adminUser.status, "disabled");

  const disabledSignIn = await requestJson<{ error: string }>(
    "/api/v1/admin/auth/sign-in",
    {
      method: "POST",
      body: {
        username: "workspace.admin",
        password: "workspace-secret-reset"
      }
    }
  );

  assert.equal(disabledSignIn.status, 401);
  assert.equal(disabledSignIn.body.error, "admin_credentials_invalid");

  const filteredDisabledWorkspaceAdmins = await requestJson<{
    items: Array<{
      adminUser: { adminUserId: string; username: string; status: string };
      roleAssignments: Array<{ role: string }>;
    }>;
  }>(
    `/api/v1/admin/users?username=workspace&status=disabled&role=workspace_admin&tenantKey=${adminTenantKey}&workspaceKey=${adminWorkspaceKey}&limit=1`,
    {
      headers: {
        authorization: `Bearer ${signIn.body.sessionToken}`
      }
    }
  );

  assert.equal(filteredDisabledWorkspaceAdmins.status, 200);
  assert.equal(filteredDisabledWorkspaceAdmins.body.items.length, 1);
  assert.equal(
    filteredDisabledWorkspaceAdmins.body.items[0]?.adminUser.adminUserId,
    createdAdminUser.body.adminUser.adminUserId
  );
  assert.equal(
    filteredDisabledWorkspaceAdmins.body.items[0]?.adminUser.status,
    "disabled"
  );
  assert.equal(
    filteredDisabledWorkspaceAdmins.body.items[0]?.roleAssignments[0]?.role,
    "workspace_admin"
  );

  const adminUsersCsvResponse = await fetch(
    `${baseUrl}/api/v1/admin/users.csv?username=workspace&status=disabled&role=workspace_admin&tenantKey=${adminTenantKey}&workspaceKey=${adminWorkspaceKey}&limit=1`,
    {
      headers: {
        authorization: `Bearer ${signIn.body.sessionToken}`,
        accept: "text/csv"
      }
    }
  );
  const adminUsersCsvBody = await adminUsersCsvResponse.text();

  assert.equal(adminUsersCsvResponse.status, 200);
  assertSecurityHeaders(adminUsersCsvResponse);
  assert.match(
    adminUsersCsvResponse.headers.get("content-type") ?? "",
    /text\/csv/
  );
  assert.match(
    adminUsersCsvResponse.headers.get("content-disposition") ?? "",
    /admin-users\.csv/
  );
  assert.match(
    adminUsersCsvBody,
    /^"adminUserId","username","displayName","status","createdAt","roleAssignments"/
  );
  assert.match(adminUsersCsvBody, /"workspace\.admin"/);
  assert.match(adminUsersCsvBody, /"disabled"/);
  assert.match(adminUsersCsvBody, /workspace_admin/);
  assert.equal(adminUsersCsvBody.includes("workspace-secret"), false);

  const missingAdminUsersCsvSession = await requestJson<{ error: string }>(
    "/api/v1/admin/users.csv"
  );

  assert.equal(missingAdminUsersCsvSession.status, 401);
  assert.equal(missingAdminUsersCsvSession.body.error, "admin_session_missing");

  const invalidAdminUserStatus = await requestJson<{ error: string }>(
    "/api/v1/admin/users?status=unsupported",
    {
      headers: {
        authorization: `Bearer ${signIn.body.sessionToken}`
      }
    }
  );

  assert.equal(invalidAdminUserStatus.status, 400);
  assert.equal(invalidAdminUserStatus.body.error, "admin_user_status_invalid");

  const invalidAdminRole = await requestJson<{ error: string }>(
    "/api/v1/admin/users?role=unsupported",
    {
      headers: {
        authorization: `Bearer ${signIn.body.sessionToken}`
      }
    }
  );

  assert.equal(invalidAdminRole.status, 400);
  assert.equal(invalidAdminRole.body.error, "admin_role_invalid");

  const invalidAdminUserLimit = await requestJson<{ error: string }>(
    "/api/v1/admin/users?limit=0",
    {
      headers: {
        authorization: `Bearer ${signIn.body.sessionToken}`
      }
    }
  );

  assert.equal(invalidAdminUserLimit.status, 400);
  assert.equal(invalidAdminUserLimit.body.error, "admin_user_limit_invalid");

  const adminAuditEvents = await requestJson<{
    items: Array<{
      eventType: string;
      actorAdminUserId: string | null;
      subjectAdminUserId: string | null;
      summary: string;
      details: Record<string, unknown>;
    }>;
  }>("/api/v1/admin/audit-events", {
    headers: {
      authorization: `Bearer ${signIn.body.sessionToken}`
    }
  });

  assert.equal(adminAuditEvents.status, 200);
  const adminAuditEventTypes = new Set(
    adminAuditEvents.body.items.map(item => item.eventType)
  );
  assert.equal(adminAuditEventTypes.has("admin_user_bootstrapped"), true);
  assert.equal(adminAuditEventTypes.has("admin_sign_in_failed"), true);
  assert.equal(adminAuditEventTypes.has("admin_sign_in_succeeded"), true);
  assert.equal(adminAuditEventTypes.has("admin_session_revoked"), true);
  assert.equal(adminAuditEventTypes.has("admin_user_created"), true);
  assert.equal(adminAuditEventTypes.has("admin_role_assigned"), true);
  assert.equal(adminAuditEventTypes.has("admin_role_revoked"), true);
  assert.equal(adminAuditEventTypes.has("admin_password_reset"), true);
  assert.equal(adminAuditEventTypes.has("admin_user_updated"), true);
  assert.equal(
    adminAuditEvents.body.items.some(
      item =>
        item.eventType === "admin_user_updated" &&
        item.subjectAdminUserId === createdAdminUser.body.adminUser.adminUserId &&
        item.summary.includes("workspace.admin")
    ),
    true
  );
  assert.equal(
    adminAuditEvents.body.items.some(
      item =>
        item.eventType === "admin_sign_in_failed" &&
        item.subjectAdminUserId === createdAdminUser.body.adminUser.adminUserId &&
        item.details["username"] === "workspace.admin" &&
        item.details["reason"] === "admin_user_not_active"
    ),
    true
  );
  assert.equal(JSON.stringify(adminAuditEvents.body).includes("workspace-secret"), false);

  const subjectAuditEvents = await requestJson<{
    items: Array<{ subjectAdminUserId: string | null }>;
  }>(
    `/api/v1/admin/audit-events?subjectAdminUserId=${createdAdminUser.body.adminUser.adminUserId}`,
    {
      headers: {
        authorization: `Bearer ${signIn.body.sessionToken}`
      }
    }
  );

  assert.equal(subjectAuditEvents.status, 200);
  assert.equal(subjectAuditEvents.body.items.length > 0, true);
  assert.equal(
    subjectAuditEvents.body.items.every(
      item => item.subjectAdminUserId === createdAdminUser.body.adminUser.adminUserId
    ),
    true
  );

  const limitedAuditEvents = await requestJson<{ items: unknown[] }>(
    "/api/v1/admin/audit-events?limit=1",
    {
      headers: {
        authorization: `Bearer ${signIn.body.sessionToken}`
      }
    }
  );

  assert.equal(limitedAuditEvents.status, 200);
  assert.equal(limitedAuditEvents.body.items.length, 1);

  const auditCsvResponse = await fetch(
    `${baseUrl}/api/v1/admin/audit-events.csv?eventType=admin_user_updated&subjectAdminUserId=${createdAdminUser.body.adminUser.adminUserId}&limit=1`,
    {
      headers: {
        authorization: `Bearer ${signIn.body.sessionToken}`,
        accept: "text/csv"
      }
    }
  );
  const auditCsvBody = await auditCsvResponse.text();

  assert.equal(auditCsvResponse.status, 200);
  assertSecurityHeaders(auditCsvResponse);
  assert.match(
    auditCsvResponse.headers.get("content-type") ?? "",
    /text\/csv/
  );
  assert.match(
    auditCsvResponse.headers.get("content-disposition") ?? "",
    /admin-audit-events\.csv/
  );
  assert.match(
    auditCsvBody,
    /^"adminAuditEventId","eventType","occurredAt","actorAdminUserId","subjectAdminUserId","summary","details"/
  );
  assert.match(auditCsvBody, /"admin_user_updated"/);
  assert.match(auditCsvBody, new RegExp(createdAdminUser.body.adminUser.adminUserId));
  assert.equal(auditCsvBody.includes("workspace-secret"), false);

  const missingAuditCsvSession = await requestJson<{ error: string }>(
    "/api/v1/admin/audit-events.csv"
  );

  assert.equal(missingAuditCsvSession.status, 401);
  assert.equal(missingAuditCsvSession.body.error, "admin_session_missing");

  const invalidAuditEventType = await requestJson<{ error: string }>(
    "/api/v1/admin/audit-events?eventType=unsupported",
    {
      headers: {
        authorization: `Bearer ${signIn.body.sessionToken}`
      }
    }
  );

  assert.equal(invalidAuditEventType.status, 400);
  assert.equal(
    invalidAuditEventType.body.error,
    "admin_audit_event_type_invalid"
  );

  const invalidAuditLimit = await requestJson<{ error: string }>(
    "/api/v1/admin/audit-events?limit=0",
    {
      headers: {
        authorization: `Bearer ${signIn.body.sessionToken}`
      }
    }
  );

  assert.equal(invalidAuditLimit.status, 400);
  assert.equal(invalidAuditLimit.body.error, "admin_audit_limit_invalid");

  const signOut = await requestJson<{
    adminSession: { adminSessionId: string; revokedAt: string | null };
  }>("/api/v1/admin/auth/sign-out", {
    method: "POST",
    headers: {
      authorization: `Bearer ${signIn.body.sessionToken}`
    }
  });

  assert.equal(signOut.status, 200);
  assert.equal(signOut.body.adminSession.adminSessionId, signIn.body.adminSession.adminSessionId);
  assert.equal(typeof signOut.body.adminSession.revokedAt, "string");

  const revokedSession = await requestJson<{ error: string }>(
    "/api/v1/admin/auth/current-session",
    {
      headers: {
        authorization: `Bearer ${signIn.body.sessionToken}`
      }
    }
  );

  assert.equal(revokedSession.status, 401);
  assert.equal(revokedSession.body.error, "admin_session_invalid");
});

test("operator API can require a platform-admin bearer session", async () => {
  const isolated = await createIsolatedServer({
    FIRST_SLICE_STORE: "memory",
    FIRST_SLICE_OPERATOR_AUTH_REQUIRED: "true"
  });

  try {
    const config = await requestJsonAt<{
      runtimeConfig: {
        operatorAuthRequired: boolean;
        environment: { firstSliceOperatorAuthRequired: boolean };
      };
    }>(isolated.baseUrl, "/diagnostics/config");

    assert.equal(config.status, 200);
    assert.equal(config.body.runtimeConfig.operatorAuthRequired, true);
    assert.equal(
      config.body.runtimeConfig.environment.firstSliceOperatorAuthRequired,
      true
    );

    const rejectedTenantCreate = await requestJsonAt<{ error: string }>(
      isolated.baseUrl,
      "/api/v1/platform/tenants",
      {
        method: "POST",
        body: { tenantKey: "auth-required-tenant", displayName: "Auth Required" }
      }
    );

    assert.equal(rejectedTenantCreate.status, 401);
    assert.equal(rejectedTenantCreate.body.error, "admin_session_missing");

    const rejectedTenantList = await requestJsonAt<{ error: string }>(
      isolated.baseUrl,
      "/api/v1/platform/tenants"
    );

    assert.equal(rejectedTenantList.status, 401);
    assert.equal(rejectedTenantList.body.error, "admin_session_missing");

    await requestJsonAt(isolated.baseUrl, "/api/v1/admin/auth/bootstrap", {
      method: "POST",
      body: {
        username: "Required.Admin",
        displayName: "Required Admin",
        password: "required-secret"
      }
    });
    const signIn = await requestJsonAt<{ sessionToken: string }>(
      isolated.baseUrl,
      "/api/v1/admin/auth/sign-in",
      {
        method: "POST",
        body: {
          username: "required.admin",
          password: "required-secret"
        }
      }
    );
    const adminHeaders = {
      authorization: `Bearer ${signIn.body.sessionToken}`
    };

    const tenantCreate = await requestJsonAt<{ tenant: { tenantKey: string } }>(
      isolated.baseUrl,
      "/api/v1/platform/tenants",
      {
        method: "POST",
        headers: adminHeaders,
        body: { tenantKey: "auth-required-tenant", displayName: "Auth Required" }
      }
    );

    assert.equal(tenantCreate.status, 201);
    assert.equal(tenantCreate.body.tenant.tenantKey, "auth-required-tenant");

    const tenantList = await requestJsonAt<{
      items: Array<{ tenantKey: string }>;
    }>(isolated.baseUrl, "/api/v1/platform/tenants", { headers: adminHeaders });

    assert.equal(tenantList.status, 200);
    assert.equal(
      tenantList.body.items.some(
        tenant => tenant.tenantKey === "auth-required-tenant"
      ),
      true
    );

    await requestJsonAt(
      isolated.baseUrl,
      "/api/v1/tenants/auth-required-tenant/workspaces",
      {
        method: "POST",
        headers: adminHeaders,
        body: {
          workspaceKey: "auth-required-workspace",
          displayName: "Auth Required Workspace"
        }
      }
    );

    const workspaceList = await requestJsonAt<{
      items: Array<{ workspaceKey: string }>;
    }>(
      isolated.baseUrl,
      "/api/v1/tenants/auth-required-tenant/workspaces",
      { headers: adminHeaders }
    );

    assert.equal(workspaceList.status, 200);
    assert.equal(
      workspaceList.body.items.some(
        workspace => workspace.workspaceKey === "auth-required-workspace"
      ),
      true
    );

    const rejectedOverview = await requestJsonAt<{ error: string }>(
      isolated.baseUrl,
      "/api/v1/tenants/auth-required-tenant/workspaces/auth-required-workspace"
    );

    assert.equal(rejectedOverview.status, 401);
    assert.equal(rejectedOverview.body.error, "admin_session_missing");

    const rejectedWorkspaceOverviewCsv = await requestJsonAt<{ error: string }>(
      isolated.baseUrl,
      "/api/v1/tenants/auth-required-tenant/workspaces/auth-required-workspace/exports/workspace-overview.csv"
    );

    assert.equal(rejectedWorkspaceOverviewCsv.status, 401);
    assert.equal(
      rejectedWorkspaceOverviewCsv.body.error,
      "admin_session_missing"
    );

    const rejectedSourcePackageCsv = await requestJsonAt<{ error: string }>(
      isolated.baseUrl,
      "/api/v1/tenants/auth-required-tenant/workspaces/auth-required-workspace/exports/source-packages.csv"
    );

    assert.equal(rejectedSourcePackageCsv.status, 401);
    assert.equal(rejectedSourcePackageCsv.body.error, "admin_session_missing");

    const rejectedImportJobCsv = await requestJsonAt<{ error: string }>(
      isolated.baseUrl,
      "/api/v1/tenants/auth-required-tenant/workspaces/auth-required-workspace/exports/import-jobs.csv"
    );

    assert.equal(rejectedImportJobCsv.status, 401);
    assert.equal(rejectedImportJobCsv.body.error, "admin_session_missing");

    const rejectedContentReleaseCsv = await requestJsonAt<{ error: string }>(
      isolated.baseUrl,
      "/api/v1/tenants/auth-required-tenant/workspaces/auth-required-workspace/exports/content-releases.csv"
    );

    assert.equal(rejectedContentReleaseCsv.status, 401);
    assert.equal(rejectedContentReleaseCsv.body.error, "admin_session_missing");

    const rejectedStudyMonitorSummary = await requestJsonAt<{ error: string }>(
      isolated.baseUrl,
      "/api/v1/tenants/auth-required-tenant/workspaces/auth-required-workspace/study-monitor/summary"
    );

    assert.equal(rejectedStudyMonitorSummary.status, 401);
    assert.equal(rejectedStudyMonitorSummary.body.error, "admin_session_missing");

    const rejectedStudyMonitorParticipantMatrix =
      await requestJsonAt<{ error: string }>(
        isolated.baseUrl,
        "/api/v1/tenants/auth-required-tenant/workspaces/auth-required-workspace/study-monitor/participants"
      );

    assert.equal(rejectedStudyMonitorParticipantMatrix.status, 401);
    assert.equal(
      rejectedStudyMonitorParticipantMatrix.body.error,
      "admin_session_missing"
    );

    const rejectedStudyMonitorParticipant =
      await requestJsonAt<{ error: string }>(
        isolated.baseUrl,
        "/api/v1/tenants/auth-required-tenant/workspaces/auth-required-workspace/study-monitor/participants/student-auth"
      );

    assert.equal(rejectedStudyMonitorParticipant.status, 401);
    assert.equal(
      rejectedStudyMonitorParticipant.body.error,
      "admin_session_missing"
    );

    const rejectedStudyMonitorBooklet = await requestJsonAt<{ error: string }>(
      isolated.baseUrl,
      "/api/v1/tenants/auth-required-tenant/workspaces/auth-required-workspace/study-monitor/booklets/booklet%3Aauth"
    );

    assert.equal(rejectedStudyMonitorBooklet.status, 401);
    assert.equal(rejectedStudyMonitorBooklet.body.error, "admin_session_missing");

    const rejectedStudyMonitorUnit = await requestJsonAt<{ error: string }>(
      isolated.baseUrl,
      "/api/v1/tenants/auth-required-tenant/workspaces/auth-required-workspace/study-monitor/units/unit-auth"
    );

    assert.equal(rejectedStudyMonitorUnit.status, 401);
    assert.equal(rejectedStudyMonitorUnit.body.error, "admin_session_missing");

    const rejectedStudyMonitorCsv = await requestJsonAt<{ error: string }>(
      isolated.baseUrl,
      "/api/v1/tenants/auth-required-tenant/workspaces/auth-required-workspace/exports/study-monitor.csv"
    );

    assert.equal(rejectedStudyMonitorCsv.status, 401);
    assert.equal(rejectedStudyMonitorCsv.body.error, "admin_session_missing");

    const rejectedStudyMonitorParticipantMatrixCsv =
      await requestJsonAt<{ error: string }>(
        isolated.baseUrl,
        "/api/v1/tenants/auth-required-tenant/workspaces/auth-required-workspace/exports/study-monitor-participants.csv"
      );

    assert.equal(rejectedStudyMonitorParticipantMatrixCsv.status, 401);
    assert.equal(
      rejectedStudyMonitorParticipantMatrixCsv.body.error,
      "admin_session_missing"
    );

    const rejectedStudyMonitorRunCsv = await requestJsonAt<{ error: string }>(
      isolated.baseUrl,
      "/api/v1/tenants/auth-required-tenant/workspaces/auth-required-workspace/exports/study-monitor-runs/missing-run.csv"
    );

    assert.equal(rejectedStudyMonitorRunCsv.status, 401);
    assert.equal(rejectedStudyMonitorRunCsv.body.error, "admin_session_missing");

    const rejectedTenantDirectoryCsv = await requestJsonAt<{ error: string }>(
      isolated.baseUrl,
      "/api/v1/platform/tenants.csv"
    );

    assert.equal(rejectedTenantDirectoryCsv.status, 401);
    assert.equal(rejectedTenantDirectoryCsv.body.error, "admin_session_missing");

    const rejectedWorkspaceDirectoryCsv = await requestJsonAt<{ error: string }>(
      isolated.baseUrl,
      "/api/v1/tenants/auth-required-tenant/workspaces.csv"
    );

    assert.equal(rejectedWorkspaceDirectoryCsv.status, 401);
    assert.equal(rejectedWorkspaceDirectoryCsv.body.error, "admin_session_missing");

    const rejectedOpenRunsCsv = await requestJsonAt<{ error: string }>(
      isolated.baseUrl,
      "/api/v1/tenants/auth-required-tenant/workspaces/auth-required-workspace/exports/open-runs.csv"
    );

    assert.equal(rejectedOpenRunsCsv.status, 401);
    assert.equal(rejectedOpenRunsCsv.body.error, "admin_session_missing");

    const rejectedParticipantRosterCsv = await requestJsonAt<{ error: string }>(
      isolated.baseUrl,
      "/api/v1/tenants/auth-required-tenant/workspaces/auth-required-workspace/exports/participant-roster.csv"
    );

    assert.equal(rejectedParticipantRosterCsv.status, 401);
    assert.equal(rejectedParticipantRosterCsv.body.error, "admin_session_missing");

    const rejectedParticipantSessionsCsv = await requestJsonAt<{ error: string }>(
      isolated.baseUrl,
      "/api/v1/tenants/auth-required-tenant/workspaces/auth-required-workspace/exports/participant-sessions.csv"
    );

    assert.equal(rejectedParticipantSessionsCsv.status, 401);
    assert.equal(rejectedParticipantSessionsCsv.body.error, "admin_session_missing");

    const overview = await requestJsonAt<{
      workspaceOverview: { workspace: { workspaceKey: string } };
    }>(
      isolated.baseUrl,
      "/api/v1/tenants/auth-required-tenant/workspaces/auth-required-workspace",
      { headers: adminHeaders }
    );

    assert.equal(overview.status, 200);
    assert.equal(
      overview.body.workspaceOverview.workspace.workspaceKey,
      "auth-required-workspace"
    );

    const overviewCsv = await requestTextAt(
      isolated.baseUrl,
      "/api/v1/tenants/auth-required-tenant/workspaces/auth-required-workspace/exports/workspace-overview.csv",
      { headers: adminHeaders }
    );

    assert.equal(overviewCsv.status, 200);
    assert.equal(overviewCsv.contentType, "text/csv; charset=utf-8");
    assert.match(
      overviewCsv.body,
      /^tenantKey,workspaceKey,tenantDisplayName,workspaceDisplayName,sourcePackageCount,importJobCount,contentReleaseCount,activeContentReleaseId,latestImportJobAt,participantSessionCount,openTestRunCount\n/
    );
    assert.match(
      overviewCsv.body,
      /"auth-required-tenant","auth-required-workspace","Auth Required","Auth Required Workspace","0","0","0","","","0","0"/
    );

    const tenantDirectoryCsv = await requestTextAt(
      isolated.baseUrl,
      "/api/v1/platform/tenants.csv",
      { headers: adminHeaders }
    );

    assert.equal(tenantDirectoryCsv.status, 200);
    assert.equal(tenantDirectoryCsv.contentType, "text/csv; charset=utf-8");
    assert.match(
      tenantDirectoryCsv.body,
      /^tenantKey,displayName,status,tenantId,createdAt\n/
    );
    assert.match(tenantDirectoryCsv.body, /"auth-required-tenant","Auth Required"/);

    const workspaceDirectoryCsv = await requestTextAt(
      isolated.baseUrl,
      "/api/v1/tenants/auth-required-tenant/workspaces.csv",
      { headers: adminHeaders }
    );

    assert.equal(workspaceDirectoryCsv.status, 200);
    assert.equal(workspaceDirectoryCsv.contentType, "text/csv; charset=utf-8");
    assert.match(
      workspaceDirectoryCsv.body,
      /^tenantKey,workspaceKey,displayName,status,workspaceId,createdAt\n/
    );
    assert.match(
      workspaceDirectoryCsv.body,
      /"auth-required-tenant","auth-required-workspace","Auth Required Workspace"/
    );

    const workspaceAdmin = await requestJsonAt<{
      adminUser: { adminUserId: string; username: string };
      roleAssignments: Array<{ role: string }>;
    }>(isolated.baseUrl, "/api/v1/admin/users", {
      method: "POST",
      headers: adminHeaders,
      body: {
        username: "Workspace.Required.Admin",
        displayName: "Workspace Required Admin",
        password: "workspace-required-secret",
        roleAssignments: [
          {
            role: "workspace_admin",
            tenantKey: "auth-required-tenant",
            workspaceKey: "auth-required-workspace"
          }
        ]
      }
    });

    assert.equal(workspaceAdmin.status, 201);
    assert.equal(workspaceAdmin.body.adminUser.username, "workspace.required.admin");
    assert.equal(workspaceAdmin.body.roleAssignments[0]?.role, "workspace_admin");

    const workspaceAdminSignIn = await requestJsonAt<{ sessionToken: string }>(
      isolated.baseUrl,
      "/api/v1/admin/auth/sign-in",
      {
        method: "POST",
        body: {
          username: "workspace.required.admin",
          password: "workspace-required-secret"
        }
      }
    );
    const workspaceAdminHeaders = {
      authorization: `Bearer ${workspaceAdminSignIn.body.sessionToken}`
    };

    const scopedOverview = await requestJsonAt<{
      workspaceOverview: { workspace: { workspaceKey: string } };
    }>(
      isolated.baseUrl,
      "/api/v1/tenants/auth-required-tenant/workspaces/auth-required-workspace",
      { headers: workspaceAdminHeaders }
    );

    assert.equal(scopedOverview.status, 200);
    assert.equal(
      scopedOverview.body.workspaceOverview.workspace.workspaceKey,
      "auth-required-workspace"
    );

    const rejectedWorkspaceListByWorkspaceAdmin = await requestJsonAt<{
      error: string;
    }>(
      isolated.baseUrl,
      "/api/v1/tenants/auth-required-tenant/workspaces",
      { headers: workspaceAdminHeaders }
    );

    assert.equal(rejectedWorkspaceListByWorkspaceAdmin.status, 403);
    assert.equal(
      rejectedWorkspaceListByWorkspaceAdmin.body.error,
      "admin_role_required"
    );

    const rejectedWorkspaceDirectoryCsvByWorkspaceAdmin =
      await requestJsonAt<{ error: string }>(
        isolated.baseUrl,
        "/api/v1/tenants/auth-required-tenant/workspaces.csv",
        { headers: workspaceAdminHeaders }
      );

    assert.equal(rejectedWorkspaceDirectoryCsvByWorkspaceAdmin.status, 403);
    assert.equal(
      rejectedWorkspaceDirectoryCsvByWorkspaceAdmin.body.error,
      "admin_role_required"
    );

    const rejectedWorkspaceCreateByWorkspaceAdmin = await requestJsonAt<{
      error: string;
    }>(isolated.baseUrl, "/api/v1/tenants/auth-required-tenant/workspaces", {
      method: "POST",
      headers: workspaceAdminHeaders,
      body: {
        workspaceKey: "workspace-admin-created",
        displayName: "Workspace Admin Created"
      }
    });

    assert.equal(rejectedWorkspaceCreateByWorkspaceAdmin.status, 403);
    assert.equal(
      rejectedWorkspaceCreateByWorkspaceAdmin.body.error,
      "admin_role_required"
    );

    const rejectedTenantCreateByWorkspaceAdmin = await requestJsonAt<{
      error: string;
    }>(isolated.baseUrl, "/api/v1/platform/tenants", {
      method: "POST",
      headers: workspaceAdminHeaders,
      body: {
        tenantKey: "workspace-admin-tenant",
        displayName: "Workspace Admin Tenant"
      }
    });

    assert.equal(rejectedTenantCreateByWorkspaceAdmin.status, 403);
    assert.equal(
      rejectedTenantCreateByWorkspaceAdmin.body.error,
      "admin_role_required"
    );

    const tenantAdmin = await requestJsonAt<{
      adminUser: { username: string };
      roleAssignments: Array<{ role: string }>;
    }>(isolated.baseUrl, "/api/v1/admin/users", {
      method: "POST",
      headers: adminHeaders,
      body: {
        username: "Tenant.Required.Admin",
        displayName: "Tenant Required Admin",
        password: "tenant-required-secret",
        roleAssignments: [
          {
            role: "tenant_admin",
            tenantKey: "auth-required-tenant"
          }
        ]
      }
    });

    assert.equal(tenantAdmin.status, 201);
    assert.equal(tenantAdmin.body.adminUser.username, "tenant.required.admin");
    assert.equal(tenantAdmin.body.roleAssignments[0]?.role, "tenant_admin");

    const tenantAdminSignIn = await requestJsonAt<{ sessionToken: string }>(
      isolated.baseUrl,
      "/api/v1/admin/auth/sign-in",
      {
        method: "POST",
        body: {
          username: "tenant.required.admin",
          password: "tenant-required-secret"
        }
      }
    );

    const tenantCreatedWorkspace = await requestJsonAt<{
      workspace: { workspaceKey: string };
    }>(isolated.baseUrl, "/api/v1/tenants/auth-required-tenant/workspaces", {
      method: "POST",
      headers: {
        authorization: `Bearer ${tenantAdminSignIn.body.sessionToken}`
      },
      body: {
        workspaceKey: "tenant-admin-created",
        displayName: "Tenant Admin Created"
      }
    });

    assert.equal(tenantCreatedWorkspace.status, 201);
    assert.equal(
      tenantCreatedWorkspace.body.workspace.workspaceKey,
      "tenant-admin-created"
    );

    const tenantAdminWorkspaceList = await requestJsonAt<{
      items: Array<{ workspaceKey: string }>;
    }>(
      isolated.baseUrl,
      "/api/v1/tenants/auth-required-tenant/workspaces",
      {
        headers: {
          authorization: `Bearer ${tenantAdminSignIn.body.sessionToken}`
        }
      }
    );

    assert.equal(tenantAdminWorkspaceList.status, 200);
    assert.equal(
      tenantAdminWorkspaceList.body.items.some(
        workspace => workspace.workspaceKey === "tenant-admin-created"
      ),
      true
    );
  } finally {
    await closeServer(isolated.server);
  }
});

test("API rejects JSON request bodies above the configured limit", async () => {
  const isolated = await createIsolatedServer({
    FIRST_SLICE_STORE: "memory",
    FIRST_SLICE_MAX_JSON_BODY_BYTES: "96"
  });

  try {
    const config = await requestJsonAt<{
      runtimeConfig: {
        maxJsonBodyBytes: number;
        environment: { firstSliceMaxJsonBodyBytesPresent: boolean };
      };
    }>(isolated.baseUrl, "/diagnostics/config");

    assert.equal(config.status, 200);
    assert.equal(config.body.runtimeConfig.maxJsonBodyBytes, 96);
    assert.equal(
      config.body.runtimeConfig.environment.firstSliceMaxJsonBodyBytesPresent,
      true
    );

    const oversizedResponse = await fetch(
      `${isolated.baseUrl}/api/v1/admin/auth/bootstrap`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          username: "large-body-admin",
          displayName: "Large Body Admin",
          password: "x".repeat(128)
        })
      }
    );
    const oversizedBody = (await oversizedResponse.json()) as {
      error: string;
      details: { maxJsonBodyBytes: number };
    };

    assert.equal(oversizedResponse.status, 413);
    assert.equal(oversizedBody.error, "request_body_too_large");
    assert.equal(oversizedBody.details.maxJsonBodyBytes, 96);
  } finally {
    await closeServer(isolated.server);
  }
});

test("HTTP server timeouts are configurable and exposed", async () => {
  const isolated = await createIsolatedServer({
    FIRST_SLICE_STORE: "memory",
    HTTP_HEADERS_TIMEOUT_MS: "7000",
    HTTP_REQUEST_TIMEOUT_MS: "11000",
    HTTP_KEEP_ALIVE_TIMEOUT_MS: "3000"
  });

  try {
    assert.equal(isolated.server.headersTimeout, 7000);
    assert.equal(isolated.server.requestTimeout, 11000);
    assert.equal(isolated.server.keepAliveTimeout, 3000);

    const config = await requestJsonAt<{
      runtimeConfig: {
        httpTimeouts: {
          headersTimeoutMs: number;
          requestTimeoutMs: number;
          keepAliveTimeoutMs: number;
        };
        environment: {
          httpHeadersTimeoutMsPresent: boolean;
          httpRequestTimeoutMsPresent: boolean;
          httpKeepAliveTimeoutMsPresent: boolean;
        };
      };
    }>(isolated.baseUrl, "/diagnostics/config");

    assert.equal(config.status, 200);
    assert.deepEqual(config.body.runtimeConfig.httpTimeouts, {
      headersTimeoutMs: 7000,
      requestTimeoutMs: 11000,
      keepAliveTimeoutMs: 3000
    });
    assert.equal(
      config.body.runtimeConfig.environment.httpHeadersTimeoutMsPresent,
      true
    );
    assert.equal(
      config.body.runtimeConfig.environment.httpRequestTimeoutMsPresent,
      true
    );
    assert.equal(
      config.body.runtimeConfig.environment.httpKeepAliveTimeoutMsPresent,
      true
    );
  } finally {
    await closeServer(isolated.server);
  }
});

test("runtime port and shutdown drain settings are validated and exposed", async () => {
  const isolated = await createIsolatedServer({
    FIRST_SLICE_STORE: "memory",
    PORT: "4510",
    SHUTDOWN_DRAIN_DELAY_MS: "250"
  });

  try {
    const config = await requestJsonAt<{
      runtimeConfig: {
        port: number;
        shutdownDrainDelayMs: number;
      };
    }>(isolated.baseUrl, "/diagnostics/config");

    assert.equal(config.status, 200);
    assert.equal(config.body.runtimeConfig.port, 4510);
    assert.equal(config.body.runtimeConfig.shutdownDrainDelayMs, 250);
  } finally {
    await closeServer(isolated.server);
  }

  await assert.rejects(
    () =>
      createIsolatedServer({
        FIRST_SLICE_STORE: "memory",
        PORT: "0"
      }),
    /PORT must be a positive integer/
  );

  await assert.rejects(
    () =>
      createIsolatedServer({
        FIRST_SLICE_STORE: "memory",
        PORT: "70000"
      }),
    /PORT must be between 1 and 65535/
  );

  await assert.rejects(
    () =>
      createIsolatedServer({
        FIRST_SLICE_STORE: "memory",
        SHUTDOWN_DRAIN_DELAY_MS: "250ms"
      }),
    /SHUTDOWN_DRAIN_DELAY_MS must be a non-negative integer/
  );
});

test("local demo bootstrap seeds a directly usable app state", async () => {
  const isolated = await createIsolatedServer({
    FIRST_SLICE_STORE: "memory",
    FIRST_SLICE_OPERATOR_AUTH_REQUIRED: "true",
    FIRST_SLICE_BOOTSTRAP_DEMO: "true"
  });

  try {
    const config = await requestJsonAt<{
      runtimeConfig: {
        environment: { firstSliceBootstrapDemo: boolean };
      };
    }>(isolated.baseUrl, "/diagnostics/config");

    assert.equal(config.status, 200);
    assert.equal(config.body.runtimeConfig.environment.firstSliceBootstrapDemo, true);

    const signIn = await requestJsonAt<{
      sessionToken: string;
      adminUser: { username: string };
      roleAssignments: Array<{ role: string }>;
    }>(isolated.baseUrl, "/api/v1/admin/auth/sign-in", {
      method: "POST",
      body: {
        username: "demo-admin",
        password: "demo-admin-password"
      }
    });

    assert.equal(signIn.status, 200);
    assert.equal(signIn.body.adminUser.username, "demo-admin");
    assert.equal(signIn.body.roleAssignments[0]?.role, "platform_admin");

    const overview = await requestJsonAt<{
      workspaceOverview: {
        workspace: { workspaceKey: string };
        activeContentReleaseId: string | null;
        contentReleaseCount: number;
      };
    }>(
      isolated.baseUrl,
      "/api/v1/tenants/demo-tenant/workspaces/demo-workspace",
      {
        headers: {
          authorization: `Bearer ${signIn.body.sessionToken}`
        }
      }
    );

    assert.equal(overview.status, 200);
    assert.equal(overview.body.workspaceOverview.workspace.workspaceKey, "demo-workspace");
    assert.equal(typeof overview.body.workspaceOverview.activeContentReleaseId, "string");
    assert.ok(overview.body.workspaceOverview.contentReleaseCount >= 1);

    const rosterCsv = await fetch(
      `${isolated.baseUrl}/api/v1/tenants/demo-tenant/workspaces/demo-workspace/exports/participant-roster.csv`,
      {
        headers: {
          authorization: `Bearer ${signIn.body.sessionToken}`
        }
      }
    );
    assert.equal(rosterCsv.status, 200);
    assert.equal(
      rosterCsv.headers.get("content-type"),
      "text/csv; charset=utf-8"
    );
    const rosterCsvText = await rosterCsv.text();
    assert.match(
      rosterCsvText,
      /^tenantKey,workspaceKey,participantRosterEntryId,loginKey,groupKey,bookletKey,displayName,passwordRequired,importedAt,validationWarningCodes,validationWarningMessages,bookletKeys\n/
    );
    assert.match(
      rosterCsvText,
      /"demo-tenant","demo-workspace","[^"]+","student-demo","group:student-demo","booklet:demo","Demo Student","false"/
    );

    const participantSignIn = await requestJsonAt<{
      participantSession: {
        participantSessionId: string;
        loginKey: string;
        groupKey: string;
      };
      participantRosterEntry: {
        displayName: string | null;
      } | null;
    }>(isolated.baseUrl, "/api/v1/participant/auth/sign-in", {
      method: "POST",
      body: {
        workspaceKey: "demo-workspace",
        loginKey: "student-demo"
      }
    });

    assert.equal(participantSignIn.status, 200);
    assert.equal(participantSignIn.body.participantSession.loginKey, "student-demo");
    assert.equal(
      participantSignIn.body.participantRosterEntry?.displayName,
      "Demo Student"
    );

    const resumed = await requestJsonAt<{
      testRun: {
        testRunId: string;
        status: string;
        bookletKey: string;
        currentUnitKey: string | null;
      };
    }>(
      isolated.baseUrl,
      `/api/v1/participant/sessions/${participantSignIn.body.participantSession.participantSessionId}/resume`,
      { method: "POST" }
    );

    assert.equal(resumed.status, 200);
    assert.equal(resumed.body.testRun.status, "running");
    assert.equal(resumed.body.testRun.bookletKey, "booklet:demo");
    assert.equal(resumed.body.testRun.currentUnitKey, "unit-intro");

    const currentState = await requestJsonAt<{
      currentRunState: {
        scope: {
          tenantKey: string;
          workspaceKey: string;
        };
        participantRosterEntry: {
          displayName: string | null;
        } | null;
        currentUnit: {
          unitKey: string | null;
          displayLabel: string | null;
          description?: string | null;
          content?: string | null;
        };
        bookletUnits: Array<{
          unitKey: string;
          displayLabel: string;
          content?: string;
        }>;
      };
    }>(
      isolated.baseUrl,
      `/api/v1/participant/sessions/${participantSignIn.body.participantSession.participantSessionId}/current-state`
    );

    assert.equal(currentState.status, 200);
    assert.deepEqual(currentState.body.currentRunState.scope, {
      tenantKey: "demo-tenant",
      workspaceKey: "demo-workspace"
    });
    assert.equal(
      currentState.body.currentRunState.participantRosterEntry?.displayName,
      "Demo Student"
    );
    assert.deepEqual(
      currentState.body.currentRunState.bookletUnits.map(unit => unit.unitKey),
      ["unit-intro", "unit-practice", "unit-finish"]
    );
    assert.equal(
      currentState.body.currentRunState.currentUnit.description,
      "Demo introduction task"
    );
    assert.equal(
      currentState.body.currentRunState.currentUnit.content,
      "Describe what you see in the demo introduction."
    );
    assert.equal(
      currentState.body.currentRunState.bookletUnits[1]?.content,
      "Save a practice response."
    );

    const saved = await requestJsonAt<{
      testRun: {
        currentUnitKey: string | null;
        unitResponses: Record<string, string>;
      };
    }>(
      isolated.baseUrl,
      `/api/v1/participant/test-runs/${resumed.body.testRun.testRunId}/save-progress`,
      {
        method: "POST",
        body: {
          currentUnitKey: "unit-intro",
          status: "running",
          unitResponse: "My first demo response"
        }
      }
    );

    assert.equal(saved.status, 200);
    assert.equal(saved.body.testRun.currentUnitKey, "unit-intro");
    assert.equal(saved.body.testRun.unitResponses["unit-intro"], "My first demo response");

    const statusOnlySave = await requestJsonAt<{
      testRun: {
        currentUnitKey: string | null;
        status: string;
        unitResponses: Record<string, string>;
      };
    }>(
      isolated.baseUrl,
      `/api/v1/participant/test-runs/${resumed.body.testRun.testRunId}/save-progress`,
      {
        method: "POST",
        body: {
          status: "paused"
        }
      }
    );

    assert.equal(statusOnlySave.status, 200);
    assert.equal(statusOnlySave.body.testRun.status, "paused");
    assert.equal(statusOnlySave.body.testRun.currentUnitKey, "unit-intro");
    assert.equal(
      statusOnlySave.body.testRun.unitResponses["unit-intro"],
      "My first demo response"
    );

    const movedToPractice = await requestJsonAt<{
      testRun: {
        currentUnitKey: string | null;
      };
    }>(
      isolated.baseUrl,
      `/api/v1/participant/test-runs/${resumed.body.testRun.testRunId}/save-progress`,
      {
        method: "POST",
        body: {
          currentUnitKey: "unit-practice",
          status: "running"
        }
      }
    );

    assert.equal(movedToPractice.status, 200);
    assert.equal(movedToPractice.body.testRun.currentUnitKey, "unit-practice");

    const responseOnlySave = await requestJsonAt<{
      testRun: {
        currentUnitKey: string | null;
        unitResponses: Record<string, string>;
      };
    }>(
      isolated.baseUrl,
      `/api/v1/participant/test-runs/${resumed.body.testRun.testRunId}/save-progress`,
      {
        method: "POST",
        body: {
          status: "running",
          unitResponse: "Practice response without repeated unit key"
        }
      }
    );

    assert.equal(responseOnlySave.status, 200);
    assert.equal(responseOnlySave.body.testRun.currentUnitKey, "unit-practice");
    assert.equal(
      responseOnlySave.body.testRun.unitResponses["unit-practice"],
      "Practice response without repeated unit key"
    );

    const unknownUnitSave = await requestJsonAt<{ error: string }>(
      isolated.baseUrl,
      `/api/v1/participant/test-runs/${resumed.body.testRun.testRunId}/save-progress`,
      {
        method: "POST",
        body: {
          currentUnitKey: "unit-missing",
          status: "paused",
          unitResponse: "This should not be stored"
        }
      }
    );

    assert.equal(unknownUnitSave.status, 404);
    assert.equal(unknownUnitSave.body.error, "unit_not_found");

    const invalidStatusSave = await requestJsonAt<{ error: string }>(
      isolated.baseUrl,
      `/api/v1/participant/test-runs/${resumed.body.testRun.testRunId}/save-progress`,
      {
        method: "POST",
        body: {
          currentUnitKey: "unit-intro",
          status: "completed",
          unitResponse: "This should not be stored either"
        }
      }
    );

    assert.equal(invalidStatusSave.status, 400);
    assert.equal(invalidStatusSave.body.error, "test_run_progress_status_invalid");

    const invalidCurrentUnitSave = await requestJsonAt<{ error: string }>(
      isolated.baseUrl,
      `/api/v1/participant/test-runs/${resumed.body.testRun.testRunId}/save-progress`,
      {
        method: "POST",
        body: {
          currentUnitKey: 42,
          status: "paused",
          unitResponse: "This should not be stored either"
        }
      }
    );

    assert.equal(invalidCurrentUnitSave.status, 400);
    assert.equal(invalidCurrentUnitSave.body.error, "current_unit_key_invalid");

    const invalidUnitResponseSave = await requestJsonAt<{ error: string }>(
      isolated.baseUrl,
      `/api/v1/participant/test-runs/${resumed.body.testRun.testRunId}/save-progress`,
      {
        method: "POST",
        body: {
          currentUnitKey: "unit-intro",
          status: "paused",
          unitResponse: { text: "This should not be stored either" }
        }
      }
    );

    assert.equal(invalidUnitResponseSave.status, 400);
    assert.equal(invalidUnitResponseSave.body.error, "unit_response_invalid");

    const invalidSaveTestRunId = await requestJsonAt<{ error: string }>(
      isolated.baseUrl,
      "/api/v1/participant/test-runs/%20/save-progress",
      {
        method: "POST",
        body: {
          currentUnitKey: "unit-intro",
          status: "running",
          unitResponse: "This should not be stored either"
        }
      }
    );

    assert.equal(invalidSaveTestRunId.status, 400);
    assert.equal(invalidSaveTestRunId.body.error, "test_run_id_required");

    const invalidResumeTestRunId = await requestJsonAt<{ error: string }>(
      isolated.baseUrl,
      "/api/v1/participant/test-runs/%20/resume",
      { method: "POST" }
    );

    assert.equal(invalidResumeTestRunId.status, 400);
    assert.equal(invalidResumeTestRunId.body.error, "test_run_id_required");

    const invalidCompleteTestRunId = await requestJsonAt<{ error: string }>(
      isolated.baseUrl,
      "/api/v1/participant/test-runs/%20/complete",
      { method: "POST" }
    );

    assert.equal(invalidCompleteTestRunId.status, 400);
    assert.equal(invalidCompleteTestRunId.body.error, "test_run_id_required");

    const missingLaunchIdentity = await requestJsonAt<{ error: string }>(
      isolated.baseUrl,
      "/api/v1/participant/starter:launch",
      {
        method: "POST",
        body: {}
      }
    );

    assert.equal(missingLaunchIdentity.status, 400);
    assert.equal(
      missingLaunchIdentity.body.error,
      "participant_workspace_key_required"
    );

    const invalidLaunchBooklet = await requestJsonAt<{ error: string }>(
      isolated.baseUrl,
      "/api/v1/participant/starter:launch",
      {
        method: "POST",
        body: {
          participantSessionId:
            participantSignIn.body.participantSession.participantSessionId,
          bookletKey: { key: "booklet:demo" }
        }
      }
    );

    assert.equal(invalidLaunchBooklet.status, 400);
    assert.equal(invalidLaunchBooklet.body.error, "booklet_key_invalid");

    const stateAfterResponse = await requestJsonAt<{
      currentRunState: {
        scope: {
          tenantKey: string;
          workspaceKey: string;
        };
        testRun: { unitResponses: Record<string, string> };
      };
    }>(
      isolated.baseUrl,
      `/api/v1/participant/sessions/${participantSignIn.body.participantSession.participantSessionId}/current-state`
    );

    assert.equal(stateAfterResponse.status, 200);
    assert.deepEqual(stateAfterResponse.body.currentRunState.scope, {
      tenantKey: "demo-tenant",
      workspaceKey: "demo-workspace"
    });
    assert.equal(
      stateAfterResponse.body.currentRunState.testRun.unitResponses["unit-intro"],
      "My first demo response"
    );
    assert.equal(
      stateAfterResponse.body.currentRunState.testRun.unitResponses[
        "unit-practice"
      ],
      "Practice response without repeated unit key"
    );

    const detailedResponses = await requestJsonAt<{
      items: Array<{
        loginKey: string;
        groupKey: string;
        testRunId: string;
        bookletKey: string;
        unitKey: string;
        response: string;
        responseLength: number;
      }>;
    }>(
      isolated.baseUrl,
      "/api/v1/tenants/demo-tenant/workspaces/demo-workspace/responses/detailed",
      {
        headers: {
          authorization: `Bearer ${signIn.body.sessionToken}`
        }
      }
    );

    assert.equal(detailedResponses.status, 200);
    assert.deepEqual(detailedResponses.body.items.map(item => item.unitKey), [
      "unit-intro",
      "unit-practice"
    ]);
    const introResponse = detailedResponses.body.items.find(
      item => item.unitKey === "unit-intro"
    );
    const practiceResponse = detailedResponses.body.items.find(
      item => item.unitKey === "unit-practice"
    );
    assert.equal(introResponse?.loginKey, "student-demo");
    assert.equal(introResponse?.groupKey, "group:student-demo");
    assert.equal(introResponse?.bookletKey, "booklet:demo");
    assert.equal(introResponse?.response, "My first demo response");
    assert.equal(introResponse?.responseLength, 22);
    assert.equal(
      practiceResponse?.response,
      "Practice response without repeated unit key"
    );

    const filteredDetailedResponses = await requestJsonAt<{
      items: Array<{
        loginKey: string;
        groupKey: string;
        bookletKey: string;
        testRunId: string;
        unitKey: string;
        status: string;
      }>;
    }>(
      isolated.baseUrl,
      `/api/v1/tenants/demo-tenant/workspaces/demo-workspace/responses/detailed?loginKey=student-demo&groupKey=group%3Astudent-demo&bookletKey=booklet%3Ademo&participantSessionId=${participantSignIn.body.participantSession.participantSessionId}&testRunId=${resumed.body.testRun.testRunId}&unitKey=unit-intro&status=running&limit=1`,
      {
        headers: {
          authorization: `Bearer ${signIn.body.sessionToken}`
        }
      }
    );

    assert.equal(filteredDetailedResponses.status, 200);
    assert.equal(filteredDetailedResponses.body.items.length, 1);
    assert.equal(filteredDetailedResponses.body.items[0]?.loginKey, "student-demo");
    assert.equal(filteredDetailedResponses.body.items[0]?.bookletKey, "booklet:demo");
    assert.equal(filteredDetailedResponses.body.items[0]?.unitKey, "unit-intro");
    assert.equal(filteredDetailedResponses.body.items[0]?.status, "running");

    const participantSessionsCsv = await requestTextAt(
      isolated.baseUrl,
      "/api/v1/tenants/demo-tenant/workspaces/demo-workspace/exports/participant-sessions.csv?loginKey=student-demo&groupKey=group%3Astudent-demo&limit=1",
      {
        headers: {
          authorization: `Bearer ${signIn.body.sessionToken}`
        }
      }
    );

    assert.equal(participantSessionsCsv.status, 200);
    assert.equal(participantSessionsCsv.contentType, "text/csv; charset=utf-8");
    assert.match(
      participantSessionsCsv.body,
      /^tenantKey,workspaceKey,participantSessionId,loginKey,groupKey,sessionStatus,/
    );
    assert.match(
      participantSessionsCsv.body,
      new RegExp(
        `"demo-tenant","demo-workspace","${participantSignIn.body.participantSession.participantSessionId}","student-demo","group:student-demo"`
      )
    );

    const invalidDetailedResponseStatus = await requestJsonAt<{ error: string }>(
      isolated.baseUrl,
      "/api/v1/tenants/demo-tenant/workspaces/demo-workspace/responses/detailed?status=unknown",
      {
        headers: {
          authorization: `Bearer ${signIn.body.sessionToken}`
        }
      }
    );

    assert.equal(invalidDetailedResponseStatus.status, 400);
    assert.equal(
      invalidDetailedResponseStatus.body.error,
      "detailed_response_status_invalid"
    );

    const invalidDetailedResponseLimit = await requestJsonAt<{ error: string }>(
      isolated.baseUrl,
      "/api/v1/tenants/demo-tenant/workspaces/demo-workspace/responses/detailed?limit=0",
      {
        headers: {
          authorization: `Bearer ${signIn.body.sessionToken}`
        }
      }
    );

    assert.equal(invalidDetailedResponseLimit.status, 400);
    assert.equal(
      invalidDetailedResponseLimit.body.error,
      "detailed_response_limit_invalid"
    );

    const studyMonitor = await requestJsonAt<{
      studyMonitorSummary: {
        participantSessionCount: number;
        testRunCount: number;
        runningCount: number;
        responseCount: number;
        reviewCount: number;
        bookletProgress: Array<{
          bookletKey: string;
          displayLabel: string;
          participantSessionCount: number;
          testRunCount: number;
          runningCount: number;
          responseCount: number;
          unitCount: number;
        }>;
        unitProgress: Array<{
          unitKey: string;
          expectedRunCount: number;
          responseCount: number;
          missingResponseCount: number;
          unexpectedResponseCount: number;
        }>;
        groups: Array<{
          groupKey: string;
          participantSessionCount: number;
          runningCount: number;
          responseCount: number;
          reviewCount: number;
        }>;
        attentionItems: Array<{
          subjectType: string;
          key: string;
          label: string;
          score: number;
          missingResponseCount: number;
          unexpectedResponseCount: number;
          notStartedCount: number;
          runningCount: number;
          pausedCount: number;
        }>;
      };
    }>(
      isolated.baseUrl,
      "/api/v1/tenants/demo-tenant/workspaces/demo-workspace/study-monitor/summary",
      {
        headers: {
          authorization: `Bearer ${signIn.body.sessionToken}`
        }
      }
    );

    assert.equal(studyMonitor.status, 200);
    assert.equal(studyMonitor.body.studyMonitorSummary.participantSessionCount, 1);
    assert.equal(studyMonitor.body.studyMonitorSummary.testRunCount, 1);
    assert.equal(studyMonitor.body.studyMonitorSummary.runningCount, 1);
    assert.equal(studyMonitor.body.studyMonitorSummary.responseCount, 2);
    assert.equal(studyMonitor.body.studyMonitorSummary.reviewCount, 0);
    assert.deepEqual(
      studyMonitor.body.studyMonitorSummary.bookletProgress.map(booklet => ({
        bookletKey: booklet.bookletKey,
        displayLabel: booklet.displayLabel,
        participantSessionCount: booklet.participantSessionCount,
        testRunCount: booklet.testRunCount,
        runningCount: booklet.runningCount,
        responseCount: booklet.responseCount,
        unitCount: booklet.unitCount
      })),
      [
        {
          bookletKey: "booklet:demo",
          displayLabel: "Demo Booklet",
          participantSessionCount: 1,
          testRunCount: 1,
          runningCount: 1,
          responseCount: 2,
          unitCount: 3
        }
      ]
    );
    assert.deepEqual(
      studyMonitor.body.studyMonitorSummary.unitProgress.map(unit => ({
        unitKey: unit.unitKey,
        expectedRunCount: unit.expectedRunCount,
        responseCount: unit.responseCount,
        missingResponseCount: unit.missingResponseCount,
        unexpectedResponseCount: unit.unexpectedResponseCount
      })),
      [
        {
          unitKey: "unit-finish",
          expectedRunCount: 1,
          responseCount: 0,
          missingResponseCount: 1,
          unexpectedResponseCount: 0
        },
        {
          unitKey: "unit-intro",
          expectedRunCount: 1,
          responseCount: 1,
          missingResponseCount: 0,
          unexpectedResponseCount: 0
        },
        {
          unitKey: "unit-practice",
          expectedRunCount: 1,
          responseCount: 1,
          missingResponseCount: 0,
          unexpectedResponseCount: 0
        }
      ]
    );
    assert.equal(
      studyMonitor.body.studyMonitorSummary.groups[0]?.groupKey,
      "group:student-demo"
    );
    assert.equal(
      studyMonitor.body.studyMonitorSummary.groups[0]?.participantSessionCount,
      1
    );
    assert.equal(studyMonitor.body.studyMonitorSummary.groups[0]?.reviewCount, 0);
    assert.deepEqual(
      studyMonitor.body.studyMonitorSummary.attentionItems.map(item => ({
        subjectType: item.subjectType,
        key: item.key,
        label: item.label,
        score: item.score,
        missingResponseCount: item.missingResponseCount,
        unexpectedResponseCount: item.unexpectedResponseCount,
        notStartedCount: item.notStartedCount,
        runningCount: item.runningCount,
        pausedCount: item.pausedCount
      })),
      [
        {
          subjectType: "unit",
          key: "unit-finish",
          label: "Finish",
          score: 100,
          missingResponseCount: 1,
          unexpectedResponseCount: 0,
          notStartedCount: 0,
          runningCount: 0,
          pausedCount: 0
        },
        {
          subjectType: "group",
          key: "group:student-demo",
          label: "group:student-demo",
          score: 10,
          missingResponseCount: 0,
          unexpectedResponseCount: 0,
          notStartedCount: 0,
          runningCount: 1,
          pausedCount: 0
        },
        {
          subjectType: "booklet",
          key: "booklet:demo",
          label: "Demo Booklet",
          score: 10,
          missingResponseCount: 0,
          unexpectedResponseCount: 0,
          notStartedCount: 0,
          runningCount: 1,
          pausedCount: 0
        }
      ]
    );

    const participantMatrix = await requestJsonAt<{
      studyMonitorParticipantMatrix: {
        rows: Array<{
          loginKey: string;
          groupKey: string;
          displayName: string | null;
          bookletKey: string | null;
          testRunStatus: string;
          unitKey: string;
          unitLabel: string;
          answered: boolean;
          responseLength: number;
        }>;
      };
    }>(
      isolated.baseUrl,
      "/api/v1/tenants/demo-tenant/workspaces/demo-workspace/study-monitor/participants",
      {
        headers: {
          authorization: `Bearer ${signIn.body.sessionToken}`
        }
      }
    );

    assert.equal(participantMatrix.status, 200);
    const introMatrixRow =
      participantMatrix.body.studyMonitorParticipantMatrix.rows.find(
        row => row.loginKey === "student-demo" && row.unitKey === "unit-intro"
      );
    assert.deepEqual(
      {
        groupKey: introMatrixRow?.groupKey,
        displayName: introMatrixRow?.displayName,
        testRunStatus: introMatrixRow?.testRunStatus,
        unitLabel: introMatrixRow?.unitLabel,
        answered: introMatrixRow?.answered
      },
      {
        groupKey: "group:student-demo",
        displayName: "Demo Student",
        testRunStatus: "running",
        unitLabel: "Introduction",
        answered: true
      }
    );
    assert.ok((introMatrixRow?.responseLength ?? 0) > 0);

    const bookletFilteredParticipantMatrix = await requestJsonAt<{
      studyMonitorParticipantMatrix: {
        rows: Array<{
          bookletKey: string | null;
          rosterBookletKey: string | null;
        }>;
      };
    }>(
      isolated.baseUrl,
      "/api/v1/tenants/demo-tenant/workspaces/demo-workspace/study-monitor/participants?bookletKey=booklet%3Ademo&limit=10",
      {
        headers: {
          authorization: `Bearer ${signIn.body.sessionToken}`
        }
      }
    );

    assert.equal(bookletFilteredParticipantMatrix.status, 200);
    assert.ok(
      bookletFilteredParticipantMatrix.body.studyMonitorParticipantMatrix.rows.length > 0
    );
    assert.ok(
      bookletFilteredParticipantMatrix.body.studyMonitorParticipantMatrix.rows.every(
        row =>
          row.bookletKey === "booklet:demo" ||
          row.rosterBookletKey === "booklet:demo"
      )
    );

    const participantDetail = await requestJsonAt<{
      studyMonitorParticipant: {
        loginKey: string;
        groupKey: string | null;
        displayName: string | null;
        participantSessionCount: number;
        testRunCount: number;
        responseCount: number;
        unitRows: Array<{
          unitKey: string;
          answered: boolean;
          responseLength: number;
          testRunStatus: string;
        }>;
      };
    }>(
      isolated.baseUrl,
      "/api/v1/tenants/demo-tenant/workspaces/demo-workspace/study-monitor/participants/student-demo",
      {
        headers: {
          authorization: `Bearer ${signIn.body.sessionToken}`
        }
      }
    );

    assert.equal(participantDetail.status, 200);
    const participantIntroRow =
      participantDetail.body.studyMonitorParticipant.unitRows.find(
        row => row.unitKey === "unit-intro"
      );
    assert.deepEqual(
      {
        loginKey: participantDetail.body.studyMonitorParticipant.loginKey,
        groupKey: participantDetail.body.studyMonitorParticipant.groupKey,
        displayName: participantDetail.body.studyMonitorParticipant.displayName,
        participantSessionCount:
          participantDetail.body.studyMonitorParticipant.participantSessionCount,
        testRunCount: participantDetail.body.studyMonitorParticipant.testRunCount,
        introAnswered: participantIntroRow?.answered,
        introStatus: participantIntroRow?.testRunStatus
      },
      {
        loginKey: "student-demo",
        groupKey: "group:student-demo",
        displayName: "Demo Student",
        participantSessionCount: 1,
        testRunCount: 1,
        introAnswered: true,
        introStatus: "running"
      }
    );
    assert.ok(participantDetail.body.studyMonitorParticipant.responseCount >= 1);
    assert.ok((participantIntroRow?.responseLength ?? 0) > 0);

    const studyMonitorCsv = await requestTextAt(
      isolated.baseUrl,
      "/api/v1/tenants/demo-tenant/workspaces/demo-workspace/exports/study-monitor.csv",
      {
        headers: {
          authorization: `Bearer ${signIn.body.sessionToken}`
        }
      }
    );

    assert.equal(studyMonitorCsv.status, 200);
    assert.equal(studyMonitorCsv.contentType, "text/csv; charset=utf-8");
    assert.match(
      studyMonitorCsv.body,
      /^tenantKey,workspaceKey,section,key,label,groupKey,bookletKey,unitKey,loginKey,expectedParticipantCount,rosterEntryCount,participantSessionCount,testRunCount,notStartedCount,runningCount,pausedCount,completedCount,responseCount,reviewCount,unitCount,expectedRunCount,rosterExpectedCount,missingResponseCount,unexpectedResponseCount,completedRunCount,latestActivityAt,generatedAt\n/
    );
    assert.match(
      studyMonitorCsv.body,
      /"demo-tenant","demo-workspace","workspace","demo-workspace","demo-workspace monitor"/
    );
    assert.match(
      studyMonitorCsv.body,
      /"demo-tenant","demo-workspace","group","group:student-demo","group:student-demo","group:student-demo"/
    );
    assert.match(
      studyMonitorCsv.body,
      /"demo-tenant","demo-workspace","booklet","booklet:demo","Demo Booklet","","booklet:demo"/
    );

    const studyMonitorParticipantMatrixCsv = await requestTextAt(
      isolated.baseUrl,
      "/api/v1/tenants/demo-tenant/workspaces/demo-workspace/exports/study-monitor-participants.csv",
      {
        headers: {
          authorization: `Bearer ${signIn.body.sessionToken}`
        }
      }
    );

    assert.equal(studyMonitorParticipantMatrixCsv.status, 200);
    assert.equal(
      studyMonitorParticipantMatrixCsv.contentType,
      "text/csv; charset=utf-8"
    );
    assert.match(
      studyMonitorParticipantMatrixCsv.body,
      /^tenantKey,workspaceKey,generatedAt,loginKey,groupKey,displayName,rosterBookletKey,participantSessionId,participantSessionStatus,testRunId,testRunStatus,bookletKey,unitKey,unitLabel,expected,answered,responseLength,reviewCount,latestActivityAt\n/
    );
    assert.match(
      studyMonitorParticipantMatrixCsv.body,
      /"demo-tenant","demo-workspace","[^"]+","student-demo","group:student-demo","Demo Student","booklet:demo","[^"]+","launched","[^"]+","running","booklet:demo","unit-intro","Introduction","true","true","[^"]+","0","[^"]+"/
    );
    assert.match(
      studyMonitorParticipantMatrixCsv.body,
      /"demo-tenant","demo-workspace","[^"]+","student-demo","group:student-demo","Demo Student","booklet:demo","[^"]+","launched","[^"]+","running","booklet:demo","unit-finish","Finish","true","false","0","0","[^"]+"/
    );

    const studyMonitorRunCsv = await requestTextAt(
      isolated.baseUrl,
      `/api/v1/tenants/demo-tenant/workspaces/demo-workspace/exports/study-monitor-runs/${resumed.body.testRun.testRunId}.csv`,
      {
        headers: {
          authorization: `Bearer ${signIn.body.sessionToken}`
        }
      }
    );

    assert.equal(studyMonitorRunCsv.status, 200);
    assert.equal(studyMonitorRunCsv.contentType, "text/csv; charset=utf-8");
    assert.match(
      studyMonitorRunCsv.body,
      /^tenantKey,workspaceKey,generatedAt,testRunId,participantSessionId,loginKey,groupKey,displayName,bookletKey,bookletLabel,testRunStatus,currentUnitKey,unitKey,unitLabel,expected,current,answered,responseLength,reviewCount,response\n/
    );
    assert.match(
      studyMonitorRunCsv.body,
      /"demo-tenant","demo-workspace","[^"]+","[^"]+","[^"]+","student-demo","group:student-demo","Demo Student","booklet:demo","Demo Booklet","running","unit-practice","unit-intro","Introduction","true","false","true","22","0","My first demo response"/
    );
    assert.match(
      studyMonitorRunCsv.body,
      /"demo-tenant","demo-workspace","[^"]+","[^"]+","[^"]+","student-demo","group:student-demo","Demo Student","booklet:demo","Demo Booklet","running","unit-practice","unit-practice","Practice","true","true","true","43","0","Practice response without repeated unit key"/
    );

    const filteredStudyMonitorParticipantMatrixCsv = await requestTextAt(
      isolated.baseUrl,
      "/api/v1/tenants/demo-tenant/workspaces/demo-workspace/exports/study-monitor-participants.csv?bookletKey=booklet%3Ademo&unitKey=unit-intro&limit=10",
      {
        headers: {
          authorization: `Bearer ${signIn.body.sessionToken}`
        }
      }
    );

    assert.equal(filteredStudyMonitorParticipantMatrixCsv.status, 200);
    assert.match(
      filteredStudyMonitorParticipantMatrixCsv.body,
      /^tenantKey,workspaceKey,generatedAt,loginKey,groupKey,displayName,rosterBookletKey,participantSessionId,participantSessionStatus,testRunId,testRunStatus,bookletKey,unitKey,unitLabel,expected,answered,responseLength,reviewCount,latestActivityAt\n/
    );
    assert.match(filteredStudyMonitorParticipantMatrixCsv.body, /booklet:demo/);
    assert.match(filteredStudyMonitorParticipantMatrixCsv.body, /unit-intro/);
    assert.equal(
      filteredStudyMonitorParticipantMatrixCsv.body.trim().split("\n").length,
      2
    );

    const openRunsCsv = await requestTextAt(
      isolated.baseUrl,
      `/api/v1/tenants/demo-tenant/workspaces/demo-workspace/exports/open-runs.csv?loginKey=student-demo&groupKey=group%3Astudent-demo&bookletKey=booklet%3Ademo&participantSessionId=${participantSignIn.body.participantSession.participantSessionId}&testRunId=${resumed.body.testRun.testRunId}&unitKey=unit-practice&status=running&limit=1`,
      {
        headers: {
          authorization: `Bearer ${signIn.body.sessionToken}`
        }
      }
    );

    assert.equal(openRunsCsv.status, 200);
    assert.equal(openRunsCsv.contentType, "text/csv; charset=utf-8");
    assert.match(
      openRunsCsv.body,
      /^tenantKey,workspaceKey,participantSessionId,testRunId,loginKey,groupKey,bookletKey,status,currentUnitKey,updatedAt,rosterBookletKey,rosterDisplayName\n/
    );
    assert.match(
      openRunsCsv.body,
      /"demo-tenant","demo-workspace","[^"]+","[^"]+","student-demo","group:student-demo","booklet:demo","running","unit-practice","[^"]+","booklet:demo","Demo Student"/
    );
    assert.equal(openRunsCsv.body.trim().split("\n").length, 2);
    assert.match(
      studyMonitorCsv.body,
      /"demo-tenant","demo-workspace","unit","unit-finish","Finish","","","unit-finish"/
    );

    const responseCsv = await requestTextAt(
      isolated.baseUrl,
      "/api/v1/tenants/demo-tenant/workspaces/demo-workspace/exports/responses.csv",
      {
        headers: {
          authorization: `Bearer ${signIn.body.sessionToken}`
        }
      }
    );

    assert.equal(responseCsv.status, 200);
    assert.equal(responseCsv.contentType, "text/csv; charset=utf-8");
    assert.match(responseCsv.body, /^tenantKey,workspaceKey,loginKey,groupKey,/);
    assert.match(
      responseCsv.body,
      /"demo-tenant","demo-workspace","student-demo","group:student-demo".*"unit-intro","My first demo response"/
    );

    const filteredResponseCsv = await requestTextAt(
      isolated.baseUrl,
      `/api/v1/tenants/demo-tenant/workspaces/demo-workspace/exports/responses.csv?testRunId=${resumed.body.testRun.testRunId}&unitKey=unit-intro&limit=1`,
      {
        headers: {
          authorization: `Bearer ${signIn.body.sessionToken}`
        }
      }
    );

    assert.equal(filteredResponseCsv.status, 200);
    assert.match(filteredResponseCsv.body, /"unit-intro","My first demo response"/);

    const createdReview = await requestJsonAt<{
      item: {
        review: {
          reviewId: string;
          reviewerId: string;
          category: string;
          comment: string;
          unitKey: string | null;
        };
      };
    }>(
      isolated.baseUrl,
      "/api/v1/tenants/demo-tenant/workspaces/demo-workspace/reviews",
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${signIn.body.sessionToken}`
        },
        body: {
          participantSessionId:
            participantSignIn.body.participantSession.participantSessionId,
          testRunId: resumed.body.testRun.testRunId,
          unitKey: "unit-intro",
          reviewerId: "integration-reviewer",
          category: "quality-check",
          comment: "Initial integration review"
        }
      }
    );

    assert.equal(createdReview.status, 201);
    assert.equal(createdReview.body.item.review.reviewerId, "integration-reviewer");
    assert.equal(createdReview.body.item.review.unitKey, "unit-intro");

    const unknownUnitReview = await requestJsonAt<{ error: string }>(
      isolated.baseUrl,
      "/api/v1/tenants/demo-tenant/workspaces/demo-workspace/reviews",
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${signIn.body.sessionToken}`
        },
        body: {
          participantSessionId:
            participantSignIn.body.participantSession.participantSessionId,
          testRunId: resumed.body.testRun.testRunId,
          unitKey: "unit-missing",
          reviewerId: "integration-reviewer",
          category: "quality-check",
          comment: "Review should reject unknown unit"
        }
      }
    );

    assert.equal(unknownUnitReview.status, 404);
    assert.equal(unknownUnitReview.body.error, "unit_not_found");

    const unknownUnitReviewUpdate = await requestJsonAt<{ error: string }>(
      isolated.baseUrl,
      `/api/v1/tenants/demo-tenant/workspaces/demo-workspace/reviews/${createdReview.body.item.review.reviewId}`,
      {
        method: "PATCH",
        headers: {
          authorization: `Bearer ${signIn.body.sessionToken}`
        },
        body: {
          unitKey: "unit-missing"
        }
      }
    );

    assert.equal(unknownUnitReviewUpdate.status, 404);
    assert.equal(unknownUnitReviewUpdate.body.error, "unit_not_found");

    const updatedReview = await requestJsonAt<{
      item: {
        review: {
          reviewId: string;
          category: string;
          comment: string;
        };
      };
    }>(
      isolated.baseUrl,
      `/api/v1/tenants/demo-tenant/workspaces/demo-workspace/reviews/${createdReview.body.item.review.reviewId}`,
      {
        method: "PATCH",
        headers: {
          authorization: `Bearer ${signIn.body.sessionToken}`
        },
        body: {
          category: "final-check",
          comment: "Updated integration review"
        }
      }
    );

    assert.equal(updatedReview.status, 200);
    assert.equal(updatedReview.body.item.review.category, "final-check");
    assert.equal(updatedReview.body.item.review.comment, "Updated integration review");

    const reviews = await requestJsonAt<{
      items: Array<{
        review: {
          reviewId: string;
          category: string;
          comment: string;
        };
        participantSession: { loginKey: string } | null;
        testRun: { bookletKey: string } | null;
      }>;
    }>(
      isolated.baseUrl,
      "/api/v1/tenants/demo-tenant/workspaces/demo-workspace/reviews",
      {
        headers: {
          authorization: `Bearer ${signIn.body.sessionToken}`
        }
      }
    );

    assert.equal(reviews.status, 200);
    assert.equal(reviews.body.items.length, 1);
    assert.equal(reviews.body.items[0]?.review.comment, "Updated integration review");
    assert.equal(reviews.body.items[0]?.participantSession?.loginKey, "student-demo");
    assert.equal(reviews.body.items[0]?.testRun?.bookletKey, "booklet:demo");

    const filteredReviews = await requestJsonAt<{
      items: Array<{
        review: {
          reviewerId: string;
          category: string;
          unitKey: string | null;
        };
        participantSession: { loginKey: string; groupKey: string } | null;
        testRun: { bookletKey: string } | null;
      }>;
    }>(
      isolated.baseUrl,
      `/api/v1/tenants/demo-tenant/workspaces/demo-workspace/reviews?loginKey=student-demo&groupKey=group%3Astudent-demo&bookletKey=booklet%3Ademo&participantSessionId=${participantSignIn.body.participantSession.participantSessionId}&testRunId=${resumed.body.testRun.testRunId}&unitKey=unit-intro&reviewerId=integration-reviewer&category=final-check&limit=1`,
      {
        headers: {
          authorization: `Bearer ${signIn.body.sessionToken}`
        }
      }
    );

    assert.equal(filteredReviews.status, 200);
    assert.equal(filteredReviews.body.items.length, 1);
    assert.equal(filteredReviews.body.items[0]?.review.reviewerId, "integration-reviewer");
    assert.equal(filteredReviews.body.items[0]?.review.category, "final-check");
    assert.equal(filteredReviews.body.items[0]?.participantSession?.loginKey, "student-demo");
    assert.equal(filteredReviews.body.items[0]?.testRun?.bookletKey, "booklet:demo");

    const invalidReviewLimit = await requestJsonAt<{ error: string }>(
      isolated.baseUrl,
      "/api/v1/tenants/demo-tenant/workspaces/demo-workspace/reviews?limit=0",
      {
        headers: {
          authorization: `Bearer ${signIn.body.sessionToken}`
        }
      }
    );

    assert.equal(invalidReviewLimit.status, 400);
    assert.equal(invalidReviewLimit.body.error, "workspace_review_limit_invalid");

    const reviewedStudyMonitor = await requestJsonAt<{
      studyMonitorSummary: {
        reviewCount: number;
        groups: Array<{ groupKey: string; reviewCount: number }>;
      };
    }>(
      isolated.baseUrl,
      "/api/v1/tenants/demo-tenant/workspaces/demo-workspace/study-monitor/summary",
      {
        headers: {
          authorization: `Bearer ${signIn.body.sessionToken}`
        }
      }
    );

    assert.equal(reviewedStudyMonitor.status, 200);
    assert.equal(reviewedStudyMonitor.body.studyMonitorSummary.reviewCount, 1);
    assert.equal(
      reviewedStudyMonitor.body.studyMonitorSummary.groups[0]?.groupKey,
      "group:student-demo"
    );
    assert.equal(
      reviewedStudyMonitor.body.studyMonitorSummary.groups[0]?.reviewCount,
      1
    );

    const participantSessionDetail = await requestJsonAt<{
      participantSessionDetail: {
        responseCount: number;
        reviewCount: number;
        runSummaries: Array<{
          testRun: { testRunId: string; status: string };
          responseCount: number;
          reviewCount: number;
        }>;
        reviews: Array<{ reviewId: string; comment: string }>;
      };
    }>(
      isolated.baseUrl,
      `/api/v1/tenants/demo-tenant/workspaces/demo-workspace/participant-sessions/${participantSignIn.body.participantSession.participantSessionId}`,
      {
        headers: {
          authorization: `Bearer ${signIn.body.sessionToken}`
        }
      }
    );

    assert.equal(participantSessionDetail.status, 200);
    assert.equal(participantSessionDetail.body.participantSessionDetail.responseCount, 2);
    assert.equal(participantSessionDetail.body.participantSessionDetail.reviewCount, 1);
    assert.equal(
      participantSessionDetail.body.participantSessionDetail.runSummaries[0]?.testRun
        .testRunId,
      resumed.body.testRun.testRunId
    );
    assert.equal(
      participantSessionDetail.body.participantSessionDetail.runSummaries[0]
        ?.responseCount,
      2
    );
    assert.equal(
      participantSessionDetail.body.participantSessionDetail.runSummaries[0]
        ?.reviewCount,
      1
    );
    assert.equal(
      participantSessionDetail.body.participantSessionDetail.reviews[0]?.comment,
      "Updated integration review"
    );

    const studyMonitorGroup = await requestJsonAt<{
      studyMonitorGroup: {
        groupKey: string;
        participantSessionCount: number;
        testRunCount: number;
        notStartedCount: number;
        runningCount: number;
        pausedCount: number;
        completedCount: number;
        responseCount: number;
        reviewCount: number;
        sessions: Array<{
          participantSession: { participantSessionId: string; loginKey: string };
          latestTestRun: { testRunId: string; status: string } | null;
          testRunCount: number;
          responseCount: number;
          reviewCount: number;
        }>;
        testRuns: Array<{
          testRun: { testRunId: string; status: string };
          responseCount: number;
          reviewCount: number;
        }>;
        unitProgress: Array<{
          unitKey: string;
          expectedRunCount: number;
          responseCount: number;
          missingResponseCount: number;
          unexpectedResponseCount: number;
        }>;
      };
    }>(
      isolated.baseUrl,
      "/api/v1/tenants/demo-tenant/workspaces/demo-workspace/study-monitor/groups/group%3Astudent-demo",
      {
        headers: {
          authorization: `Bearer ${signIn.body.sessionToken}`
        }
      }
    );

    assert.equal(studyMonitorGroup.status, 200);
    assert.equal(studyMonitorGroup.body.studyMonitorGroup.groupKey, "group:student-demo");
    assert.equal(studyMonitorGroup.body.studyMonitorGroup.participantSessionCount, 1);
    assert.equal(studyMonitorGroup.body.studyMonitorGroup.testRunCount, 1);
    assert.equal(studyMonitorGroup.body.studyMonitorGroup.notStartedCount, 0);
    assert.equal(studyMonitorGroup.body.studyMonitorGroup.runningCount, 1);
    assert.equal(studyMonitorGroup.body.studyMonitorGroup.pausedCount, 0);
    assert.equal(studyMonitorGroup.body.studyMonitorGroup.completedCount, 0);
    assert.equal(studyMonitorGroup.body.studyMonitorGroup.responseCount, 2);
    assert.equal(studyMonitorGroup.body.studyMonitorGroup.reviewCount, 1);
    assert.equal(
      studyMonitorGroup.body.studyMonitorGroup.sessions[0]?.participantSession.loginKey,
      "student-demo"
    );
    assert.equal(
      studyMonitorGroup.body.studyMonitorGroup.sessions[0]?.latestTestRun?.testRunId,
      resumed.body.testRun.testRunId
    );
    assert.equal(
      studyMonitorGroup.body.studyMonitorGroup.sessions[0]?.responseCount,
      2
    );
    assert.equal(studyMonitorGroup.body.studyMonitorGroup.sessions[0]?.reviewCount, 1);
    assert.equal(
      studyMonitorGroup.body.studyMonitorGroup.testRuns[0]?.testRun.testRunId,
      resumed.body.testRun.testRunId
    );
    assert.equal(studyMonitorGroup.body.studyMonitorGroup.testRuns[0]?.reviewCount, 1);
    assert.deepEqual(
      studyMonitorGroup.body.studyMonitorGroup.unitProgress.map(unit => ({
        unitKey: unit.unitKey,
        expectedRunCount: unit.expectedRunCount,
        responseCount: unit.responseCount,
        missingResponseCount: unit.missingResponseCount,
        unexpectedResponseCount: unit.unexpectedResponseCount
      })),
      [
        {
          unitKey: "unit-finish",
          expectedRunCount: 1,
          responseCount: 0,
          missingResponseCount: 1,
          unexpectedResponseCount: 0
        },
        {
          unitKey: "unit-intro",
          expectedRunCount: 1,
          responseCount: 1,
          missingResponseCount: 0,
          unexpectedResponseCount: 0
        },
        {
          unitKey: "unit-practice",
          expectedRunCount: 1,
          responseCount: 1,
          missingResponseCount: 0,
          unexpectedResponseCount: 0
        }
      ]
    );

    const studyMonitorBooklet = await requestJsonAt<{
      studyMonitorBooklet: {
        bookletKey: string;
        displayLabel: string;
        participantSessionCount: number;
        testRunCount: number;
        runningCount: number;
        responseCount: number;
        reviewCount: number;
        unitCount: number;
        testRuns: Array<{
          testRun: { testRunId: string; status: string; bookletKey: string };
          participantSession: { loginKey: string; groupKey: string } | null;
          responseCount: number;
          reviewCount: number;
        }>;
        unitProgress: Array<{
          unitKey: string;
          expectedRunCount: number;
          responseCount: number;
          missingResponseCount: number;
          unexpectedResponseCount: number;
        }>;
      };
    }>(
      isolated.baseUrl,
      "/api/v1/tenants/demo-tenant/workspaces/demo-workspace/study-monitor/booklets/booklet%3Ademo",
      {
        headers: {
          authorization: `Bearer ${signIn.body.sessionToken}`
        }
      }
    );

    assert.equal(studyMonitorBooklet.status, 200);
    assert.equal(
      studyMonitorBooklet.body.studyMonitorBooklet.bookletKey,
      "booklet:demo"
    );
    assert.equal(
      studyMonitorBooklet.body.studyMonitorBooklet.displayLabel,
      "Demo Booklet"
    );
    assert.equal(
      studyMonitorBooklet.body.studyMonitorBooklet.participantSessionCount,
      1
    );
    assert.equal(studyMonitorBooklet.body.studyMonitorBooklet.testRunCount, 1);
    assert.equal(studyMonitorBooklet.body.studyMonitorBooklet.runningCount, 1);
    assert.equal(studyMonitorBooklet.body.studyMonitorBooklet.responseCount, 2);
    assert.equal(studyMonitorBooklet.body.studyMonitorBooklet.reviewCount, 1);
    assert.equal(studyMonitorBooklet.body.studyMonitorBooklet.unitCount, 3);
    assert.equal(
      studyMonitorBooklet.body.studyMonitorBooklet.testRuns[0]?.testRun.testRunId,
      resumed.body.testRun.testRunId
    );
    assert.equal(
      studyMonitorBooklet.body.studyMonitorBooklet.testRuns[0]?.participantSession
        ?.loginKey,
      "student-demo"
    );
    assert.equal(
      studyMonitorBooklet.body.studyMonitorBooklet.testRuns[0]?.responseCount,
      2
    );
    assert.equal(
      studyMonitorBooklet.body.studyMonitorBooklet.testRuns[0]?.reviewCount,
      1
    );
    assert.deepEqual(
      studyMonitorBooklet.body.studyMonitorBooklet.unitProgress.map(unit => ({
        unitKey: unit.unitKey,
        expectedRunCount: unit.expectedRunCount,
        responseCount: unit.responseCount,
        missingResponseCount: unit.missingResponseCount,
        unexpectedResponseCount: unit.unexpectedResponseCount
      })),
      [
        {
          unitKey: "unit-finish",
          expectedRunCount: 1,
          responseCount: 0,
          missingResponseCount: 1,
          unexpectedResponseCount: 0
        },
        {
          unitKey: "unit-intro",
          expectedRunCount: 1,
          responseCount: 1,
          missingResponseCount: 0,
          unexpectedResponseCount: 0
        },
        {
          unitKey: "unit-practice",
          expectedRunCount: 1,
          responseCount: 1,
          missingResponseCount: 0,
          unexpectedResponseCount: 0
        }
      ]
    );

    const missingStudyMonitorBooklet = await requestJsonAt<{ error: string }>(
      isolated.baseUrl,
      "/api/v1/tenants/demo-tenant/workspaces/demo-workspace/study-monitor/booklets/booklet%3Amissing",
      {
        headers: {
          authorization: `Bearer ${signIn.body.sessionToken}`
        }
      }
    );

    assert.equal(missingStudyMonitorBooklet.status, 404);
    assert.equal(
      missingStudyMonitorBooklet.body.error,
      "study_monitor_booklet_not_found"
    );

    const studyMonitorUnit = await requestJsonAt<{
      studyMonitorUnit: {
        unitKey: string;
        displayLabel: string;
        expectedRunCount: number;
        responseCount: number;
        missingResponseCount: number;
        unexpectedResponseCount: number;
        completedRunCount: number;
        reviewCount: number;
        testRuns: Array<{
          testRun: { testRunId: string; status: string; bookletKey: string };
          participantSession: { loginKey: string; groupKey: string } | null;
          expected: boolean;
          answered: boolean;
          response: string | null;
          responseLength: number;
          reviewCount: number;
        }>;
      };
    }>(
      isolated.baseUrl,
      "/api/v1/tenants/demo-tenant/workspaces/demo-workspace/study-monitor/units/unit-intro",
      {
        headers: {
          authorization: `Bearer ${signIn.body.sessionToken}`
        }
      }
    );

    assert.equal(studyMonitorUnit.status, 200);
    assert.equal(studyMonitorUnit.body.studyMonitorUnit.unitKey, "unit-intro");
    assert.equal(studyMonitorUnit.body.studyMonitorUnit.displayLabel, "Introduction");
    assert.equal(studyMonitorUnit.body.studyMonitorUnit.expectedRunCount, 1);
    assert.equal(studyMonitorUnit.body.studyMonitorUnit.responseCount, 1);
    assert.equal(studyMonitorUnit.body.studyMonitorUnit.missingResponseCount, 0);
    assert.equal(studyMonitorUnit.body.studyMonitorUnit.unexpectedResponseCount, 0);
    assert.equal(studyMonitorUnit.body.studyMonitorUnit.completedRunCount, 0);
    assert.equal(studyMonitorUnit.body.studyMonitorUnit.reviewCount, 1);
    assert.equal(
      studyMonitorUnit.body.studyMonitorUnit.testRuns[0]?.testRun.testRunId,
      resumed.body.testRun.testRunId
    );
    assert.equal(
      studyMonitorUnit.body.studyMonitorUnit.testRuns[0]?.participantSession?.loginKey,
      "student-demo"
    );
    assert.equal(studyMonitorUnit.body.studyMonitorUnit.testRuns[0]?.expected, true);
    assert.equal(studyMonitorUnit.body.studyMonitorUnit.testRuns[0]?.answered, true);
    assert.equal(
      studyMonitorUnit.body.studyMonitorUnit.testRuns[0]?.response,
      "My first demo response"
    );
    assert.equal(studyMonitorUnit.body.studyMonitorUnit.testRuns[0]?.reviewCount, 1);

    const missingStudyMonitorUnit = await requestJsonAt<{ error: string }>(
      isolated.baseUrl,
      "/api/v1/tenants/demo-tenant/workspaces/demo-workspace/study-monitor/units/unit-missing",
      {
        headers: {
          authorization: `Bearer ${signIn.body.sessionToken}`
        }
      }
    );

    assert.equal(missingStudyMonitorUnit.status, 404);
    assert.equal(missingStudyMonitorUnit.body.error, "study_monitor_unit_not_found");

    const reviewCsv = await requestTextAt(
      isolated.baseUrl,
      "/api/v1/tenants/demo-tenant/workspaces/demo-workspace/exports/reviews.csv",
      {
        headers: {
          authorization: `Bearer ${signIn.body.sessionToken}`
        }
      }
    );

    assert.equal(reviewCsv.status, 200);
    assert.equal(reviewCsv.contentType, "text/csv; charset=utf-8");
    assert.match(reviewCsv.body, /^tenantKey,workspaceKey,reviewId,loginKey,/);
    assert.match(
      reviewCsv.body,
      /"demo-tenant","demo-workspace".*"student-demo","group:student-demo".*"unit-intro","integration-reviewer","final-check","Updated integration review"/
    );

    const filteredReviewCsv = await requestTextAt(
      isolated.baseUrl,
      `/api/v1/tenants/demo-tenant/workspaces/demo-workspace/exports/reviews.csv?bookletKey=booklet%3Ademo&reviewerId=integration-reviewer&category=final-check&limit=1`,
      {
        headers: {
          authorization: `Bearer ${signIn.body.sessionToken}`
        }
      }
    );

    assert.equal(filteredReviewCsv.status, 200);
    assert.match(
      filteredReviewCsv.body,
      /"unit-intro","integration-reviewer","final-check","Updated integration review"/
    );

    const deletedReview = await requestJsonAt<{ deletedReviewId: string }>(
      isolated.baseUrl,
      `/api/v1/tenants/demo-tenant/workspaces/demo-workspace/reviews/${createdReview.body.item.review.reviewId}`,
      {
        method: "DELETE",
        headers: {
          authorization: `Bearer ${signIn.body.sessionToken}`
        }
      }
    );

    assert.equal(deletedReview.status, 200);
    assert.equal(
      deletedReview.body.deletedReviewId,
      createdReview.body.item.review.reviewId
    );

    const logCsv = await requestTextAt(
      isolated.baseUrl,
      "/api/v1/tenants/demo-tenant/workspaces/demo-workspace/exports/logs.csv",
      {
        headers: {
          authorization: `Bearer ${signIn.body.sessionToken}`
        }
      }
    );

    assert.equal(logCsv.status, 200);
    assert.equal(logCsv.contentType, "text/csv; charset=utf-8");
    assert.match(logCsv.body, /^tenantKey,workspaceKey,activityEventId,eventType,/);
    assert.match(logCsv.body, /"demo-tenant","demo-workspace",.*"participant_signed_in"/);
    assert.match(logCsv.body, /"demo-tenant","demo-workspace",.*"test_run_progress_saved"/);
    assert.match(logCsv.body, /"demo-tenant","demo-workspace",.*"review_created"/);
    assert.match(logCsv.body, /"demo-tenant","demo-workspace",.*"review_deleted"/);

    const cleanupReview = await requestJsonAt<{
      item: { review: { reviewId: string } };
    }>(
      isolated.baseUrl,
      "/api/v1/tenants/demo-tenant/workspaces/demo-workspace/reviews",
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${signIn.body.sessionToken}`
        },
        body: {
          participantSessionId:
            participantSignIn.body.participantSession.participantSessionId,
          testRunId: resumed.body.testRun.testRunId,
          unitKey: "unit-intro",
          reviewerId: "cleanup-reviewer",
          category: "cleanup-check",
          comment: "Review removed by group deletion"
        }
      }
    );
    assert.equal(cleanupReview.status, 201);

    const groupDeletion = await requestJsonAt<{
      deletion: {
        groupKey: string;
        deletedTestRunCount: number;
        deletedResponseCount: number;
        deletedReviewCount: number;
        affectedParticipantSessionIds: string[];
        deletedTestRunIds: string[];
      };
    }>(
      isolated.baseUrl,
      "/api/v1/tenants/demo-tenant/workspaces/demo-workspace/results/groups/group%3Astudent-demo",
      {
        method: "DELETE",
        headers: {
          authorization: `Bearer ${signIn.body.sessionToken}`
        }
      }
    );

    assert.equal(groupDeletion.status, 200);
    assert.equal(groupDeletion.body.deletion.groupKey, "group:student-demo");
    assert.equal(groupDeletion.body.deletion.deletedTestRunCount, 1);
    assert.equal(groupDeletion.body.deletion.deletedResponseCount, 2);
    assert.equal(groupDeletion.body.deletion.deletedReviewCount, 1);
    assert.deepEqual(groupDeletion.body.deletion.affectedParticipantSessionIds, [
      participantSignIn.body.participantSession.participantSessionId
    ]);
    assert.deepEqual(groupDeletion.body.deletion.deletedTestRunIds, [
      resumed.body.testRun.testRunId
    ]);

    const detailedResponsesAfterDeletion = await requestJsonAt<{
      items: unknown[];
    }>(
      isolated.baseUrl,
      "/api/v1/tenants/demo-tenant/workspaces/demo-workspace/responses/detailed",
      {
        headers: {
          authorization: `Bearer ${signIn.body.sessionToken}`
        }
      }
    );

    assert.equal(detailedResponsesAfterDeletion.status, 200);
    assert.deepEqual(detailedResponsesAfterDeletion.body.items, []);

    const reviewsAfterDeletion = await requestJsonAt<{ items: unknown[] }>(
      isolated.baseUrl,
      "/api/v1/tenants/demo-tenant/workspaces/demo-workspace/reviews",
      {
        headers: {
          authorization: `Bearer ${signIn.body.sessionToken}`
        }
      }
    );

    assert.equal(reviewsAfterDeletion.status, 200);
    assert.deepEqual(reviewsAfterDeletion.body.items, []);

    const groupMonitorAfterDeletion = await requestJsonAt<{
      studyMonitorGroup: {
        participantSessionCount: number;
        testRunCount: number;
        notStartedCount: number;
        responseCount: number;
        reviewCount: number;
      };
    }>(
      isolated.baseUrl,
      "/api/v1/tenants/demo-tenant/workspaces/demo-workspace/study-monitor/groups/group%3Astudent-demo",
      {
        headers: {
          authorization: `Bearer ${signIn.body.sessionToken}`
        }
      }
    );

    assert.equal(groupMonitorAfterDeletion.status, 200);
    assert.equal(
      groupMonitorAfterDeletion.body.studyMonitorGroup.participantSessionCount,
      1
    );
    assert.equal(groupMonitorAfterDeletion.body.studyMonitorGroup.testRunCount, 0);
    assert.equal(groupMonitorAfterDeletion.body.studyMonitorGroup.notStartedCount, 1);
    assert.equal(groupMonitorAfterDeletion.body.studyMonitorGroup.responseCount, 0);
    assert.equal(groupMonitorAfterDeletion.body.studyMonitorGroup.reviewCount, 0);

    const deletionActivity = await requestJsonAt<{
      items: Array<{
        activityEvent: {
          eventType: string;
          summary: string;
          details: {
            groupKey?: string;
            deletedTestRunCount?: number;
            deletedResponseCount?: number;
            deletedReviewCount?: number;
          };
        };
      }>;
    }>(
      isolated.baseUrl,
      "/api/v1/tenants/demo-tenant/workspaces/demo-workspace/activity-events?eventType=group_results_deleted&limit=1",
      {
        headers: {
          authorization: `Bearer ${signIn.body.sessionToken}`
        }
      }
    );

    assert.equal(deletionActivity.status, 200);
    assert.equal(
      deletionActivity.body.items[0]?.activityEvent.eventType,
      "group_results_deleted"
    );
    assert.match(
      deletionActivity.body.items[0]?.activityEvent.summary ?? "",
      /Deleted 1 test run/
    );
    assert.deepEqual(deletionActivity.body.items[0]?.activityEvent.details, {
      groupKey: "group:student-demo",
      deletedTestRunCount: 1,
      deletedResponseCount: 2,
      deletedReviewCount: 1,
      affectedParticipantSessionIds: [
        participantSignIn.body.participantSession.participantSessionId
      ],
      deletedTestRunIds: [resumed.body.testRun.testRunId]
    });

    const protectedRosterImport = await requestJsonAt<{
      items: Array<{
        loginKey: string;
        passwordRequired: boolean;
      }>;
    }>(
      isolated.baseUrl,
      "/api/v1/tenants/demo-tenant/workspaces/demo-workspace/participant-roster",
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${signIn.body.sessionToken}`
        },
        body: {
          rosterText: [
            "loginKey,groupKey,bookletKey,displayName,pw",
            "protected-demo,group:protected-demo,booklet:demo,Protected Demo,secret-demo"
          ].join("\n")
        }
      }
    );
    assert.equal(protectedRosterImport.status, 201);
    assert.equal(
      protectedRosterImport.body.items.find(
        item => item.loginKey === "protected-demo"
      )?.passwordRequired,
      true
    );

    const protectedSignInWithoutPassword = await requestJsonAt<{
      error: string;
    }>(isolated.baseUrl, "/api/v1/participant/auth/sign-in", {
      method: "POST",
      body: {
        tenantKey: "demo-tenant",
        workspaceKey: "demo-workspace",
        loginKey: "protected-demo"
      }
    });
    assert.equal(protectedSignInWithoutPassword.status, 401);
    assert.equal(
      protectedSignInWithoutPassword.body.error,
      "participant_password_invalid"
    );

    const protectedSignInWithWrongPassword = await requestJsonAt<{
      error: string;
    }>(isolated.baseUrl, "/api/v1/participant/auth/sign-in", {
      method: "POST",
      body: {
        tenantKey: "demo-tenant",
        workspaceKey: "demo-workspace",
        loginKey: "protected-demo",
        password: "wrong-secret"
      }
    });
    assert.equal(protectedSignInWithWrongPassword.status, 401);
    assert.equal(
      protectedSignInWithWrongPassword.body.error,
      "participant_password_invalid"
    );

    const protectedStarterLaunch = await requestJsonAt<{
      participantSession: {
        loginKey: string;
      };
      participantRosterEntry: {
        passwordRequired: boolean;
      } | null;
      testRun: {
        bookletKey: string;
      };
    }>(isolated.baseUrl, "/api/v1/participant/starter:launch", {
      method: "POST",
      body: {
        tenantKey: "demo-tenant",
        workspaceKey: "demo-workspace",
        loginKey: "protected-demo",
        password: "secret-demo"
      }
    });
    assert.equal(protectedStarterLaunch.status, 200);
    assert.equal(
      protectedStarterLaunch.body.participantSession.loginKey,
      "protected-demo"
    );
    assert.equal(
      protectedStarterLaunch.body.participantRosterEntry?.passwordRequired,
      true
    );
    assert.equal(protectedStarterLaunch.body.testRun.bookletKey, "booklet:demo");
  } finally {
    await closeServer(isolated.server);
  }
});

test("monitor command endpoint pauses and resumes an open run", async () => {
  const isolated = await createIsolatedServer({
    FIRST_SLICE_STORE: "memory",
    FIRST_SLICE_BOOTSTRAP_DEMO: "true",
    FIRST_SLICE_OPERATOR_AUTH_REQUIRED: "true"
  });

  try {
    const signIn = await requestJsonAt<{
      sessionToken: string;
    }>(isolated.baseUrl, "/api/v1/admin/auth/sign-in", {
      method: "POST",
      body: {
        username: "demo-admin",
        password: "demo-admin-password"
      }
    });

    assert.equal(signIn.status, 200);
    const authorization = `Bearer ${signIn.body.sessionToken}`;

    const participantSignIn = await requestJsonAt<{
      participantSession: {
        participantSessionId: string;
        loginKey: string;
        groupKey: string;
      };
    }>(isolated.baseUrl, "/api/v1/participant/auth/sign-in", {
      method: "POST",
      body: {
        workspaceKey: "demo-workspace",
        loginKey: "student-demo"
      }
    });

    assert.equal(participantSignIn.status, 200);

    const resumed = await requestJsonAt<{
      testRun: { testRunId: string; status: string; bookletKey: string };
    }>(
      isolated.baseUrl,
      `/api/v1/participant/sessions/${participantSignIn.body.participantSession.participantSessionId}/resume`,
      { method: "POST" }
    );

    assert.equal(resumed.status, 200);
    assert.equal(resumed.body.testRun.status, "running");
    assert.equal(resumed.body.testRun.bookletKey, "booklet:demo");

    const commandPath = `/api/v1/tenants/demo-tenant/workspaces/demo-workspace/monitor/open-runs/${resumed.body.testRun.testRunId}/commands`;
    const pauseCommand = await requestJsonAt<{
      command: {
        commandId: string;
        commandType: string;
        actorId: string | null;
        previousStatus: string;
        testRun: { testRunId: string; status: string };
        participantSession: { participantSessionId: string; loginKey: string };
      };
    }>(isolated.baseUrl, commandPath, {
      method: "POST",
      headers: { authorization },
      body: {
        commandType: "pause",
        actorId: "operator-demo"
      }
    });

    assert.equal(pauseCommand.status, 200);
    assert.equal(pauseCommand.body.command.commandType, "pause");
    assert.equal(pauseCommand.body.command.actorId, "operator-demo");
    assert.equal(pauseCommand.body.command.previousStatus, "running");
    assert.equal(pauseCommand.body.command.testRun.status, "paused");
    assert.equal(
      pauseCommand.body.command.participantSession.participantSessionId,
      participantSignIn.body.participantSession.participantSessionId
    );

    const openRunsAfterPause = await requestJsonAt<{
      items: Array<{
        testRunId: string;
        participantSessionId: string;
        status: string;
        loginKey: string;
        groupKey: string;
        bookletKey: string;
        currentUnitKey: string | null;
      }>;
    }>(
      isolated.baseUrl,
      `/api/v1/tenants/demo-tenant/workspaces/demo-workspace/monitor/open-runs?loginKey=student-demo&groupKey=group%3Astudent-demo&bookletKey=booklet%3Ademo&participantSessionId=${participantSignIn.body.participantSession.participantSessionId}&testRunId=${resumed.body.testRun.testRunId}&status=paused&limit=1`,
      { headers: { authorization } }
    );

    assert.equal(openRunsAfterPause.status, 200);
    assert.equal(openRunsAfterPause.body.items[0]?.testRunId, resumed.body.testRun.testRunId);
    assert.equal(
      openRunsAfterPause.body.items[0]?.participantSessionId,
      participantSignIn.body.participantSession.participantSessionId
    );
    assert.equal(openRunsAfterPause.body.items[0]?.status, "paused");
    assert.equal(openRunsAfterPause.body.items[0]?.loginKey, "student-demo");
    assert.equal(openRunsAfterPause.body.items[0]?.groupKey, "group:student-demo");
    assert.equal(openRunsAfterPause.body.items[0]?.bookletKey, "booklet:demo");

    const resumeCommand = await requestJsonAt<{
      command: {
        commandType: string;
        previousStatus: string;
        testRun: { status: string };
      };
    }>(isolated.baseUrl, commandPath, {
      method: "POST",
      headers: { authorization },
      body: {
        commandType: "resume",
        actorId: "operator-demo"
      }
    });

    assert.equal(resumeCommand.status, 200);
    assert.equal(resumeCommand.body.command.commandType, "resume");
    assert.equal(resumeCommand.body.command.previousStatus, "paused");
    assert.equal(resumeCommand.body.command.testRun.status, "running");

    const completeCommand = await requestJsonAt<{
      command: {
        commandType: string;
        previousStatus: string;
        testRun: { status: string; currentUnitKey: string | null; completedAt: string | null };
        participantSession: { status: string };
      };
    }>(isolated.baseUrl, commandPath, {
      method: "POST",
      headers: { authorization },
      body: {
        commandType: "complete",
        actorId: "operator-demo"
      }
    });

    assert.equal(completeCommand.status, 200);
    assert.equal(completeCommand.body.command.commandType, "complete");
    assert.equal(completeCommand.body.command.previousStatus, "running");
    assert.equal(completeCommand.body.command.testRun.status, "completed");
    assert.equal(completeCommand.body.command.testRun.currentUnitKey, null);
    assert.match(completeCommand.body.command.testRun.completedAt ?? "", ISO_DATE_REGEX);
    assert.equal(completeCommand.body.command.participantSession.status, "closed");

    const repeatCommand = await requestJsonAt<{ error: string }>(
      isolated.baseUrl,
      commandPath,
      {
        method: "POST",
        headers: { authorization },
        body: {
          commandType: "resume",
          actorId: "operator-demo"
        }
      }
    );

    assert.equal(repeatCommand.status, 409);
    assert.equal(repeatCommand.body.error, "test_run_already_completed");

    const openRunsAfterComplete = await requestJsonAt<{
      items: Array<{ testRunId: string; status: string; loginKey: string }>;
    }>(
      isolated.baseUrl,
      "/api/v1/tenants/demo-tenant/workspaces/demo-workspace/monitor/open-runs",
      { headers: { authorization } }
    );

    assert.equal(openRunsAfterComplete.status, 200);
    assert.equal(
      openRunsAfterComplete.body.items.some(
        item => item.testRunId === resumed.body.testRun.testRunId
      ),
      false
    );

    const commandActivity = await requestJsonAt<{
      items: Array<{
        activityEvent: {
          eventType: string;
          actorId: string | null;
          subjectId: string;
          details: {
            commandId?: string;
            commandType?: string;
            previousStatus?: string;
            nextStatus?: string;
            completedAt?: string | null;
            participantSessionId?: string;
            loginKey?: string;
            groupKey?: string;
            bookletKey?: string;
            displayName?: string | null;
          };
        };
      }>;
    }>(
      isolated.baseUrl,
      "/api/v1/tenants/demo-tenant/workspaces/demo-workspace/activity-events?eventType=monitor_run_command_issued&limit=3",
      { headers: { authorization } }
    );

    assert.equal(commandActivity.status, 200);
    assert.equal(commandActivity.body.items.length, 3);
    assert.deepEqual(
      commandActivity.body.items.map(item => item.activityEvent.details.commandType),
      ["complete", "resume", "pause"]
    );
    assert.equal(commandActivity.body.items[0]?.activityEvent.actorId, "operator-demo");
    assert.equal(
      commandActivity.body.items[0]?.activityEvent.subjectId,
      resumed.body.testRun.testRunId
    );
    assert.equal(commandActivity.body.items[0]?.activityEvent.details.previousStatus, "running");
    assert.equal(commandActivity.body.items[0]?.activityEvent.details.nextStatus, "completed");
    assert.match(
      String(commandActivity.body.items[0]?.activityEvent.details.completedAt ?? ""),
      ISO_DATE_REGEX
    );
    assert.equal(commandActivity.body.items[0]?.activityEvent.details.loginKey, "student-demo");
    assert.equal(
      commandActivity.body.items[0]?.activityEvent.details.participantSessionId,
      participantSignIn.body.participantSession.participantSessionId
    );
    assert.equal(
      commandActivity.body.items[0]?.activityEvent.details.groupKey,
      participantSignIn.body.participantSession.groupKey
    );
    assert.equal(
      commandActivity.body.items[0]?.activityEvent.details.bookletKey,
      resumed.body.testRun.bookletKey
    );
    assert.equal(
      commandActivity.body.items[0]?.activityEvent.details.displayName,
      "Demo Student"
    );
    assert.deepEqual(
      commandActivity.body.items.map(item => item.activityEvent.details.bookletKey),
      ["booklet:demo", "booklet:demo", "booklet:demo"]
    );
  } finally {
    await closeServer(isolated.server);
  }
});

test("failed import can be retried on the same source package", async () => {
  const tenantKey = "integration-tenant-retry";
  const workspaceKey = "integration-workspace-retry";

  await requestJson("/api/v1/platform/tenants", {
    method: "POST",
    body: { tenantKey, displayName: tenantKey }
  });
  await requestJson(`/api/v1/tenants/${tenantKey}/workspaces`, {
    method: "POST",
    body: { workspaceKey, displayName: workspaceKey }
  });

  const sourcePackage = await requestJson<{
    sourcePackage: { sourcePackageId: string; status: string };
  }>(`/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/source-packages`, {
    method: "POST",
    body: {
      fileName: "broken.json",
      mediaType: "application/json",
      sourceDocument: "{\"booklets\":[]}"
    }
  });

  const failedImport = await requestJson<{
    importJob: {
      importJobId: string;
      sourcePackageId: string;
      status: string;
      diagnostics: Array<{ code: string }>;
    };
    stagedContentRelease: null;
  }>(`/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/import-jobs`, {
    method: "POST",
    body: {
      sourcePackageId: sourcePackage.body.sourcePackage.sourcePackageId
    }
  });

  assert.equal(failedImport.status, 201);
  assert.equal(failedImport.body.importJob.status, "failed");
  assert.equal(
    failedImport.body.importJob.diagnostics[0]?.code,
    "source_document_runtime_structure_invalid"
  );
  assert.equal(failedImport.body.stagedContentRelease, null);

  const retriedImport = await requestJson<{
    sourcePackage: {
      sourcePackageId: string;
      fileName: string;
      mediaType: string;
      status: string;
    };
    importJob: { importJobId: string; sourcePackageId: string; status: string };
    stagedContentRelease: { contentReleaseId: string } | null;
  }>(
    `/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/source-packages/${sourcePackage.body.sourcePackage.sourcePackageId}/retry-import`,
    {
      method: "POST",
      body: {
        fileName: "fixed.json",
        mediaType: "application/json",
        sourceDocument: {
          booklets: [
            {
              bookletKey: "booklet:fixed",
              title: "Fixed",
              units: [{ unitKey: "unit-fixed", title: "Fixed Unit" }]
            }
          ]
        }
      }
    }
  );

  assert.equal(retriedImport.status, 200);
  assert.equal(retriedImport.body.sourcePackage.status, "accepted");
  assert.equal(retriedImport.body.importJob.status, "completed");
  assert.ok(retriedImport.body.stagedContentRelease?.contentReleaseId);

  const acceptedSourcePackages = await requestJson<{
    items: Array<{
      sourcePackage: {
        sourcePackageId: string;
        fileName: string;
        mediaType: string;
        status: string;
      };
      latestImportJob: { status: string } | null;
    }>;
  }>(
    `/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/source-packages?status=accepted&mediaType=application%2Fjson&fileName=fixed.json&latestImportStatus=completed&limit=1`
  );

  assert.equal(acceptedSourcePackages.status, 200);
  assert.equal(acceptedSourcePackages.body.items.length, 1);
  assert.equal(
    acceptedSourcePackages.body.items[0]?.sourcePackage.sourcePackageId,
    sourcePackage.body.sourcePackage.sourcePackageId
  );
  assert.equal(
    acceptedSourcePackages.body.items[0]?.latestImportJob?.status,
    "completed"
  );

  const sourcePackagesCsv = await requestText(
    `/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/exports/source-packages.csv?status=accepted&mediaType=application%2Fjson&fileName=fixed.json&latestImportStatus=completed&limit=1`
  );

  assert.equal(sourcePackagesCsv.status, 200);
  assert.equal(sourcePackagesCsv.contentType, "text/csv; charset=utf-8");
  assert.match(
    sourcePackagesCsv.body,
    /^tenantKey,workspaceKey,sourcePackageId,fileName,mediaType,status,uploadedAt,bookletCount,unitCount,hasSourceDocument,latestImportJobId,latestImportStatus,latestImportCreatedAt,latestImportFinishedAt,latestImportDiagnosticCount\n/
  );
  assert.match(
    sourcePackagesCsv.body,
    new RegExp(
      `"${tenantKey}","${workspaceKey}","${sourcePackage.body.sourcePackage.sourcePackageId}","fixed.json","application/json","accepted","[^"]+","0","0","true","${retriedImport.body.importJob.importJobId}","completed","[^"]+","[^"]+","0"`
    )
  );

  const failedImportJobs = await requestJson<{
    items: Array<{ importJob: { importJobId: string; status: string } }>;
  }>(
    `/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/import-jobs?status=failed&sourcePackageId=${sourcePackage.body.sourcePackage.sourcePackageId}`
  );

  assert.equal(failedImportJobs.status, 200);
  assert.equal(failedImportJobs.body.items.length, 1);
  assert.equal(
    failedImportJobs.body.items[0]?.importJob.importJobId,
    failedImport.body.importJob.importJobId
  );

  const failedImportJobsCsv = await requestText(
    `/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/exports/import-jobs.csv?status=failed&sourcePackageId=${sourcePackage.body.sourcePackage.sourcePackageId}&limit=1`
  );

  assert.equal(failedImportJobsCsv.status, 200);
  assert.equal(failedImportJobsCsv.contentType, "text/csv; charset=utf-8");
  assert.match(
    failedImportJobsCsv.body,
    /^tenantKey,workspaceKey,importJobId,sourcePackageId,sourceFileName,sourceMediaType,status,createdAt,finishedAt,diagnosticCount,diagnosticSeverities,diagnosticCodes,diagnosticMessages\n/
  );
  assert.match(
    failedImportJobsCsv.body,
    new RegExp(
      `"${tenantKey}","${workspaceKey}","${failedImport.body.importJob.importJobId}","${sourcePackage.body.sourcePackage.sourcePackageId}","fixed.json","application/json","failed","[^"]+","[^"]+","1","error","source_document_runtime_structure_invalid","[^"]+"`
    )
  );

  const limitedImportJobs = await requestJson<{ items: unknown[] }>(
    `/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/import-jobs?sourcePackageId=${sourcePackage.body.sourcePackage.sourcePackageId}&limit=1`
  );

  assert.equal(limitedImportJobs.status, 200);
  assert.equal(limitedImportJobs.body.items.length, 1);

  const stagedContentReleases = await requestJson<{
    items: Array<{
      contentRelease: { contentReleaseId: string; status: string };
      importJob: { importJobId: string } | null;
      sourcePackage: { sourcePackageId: string } | null;
    }>;
  }>(
    `/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/content-releases?status=staged&sourcePackageId=${sourcePackage.body.sourcePackage.sourcePackageId}&importJobId=${retriedImport.body.importJob.importJobId}&limit=1`
  );

  assert.equal(stagedContentReleases.status, 200);
  assert.equal(stagedContentReleases.body.items.length, 1);
  assert.equal(
    stagedContentReleases.body.items[0]?.contentRelease.contentReleaseId,
    retriedImport.body.stagedContentRelease.contentReleaseId
  );
  assert.equal(
    stagedContentReleases.body.items[0]?.sourcePackage?.sourcePackageId,
    sourcePackage.body.sourcePackage.sourcePackageId
  );

  const stagedContentReleasesCsv = await requestText(
    `/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/exports/content-releases.csv?status=staged&sourcePackageId=${sourcePackage.body.sourcePackage.sourcePackageId}&importJobId=${retriedImport.body.importJob.importJobId}&limit=1`
  );

  assert.equal(stagedContentReleasesCsv.status, 200);
  assert.equal(stagedContentReleasesCsv.contentType, "text/csv; charset=utf-8");
  assert.match(
    stagedContentReleasesCsv.body,
    /^tenantKey,workspaceKey,contentReleaseId,releaseLabel,status,createdAt,activatedAt,importJobId,importJobStatus,sourcePackageId,sourceFileName,sourceMediaType,bookletCount,unitCount,participantSessionCount,openTestRunCount\n/
  );
  assert.match(
    stagedContentReleasesCsv.body,
    new RegExp(
      `"${tenantKey}","${workspaceKey}","${retriedImport.body.stagedContentRelease.contentReleaseId}","[^"]+","staged","[^"]+","","${retriedImport.body.importJob.importJobId}","completed","${sourcePackage.body.sourcePackage.sourcePackageId}","fixed.json","application/json","1","1","0","0"`
    )
  );

  const invalidSourcePackageStatus = await requestJson<{ error: string }>(
    `/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/source-packages?status=unsupported`
  );
  assert.equal(invalidSourcePackageStatus.status, 400);
  assert.equal(
    invalidSourcePackageStatus.body.error,
    "source_package_status_invalid"
  );

  const invalidSourcePackageLatestImportStatus = await requestJson<{ error: string }>(
    `/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/source-packages?latestImportStatus=unsupported`
  );
  assert.equal(invalidSourcePackageLatestImportStatus.status, 400);
  assert.equal(
    invalidSourcePackageLatestImportStatus.body.error,
    "source_package_latest_import_status_invalid"
  );

  const invalidSourcePackageLimit = await requestJson<{ error: string }>(
    `/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/source-packages?limit=0`
  );
  assert.equal(invalidSourcePackageLimit.status, 400);
  assert.equal(invalidSourcePackageLimit.body.error, "source_package_limit_invalid");

  const invalidImportJobStatus = await requestJson<{ error: string }>(
    `/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/import-jobs?status=unsupported`
  );
  assert.equal(invalidImportJobStatus.status, 400);
  assert.equal(invalidImportJobStatus.body.error, "import_job_status_invalid");

  const invalidImportJobLimit = await requestJson<{ error: string }>(
    `/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/import-jobs?limit=0`
  );
  assert.equal(invalidImportJobLimit.status, 400);
  assert.equal(invalidImportJobLimit.body.error, "import_job_limit_invalid");

  const invalidContentReleaseStatus = await requestJson<{ error: string }>(
    `/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/content-releases?status=unsupported`
  );
  assert.equal(invalidContentReleaseStatus.status, 400);
  assert.equal(
    invalidContentReleaseStatus.body.error,
    "content_release_status_invalid"
  );

  const invalidContentReleaseLimit = await requestJson<{ error: string }>(
    `/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/content-releases?limit=0`
  );
  assert.equal(invalidContentReleaseLimit.status, 400);
  assert.equal(
    invalidContentReleaseLimit.body.error,
    "content_release_limit_invalid"
  );
});

test("source-package intake rejects invalid metadata before import", async () => {
  const tenantKey = "integration-tenant-source-validation";
  const workspaceKey = "integration-workspace-source-validation";

  await requestJson("/api/v1/platform/tenants", {
    method: "POST",
    body: { tenantKey, displayName: tenantKey }
  });
  await requestJson(`/api/v1/tenants/${tenantKey}/workspaces`, {
    method: "POST",
    body: { workspaceKey, displayName: workspaceKey }
  });

  const blankFileName = await requestJson<{ error: string }>(
    `/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/source-packages`,
    {
      method: "POST",
      body: {
        fileName: " ",
        mediaType: "application/xml",
        sourceDocument:
          "<assessment><booklet key=\"booklet:valid\"><unit key=\"unit-valid\" /></booklet></assessment>"
      }
    }
  );

  assert.equal(blankFileName.status, 400);
  assert.equal(blankFileName.body.error, "source_package_file_name_required");

  const blankMediaType = await requestJson<{ error: string }>(
    `/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/source-packages`,
    {
      method: "POST",
      body: {
        fileName: "valid.xml",
        mediaType: " ",
        sourceDocument:
          "<assessment><booklet key=\"booklet:valid\"><unit key=\"unit-valid\" /></booklet></assessment>"
      }
    }
  );

  assert.equal(blankMediaType.status, 400);
  assert.equal(blankMediaType.body.error, "source_package_media_type_required");

  const invalidSourceDocument = await requestJson<{ error: string }>(
    `/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/source-packages`,
    {
      method: "POST",
      body: {
        fileName: "valid.xml",
        mediaType: "application/xml",
        sourceDocument: true
      }
    }
  );

  assert.equal(invalidSourceDocument.status, 400);
  assert.equal(invalidSourceDocument.body.error, "source_document_invalid");

  const validSourcePackage = await requestJson<{
    sourcePackage: { sourcePackageId: string };
  }>(`/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/source-packages`, {
    method: "POST",
    body: {
      fileName: "valid.xml",
      mediaType: "application/xml",
      sourceDocument:
        "<assessment><booklet key=\"booklet:valid\"><unit key=\"unit-valid\" /></booklet></assessment>"
    }
  });

  assert.equal(validSourcePackage.status, 201);

  const invalidRetryMediaType = await requestJson<{ error: string }>(
    `/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/source-packages/${validSourcePackage.body.sourcePackage.sourcePackageId}/retry-import`,
    {
      method: "POST",
      body: {
        mediaType: ""
      }
    }
  );

  assert.equal(invalidRetryMediaType.status, 400);
  assert.equal(
    invalidRetryMediaType.body.error,
    "source_package_media_type_required"
  );

  const invalidRetrySourceDocument = await requestJson<{ error: string }>(
    `/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/source-packages/${validSourcePackage.body.sourcePackage.sourcePackageId}/retry-import`,
    {
      method: "POST",
      body: {
        sourceDocument: true
      }
    }
  );

  assert.equal(invalidRetrySourceDocument.status, 400);
  assert.equal(invalidRetrySourceDocument.body.error, "source_document_invalid");
});

test("source document import normalizes fallback labels and duplicate entries", async () => {
  const tenantKey = "integration-tenant-manifest-normalization";
  const workspaceKey = "integration-workspace-manifest-normalization";

  await requestJson("/api/v1/platform/tenants", {
    method: "POST",
    body: { tenantKey, displayName: tenantKey }
  });
  await requestJson(`/api/v1/tenants/${tenantKey}/workspaces`, {
    method: "POST",
    body: { workspaceKey, displayName: workspaceKey }
  });

  const sourcePackage = await requestJson<{
    sourcePackage: { sourcePackageId: string };
  }>(`/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/source-packages`, {
    method: "POST",
    body: {
      fileName: "normalization.json",
      mediaType: "application/json",
      sourceDocument: JSON.stringify({
        manifest: {
          testlets: [
            {
              bookletId: " booklet:alpha ",
              unitRefs: [
                {
                  unitId: " unit-alpha ",
                  title: " Alpha Unit ",
                  description: "Alpha setup",
                  prompt: "Solve the alpha prompt."
                },
                { unitId: "unit-alpha", title: "Duplicate Alpha Unit" },
                { ref: "unit-beta" }
              ]
            },
            {
              id: "booklet:alpha",
              title: "Duplicate Booklet",
              unit: { id: "unit-gamma", name: "Gamma Unit" }
            }
          ]
        }
      })
    }
  });

  const importResult = await requestJson<{
    importJob: { status: string; diagnostics: Array<{ code: string }> };
    stagedContentRelease: { contentReleaseId: string } | null;
  }>(`/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/import-jobs`, {
    method: "POST",
    body: {
      sourcePackageId: sourcePackage.body.sourcePackage.sourcePackageId
    }
  });

  assert.equal(importResult.status, 201);
  assert.equal(importResult.body.importJob.status, "completed");
  assert.deepEqual(importResult.body.importJob.diagnostics, []);
  assert.ok(importResult.body.stagedContentRelease?.contentReleaseId);

  const contentRelease = await requestJson<{
    contentReleaseDetail: {
      contentRelease: {
        runtimeSnapshot: {
          bookletEntries: Array<{
            bookletKey: string;
            displayLabel: string;
            unitEntries: Array<{ unitKey: string; displayLabel: string }>;
          }>;
        };
      };
    };
  }>(
    `/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/content-releases/${importResult.body.stagedContentRelease.contentReleaseId}`
  );

  assert.equal(contentRelease.status, 200);
  assert.deepEqual(
    contentRelease.body.contentReleaseDetail.contentRelease.runtimeSnapshot,
    {
      bookletEntries: [
        {
          bookletKey: "booklet:alpha",
          displayLabel: "Booklet booklet alpha",
          unitEntries: [
            {
              unitKey: "unit-alpha",
              displayLabel: "Alpha Unit",
              description: "Alpha setup",
              content: "Solve the alpha prompt."
            },
            { unitKey: "unit-beta", displayLabel: "Unit unit beta" },
            { unitKey: "unit-gamma", displayLabel: "Gamma Unit" }
          ]
        }
      ]
    }
  );
});

test("source document import accepts native JSON booklet and unit maps", async () => {
  const tenantKey = "integration-tenant-json-maps";
  const workspaceKey = "integration-workspace-json-maps";

  await requestJson("/api/v1/platform/tenants", {
    method: "POST",
    body: { tenantKey, displayName: tenantKey }
  });
  await requestJson(`/api/v1/tenants/${tenantKey}/workspaces`, {
    method: "POST",
    body: { workspaceKey, displayName: workspaceKey }
  });

  const sourcePackage = await requestJson<{
    sourcePackage: { sourcePackageId: string };
  }>(`/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/source-packages`, {
    method: "POST",
    body: {
      fileName: "json-mapped-manifest.json",
      mediaType: "application/json",
      sourceDocument: {
        contentStructure: {
          booklets: {
            "booklet:mapped": {
              title: "Mapped Booklet",
              units: {
                "unit:mapped-a": {
                  title: "Mapped Unit A",
                  body: "Use mapped body A."
                },
                "unit:mapped-b": "Mapped Unit B",
                "unit:mapped-c": {
                  displayName: "Mapped Unit C",
                  description: "Mapped setup C",
                  definition: "Use mapped definition C."
                }
              }
            }
          }
        }
      }
    }
  });

  const importResult = await requestJson<{
    importJob: { status: string; diagnostics: Array<{ code: string }> };
    stagedContentRelease: { contentReleaseId: string } | null;
  }>(`/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/import-jobs`, {
    method: "POST",
    body: {
      sourcePackageId: sourcePackage.body.sourcePackage.sourcePackageId
    }
  });

  assert.equal(importResult.status, 201);
  assert.equal(importResult.body.importJob.status, "completed");
  assert.deepEqual(importResult.body.importJob.diagnostics, []);
  assert.ok(importResult.body.stagedContentRelease?.contentReleaseId);

  const contentRelease = await requestJson<{
    contentReleaseDetail: {
      contentRelease: {
        runtimeSnapshot: {
          bookletEntries: Array<{
            bookletKey: string;
            displayLabel: string;
            unitEntries: Array<{
              unitKey: string;
              displayLabel: string;
              description?: string;
              content?: string;
            }>;
          }>;
        };
      };
    };
  }>(
    `/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/content-releases/${importResult.body.stagedContentRelease.contentReleaseId}`
  );

  assert.equal(contentRelease.status, 200);
  assert.deepEqual(
    contentRelease.body.contentReleaseDetail.contentRelease.runtimeSnapshot,
    {
      bookletEntries: [
        {
          bookletKey: "booklet:mapped",
          displayLabel: "Mapped Booklet",
          unitEntries: [
            {
              unitKey: "unit:mapped-a",
              displayLabel: "Mapped Unit A",
              content: "Use mapped body A."
            },
            { unitKey: "unit:mapped-b", displayLabel: "Mapped Unit B" },
            {
              unitKey: "unit:mapped-c",
              displayLabel: "Mapped Unit C",
              description: "Mapped setup C",
              content: "Use mapped definition C."
            }
          ]
        }
      ]
    }
  );
});

test("source document import accepts nested testcenter package manifests", async () => {
  const tenantKey = "integration-tenant-package-manifest";
  const workspaceKey = "integration-workspace-package-manifest";

  await requestJson("/api/v1/platform/tenants", {
    method: "POST",
    body: { tenantKey, displayName: tenantKey }
  });
  await requestJson(`/api/v1/tenants/${tenantKey}/workspaces`, {
    method: "POST",
    body: { workspaceKey, displayName: workspaceKey }
  });

  const sourcePackage = await requestJson<{
    sourcePackage: { sourcePackageId: string };
  }>(`/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/source-packages`, {
    method: "POST",
    body: {
      fileName: "testcenter-package-manifest.json",
      mediaType: "application/json",
      sourceDocument: JSON.stringify({
        testcenter: {
          package: {
            tests: [
              {
                identifier: "test:math",
                booklets: [
                  {
                    identifier: "booklet:math-a",
                    label: "Math A",
                    resources: [
                      { path: "units/addition.xml", title: "Addition" },
                      { fileName: "units/subtraction.xml", displayName: "Subtraction" },
                      "units/multiplication.xml"
                    ]
                  }
                ]
              },
              {
                assessment: {
                  testlet: {
                    assessmentTestId: "booklet:reading",
                    displayName: "Reading",
                    module: { moduleId: "unit-reading", label: "Reading Unit" }
                  }
                }
              }
            ]
          }
        }
      })
    }
  });

  const importResult = await requestJson<{
    importJob: { status: string; diagnostics: Array<{ code: string }> };
    stagedContentRelease: { contentReleaseId: string } | null;
  }>(`/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/import-jobs`, {
    method: "POST",
    body: {
      sourcePackageId: sourcePackage.body.sourcePackage.sourcePackageId
    }
  });

  assert.equal(importResult.status, 201);
  assert.equal(importResult.body.importJob.status, "completed");
  assert.deepEqual(importResult.body.importJob.diagnostics, []);
  assert.ok(importResult.body.stagedContentRelease?.contentReleaseId);

  const contentRelease = await requestJson<{
    contentReleaseDetail: {
      contentRelease: {
        runtimeSnapshot: {
          bookletEntries: Array<{
            bookletKey: string;
            displayLabel: string;
            unitEntries: Array<{ unitKey: string; displayLabel: string }>;
          }>;
        };
      };
    };
  }>(
    `/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/content-releases/${importResult.body.stagedContentRelease.contentReleaseId}`
  );

  assert.equal(contentRelease.status, 200);
  assert.deepEqual(
    contentRelease.body.contentReleaseDetail.contentRelease.runtimeSnapshot,
    {
      bookletEntries: [
        {
          bookletKey: "booklet:math-a",
          displayLabel: "Math A",
          unitEntries: [
            { unitKey: "units/addition.xml", displayLabel: "Addition" },
            { unitKey: "units/subtraction.xml", displayLabel: "Subtraction" },
            {
              unitKey: "units/multiplication.xml",
              displayLabel: "Unit units/multiplication.xml"
            }
          ]
        },
        {
          bookletKey: "booklet:reading",
          displayLabel: "Reading",
          unitEntries: [
            { unitKey: "unit-reading", displayLabel: "Reading Unit" }
          ]
        }
      ]
    }
  );
});

test("source document import accepts delimited JSON unit reference strings", async () => {
  const tenantKey = "integration-tenant-json-unit-ref-strings";
  const workspaceKey = "integration-workspace-json-unit-ref-strings";

  await requestJson("/api/v1/platform/tenants", {
    method: "POST",
    body: { tenantKey, displayName: tenantKey }
  });
  await requestJson(`/api/v1/tenants/${tenantKey}/workspaces`, {
    method: "POST",
    body: { workspaceKey, displayName: workspaceKey }
  });

  const sourcePackage = await requestJson<{
    sourcePackage: { sourcePackageId: string };
  }>(`/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/source-packages`, {
    method: "POST",
    body: {
      fileName: "unit-ref-strings.json",
      mediaType: "application/json",
      sourceDocument: JSON.stringify({
        manifest: {
          booklets: [
            {
              bookletKey: "booklet:string-refs",
              title: "String Ref Booklet",
              unitRefs: "unit:string-a, unit:string-b; unit:string-c\nunit:string-d"
            }
          ]
        }
      })
    }
  });

  const importResult = await requestJson<{
    importJob: { status: string; diagnostics: Array<{ code: string }> };
    stagedContentRelease: { contentReleaseId: string } | null;
  }>(`/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/import-jobs`, {
    method: "POST",
    body: {
      sourcePackageId: sourcePackage.body.sourcePackage.sourcePackageId
    }
  });

  assert.equal(importResult.status, 201);
  assert.equal(importResult.body.importJob.status, "completed");
  assert.deepEqual(importResult.body.importJob.diagnostics, []);
  assert.ok(importResult.body.stagedContentRelease?.contentReleaseId);

  const contentRelease = await requestJson<{
    contentReleaseDetail: {
      contentRelease: {
        runtimeSnapshot: {
          bookletEntries: Array<{
            bookletKey: string;
            displayLabel: string;
            unitEntries: Array<{ unitKey: string; displayLabel: string }>;
          }>;
        };
      };
    };
  }>(
    `/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/content-releases/${importResult.body.stagedContentRelease.contentReleaseId}`
  );

  assert.equal(contentRelease.status, 200);
  assert.deepEqual(
    contentRelease.body.contentReleaseDetail.contentRelease.runtimeSnapshot
      .bookletEntries,
    [
      {
        bookletKey: "booklet:string-refs",
        displayLabel: "String Ref Booklet",
        unitEntries: [
          { unitKey: "unit:string-a", displayLabel: "Unit unit string a" },
          { unitKey: "unit:string-b", displayLabel: "Unit unit string b" },
          { unitKey: "unit:string-c", displayLabel: "Unit unit string c" },
          { unitKey: "unit:string-d", displayLabel: "Unit unit string d" }
        ]
      }
    ]
  );
});

test("source document import resolves JSON organization item references", async () => {
  const tenantKey = "integration-tenant-json-organization";
  const workspaceKey = "integration-workspace-json-organization";

  await requestJson("/api/v1/platform/tenants", {
    method: "POST",
    body: { tenantKey, displayName: tenantKey }
  });
  await requestJson(`/api/v1/tenants/${tenantKey}/workspaces`, {
    method: "POST",
    body: { workspaceKey, displayName: workspaceKey }
  });

  const sourcePackage = await requestJson<{
    sourcePackage: { sourcePackageId: string };
  }>(`/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/source-packages`, {
    method: "POST",
    body: {
      fileName: "imsmanifest.json",
      mediaType: "application/json",
      sourceDocument: JSON.stringify({
        manifest: {
          organizations: [
            {
              identifier: "ORG-1",
              items: [
                {
                  identifier: "BOOKLET-ITEM",
                  identifierref: "RES-BOOKLET-A",
                  title: "Booklet A",
                  items: [
                    {
                      identifier: "UNIT-ITEM-1",
                      identifierref: "RES-UNIT-1",
                      title: "Item One"
                    },
                    {
                      identifier: "UNIT-ITEM-2",
                      identifierref: "RES-UNIT-2"
                    }
                  ]
                }
              ]
            }
          ],
          resources: [
            {
              identifier: "RES-BOOKLET-A",
              href: "booklets/booklet-a.xml"
            },
            {
              identifier: "RES-UNIT-1",
              href: "units/unit-1.xml"
            },
            {
              identifier: "RES-UNIT-2",
              title: "Item Two",
              files: [{ href: "units/unit-2.xml" }]
            }
          ]
        }
      })
    }
  });

  const importResult = await requestJson<{
    importJob: { status: string; diagnostics: Array<{ code: string }> };
    stagedContentRelease: { contentReleaseId: string } | null;
  }>(`/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/import-jobs`, {
    method: "POST",
    body: {
      sourcePackageId: sourcePackage.body.sourcePackage.sourcePackageId
    }
  });

  assert.equal(importResult.status, 201);
  assert.equal(importResult.body.importJob.status, "completed");
  assert.deepEqual(importResult.body.importJob.diagnostics, []);
  assert.ok(importResult.body.stagedContentRelease?.contentReleaseId);

  const contentRelease = await requestJson<{
    contentReleaseDetail: {
      contentRelease: {
        runtimeSnapshot: {
          bookletEntries: Array<{
            bookletKey: string;
            displayLabel: string;
            unitEntries: Array<{ unitKey: string; displayLabel: string }>;
          }>;
        };
      };
    };
  }>(
    `/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/content-releases/${importResult.body.stagedContentRelease.contentReleaseId}`
  );

  assert.equal(contentRelease.status, 200);
  assert.deepEqual(
    contentRelease.body.contentReleaseDetail.contentRelease.runtimeSnapshot,
    {
      bookletEntries: [
        {
          bookletKey: "booklets/booklet-a.xml",
          displayLabel: "Booklet A",
          unitEntries: [
            { unitKey: "units/unit-1.xml", displayLabel: "Item One" },
            { unitKey: "units/unit-2.xml", displayLabel: "Item Two" }
          ]
        }
      ]
    }
  );
});

test("source document import resolves keyed JSON IMS manifest maps", async () => {
  const tenantKey = "integration-tenant-json-keyed-ims";
  const workspaceKey = "integration-workspace-json-keyed-ims";

  await requestJson("/api/v1/platform/tenants", {
    method: "POST",
    body: { tenantKey, displayName: tenantKey }
  });
  await requestJson(`/api/v1/tenants/${tenantKey}/workspaces`, {
    method: "POST",
    body: { workspaceKey, displayName: workspaceKey }
  });

  const sourcePackage = await requestJson<{
    sourcePackage: { sourcePackageId: string };
  }>(`/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/source-packages`, {
    method: "POST",
    body: {
      fileName: "imsmanifest-keyed.json",
      mediaType: "application/json",
      sourceDocument: JSON.stringify({
        manifest: {
          defaultOrganization: "ORG-1",
          organizations: {
            "ORG-1": {
              title: "Default Organization",
              items: [
                {
                  identifierref: "RES-BOOKLET-KEYED",
                  title: "Keyed Booklet",
                  item: {
                    identifierref: "RES-UNIT-KEYED",
                    title: "Keyed Unit"
                  }
                }
              ]
            }
          },
          resources: {
            "RES-BOOKLET-KEYED": {
              href: "booklets/keyed-booklet.xml",
              title: "Resource Booklet"
            },
            "RES-UNIT-KEYED": {
              files: [{ href: "items/keyed-unit.xml" }],
              title: "Resource Unit"
            }
          }
        }
      })
    }
  });

  const importResult = await requestJson<{
    importJob: { status: string; diagnostics: Array<{ code: string }> };
    stagedContentRelease: { contentReleaseId: string } | null;
  }>(`/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/import-jobs`, {
    method: "POST",
    body: {
      sourcePackageId: sourcePackage.body.sourcePackage.sourcePackageId
    }
  });

  assert.equal(importResult.status, 201);
  assert.equal(importResult.body.importJob.status, "completed");
  assert.deepEqual(importResult.body.importJob.diagnostics, []);
  assert.ok(importResult.body.stagedContentRelease?.contentReleaseId);

  const contentRelease = await requestJson<{
    contentReleaseDetail: {
      contentRelease: {
        runtimeSnapshot: {
          bookletEntries: Array<{
            bookletKey: string;
            displayLabel: string;
            unitEntries: Array<{ unitKey: string; displayLabel: string }>;
          }>;
        };
      };
    };
  }>(
    `/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/content-releases/${importResult.body.stagedContentRelease.contentReleaseId}`
  );

  assert.equal(contentRelease.status, 200);
  assert.deepEqual(
    contentRelease.body.contentReleaseDetail.contentRelease.runtimeSnapshot,
    {
      bookletEntries: [
        {
          bookletKey: "booklets/keyed-booklet.xml",
          displayLabel: "Keyed Booklet",
          unitEntries: [
            { unitKey: "items/keyed-unit.xml", displayLabel: "Keyed Unit" }
          ]
        }
      ]
    }
  );
});

test("source document import respects JSON default organization", async () => {
  const tenantKey = "integration-tenant-json-default-organization";
  const workspaceKey = "integration-workspace-json-default-organization";

  await requestJson("/api/v1/platform/tenants", {
    method: "POST",
    body: { tenantKey, displayName: tenantKey }
  });
  await requestJson(`/api/v1/tenants/${tenantKey}/workspaces`, {
    method: "POST",
    body: { workspaceKey, displayName: workspaceKey }
  });

  const sourcePackage = await requestJson<{
    sourcePackage: { sourcePackageId: string };
  }>(`/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/source-packages`, {
    method: "POST",
    body: {
      fileName: "imsmanifest-default-organization.json",
      mediaType: "application/json",
      sourceDocument: JSON.stringify({
        manifest: {
          defaultOrganization: "ORG-DEFAULT",
          organizations: [
            {
              identifier: "ORG-DISTRACTOR",
              items: [
                {
                  identifierref: "RES-BOOKLET-DISTRACTOR",
                  title: "Distractor Booklet",
                  items: [{ identifierref: "RES-UNIT-DISTRACTOR" }]
                }
              ]
            },
            {
              identifier: "ORG-DEFAULT",
              items: [
                {
                  identifierref: "RES-BOOKLET-DEFAULT",
                  title: "Default Booklet",
                  items: [
                    {
                      identifierref: "RES-UNIT-DEFAULT",
                      title: "Default Unit"
                    }
                  ]
                }
              ]
            }
          ],
          resources: [
            {
              identifier: "RES-BOOKLET-DISTRACTOR",
              href: "booklets/distractor.xml"
            },
            {
              identifier: "RES-UNIT-DISTRACTOR",
              href: "items/distractor.xml"
            },
            {
              identifier: "RES-BOOKLET-DEFAULT",
              href: "booklets/default.xml"
            },
            {
              identifier: "RES-UNIT-DEFAULT",
              href: "items/default.xml"
            }
          ]
        }
      })
    }
  });

  const importResult = await requestJson<{
    importJob: { status: string; diagnostics: Array<{ code: string }> };
    stagedContentRelease: { contentReleaseId: string } | null;
  }>(`/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/import-jobs`, {
    method: "POST",
    body: {
      sourcePackageId: sourcePackage.body.sourcePackage.sourcePackageId
    }
  });

  assert.equal(importResult.status, 201);
  assert.equal(importResult.body.importJob.status, "completed");
  assert.deepEqual(importResult.body.importJob.diagnostics, []);
  assert.ok(importResult.body.stagedContentRelease?.contentReleaseId);

  const contentRelease = await requestJson<{
    contentReleaseDetail: {
      contentRelease: {
        runtimeSnapshot: {
          bookletEntries: Array<{
            bookletKey: string;
            displayLabel: string;
            unitEntries: Array<{ unitKey: string; displayLabel: string }>;
          }>;
        };
      };
    };
  }>(
    `/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/content-releases/${importResult.body.stagedContentRelease.contentReleaseId}`
  );

  assert.equal(contentRelease.status, 200);
  assert.deepEqual(
    contentRelease.body.contentReleaseDetail.contentRelease.runtimeSnapshot,
    {
      bookletEntries: [
        {
          bookletKey: "booklets/default.xml",
          displayLabel: "Default Booklet",
          unitEntries: [
            { unitKey: "items/default.xml", displayLabel: "Default Unit" }
          ]
        }
      ]
    }
  );
});

test("source document import resolves JSON resource dependencies", async () => {
  const tenantKey = "integration-tenant-json-dependencies";
  const workspaceKey = "integration-workspace-json-dependencies";

  await requestJson("/api/v1/platform/tenants", {
    method: "POST",
    body: { tenantKey, displayName: tenantKey }
  });
  await requestJson(`/api/v1/tenants/${tenantKey}/workspaces`, {
    method: "POST",
    body: { workspaceKey, displayName: workspaceKey }
  });

  const sourcePackage = await requestJson<{
    sourcePackage: { sourcePackageId: string };
  }>(`/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/source-packages`, {
    method: "POST",
    body: {
      fileName: "imsmanifest-dependencies.json",
      mediaType: "application/json",
      sourceDocument: JSON.stringify({
        manifest: {
          resources: [
            {
              identifier: "RES-TEST",
              href: "tests/json-booklet.xml",
              title: "JSON Dependency Booklet",
              dependencies: [
                { identifierref: "RES-ITEM-1" },
                { ref: "RES-ITEM-2" }
              ]
            },
            {
              identifier: "RES-ITEM-1",
              href: "items/json-item-one.xml"
            },
            {
              identifier: "RES-ITEM-2",
              title: "JSON Item Two",
              files: [{ href: "items/json-item-two.xml" }]
            }
          ]
        }
      })
    }
  });

  const importResult = await requestJson<{
    importJob: { status: string; diagnostics: Array<{ code: string }> };
    stagedContentRelease: { contentReleaseId: string } | null;
  }>(`/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/import-jobs`, {
    method: "POST",
    body: {
      sourcePackageId: sourcePackage.body.sourcePackage.sourcePackageId
    }
  });

  assert.equal(importResult.status, 201);
  assert.equal(importResult.body.importJob.status, "completed");
  assert.deepEqual(importResult.body.importJob.diagnostics, []);
  assert.ok(importResult.body.stagedContentRelease?.contentReleaseId);

  const contentRelease = await requestJson<{
    contentReleaseDetail: {
      contentRelease: {
        runtimeSnapshot: {
          bookletEntries: Array<{
            bookletKey: string;
            displayLabel: string;
            unitEntries: Array<{ unitKey: string; displayLabel: string }>;
          }>;
        };
      };
    };
  }>(
    `/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/content-releases/${importResult.body.stagedContentRelease.contentReleaseId}`
  );

  assert.equal(contentRelease.status, 200);
  assert.deepEqual(
    contentRelease.body.contentReleaseDetail.contentRelease.runtimeSnapshot,
    {
      bookletEntries: [
        {
          bookletKey: "tests/json-booklet.xml",
          displayLabel: "JSON Dependency Booklet",
          unitEntries: [
            {
              unitKey: "items/json-item-one.xml",
              displayLabel: "Resource items/json item one.xml"
            },
            {
              unitKey: "items/json-item-two.xml",
              displayLabel: "JSON Item Two"
            }
          ]
        }
      ]
    }
  );
});

test("source document import resolves keyed JSON resource dependency maps", async () => {
  const tenantKey = "integration-tenant-json-keyed-dependencies";
  const workspaceKey = "integration-workspace-json-keyed-dependencies";

  await requestJson("/api/v1/platform/tenants", {
    method: "POST",
    body: { tenantKey, displayName: tenantKey }
  });
  await requestJson(`/api/v1/tenants/${tenantKey}/workspaces`, {
    method: "POST",
    body: { workspaceKey, displayName: workspaceKey }
  });

  const sourcePackage = await requestJson<{
    sourcePackage: { sourcePackageId: string };
  }>(`/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/source-packages`, {
    method: "POST",
    body: {
      fileName: "imsmanifest-keyed-dependencies.json",
      mediaType: "application/json",
      sourceDocument: JSON.stringify({
        manifest: {
          resources: {
            "RES-TEST": {
              href: "tests/keyed-dependency-booklet.xml",
              title: "Keyed Dependency Booklet",
              dependencies: {
                "RES-ITEM-A": {},
                "RES-ITEM-B": {}
              }
            },
            "RES-ITEM-A": {
              href: "items/keyed-dependency-a.xml",
              title: "Keyed Dependency A"
            },
            "RES-ITEM-B": {
              files: [{ href: "items/keyed-dependency-b.xml" }],
              title: "Keyed Dependency B"
            }
          }
        }
      })
    }
  });

  const importResult = await requestJson<{
    importJob: { status: string; diagnostics: Array<{ code: string }> };
    stagedContentRelease: { contentReleaseId: string } | null;
  }>(`/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/import-jobs`, {
    method: "POST",
    body: {
      sourcePackageId: sourcePackage.body.sourcePackage.sourcePackageId
    }
  });

  assert.equal(importResult.status, 201);
  assert.equal(importResult.body.importJob.status, "completed");
  assert.deepEqual(importResult.body.importJob.diagnostics, []);
  assert.ok(importResult.body.stagedContentRelease?.contentReleaseId);

  const contentRelease = await requestJson<{
    contentReleaseDetail: {
      contentRelease: {
        runtimeSnapshot: {
          bookletEntries: Array<{
            bookletKey: string;
            displayLabel: string;
            unitEntries: Array<{ unitKey: string; displayLabel: string }>;
          }>;
        };
      };
    };
  }>(
    `/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/content-releases/${importResult.body.stagedContentRelease.contentReleaseId}`
  );

  assert.equal(contentRelease.status, 200);
  assert.deepEqual(
    contentRelease.body.contentReleaseDetail.contentRelease.runtimeSnapshot,
    {
      bookletEntries: [
        {
          bookletKey: "tests/keyed-dependency-booklet.xml",
          displayLabel: "Keyed Dependency Booklet",
          unitEntries: [
            {
              unitKey: "items/keyed-dependency-a.xml",
              displayLabel: "Keyed Dependency A"
            },
            {
              unitKey: "items/keyed-dependency-b.xml",
              displayLabel: "Keyed Dependency B"
            }
          ]
        }
      ]
    }
  );
});

test("source document import resolves JSON IMS base paths for resource dependencies", async () => {
  const tenantKey = "integration-tenant-json-base-dependencies";
  const workspaceKey = "integration-workspace-json-base-dependencies";

  await requestJson("/api/v1/platform/tenants", {
    method: "POST",
    body: { tenantKey, displayName: tenantKey }
  });
  await requestJson(`/api/v1/tenants/${tenantKey}/workspaces`, {
    method: "POST",
    body: { workspaceKey, displayName: workspaceKey }
  });

  const sourcePackage = await requestJson<{
    sourcePackage: { sourcePackageId: string };
  }>(`/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/source-packages`, {
    method: "POST",
    body: {
      fileName: "imsmanifest-base-dependencies.json",
      mediaType: "application/json",
      sourceDocument: JSON.stringify({
        manifest: {
          "xml:base": "content/",
          resources: [
            {
              identifier: "RES-TEST",
              base: "booklets/",
              href: "json-base-booklet.xml",
              title: "JSON Base Dependency Booklet",
              dependencies: [{ identifierref: "RES-ITEM" }]
            },
            {
              identifier: "RES-ITEM",
              title: "JSON Base Item",
              files: [{ base: "items/", href: "json-base-item.xml" }]
            }
          ]
        }
      })
    }
  });

  const importResult = await requestJson<{
    importJob: { status: string; diagnostics: Array<{ code: string }> };
    stagedContentRelease: { contentReleaseId: string } | null;
  }>(`/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/import-jobs`, {
    method: "POST",
    body: {
      sourcePackageId: sourcePackage.body.sourcePackage.sourcePackageId
    }
  });

  assert.equal(importResult.status, 201);
  assert.equal(importResult.body.importJob.status, "completed");
  assert.deepEqual(importResult.body.importJob.diagnostics, []);
  assert.ok(importResult.body.stagedContentRelease?.contentReleaseId);

  const contentRelease = await requestJson<{
    contentReleaseDetail: {
      contentRelease: {
        runtimeSnapshot: {
          bookletEntries: Array<{
            bookletKey: string;
            displayLabel: string;
            unitEntries: Array<{ unitKey: string; displayLabel: string }>;
          }>;
        };
      };
    };
  }>(
    `/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/content-releases/${importResult.body.stagedContentRelease.contentReleaseId}`
  );

  assert.equal(contentRelease.status, 200);
  assert.deepEqual(
    contentRelease.body.contentReleaseDetail.contentRelease.runtimeSnapshot,
    {
      bookletEntries: [
        {
          bookletKey: "content/booklets/json-base-booklet.xml",
          displayLabel: "JSON Base Dependency Booklet",
          unitEntries: [
            {
              unitKey: "content/items/json-base-item.xml",
              displayLabel: "JSON Base Item"
            }
          ]
        }
      ]
    }
  );
});

test("source document import accepts JSON QTI assessment sections as booklets", async () => {
  const tenantKey = "integration-tenant-json-qti-sections";
  const workspaceKey = "integration-workspace-json-qti-sections";

  await requestJson("/api/v1/platform/tenants", {
    method: "POST",
    body: { tenantKey, displayName: tenantKey }
  });
  await requestJson(`/api/v1/tenants/${tenantKey}/workspaces`, {
    method: "POST",
    body: { workspaceKey, displayName: workspaceKey }
  });

  const sourcePackage = await requestJson<{
    sourcePackage: { sourcePackageId: string };
  }>(`/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/source-packages`, {
    method: "POST",
    body: {
      fileName: "qti-assessment-section.json",
      mediaType: "application/json",
      sourceDocument: JSON.stringify({
        assessmentTests: [
          {
            identifier: "test:qti-json-sections",
            title: "QTI JSON Section Test",
            assessmentSections: [
              {
                identifier: "section:listening",
                title: "Listening Section",
                assessmentItemRefs: [
                  {
                    identifier: "unit-listening-a",
                    title: "Listening Item A"
                  },
                  {
                    identifier: "unit-listening-b",
                    title: "Listening Item B"
                  },
                  {
                    identifierRef: "unit-listening-c",
                    title: "Listening Item C"
                  }
                ],
                assessmentItems: [
                  {
                    identifier: "unit-listening-d",
                    title: "Listening Item D",
                    itemBody: "Use the JSON embedded item body."
                  }
                ]
              }
            ]
          }
        ]
      })
    }
  });

  const importResult = await requestJson<{
    importJob: { status: string; diagnostics: Array<{ code: string }> };
    stagedContentRelease: { contentReleaseId: string } | null;
  }>(`/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/import-jobs`, {
    method: "POST",
    body: {
      sourcePackageId: sourcePackage.body.sourcePackage.sourcePackageId
    }
  });

  assert.equal(importResult.status, 201);
  assert.equal(importResult.body.importJob.status, "completed");
  assert.deepEqual(importResult.body.importJob.diagnostics, []);
  assert.ok(importResult.body.stagedContentRelease?.contentReleaseId);

  const contentRelease = await requestJson<{
    contentReleaseDetail: {
      contentRelease: {
        runtimeSnapshot: {
          bookletEntries: Array<{
            bookletKey: string;
            displayLabel: string;
            unitEntries: Array<{
              unitKey: string;
              displayLabel: string;
              content?: string;
            }>;
          }>;
        };
      };
    };
  }>(
    `/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/content-releases/${importResult.body.stagedContentRelease.contentReleaseId}`
  );

  assert.equal(contentRelease.status, 200);
  assert.deepEqual(
    contentRelease.body.contentReleaseDetail.contentRelease.runtimeSnapshot,
    {
      bookletEntries: [
        {
          bookletKey: "section:listening",
          displayLabel: "Listening Section",
          unitEntries: [
            { unitKey: "unit-listening-a", displayLabel: "Listening Item A" },
            { unitKey: "unit-listening-b", displayLabel: "Listening Item B" },
            { unitKey: "unit-listening-c", displayLabel: "Listening Item C" },
            {
              unitKey: "unit-listening-d",
              displayLabel: "Listening Item D",
              content: "Use the JSON embedded item body."
            }
          ]
        }
      ]
    }
  );
});

test("source document import accepts testcenter-style XML aliases", async () => {
  const tenantKey = "integration-tenant-xml-aliases";
  const workspaceKey = "integration-workspace-xml-aliases";

  await requestJson("/api/v1/platform/tenants", {
    method: "POST",
    body: { tenantKey, displayName: tenantKey }
  });
  await requestJson(`/api/v1/tenants/${tenantKey}/workspaces`, {
    method: "POST",
    body: { workspaceKey, displayName: workspaceKey }
  });

  const sourcePackage = await requestJson<{
    sourcePackage: { sourcePackageId: string };
  }>(`/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/source-packages`, {
    method: "POST",
    body: {
      fileName: "testcenter-style.imsmanifest",
      mediaType: "application/octet-stream",
      sourceDocument: `
        <assessment xmlns:tc="https://example.testcenter.local/schema">
          <tc:test tc:identifier="test:wrapper">
            <tc:testlet tc:key="booklet:alias" tc:title="Alias Booklet">
              <tc:unitRef tc:ref="unit-alpha" tc:label="Alpha Unit" />
              <unitDefinition alias="unit-beta" displayName="Beta Unit" />
              <tc:item code="unit-beta" label="Duplicate Beta Unit" />
              <item href="unit-gamma" />
            </tc:testlet>
            <tc:assessmentTest tc:identifier="booklet:qti" tc:title="QTI Booklet">
              <tc:assessmentItemRef tc:identifier="unit-reading" tc:title="Reading Unit" />
              <tc:assessmentItemRef tc:identifierref="unit-listening" tc:title="Listening Unit" />
              <item-ref identifier="unit-speaking">
                <title>Speaking Unit</title>
              </item-ref>
              <item-ref identifier="unit-writing" title="Writing Unit" />
            </tc:assessmentTest>
          </tc:test>
        </assessment>
      `
    }
  });

  const importResult = await requestJson<{
    importJob: { status: string; diagnostics: Array<{ code: string }> };
    stagedContentRelease: { contentReleaseId: string } | null;
  }>(`/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/import-jobs`, {
    method: "POST",
    body: {
      sourcePackageId: sourcePackage.body.sourcePackage.sourcePackageId
    }
  });

  assert.equal(importResult.status, 201);
  assert.equal(importResult.body.importJob.status, "completed");
  assert.deepEqual(importResult.body.importJob.diagnostics, []);
  assert.ok(importResult.body.stagedContentRelease?.contentReleaseId);

  const contentRelease = await requestJson<{
    contentReleaseDetail: {
      contentRelease: {
        runtimeSnapshot: {
          bookletEntries: Array<{
            bookletKey: string;
            displayLabel: string;
            unitEntries: Array<{ unitKey: string; displayLabel: string }>;
          }>;
        };
      };
    };
  }>(
    `/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/content-releases/${importResult.body.stagedContentRelease.contentReleaseId}`
  );

  assert.equal(contentRelease.status, 200);
  assert.deepEqual(
    contentRelease.body.contentReleaseDetail.contentRelease.runtimeSnapshot,
    {
      bookletEntries: [
        {
          bookletKey: "booklet:alias",
          displayLabel: "Alias Booklet",
          unitEntries: [
            { unitKey: "unit-alpha", displayLabel: "Alpha Unit" },
            { unitKey: "unit-beta", displayLabel: "Beta Unit" },
            { unitKey: "unit-gamma", displayLabel: "Unit unit gamma" }
          ]
        },
        {
          bookletKey: "booklet:qti",
          displayLabel: "QTI Booklet",
          unitEntries: [
            { unitKey: "unit-reading", displayLabel: "Reading Unit" },
            { unitKey: "unit-listening", displayLabel: "Listening Unit" },
            { unitKey: "unit-speaking", displayLabel: "Speaking Unit" },
            { unitKey: "unit-writing", displayLabel: "Writing Unit" }
          ]
        }
      ]
    }
  );
});

test("source document import preserves testcenter unit aliases", async () => {
  const tenantKey = "integration-tenant-testcenter-aliases";
  const workspaceKey = "integration-workspace-testcenter-aliases";

  await requestJson("/api/v1/platform/tenants", {
    method: "POST",
    body: { tenantKey, displayName: tenantKey }
  });
  await requestJson(`/api/v1/tenants/${tenantKey}/workspaces`, {
    method: "POST",
    body: { workspaceKey, displayName: workspaceKey }
  });

  const sourcePackage = await requestJson<{
    sourcePackage: { sourcePackageId: string };
  }>(`/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/source-packages`, {
    method: "POST",
    body: {
      fileName: "Booklet.xml",
      mediaType: "application/xml",
      sourceDocument: `
        <Booklet>
          <Metadata>
            <Id>BOOKLET.SAMPLE-1</Id>
            <Label>Sample booklet</Label>
            <Description>This a sample booklet for testing/development/showcase purposes.</Description>
          </Metadata>
          <Units>
            <Unit id="UNIT.SAMPLE" label="A Sample Unit to demonstrate the SamplePlayer2" labelshort="Sample Unit" />
            <Testlet id="a_testlet_with_restrictions" label="First Block">
              <Unit id="UNIT.SAMPLE-2" label="A very Simple Sample Unit" labelshort="2nd Sample Unit" />
            </Testlet>
            <Testlet id="another_testlet" label="Second Block">
              <Unit id="UNIT.SAMPLE" label="Sample Unit again, with Alias" labelshort="Sample Unit Again" alias="an_alias" />
            </Testlet>
            <Unit id="UNIT.INLINE" label="Inline definition unit">
              <Definition><![CDATA[
                <section>Loaded direct Testcenter definition payload.</section>
              ]]></Definition>
            </Unit>
          </Units>
        </Booklet>
      `
    }
  });

  const importResult = await requestJson<{
    importJob: { status: string; diagnostics: Array<{ code: string }> };
    stagedContentRelease: { contentReleaseId: string } | null;
  }>(`/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/import-jobs`, {
    method: "POST",
    body: {
      sourcePackageId: sourcePackage.body.sourcePackage.sourcePackageId
    }
  });

  assert.equal(importResult.status, 201);
  assert.equal(importResult.body.importJob.status, "completed");
  assert.deepEqual(importResult.body.importJob.diagnostics, []);
  assert.ok(importResult.body.stagedContentRelease?.contentReleaseId);

  const contentRelease = await requestJson<{
    contentReleaseDetail: {
      contentRelease: {
        runtimeSnapshot: {
          bookletEntries: Array<{
            bookletKey: string;
            displayLabel: string;
            unitEntries: Array<{
              unitKey: string;
              displayLabel: string;
              content?: string;
            }>;
          }>;
        };
      };
    };
  }>(
    `/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/content-releases/${importResult.body.stagedContentRelease.contentReleaseId}`
  );

  assert.equal(contentRelease.status, 200);
  assert.deepEqual(
    contentRelease.body.contentReleaseDetail.contentRelease.runtimeSnapshot,
    {
      bookletEntries: [
        {
          bookletKey: "BOOKLET.SAMPLE-1",
          displayLabel: "Sample booklet",
          unitEntries: [
            {
              unitKey: "UNIT.SAMPLE",
              displayLabel: "A Sample Unit to demonstrate the SamplePlayer2"
            },
            {
              unitKey: "UNIT.SAMPLE-2",
              displayLabel: "A very Simple Sample Unit"
            },
            {
              unitKey: "an_alias",
              displayLabel: "Sample Unit again, with Alias"
            },
            {
              unitKey: "UNIT.INLINE",
              displayLabel: "Inline definition unit",
              content: "Loaded direct Testcenter definition payload."
            }
          ]
        }
      ]
    }
  );
});

test("source document import accepts QTI assessment sections as booklets", async () => {
  const tenantKey = "integration-tenant-qti-sections";
  const workspaceKey = "integration-workspace-qti-sections";

  await requestJson("/api/v1/platform/tenants", {
    method: "POST",
    body: { tenantKey, displayName: tenantKey }
  });
  await requestJson(`/api/v1/tenants/${tenantKey}/workspaces`, {
    method: "POST",
    body: { workspaceKey, displayName: workspaceKey }
  });

  const sourcePackage = await requestJson<{
    sourcePackage: { sourcePackageId: string };
  }>(`/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/source-packages`, {
    method: "POST",
    body: {
      fileName: "qti-assessment-section.xml",
      mediaType: "application/xml",
      sourceDocument: `
        <assessmentTest identifier="test:qti-sections" title="QTI Section Test">
          <testPart identifier="part-1">
            <assessmentSection>
              <identifier>section:reading</identifier>
              <title>Reading Section</title>
              <assessmentItemRef identifier="unit-reading-a" title="Reading Item A" />
              <assessmentItemRef title="Reading Item B">
                <identifier>unit-reading-b</identifier>
                <body><![CDATA[<p>Read the passage and answer the question.</p>]]></body>
              </assessmentItemRef>
              <assessmentItem identifier="unit-reading-c">
                <title>Reading Item C</title>
                <itemBody>Use the embedded item body.</itemBody>
              </assessmentItem>
            </assessmentSection>
          </testPart>
        </assessmentTest>
      `
    }
  });

  const importResult = await requestJson<{
    importJob: { status: string; diagnostics: Array<{ code: string }> };
    stagedContentRelease: { contentReleaseId: string } | null;
  }>(`/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/import-jobs`, {
    method: "POST",
    body: {
      sourcePackageId: sourcePackage.body.sourcePackage.sourcePackageId
    }
  });

  assert.equal(importResult.status, 201);
  assert.equal(importResult.body.importJob.status, "completed");
  assert.deepEqual(importResult.body.importJob.diagnostics, []);
  assert.ok(importResult.body.stagedContentRelease?.contentReleaseId);

  const contentRelease = await requestJson<{
    contentReleaseDetail: {
      contentRelease: {
        runtimeSnapshot: {
          bookletEntries: Array<{
            bookletKey: string;
            displayLabel: string;
            unitEntries: Array<{ unitKey: string; displayLabel: string }>;
          }>;
        };
      };
    };
  }>(
    `/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/content-releases/${importResult.body.stagedContentRelease.contentReleaseId}`
  );

  assert.equal(contentRelease.status, 200);
  assert.deepEqual(
    contentRelease.body.contentReleaseDetail.contentRelease.runtimeSnapshot,
    {
      bookletEntries: [
        {
          bookletKey: "section:reading",
          displayLabel: "Reading Section",
          unitEntries: [
            { unitKey: "unit-reading-a", displayLabel: "Reading Item A" },
            {
              unitKey: "unit-reading-b",
              displayLabel: "Reading Item B",
              content: "Read the passage and answer the question."
            },
            {
              unitKey: "unit-reading-c",
              displayLabel: "Reading Item C",
              content: "Use the embedded item body."
            }
          ]
        }
      ]
    }
  );
});

test("source document import resolves IMS organization item references", async () => {
  const tenantKey = "integration-tenant-ims-organization";
  const workspaceKey = "integration-workspace-ims-organization";

  await requestJson("/api/v1/platform/tenants", {
    method: "POST",
    body: { tenantKey, displayName: tenantKey }
  });
  await requestJson(`/api/v1/tenants/${tenantKey}/workspaces`, {
    method: "POST",
    body: { workspaceKey, displayName: workspaceKey }
  });

  const sourcePackage = await requestJson<{
    sourcePackage: { sourcePackageId: string };
  }>(`/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/source-packages`, {
    method: "POST",
    body: {
      fileName: "imsmanifest.xml",
      mediaType: "application/xml",
      sourceDocument: `
        <manifest xmlns="http://www.imsglobal.org/xsd/imscp_v1p1">
          <organizations default="ORG-1">
            <organization identifier="ORG-1">
              <item identifier="BOOKLET-ITEM" identifierref="RES-BOOKLET-A">
                <title>Booklet A</title>
                <item identifier="UNIT-ITEM-1" identifierref="RES-UNIT-1">
                  <title>Item One</title>
                </item>
                <item identifier="UNIT-ITEM-2" identifierref="RES-UNIT-2" />
              </item>
            </organization>
          </organizations>
          <resources>
            <resource identifier="RES-BOOKLET-A" type="imsqti_test_xmlv2p1" href="booklets/booklet-a.xml" />
            <resource identifier="RES-UNIT-1" type="imsqti_item_xmlv2p1" href="units/unit-1.xml" />
            <resource identifier="RES-UNIT-2" type="imsqti_item_xmlv2p1" title="Item Two">
              <file href="units/unit-2.xml" />
            </resource>
          </resources>
        </manifest>
      `
    }
  });

  const importResult = await requestJson<{
    importJob: { status: string; diagnostics: Array<{ code: string }> };
    stagedContentRelease: { contentReleaseId: string } | null;
  }>(`/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/import-jobs`, {
    method: "POST",
    body: {
      sourcePackageId: sourcePackage.body.sourcePackage.sourcePackageId
    }
  });

  assert.equal(importResult.status, 201);
  assert.equal(importResult.body.importJob.status, "completed");
  assert.deepEqual(importResult.body.importJob.diagnostics, []);
  assert.ok(importResult.body.stagedContentRelease?.contentReleaseId);

  const contentRelease = await requestJson<{
    contentReleaseDetail: {
      contentRelease: {
        runtimeSnapshot: {
          bookletEntries: Array<{
            bookletKey: string;
            displayLabel: string;
            unitEntries: Array<{ unitKey: string; displayLabel: string }>;
          }>;
        };
      };
    };
  }>(
    `/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/content-releases/${importResult.body.stagedContentRelease.contentReleaseId}`
  );

  assert.equal(contentRelease.status, 200);
  assert.deepEqual(
    contentRelease.body.contentReleaseDetail.contentRelease.runtimeSnapshot,
    {
      bookletEntries: [
        {
          bookletKey: "booklets/booklet-a.xml",
          displayLabel: "Booklet A",
          unitEntries: [
            { unitKey: "units/unit-1.xml", displayLabel: "Item One" },
            { unitKey: "units/unit-2.xml", displayLabel: "Item Two" }
          ]
        }
      ]
    }
  );
});

test("source document import respects IMS default organization", async () => {
  const tenantKey = "integration-tenant-ims-default-organization";
  const workspaceKey = "integration-workspace-ims-default-organization";

  await requestJson("/api/v1/platform/tenants", {
    method: "POST",
    body: { tenantKey, displayName: tenantKey }
  });
  await requestJson(`/api/v1/tenants/${tenantKey}/workspaces`, {
    method: "POST",
    body: { workspaceKey, displayName: workspaceKey }
  });

  const sourcePackage = await requestJson<{
    sourcePackage: { sourcePackageId: string };
  }>(`/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/source-packages`, {
    method: "POST",
    body: {
      fileName: "imsmanifest-default-organization.xml",
      mediaType: "application/xml",
      sourceDocument: `
        <manifest xmlns="http://www.imsglobal.org/xsd/imscp_v1p1">
          <organizations default="ORG-DEFAULT">
            <organization identifier="ORG-DISTRACTOR">
              <item identifierref="RES-BOOKLET-DISTRACTOR">
                <title>Distractor Booklet</title>
                <item identifierref="RES-UNIT-DISTRACTOR" />
              </item>
            </organization>
            <organization identifier="ORG-DEFAULT">
              <item identifierref="RES-BOOKLET-DEFAULT">
                <title>Default Booklet</title>
                <item identifierref="RES-UNIT-DEFAULT">
                  <title>Default Unit</title>
                </item>
              </item>
            </organization>
          </organizations>
          <resources>
            <resource identifier="RES-BOOKLET-DISTRACTOR" href="booklets/distractor.xml" />
            <resource identifier="RES-UNIT-DISTRACTOR" href="items/distractor.xml" />
            <resource identifier="RES-BOOKLET-DEFAULT" href="booklets/default.xml" />
            <resource identifier="RES-UNIT-DEFAULT" href="items/default.xml" />
          </resources>
        </manifest>
      `
    }
  });

  const importResult = await requestJson<{
    importJob: { status: string; diagnostics: Array<{ code: string }> };
    stagedContentRelease: { contentReleaseId: string } | null;
  }>(`/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/import-jobs`, {
    method: "POST",
    body: {
      sourcePackageId: sourcePackage.body.sourcePackage.sourcePackageId
    }
  });

  assert.equal(importResult.status, 201);
  assert.equal(importResult.body.importJob.status, "completed");
  assert.deepEqual(importResult.body.importJob.diagnostics, []);
  assert.ok(importResult.body.stagedContentRelease?.contentReleaseId);

  const contentRelease = await requestJson<{
    contentReleaseDetail: {
      contentRelease: {
        runtimeSnapshot: {
          bookletEntries: Array<{
            bookletKey: string;
            displayLabel: string;
            unitEntries: Array<{ unitKey: string; displayLabel: string }>;
          }>;
        };
      };
    };
  }>(
    `/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/content-releases/${importResult.body.stagedContentRelease.contentReleaseId}`
  );

  assert.equal(contentRelease.status, 200);
  assert.deepEqual(
    contentRelease.body.contentReleaseDetail.contentRelease.runtimeSnapshot,
    {
      bookletEntries: [
        {
          bookletKey: "booklets/default.xml",
          displayLabel: "Default Booklet",
          unitEntries: [
            { unitKey: "items/default.xml", displayLabel: "Default Unit" }
          ]
        }
      ]
    }
  );
});

test("source document import sniffs manifest text from package media types", async () => {
  const tenantKey = "integration-tenant-package-sniffing";
  const workspaceKey = "integration-workspace-package-sniffing";

  await requestJson("/api/v1/platform/tenants", {
    method: "POST",
    body: { tenantKey, displayName: tenantKey }
  });
  await requestJson(`/api/v1/tenants/${tenantKey}/workspaces`, {
    method: "POST",
    body: { workspaceKey, displayName: workspaceKey }
  });

  const sourcePackage = await requestJson<{
    sourcePackage: { sourcePackageId: string };
  }>(`/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/source-packages`, {
    method: "POST",
    body: {
      fileName: "testcenter-export.zip",
      mediaType: "application/zip",
      sourceDocument: `
        <manifest xmlns="http://www.imsglobal.org/xsd/imscp_v1p1">
          <organizations default="ORG-1">
            <organization identifier="ORG-1">
              <item identifier="BOOKLET-ITEM" identifierref="RES-BOOKLET">
                <title>Sniffed Booklet</title>
                <item identifier="UNIT-ITEM" identifierref="RES-UNIT">
                  <title>Sniffed Unit</title>
                </item>
              </item>
            </organization>
          </organizations>
          <resources>
            <resource identifier="RES-BOOKLET" type="imsqti_test_xmlv2p1" href="booklets/sniffed.xml" />
            <resource identifier="RES-UNIT" type="imsqti_item_xmlv2p1" href="units/sniffed-item.xml" />
          </resources>
        </manifest>
      `
    }
  });

  const importResult = await requestJson<{
    importJob: { status: string; diagnostics: Array<{ code: string }> };
    stagedContentRelease: { contentReleaseId: string } | null;
  }>(`/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/import-jobs`, {
    method: "POST",
    body: {
      sourcePackageId: sourcePackage.body.sourcePackage.sourcePackageId
    }
  });

  assert.equal(importResult.status, 201);
  assert.equal(importResult.body.importJob.status, "completed");
  assert.deepEqual(importResult.body.importJob.diagnostics, []);
  assert.ok(importResult.body.stagedContentRelease?.contentReleaseId);

  const contentRelease = await requestJson<{
    contentReleaseDetail: {
      contentRelease: {
        runtimeSnapshot: {
          bookletEntries: Array<{
            bookletKey: string;
            displayLabel: string;
            unitEntries: Array<{ unitKey: string; displayLabel: string }>;
          }>;
        };
      };
    };
  }>(
    `/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/content-releases/${importResult.body.stagedContentRelease.contentReleaseId}`
  );

  assert.equal(contentRelease.status, 200);
  assert.deepEqual(
    contentRelease.body.contentReleaseDetail.contentRelease.runtimeSnapshot,
    {
      bookletEntries: [
        {
          bookletKey: "booklets/sniffed.xml",
          displayLabel: "Sniffed Booklet",
          unitEntries: [
            { unitKey: "units/sniffed-item.xml", displayLabel: "Sniffed Unit" }
          ]
        }
      ]
    }
  );
});

test("source document import extracts IMS manifest from base64 ZIP packages", async () => {
  const tenantKey = "integration-tenant-zip-manifest";
  const workspaceKey = "integration-workspace-zip-manifest";

  await requestJson("/api/v1/platform/tenants", {
    method: "POST",
    body: { tenantKey, displayName: tenantKey }
  });
  await requestJson(`/api/v1/tenants/${tenantKey}/workspaces`, {
    method: "POST",
    body: { workspaceKey, displayName: workspaceKey }
  });

  const zipPayload = createZipBase64([
    {
      fileName: "README.txt",
      content: "not the manifest"
    },
    {
      fileName: "export/imsmanifest.xml",
      content: `
        <manifest xmlns="http://www.imsglobal.org/xsd/imscp_v1p1">
          <organizations default="ORG-ZIP">
            <organization identifier="ORG-ZIP">
              <item identifierref="RES-ZIP-BOOKLET">
                <title>ZIP Booklet</title>
                <item identifierref="RES-ZIP-UNIT">
                  <title>ZIP Unit</title>
                </item>
              </item>
            </organization>
          </organizations>
          <resources>
            <resource identifier="RES-ZIP-BOOKLET" href="booklets/zip-booklet.xml" />
            <resource identifier="RES-ZIP-UNIT" href="items/zip-unit.xml" />
          </resources>
        </manifest>
      `
    }
  ]);

  const sourcePackage = await requestJson<{
    sourcePackage: { sourcePackageId: string };
  }>(`/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/source-packages`, {
    method: "POST",
    body: {
      fileName: "testcenter-export.zip",
      mediaType: "application/zip",
      sourceDocument: `data:application/zip;base64,${zipPayload}`
    }
  });

  const importResult = await requestJson<{
    importJob: { status: string; diagnostics: Array<{ code: string }> };
    stagedContentRelease: { contentReleaseId: string } | null;
  }>(`/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/import-jobs`, {
    method: "POST",
    body: {
      sourcePackageId: sourcePackage.body.sourcePackage.sourcePackageId
    }
  });

  assert.equal(importResult.status, 201);
  assert.equal(importResult.body.importJob.status, "completed");
  assert.deepEqual(importResult.body.importJob.diagnostics, []);
  assert.ok(importResult.body.stagedContentRelease?.contentReleaseId);

  const contentRelease = await requestJson<{
    contentReleaseDetail: {
      contentRelease: {
        runtimeSnapshot: {
          bookletEntries: Array<{
            bookletKey: string;
            displayLabel: string;
            unitEntries: Array<{ unitKey: string; displayLabel: string }>;
          }>;
        };
      };
    };
  }>(
    `/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/content-releases/${importResult.body.stagedContentRelease.contentReleaseId}`
  );

  assert.equal(contentRelease.status, 200);
  assert.deepEqual(
    contentRelease.body.contentReleaseDetail.contentRelease.runtimeSnapshot,
    {
      bookletEntries: [
        {
          bookletKey: "booklets/zip-booklet.xml",
          displayLabel: "ZIP Booklet",
          unitEntries: [{ unitKey: "items/zip-unit.xml", displayLabel: "ZIP Unit" }]
        }
      ]
    }
  );
});

test("source document import extracts IMS manifest from deflated base64 ZIP packages", async () => {
  const tenantKey = "integration-tenant-deflated-zip-manifest";
  const workspaceKey = "integration-workspace-deflated-zip-manifest";

  await requestJson("/api/v1/platform/tenants", {
    method: "POST",
    body: { tenantKey, displayName: tenantKey }
  });
  await requestJson(`/api/v1/tenants/${tenantKey}/workspaces`, {
    method: "POST",
    body: { workspaceKey, displayName: workspaceKey }
  });

  const zipPayload = createZipBase64(
    [
      {
        fileName: "export/imsmanifest.xml",
        content: `
          <manifest xmlns="http://www.imsglobal.org/xsd/imscp_v1p1">
            <organizations default="ORG-DEFLATED-ZIP">
              <organization identifier="ORG-DEFLATED-ZIP">
                <item identifierref="RES-DEFLATED-ZIP-BOOKLET">
                  <title>Deflated ZIP Booklet</title>
                  <item identifierref="RES-DEFLATED-ZIP-UNIT">
                    <title>Deflated ZIP Unit</title>
                  </item>
                </item>
              </organization>
            </organizations>
            <resources>
              <resource identifier="RES-DEFLATED-ZIP-BOOKLET" href="booklets/deflated-zip-booklet.xml" />
              <resource identifier="RES-DEFLATED-ZIP-UNIT" href="items/deflated-zip-unit.xml" />
            </resources>
          </manifest>
        `
      }
    ],
    { compressionMethod: 8 }
  );

  const sourcePackage = await requestJson<{
    sourcePackage: { sourcePackageId: string };
  }>(`/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/source-packages`, {
    method: "POST",
    body: {
      fileName: "testcenter-deflated-export.zip",
      mediaType: "application/zip",
      sourceDocument: `data:application/zip;base64,${zipPayload}`
    }
  });

  const importResult = await requestJson<{
    importJob: { status: string; diagnostics: Array<{ code: string }> };
    stagedContentRelease: { contentReleaseId: string } | null;
  }>(`/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/import-jobs`, {
    method: "POST",
    body: {
      sourcePackageId: sourcePackage.body.sourcePackage.sourcePackageId
    }
  });

  assert.equal(importResult.status, 201);
  assert.equal(importResult.body.importJob.status, "completed");
  assert.deepEqual(importResult.body.importJob.diagnostics, []);
  assert.ok(importResult.body.stagedContentRelease?.contentReleaseId);

  const contentRelease = await requestJson<{
    contentReleaseDetail: {
      contentRelease: {
        runtimeSnapshot: {
          bookletEntries: Array<{
            bookletKey: string;
            displayLabel: string;
            unitEntries: Array<{ unitKey: string; displayLabel: string }>;
          }>;
        };
      };
    };
  }>(
    `/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/content-releases/${importResult.body.stagedContentRelease.contentReleaseId}`
  );

  assert.equal(contentRelease.status, 200);
  assert.deepEqual(
    contentRelease.body.contentReleaseDetail.contentRelease.runtimeSnapshot,
    {
      bookletEntries: [
        {
          bookletKey: "booklets/deflated-zip-booklet.xml",
          displayLabel: "Deflated ZIP Booklet",
          unitEntries: [
            {
              unitKey: "items/deflated-zip-unit.xml",
              displayLabel: "Deflated ZIP Unit"
            }
          ]
        }
      ]
    }
  );
});

test("source document import enriches ZIP units with referenced file content", async () => {
  const tenantKey = "integration-tenant-zip-unit-content";
  const workspaceKey = "integration-workspace-zip-unit-content";

  await requestJson("/api/v1/platform/tenants", {
    method: "POST",
    body: { tenantKey, displayName: tenantKey }
  });
  await requestJson(`/api/v1/tenants/${tenantKey}/workspaces`, {
    method: "POST",
    body: { workspaceKey, displayName: workspaceKey }
  });

  const zipPayload = createZipBase64([
    {
      fileName: "export/imsmanifest.xml",
      content: `
        <manifest xmlns="http://www.imsglobal.org/xsd/imscp_v1p1">
          <organizations default="ORG-ZIP-CONTENT">
            <organization identifier="ORG-ZIP-CONTENT">
              <item identifierref="RES-ZIP-CONTENT-BOOKLET">
                <title>ZIP Content Booklet</title>
                <item identifierref="RES-ZIP-CONTENT-UNIT">
                  <title>ZIP Content Unit</title>
                </item>
              </item>
            </organization>
          </organizations>
          <resources>
            <resource identifier="RES-ZIP-CONTENT-BOOKLET" href="booklets/zip-content-booklet.xml" />
            <resource identifier="RES-ZIP-CONTENT-UNIT" href="items/zip-content-unit.xml" />
          </resources>
        </manifest>
      `
    },
    {
      fileName: "export/items/zip-content-unit.xml",
      content: `
        <assessmentItem>
          <title>Extracted ZIP Unit Description</title>
          <itemBody>
            <p>Read the extracted ZIP unit body.</p>
            <p>Answer the question.</p>
          </itemBody>
        </assessmentItem>
      `
    }
  ]);

  const sourcePackage = await requestJson<{
    sourcePackage: { sourcePackageId: string };
  }>(`/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/source-packages`, {
    method: "POST",
    body: {
      fileName: "testcenter-zip-content-export.zip",
      mediaType: "application/zip",
      sourceDocument: `data:application/zip;base64,${zipPayload}`
    }
  });

  const importResult = await requestJson<{
    importJob: { status: string; diagnostics: Array<{ code: string }> };
    stagedContentRelease: { contentReleaseId: string } | null;
  }>(`/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/import-jobs`, {
    method: "POST",
    body: {
      sourcePackageId: sourcePackage.body.sourcePackage.sourcePackageId
    }
  });

  assert.equal(importResult.status, 201);
  assert.equal(importResult.body.importJob.status, "completed");
  assert.deepEqual(importResult.body.importJob.diagnostics, []);
  assert.ok(importResult.body.stagedContentRelease?.contentReleaseId);

  const contentRelease = await requestJson<{
    contentReleaseDetail: {
      contentRelease: {
        runtimeSnapshot: {
          bookletEntries: Array<{
            bookletKey: string;
            displayLabel: string;
            unitEntries: Array<{
              unitKey: string;
              displayLabel: string;
              description?: string;
              content?: string;
            }>;
          }>;
        };
      };
    };
  }>(
    `/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/content-releases/${importResult.body.stagedContentRelease.contentReleaseId}`
  );

  assert.equal(contentRelease.status, 200);
  assert.deepEqual(
    contentRelease.body.contentReleaseDetail.contentRelease.runtimeSnapshot,
    {
      bookletEntries: [
        {
          bookletKey: "booklets/zip-content-booklet.xml",
          displayLabel: "ZIP Content Booklet",
          unitEntries: [
            {
              unitKey: "items/zip-content-unit.xml",
              displayLabel: "ZIP Content Unit",
              description: "Extracted ZIP Unit Description",
              content: "Read the extracted ZIP unit body. Answer the question."
            }
          ]
        }
      ]
    }
  );
});

test("source document import derives ZIP runtime structure from referenced booklet XML", async () => {
  const tenantKey = "integration-tenant-zip-booklet-file";
  const workspaceKey = "integration-workspace-zip-booklet-file";

  await requestJson("/api/v1/platform/tenants", {
    method: "POST",
    body: { tenantKey, displayName: tenantKey }
  });
  await requestJson(`/api/v1/tenants/${tenantKey}/workspaces`, {
    method: "POST",
    body: { workspaceKey, displayName: workspaceKey }
  });

  const zipPayload = createZipBase64([
    {
      fileName: "export/imsmanifest.xml",
      content: `
        <manifest xmlns="http://www.imsglobal.org/xsd/imscp_v1p1">
          <resources>
            <resource identifier="RES-REFERENCED-BOOKLET" href="booklets/referenced-booklet.xml" />
          </resources>
        </manifest>
      `
    },
    {
      fileName: "export/booklets/referenced-booklet.xml",
      content: `
        <Booklet id="booklet:zip-referenced" label="Referenced ZIP Booklet">
          <Unit id="unit:zip-referenced-a" label="Referenced Unit A" href="../items/referenced-unit-a.xml" />
          <Unit id="unit:zip-referenced-b" label="Referenced Unit B">
            <content>Loaded from the referenced booklet file.</content>
          </Unit>
        </Booklet>
      `
    },
    {
      fileName: "export/items/referenced-unit-a.xml",
      content: `
        <assessmentItem>
          <title>Referenced Unit A Description</title>
          <itemBody>
            <p>Loaded from the booklet-relative unit file.</p>
          </itemBody>
        </assessmentItem>
      `
    }
  ]);

  const sourcePackage = await requestJson<{
    sourcePackage: { sourcePackageId: string };
  }>(`/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/source-packages`, {
    method: "POST",
    body: {
      fileName: "testcenter-zip-booklet-file-export.zip",
      mediaType: "application/zip",
      sourceDocument: `data:application/zip;base64,${zipPayload}`
    }
  });

  const importResult = await requestJson<{
    importJob: { status: string; diagnostics: Array<{ code: string }> };
    stagedContentRelease: { contentReleaseId: string } | null;
  }>(`/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/import-jobs`, {
    method: "POST",
    body: {
      sourcePackageId: sourcePackage.body.sourcePackage.sourcePackageId
    }
  });

  assert.equal(importResult.status, 201);
  assert.equal(importResult.body.importJob.status, "completed");
  assert.deepEqual(importResult.body.importJob.diagnostics, []);
  assert.ok(importResult.body.stagedContentRelease?.contentReleaseId);

  const contentRelease = await requestJson<{
    contentReleaseDetail: {
      contentRelease: {
        runtimeSnapshot: {
          bookletEntries: Array<{
            bookletKey: string;
            displayLabel: string;
            unitEntries: Array<{
              unitKey: string;
              displayLabel: string;
              content?: string;
            }>;
          }>;
        };
      };
    };
  }>(
    `/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/content-releases/${importResult.body.stagedContentRelease.contentReleaseId}`
  );

  assert.equal(contentRelease.status, 200);
  assert.deepEqual(
    contentRelease.body.contentReleaseDetail.contentRelease.runtimeSnapshot,
    {
      bookletEntries: [
        {
          bookletKey: "booklet:zip-referenced",
          displayLabel: "Referenced ZIP Booklet",
          unitEntries: [
            {
              unitKey: "unit:zip-referenced-a",
              displayLabel: "Referenced Unit A",
              content: "Loaded from the booklet-relative unit file.",
              description: "Referenced Unit A Description"
            },
            {
              unitKey: "unit:zip-referenced-b",
              displayLabel: "Referenced Unit B",
              content: "Loaded from the referenced booklet file."
            }
          ]
        }
      ]
    }
  );
});

test("source document import resolves ZIP Testcenter unit definitions", async () => {
  const tenantKey = "integration-tenant-zip-testcenter-definition";
  const workspaceKey = "integration-workspace-zip-testcenter-definition";

  await requestJson("/api/v1/platform/tenants", {
    method: "POST",
    body: { tenantKey, displayName: tenantKey }
  });
  await requestJson(`/api/v1/tenants/${tenantKey}/workspaces`, {
    method: "POST",
    body: { workspaceKey, displayName: workspaceKey }
  });

  const zipPayload = createZipBase64([
    {
      fileName: "export/imsmanifest.xml",
      content: `
        <manifest xmlns="http://www.imsglobal.org/xsd/imscp_v1p1">
          <resources>
            <resource identifier="BOOKLET.SAMPLE-1" href="booklets/Booklet.xml">
              <dependency identifierref="UNIT.SAMPLE" />
              <dependency identifierref="UNIT.INLINE" />
            </resource>
            <resource identifier="UNIT.SAMPLE" href="units/UNIT.SAMPLE.xml" />
            <resource identifier="UNIT.INLINE" href="units/UNIT.INLINE.xml" />
          </resources>
        </manifest>
      `
    },
    {
      fileName: "export/booklets/Booklet.xml",
      content: `
        <Booklet>
          <Metadata>
            <Id>BOOKLET.SAMPLE-1</Id>
            <Label>Sample booklet</Label>
          </Metadata>
          <Units>
            <Unit id="UNIT.SAMPLE" label="Referenced definition unit" />
            <Unit id="UNIT.INLINE" label="Inline definition unit" />
          </Units>
        </Booklet>
      `
    },
    {
      fileName: "export/units/UNIT.SAMPLE.xml",
      content: `
        <Unit>
          <Metadata>
            <Id>UNIT.SAMPLE</Id>
            <Label>A sample unit</Label>
            <Description>Original Unit Description</Description>
          </Metadata>
          <DefinitionRef player="verona-player-simple@6.0">assets/SAMPLE_UNITCONTENTS.HTM</DefinitionRef>
        </Unit>
      `
    },
    {
      fileName: "export/units/assets/SAMPLE_UNITCONTENTS.HTM",
      content: `
        <main>
          <p>Loaded original Testcenter definition payload.</p>
        </main>
      `
    },
    {
      fileName: "export/units/UNIT.INLINE.xml",
      content: `
        <Unit>
          <Metadata>
            <Id>UNIT.INLINE</Id>
            <Label>Inline Unit</Label>
          </Metadata>
          <Definition><![CDATA[
            <section>Loaded inline Testcenter definition payload.</section>
          ]]></Definition>
        </Unit>
      `
    }
  ]);

  const sourcePackage = await requestJson<{
    sourcePackage: { sourcePackageId: string };
  }>(`/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/source-packages`, {
    method: "POST",
    body: {
      fileName: "testcenter-definition-export.zip",
      mediaType: "application/zip",
      sourceDocument: `data:application/zip;base64,${zipPayload}`
    }
  });

  const importResult = await requestJson<{
    importJob: { status: string; diagnostics: Array<{ code: string }> };
    stagedContentRelease: { contentReleaseId: string } | null;
  }>(`/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/import-jobs`, {
    method: "POST",
    body: {
      sourcePackageId: sourcePackage.body.sourcePackage.sourcePackageId
    }
  });

  assert.equal(importResult.status, 201);
  assert.equal(importResult.body.importJob.status, "completed");
  assert.deepEqual(importResult.body.importJob.diagnostics, []);
  assert.ok(importResult.body.stagedContentRelease?.contentReleaseId);

  const contentRelease = await requestJson<{
    contentReleaseDetail: {
      contentRelease: {
        runtimeSnapshot: {
          bookletEntries: Array<{
            bookletKey: string;
            displayLabel: string;
            unitEntries: Array<{
              unitKey: string;
              displayLabel: string;
              description?: string;
              content?: string;
            }>;
          }>;
        };
      };
    };
  }>(
    `/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/content-releases/${importResult.body.stagedContentRelease.contentReleaseId}`
  );

  assert.equal(contentRelease.status, 200);
  assert.deepEqual(
    contentRelease.body.contentReleaseDetail.contentRelease.runtimeSnapshot,
    {
      bookletEntries: [
        {
          bookletKey: "BOOKLET.SAMPLE-1",
          displayLabel: "Sample booklet",
          unitEntries: [
            {
              unitKey: "UNIT.SAMPLE",
              displayLabel: "Referenced definition unit",
              description: "Original Unit Description",
              content: "Loaded original Testcenter definition payload."
            },
            {
              unitKey: "UNIT.INLINE",
              displayLabel: "Inline definition unit",
              description: "Inline Unit",
              content: "Loaded inline Testcenter definition payload."
            }
          ]
        }
      ]
    }
  );
});

test("source document import resolves IMS xml:base paths for ZIP unit content", async () => {
  const tenantKey = "integration-tenant-zip-xml-base";
  const workspaceKey = "integration-workspace-zip-xml-base";

  await requestJson("/api/v1/platform/tenants", {
    method: "POST",
    body: { tenantKey, displayName: tenantKey }
  });
  await requestJson(`/api/v1/tenants/${tenantKey}/workspaces`, {
    method: "POST",
    body: { workspaceKey, displayName: workspaceKey }
  });

  const zipPayload = createZipBase64([
    {
      fileName: "export/imsmanifest.xml",
      content: `
        <manifest xmlns="http://www.imsglobal.org/xsd/imscp_v1p1" xml:base="content/">
          <organizations default="ORG-ZIP-BASE">
            <organization identifier="ORG-ZIP-BASE">
              <item identifierref="RES-ZIP-BASE-BOOKLET">
                <title>ZIP Base Booklet</title>
                <item identifierref="RES-ZIP-BASE-UNIT">
                  <title>ZIP Base Unit</title>
                </item>
              </item>
            </organization>
          </organizations>
          <resources>
            <resource identifier="RES-ZIP-BASE-BOOKLET" xml:base="booklets/" href="zip-base-booklet.xml" />
            <resource identifier="RES-ZIP-BASE-UNIT" xml:base="items/" href="zip-base-unit.xml" />
          </resources>
        </manifest>
      `
    },
    {
      fileName: "export/content/items/zip-base-unit.xml",
      content: `
        <assessmentItem>
          <title>ZIP Base Unit Description</title>
          <itemBody>
            <p>Use xml base paths to find this unit.</p>
          </itemBody>
        </assessmentItem>
      `
    }
  ]);

  const sourcePackage = await requestJson<{
    sourcePackage: { sourcePackageId: string };
  }>(`/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/source-packages`, {
    method: "POST",
    body: {
      fileName: "testcenter-zip-xml-base-export.zip",
      mediaType: "application/zip",
      sourceDocument: `data:application/zip;base64,${zipPayload}`
    }
  });

  const importResult = await requestJson<{
    importJob: { status: string; diagnostics: Array<{ code: string }> };
    stagedContentRelease: { contentReleaseId: string } | null;
  }>(`/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/import-jobs`, {
    method: "POST",
    body: {
      sourcePackageId: sourcePackage.body.sourcePackage.sourcePackageId
    }
  });

  assert.equal(importResult.status, 201);
  assert.equal(importResult.body.importJob.status, "completed");
  assert.deepEqual(importResult.body.importJob.diagnostics, []);
  assert.ok(importResult.body.stagedContentRelease?.contentReleaseId);

  const contentRelease = await requestJson<{
    contentReleaseDetail: {
      contentRelease: {
        runtimeSnapshot: {
          bookletEntries: Array<{
            bookletKey: string;
            displayLabel: string;
            unitEntries: Array<{
              unitKey: string;
              displayLabel: string;
              description?: string;
              content?: string;
            }>;
          }>;
        };
      };
    };
  }>(
    `/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/content-releases/${importResult.body.stagedContentRelease.contentReleaseId}`
  );

  assert.equal(contentRelease.status, 200);
  assert.deepEqual(
    contentRelease.body.contentReleaseDetail.contentRelease.runtimeSnapshot,
    {
      bookletEntries: [
        {
          bookletKey: "content/booklets/zip-base-booklet.xml",
          displayLabel: "ZIP Base Booklet",
          unitEntries: [
            {
              unitKey: "content/items/zip-base-unit.xml",
              displayLabel: "ZIP Base Unit",
              description: "ZIP Base Unit Description",
              content: "Use xml base paths to find this unit."
            }
          ]
        }
      ]
    }
  );
});

test("source document import enriches ZIP units from nested IMS dependency files", async () => {
  const tenantKey = "integration-tenant-zip-dependency-content";
  const workspaceKey = "integration-workspace-zip-dependency-content";

  await requestJson("/api/v1/platform/tenants", {
    method: "POST",
    body: { tenantKey, displayName: tenantKey }
  });
  await requestJson(`/api/v1/tenants/${tenantKey}/workspaces`, {
    method: "POST",
    body: { workspaceKey, displayName: workspaceKey }
  });

  const zipPayload = createZipBase64([
    {
      fileName: "export/imsmanifest.xml",
      content: `
        <manifest xmlns="http://www.imsglobal.org/xsd/imscp_v1p1">
          <organizations default="ORG-ZIP-DEPENDENCY">
            <organization identifier="ORG-ZIP-DEPENDENCY">
              <item identifierref="RES-ZIP-DEPENDENCY-BOOKLET">
                <title>ZIP Dependency Booklet</title>
                <item identifierref="RES-ZIP-DEPENDENCY-UNIT">
                  <title>ZIP Dependency Unit</title>
                </item>
              </item>
            </organization>
          </organizations>
          <resources>
            <resource identifier="RES-ZIP-DEPENDENCY-BOOKLET" href="booklets/dependency-booklet.xml" />
            <resource identifier="RES-ZIP-DEPENDENCY-UNIT" href="units/dependency-wrapper.xml">
              <dependency identifierref="RES-ZIP-DEPENDENCY-SECTION" />
            </resource>
            <resource identifier="RES-ZIP-DEPENDENCY-SECTION" href="sections/dependency-section.xml">
              <dependency identifierref="RES-ZIP-DEPENDENCY-ITEM" />
            </resource>
            <resource identifier="RES-ZIP-DEPENDENCY-ITEM" href="items/dependency-item.xml" />
          </resources>
        </manifest>
      `
    },
    {
      fileName: "export/items/dependency-item.xml",
      content: `
        <assessmentItem>
          <title>Dependency Item Description</title>
          <itemBody>
            <p>Resolved from a dependent item file.</p>
          </itemBody>
        </assessmentItem>
      `
    }
  ]);

  const sourcePackage = await requestJson<{
    sourcePackage: { sourcePackageId: string };
  }>(`/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/source-packages`, {
    method: "POST",
    body: {
      fileName: "testcenter-zip-dependency-content-export.zip",
      mediaType: "application/zip",
      sourceDocument: `data:application/zip;base64,${zipPayload}`
    }
  });

  const importResult = await requestJson<{
    importJob: { status: string; diagnostics: Array<{ code: string }> };
    stagedContentRelease: { contentReleaseId: string } | null;
  }>(`/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/import-jobs`, {
    method: "POST",
    body: {
      sourcePackageId: sourcePackage.body.sourcePackage.sourcePackageId
    }
  });

  assert.equal(importResult.status, 201);
  assert.equal(importResult.body.importJob.status, "completed");
  assert.deepEqual(importResult.body.importJob.diagnostics, []);
  assert.ok(importResult.body.stagedContentRelease?.contentReleaseId);

  const contentRelease = await requestJson<{
    contentReleaseDetail: {
      contentRelease: {
        runtimeSnapshot: {
          bookletEntries: Array<{
            bookletKey: string;
            displayLabel: string;
            unitEntries: Array<{
              unitKey: string;
              displayLabel: string;
              description?: string;
              content?: string;
            }>;
          }>;
        };
      };
    };
  }>(
    `/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/content-releases/${importResult.body.stagedContentRelease.contentReleaseId}`
  );

  assert.equal(contentRelease.status, 200);
  assert.deepEqual(
    contentRelease.body.contentReleaseDetail.contentRelease.runtimeSnapshot,
    {
      bookletEntries: [
        {
          bookletKey: "booklets/dependency-booklet.xml",
          displayLabel: "ZIP Dependency Booklet",
          unitEntries: [
            {
              unitKey: "units/dependency-wrapper.xml",
              displayLabel: "ZIP Dependency Unit",
              description: "Dependency Item Description",
              content: "Resolved from a dependent item file."
            }
          ]
        }
      ]
    }
  );
});

test("source document import reports invalid ZIP source documents", async () => {
  const tenantKey = "integration-tenant-invalid-zip";
  const workspaceKey = "integration-workspace-invalid-zip";

  await requestJson("/api/v1/platform/tenants", {
    method: "POST",
    body: { tenantKey, displayName: tenantKey }
  });
  await requestJson(`/api/v1/tenants/${tenantKey}/workspaces`, {
    method: "POST",
    body: { workspaceKey, displayName: workspaceKey }
  });

  const sourcePackage = await requestJson<{
    sourcePackage: { sourcePackageId: string };
  }>(`/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/source-packages`, {
    method: "POST",
    body: {
      fileName: "broken-export.zip",
      mediaType: "application/zip",
      sourceDocument: "data:application/zip;base64,this-is-not-a-zip-package"
    }
  });

  const importResult = await requestJson<{
    importJob: { status: string; diagnostics: Array<{ code: string }> };
    stagedContentRelease: null;
  }>(`/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/import-jobs`, {
    method: "POST",
    body: {
      sourcePackageId: sourcePackage.body.sourcePackage.sourcePackageId
    }
  });

  assert.equal(importResult.status, 201);
  assert.equal(importResult.body.importJob.status, "failed");
  assert.equal(
    importResult.body.importJob.diagnostics[0]?.code,
    "source_document_zip_invalid"
  );
  assert.equal(importResult.body.stagedContentRelease, null);
});

test("source document import reports unreadable deflated ZIP manifest entries", async () => {
  const tenantKey = "integration-tenant-unreadable-zip-manifest";
  const workspaceKey = "integration-workspace-unreadable-zip-manifest";

  await requestJson("/api/v1/platform/tenants", {
    method: "POST",
    body: { tenantKey, displayName: tenantKey }
  });
  await requestJson(`/api/v1/tenants/${tenantKey}/workspaces`, {
    method: "POST",
    body: { workspaceKey, displayName: workspaceKey }
  });

  const zipPayload = createZipBase64([
    {
      fileName: "imsmanifest.xml",
      content: "<manifest />",
      compressionMethod: 8,
      compressedContent: Buffer.from("not raw deflate data", "utf8")
    }
  ]);

  const sourcePackage = await requestJson<{
    sourcePackage: { sourcePackageId: string };
  }>(`/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/source-packages`, {
    method: "POST",
    body: {
      fileName: "unreadable-manifest.zip",
      mediaType: "application/zip",
      sourceDocument: `data:application/zip;base64,${zipPayload}`
    }
  });

  const importResult = await requestJson<{
    importJob: { status: string; diagnostics: Array<{ code: string }> };
    stagedContentRelease: null;
  }>(`/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/import-jobs`, {
    method: "POST",
    body: {
      sourcePackageId: sourcePackage.body.sourcePackage.sourcePackageId
    }
  });

  assert.equal(importResult.status, 201);
  assert.equal(importResult.body.importJob.status, "failed");
  assert.equal(
    importResult.body.importJob.diagnostics[0]?.code,
    "source_document_zip_manifest_unreadable"
  );
  assert.equal(importResult.body.stagedContentRelease, null);
});

test("source document import bounds oversized deflated ZIP manifest entries", async () => {
  const tenantKey = "integration-tenant-oversized-zip-manifest";
  const workspaceKey = "integration-workspace-oversized-zip-manifest";

  await requestJson("/api/v1/platform/tenants", {
    method: "POST",
    body: { tenantKey, displayName: tenantKey }
  });
  await requestJson(`/api/v1/tenants/${tenantKey}/workspaces`, {
    method: "POST",
    body: { workspaceKey, displayName: workspaceKey }
  });

  const oversizedManifest = `<manifest>${"x".repeat(5 * 1024 * 1024 + 2)}</manifest>`;
  const zipPayload = createZipBase64([
    {
      fileName: "imsmanifest.xml",
      content: oversizedManifest,
      compressionMethod: 8,
      uncompressedSize: 1
    }
  ]);

  const sourcePackage = await requestJson<{
    sourcePackage: { sourcePackageId: string };
  }>(`/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/source-packages`, {
    method: "POST",
    body: {
      fileName: "oversized-manifest.zip",
      mediaType: "application/zip",
      sourceDocument: `data:application/zip;base64,${zipPayload}`
    }
  });

  const importResult = await requestJson<{
    importJob: { status: string; diagnostics: Array<{ code: string }> };
    stagedContentRelease: null;
  }>(`/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/import-jobs`, {
    method: "POST",
    body: {
      sourcePackageId: sourcePackage.body.sourcePackage.sourcePackageId
    }
  });

  assert.equal(importResult.status, 201);
  assert.equal(importResult.body.importJob.status, "failed");
  assert.equal(
    importResult.body.importJob.diagnostics[0]?.code,
    "source_document_zip_manifest_unreadable"
  );
  assert.equal(importResult.body.stagedContentRelease, null);
});

test("source document import resolves IMS resource dependencies", async () => {
  const tenantKey = "integration-tenant-ims-dependencies";
  const workspaceKey = "integration-workspace-ims-dependencies";

  await requestJson("/api/v1/platform/tenants", {
    method: "POST",
    body: { tenantKey, displayName: tenantKey }
  });
  await requestJson(`/api/v1/tenants/${tenantKey}/workspaces`, {
    method: "POST",
    body: { workspaceKey, displayName: workspaceKey }
  });

  const sourcePackage = await requestJson<{
    sourcePackage: { sourcePackageId: string };
  }>(`/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/source-packages`, {
    method: "POST",
    body: {
      fileName: "imsmanifest-dependencies.xml",
      mediaType: "application/xml",
      sourceDocument: `
        <manifest xmlns="http://www.imsglobal.org/xsd/imscp_v1p1">
          <resources>
            <resource identifier="RES-TEST" type="imsqti_test_xmlv2p1" href="tests/booklet-dep.xml" title="Dependency Booklet">
              <dependency identifierref="RES-ITEM-1" />
              <dependency identifierref="RES-ITEM-2" />
            </resource>
            <resource identifier="RES-ITEM-1" type="imsqti_item_xmlv2p1" href="items/item-one.xml" />
            <resource identifier="RES-ITEM-2" type="imsqti_item_xmlv2p1" title="Item Two">
              <file href="items/item-two.xml" />
            </resource>
          </resources>
        </manifest>
      `
    }
  });

  const importResult = await requestJson<{
    importJob: { status: string; diagnostics: Array<{ code: string }> };
    stagedContentRelease: { contentReleaseId: string } | null;
  }>(`/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/import-jobs`, {
    method: "POST",
    body: {
      sourcePackageId: sourcePackage.body.sourcePackage.sourcePackageId
    }
  });

  assert.equal(importResult.status, 201);
  assert.equal(importResult.body.importJob.status, "completed");
  assert.deepEqual(importResult.body.importJob.diagnostics, []);
  assert.ok(importResult.body.stagedContentRelease?.contentReleaseId);

  const contentRelease = await requestJson<{
    contentReleaseDetail: {
      contentRelease: {
        runtimeSnapshot: {
          bookletEntries: Array<{
            bookletKey: string;
            displayLabel: string;
            unitEntries: Array<{ unitKey: string; displayLabel: string }>;
          }>;
        };
      };
    };
  }>(
    `/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/content-releases/${importResult.body.stagedContentRelease.contentReleaseId}`
  );

  assert.equal(contentRelease.status, 200);
  assert.deepEqual(
    contentRelease.body.contentReleaseDetail.contentRelease.runtimeSnapshot,
    {
      bookletEntries: [
        {
          bookletKey: "tests/booklet-dep.xml",
          displayLabel: "Dependency Booklet",
          unitEntries: [
            {
              unitKey: "items/item-one.xml",
              displayLabel: "Resource items/item one.xml"
            },
            { unitKey: "items/item-two.xml", displayLabel: "Item Two" }
          ]
        }
      ]
    }
  );
});

test("source document import resolves XML resource dependency aliases", async () => {
  const tenantKey = "integration-tenant-xml-dependency-aliases";
  const workspaceKey = "integration-workspace-xml-dependency-aliases";

  await requestJson("/api/v1/platform/tenants", {
    method: "POST",
    body: { tenantKey, displayName: tenantKey }
  });
  await requestJson(`/api/v1/tenants/${tenantKey}/workspaces`, {
    method: "POST",
    body: { workspaceKey, displayName: workspaceKey }
  });

  const sourcePackage = await requestJson<{
    sourcePackage: { sourcePackageId: string };
  }>(`/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/source-packages`, {
    method: "POST",
    body: {
      fileName: "imsmanifest-alias-dependencies.xml",
      mediaType: "application/xml",
      sourceDocument: `
        <manifest xmlns="http://www.imsglobal.org/xsd/imscp_v1p1">
          <resources>
            <resource resourceId="RES-TEST" fileName="tests/alias-booklet.xml">
              <title>Alias Dependency Booklet</title>
              <dependency>
                <resourceIdentifier>RES-ITEM-1</resourceIdentifier>
              </dependency>
              <dependency id="RES-ITEM-2" />
            </resource>
            <resource resourceIdentifier="RES-ITEM-1" fileName="items/alias-item-one.xml" />
            <resource resourceId="RES-ITEM-2">
              <title>Alias Item Two</title>
              <file fileName="items/alias-item-two.xml" />
            </resource>
          </resources>
        </manifest>
      `
    }
  });

  const importResult = await requestJson<{
    importJob: { status: string; diagnostics: Array<{ code: string }> };
    stagedContentRelease: { contentReleaseId: string } | null;
  }>(`/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/import-jobs`, {
    method: "POST",
    body: {
      sourcePackageId: sourcePackage.body.sourcePackage.sourcePackageId
    }
  });

  assert.equal(importResult.status, 201);
  assert.equal(importResult.body.importJob.status, "completed");
  assert.deepEqual(importResult.body.importJob.diagnostics, []);
  assert.ok(importResult.body.stagedContentRelease?.contentReleaseId);

  const contentRelease = await requestJson<{
    contentReleaseDetail: {
      contentRelease: {
        runtimeSnapshot: {
          bookletEntries: Array<{
            bookletKey: string;
            displayLabel: string;
            unitEntries: Array<{ unitKey: string; displayLabel: string }>;
          }>;
        };
      };
    };
  }>(
    `/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/content-releases/${importResult.body.stagedContentRelease.contentReleaseId}`
  );

  assert.equal(contentRelease.status, 200);
  assert.deepEqual(
    contentRelease.body.contentReleaseDetail.contentRelease.runtimeSnapshot,
    {
      bookletEntries: [
        {
          bookletKey: "tests/alias-booklet.xml",
          displayLabel: "Alias Dependency Booklet",
          unitEntries: [
            {
              unitKey: "items/alias-item-one.xml",
              displayLabel: "Resource items/alias item one.xml"
            },
            {
              unitKey: "items/alias-item-two.xml",
              displayLabel: "Alias Item Two"
            }
          ]
        }
      ]
    }
  );
});

test("participant sign-in requires tenant key for ambiguous workspace keys", async () => {
  const workspaceKey = "integration-shared-workspace-key";
  const firstTenantKey = "integration-tenant-shared-workspace-a";
  const secondTenantKey = "integration-tenant-shared-workspace-b";

  await requestJson("/api/v1/platform/tenants", {
    method: "POST",
    body: { tenantKey: firstTenantKey, displayName: firstTenantKey }
  });
  await requestJson("/api/v1/platform/tenants", {
    method: "POST",
    body: { tenantKey: secondTenantKey, displayName: secondTenantKey }
  });
  await requestJson(`/api/v1/tenants/${firstTenantKey}/workspaces`, {
    method: "POST",
    body: { workspaceKey, displayName: "Shared A" }
  });
  await requestJson(`/api/v1/tenants/${secondTenantKey}/workspaces`, {
    method: "POST",
    body: { workspaceKey, displayName: "Shared B" }
  });

  const ambiguousSignIn = await requestJson<{
    error: string;
    details: {
      workspaceKey: string;
      matchingWorkspaceCount: number;
    };
  }>("/api/v1/participant/auth/sign-in", {
    method: "POST",
    body: {
      workspaceKey,
      loginKey: "ambiguous-student"
    }
  });

  assert.equal(ambiguousSignIn.status, 409);
  assert.equal(ambiguousSignIn.body.error, "participant_workspace_ambiguous");
  assert.equal(ambiguousSignIn.body.details.workspaceKey, workspaceKey);
  assert.equal(ambiguousSignIn.body.details.matchingWorkspaceCount, 2);

  const tenantScopedSignIn = await requestJson<{ error: string }>(
    "/api/v1/participant/auth/sign-in",
    {
      method: "POST",
      body: {
        tenantKey: secondTenantKey,
        workspaceKey,
        loginKey: "ambiguous-student"
      }
    }
  );

  assert.equal(tenantScopedSignIn.status, 409);
  assert.equal(
    tenantScopedSignIn.body.error,
    "workspace_has_no_active_content_release"
  );
});

test("participant sign-in reuses an open session for the active release", async () => {
  const tenantKey = "integration-tenant-session-reentry";
  const workspaceKey = "integration-workspace-session-reentry";

  await requestJson("/api/v1/platform/tenants", {
    method: "POST",
    body: { tenantKey, displayName: tenantKey }
  });
  await requestJson(`/api/v1/tenants/${tenantKey}/workspaces`, {
    method: "POST",
    body: { workspaceKey, displayName: workspaceKey }
  });

  const sourcePackage = await requestJson<{
    sourcePackage: { sourcePackageId: string };
  }>(`/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/source-packages`, {
    method: "POST",
    body: {
      fileName: "reentry.xml",
      mediaType: "application/xml",
      sourceDocument:
        "<assessment><booklet key=\"booklet:reentry\" label=\"Reentry\"><unit key=\"unit-reentry\" label=\"Reentry Unit\" /></booklet></assessment>"
    }
  });
  const importResult = await requestJson<{
    stagedContentRelease: { contentReleaseId: string };
  }>(`/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/import-jobs`, {
    method: "POST",
    body: {
      sourcePackageId: sourcePackage.body.sourcePackage.sourcePackageId
    }
  });

  await requestJson(
    `/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/content-releases/${importResult.body.stagedContentRelease.contentReleaseId}/activate`,
    {
      method: "POST",
      body: { activatedByActorId: "integration-test" }
    }
  );

  const blankSignIn = await requestJson<{ error: string }>(
    "/api/v1/participant/auth/sign-in",
    {
      method: "POST",
      body: {
        workspaceKey,
        loginKey: "   "
      }
    }
  );

  assert.equal(blankSignIn.status, 400);
  assert.equal(blankSignIn.body.error, "participant_login_key_required");

  const blankWorkspaceSignIn = await requestJson<{ error: string }>(
    "/api/v1/participant/auth/sign-in",
    {
      method: "POST",
      body: {
        workspaceKey: "   ",
        loginKey: "reentry-student"
      }
    }
  );

  assert.equal(blankWorkspaceSignIn.status, 400);
  assert.equal(
    blankWorkspaceSignIn.body.error,
    "participant_workspace_key_required"
  );

  const invalidTenantSignIn = await requestJson<{ error: string }>(
    "/api/v1/participant/auth/sign-in",
    {
      method: "POST",
      body: {
        tenantKey: 123,
        workspaceKey,
        loginKey: "reentry-student"
      }
    }
  );

  assert.equal(invalidTenantSignIn.status, 400);
  assert.equal(invalidTenantSignIn.body.error, "participant_tenant_key_invalid");

  const firstSignIn = await requestJson<{
    participantSession: {
      participantSessionId: string;
      tenantId: string;
      workspaceId: string;
      loginKey: string;
      groupKey: string;
      status: string;
    };
  }>("/api/v1/participant/auth/sign-in", {
    method: "POST",
    body: {
      tenantKey: ` ${tenantKey} `,
      workspaceKey: ` ${workspaceKey} `,
      loginKey: " reentry-student ",
      groupKey: " group:custom-reentry "
    }
  });
  const secondSignIn = await requestJson<{
    participantSession: { participantSessionId: string; status: string };
  }>("/api/v1/participant/auth/sign-in", {
    method: "POST",
    body: {
      tenantKey,
      workspaceKey,
      loginKey: "reentry-student",
      groupKey: "group:custom-reentry"
    }
  });

  assert.equal(secondSignIn.status, 200);
  assert.ok(firstSignIn.body.participantSession.tenantId);
  assert.ok(firstSignIn.body.participantSession.workspaceId);
  assert.equal(firstSignIn.body.participantSession.loginKey, "reentry-student");
  assert.equal(firstSignIn.body.participantSession.groupKey, "group:custom-reentry");
  assert.equal(
    secondSignIn.body.participantSession.participantSessionId,
    firstSignIn.body.participantSession.participantSessionId
  );
  assert.equal(secondSignIn.body.participantSession.status, "signed_in");

  await requestJson(
    `/api/v1/participant/sessions/${firstSignIn.body.participantSession.participantSessionId}/resume`,
    { method: "POST" }
  );

  const thirdSignIn = await requestJson<{
    participantSession: { participantSessionId: string; status: string };
  }>("/api/v1/participant/auth/sign-in", {
    method: "POST",
    body: {
      tenantKey,
      workspaceKey,
      loginKey: "reentry-student",
      groupKey: "group:custom-reentry"
    }
  });

  assert.equal(
    thirdSignIn.body.participantSession.participantSessionId,
    firstSignIn.body.participantSession.participantSessionId
  );
  assert.equal(thirdSignIn.body.participantSession.status, "launched");

  const participantSessions = await requestJson<{
    items: Array<{ participantSession: { loginKey: string; groupKey: string } }>;
  }>(
    `/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/participant-sessions`
  );

  assert.equal(participantSessions.status, 200);
  const reentrySession = participantSessions.body.items.find(
    item => item.participantSession.loginKey === "reentry-student"
  )?.participantSession;
  assert.equal(reentrySession?.groupKey, "group:custom-reentry");
  assert.equal(
    participantSessions.body.items.filter(
      item => item.participantSession.loginKey === "reentry-student"
    ).length,
    1
  );
});

test("participant launch rejects closed sessions after completion", async () => {
  const tenantKey = "integration-tenant-closed-launch";
  const workspaceKey = "integration-workspace-closed-launch";

  await requestJson("/api/v1/platform/tenants", {
    method: "POST",
    body: { tenantKey, displayName: tenantKey }
  });
  await requestJson(`/api/v1/tenants/${tenantKey}/workspaces`, {
    method: "POST",
    body: { workspaceKey, displayName: workspaceKey }
  });

  const sourcePackage = await requestJson<{
    sourcePackage: { sourcePackageId: string };
  }>(`/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/source-packages`, {
    method: "POST",
    body: {
      fileName: "closed-launch.xml",
      mediaType: "application/xml",
      sourceDocument:
        "<assessment><booklet key=\"booklet:closed\" label=\"Closed\"><unit key=\"unit-closed\" label=\"Closed Unit\" /></booklet></assessment>"
    }
  });
  const importResult = await requestJson<{
    stagedContentRelease: { contentReleaseId: string };
  }>(`/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/import-jobs`, {
    method: "POST",
    body: {
      sourcePackageId: sourcePackage.body.sourcePackage.sourcePackageId
    }
  });

  await requestJson(
    `/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/content-releases/${importResult.body.stagedContentRelease.contentReleaseId}/activate`,
    {
      method: "POST",
      body: { activatedByActorId: "integration-test" }
    }
  );

  const signIn = await requestJson<{
    participantSession: { participantSessionId: string };
  }>("/api/v1/participant/auth/sign-in", {
    method: "POST",
    body: {
      workspaceKey,
      loginKey: "closed-launch-student"
    }
  });
  const resumed = await requestJson<{
    testRun: { testRunId: string; status: string };
  }>(
    `/api/v1/participant/sessions/${signIn.body.participantSession.participantSessionId}/resume`,
    { method: "POST" }
  );

  assert.equal(resumed.status, 200);
  assert.equal(resumed.body.testRun.status, "running");

  const completed = await requestJson<{
    testRun: { testRunId: string; status: string };
  }>(`/api/v1/participant/test-runs/${resumed.body.testRun.testRunId}/complete`, {
    method: "POST"
  });

  assert.equal(completed.status, 200);
  assert.equal(completed.body.testRun.status, "completed");

  const directLaunch = await requestJson<{ error: string }>(
    "/api/v1/participant/starter:launch",
    {
      method: "POST",
      body: {
        participantSessionId:
          signIn.body.participantSession.participantSessionId
      }
    }
  );

  assert.equal(directLaunch.status, 409);
  assert.equal(directLaunch.body.error, "participant_session_closed");
});

test("workspace participant roster can be imported, updated, and listed", async () => {
  const tenantKey = "integration-tenant-roster";
  const workspaceKey = "integration-workspace-roster";

  await requestJson("/api/v1/platform/tenants", {
    method: "POST",
    body: { tenantKey, displayName: tenantKey }
  });
  await requestJson(`/api/v1/tenants/${tenantKey}/workspaces`, {
    method: "POST",
    body: { workspaceKey, displayName: workspaceKey }
  });

  const initialImport = await requestJson<{
    importedCount: number;
    updatedCount: number;
    items: Array<{
      participantRosterEntryId: string;
      loginKey: string;
      groupKey: string;
      bookletKey: string | null;
      bookletKeys?: string[];
      displayName: string | null;
      passwordRequired: boolean;
      validationWarnings: Array<{ code: string; message: string }>;
    }>;
  }>(`/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/participant-roster`, {
    method: "POST",
    body: {
      rosterText: [
        "loginKey,groupKey,bookletKey,displayName",
        "roster-a,group:alpha,booklet:starter,Ada Alpha",
        "roster-b,,booklet:starter,Ben Default",
        "# ignored comment"
      ].join("\n")
    }
  });

  assert.equal(initialImport.status, 201);
  assert.equal(initialImport.body.importedCount, 2);
  assert.equal(initialImport.body.updatedCount, 0);
  assert.equal(initialImport.body.items.length, 2);
  assert.equal(initialImport.body.items[0]?.loginKey, "roster-a");
  assert.equal(initialImport.body.items[0]?.passwordRequired, false);
  assert.equal(initialImport.body.items[1]?.groupKey, "group:roster-b");
  assert.equal(initialImport.body.items[1]?.displayName, "Ben Default");
  assert.deepEqual(
    initialImport.body.items[0]?.validationWarnings.map(warning => warning.code),
    ["active_content_release_missing"]
  );

  const aliasHeaderImport = await requestJson<typeof initialImport.body>(
    `/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/participant-roster`,
    {
      method: "POST",
      body: {
        rosterText: [
          "login,booklet,group,name,pw",
          "roster-alias-a,booklet:alias-a,group:alias-a,Ada Alias,alias-secret",
          "roster-alias-b\tbooklet:alias-b\tgroup:alias-b\tBen Alias"
        ].join("\n")
      }
    }
  );

  assert.equal(aliasHeaderImport.status, 201);
  assert.equal(aliasHeaderImport.body.importedCount, 2);
  assert.equal(aliasHeaderImport.body.updatedCount, 0);
  const aliasRosterA = aliasHeaderImport.body.items.find(
    item => item.loginKey === "roster-alias-a"
  );
  assert.equal(aliasRosterA?.groupKey, "group:alias-a");
  assert.equal(aliasRosterA?.bookletKey, "booklet:alias-a");
  assert.equal(aliasRosterA?.displayName, "Ada Alias");
  assert.equal(aliasRosterA?.passwordRequired, true);
  const aliasRosterB = aliasHeaderImport.body.items.find(
    item => item.loginKey === "roster-alias-b"
  );
  assert.equal(aliasRosterB?.groupKey, "group:alias-b");
  assert.equal(aliasRosterB?.bookletKey, "booklet:alias-b");
  assert.equal(aliasRosterB?.displayName, "Ben Alias");

  const rosterAEntryId = initialImport.body.items[0]?.participantRosterEntryId;
  const updateImport = await requestJson<typeof initialImport.body>(
    `/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/participant-roster`,
    {
      method: "POST",
      body: {
        rosterText: "roster-a;group:updated;booklet:updated;Ada Updated"
      }
    }
  );

  assert.equal(updateImport.status, 201);
  assert.equal(updateImport.body.importedCount, 0);
  assert.equal(updateImport.body.updatedCount, 1);
  assert.equal(updateImport.body.items.length, 4);
  const updatedRosterA = updateImport.body.items.find(
    item => item.loginKey === "roster-a"
  );
  assert.equal(updatedRosterA?.participantRosterEntryId, rosterAEntryId);
  assert.equal(updatedRosterA?.groupKey, "group:updated");
  assert.equal(updatedRosterA?.bookletKey, "booklet:updated");
  assert.equal(updatedRosterA?.displayName, "Ada Updated");
  assert.equal(updatedRosterA?.passwordRequired, false);
  assert.deepEqual(
    updatedRosterA?.validationWarnings.map(warning => warning.code),
    ["active_content_release_missing"]
  );

  const xmlImport = await requestJson<typeof initialImport.body>(
    `/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/participant-roster`,
    {
      method: "POST",
      body: {
        rosterText: [
          "<Testtakers>",
          "  <Testtaker login=\"roster-c\" group=\"group:xml\" booklet=\"booklet:xml\" name=\"Cara XML\" />",
          "  <participant>",
          "    <login>roster-d</login>",
          "    <group id=\"group:child\" />",
          "    <booklet ref=\"booklet:child\" />",
          "    <firstName>Drew</firstName>",
          "    <lastName>Child</lastName>",
          "  </participant>",
          "  <Group id=\"group:nested\">",
          "    <Booklet id=\"booklet:nested\">",
          "      <Testtaker login=\"roster-e\" name=\"Eve Nested\" />",
          "    </Booklet>",
          "  </Group>",
          "</Testtakers>"
        ].join("\n")
      }
    }
  );

  assert.equal(xmlImport.status, 201);
  assert.equal(xmlImport.body.importedCount, 3);
  assert.equal(xmlImport.body.updatedCount, 0);
  const xmlRosterC = xmlImport.body.items.find(item => item.loginKey === "roster-c");
  assert.equal(xmlRosterC?.groupKey, "group:xml");
  assert.equal(xmlRosterC?.bookletKey, "booklet:xml");
  assert.equal(xmlRosterC?.displayName, "Cara XML");
  const xmlRosterD = xmlImport.body.items.find(item => item.loginKey === "roster-d");
  assert.equal(xmlRosterD?.groupKey, "group:child");
  assert.equal(xmlRosterD?.bookletKey, "booklet:child");
  assert.equal(xmlRosterD?.displayName, "Drew Child");
  const xmlRosterE = xmlImport.body.items.find(item => item.loginKey === "roster-e");
  assert.equal(xmlRosterE?.groupKey, "group:nested");
  assert.equal(xmlRosterE?.bookletKey, "booklet:nested");
  assert.equal(xmlRosterE?.displayName, "Eve Nested");

  const testcenterLoginImport = await requestJson<typeof initialImport.body>(
    `/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/participant-roster`,
    {
      method: "POST",
      body: {
        rosterText: [
          "<Testtakers>",
          "  <Group id=\"sample_group\" label=\"Primary Sample Group\">",
          "    <Login mode=\"run-hot-return\" name=\"test\" pw=\"user123\">",
          "      <Booklet codes=\"xxx yyy\">BOOKLET.SAMPLE-1</Booklet>",
          "      <Booklet>BOOKLET.SAMPLE-2</Booklet>",
          "    </Login>",
          "    <Login mode=\"monitor-group\" name=\"test-group-monitor\" pw=\"user123\" />",
          "  </Group>",
          "</Testtakers>"
        ].join("\n")
      }
    }
  );

  assert.equal(testcenterLoginImport.status, 201);
  assert.equal(testcenterLoginImport.body.importedCount, 2);
  assert.equal(testcenterLoginImport.body.updatedCount, 0);
  const testcenterLogin = testcenterLoginImport.body.items.find(
    item => item.loginKey === "test"
  );
  assert.equal(testcenterLogin?.groupKey, "sample_group");
  assert.equal(testcenterLogin?.bookletKey, "BOOKLET.SAMPLE-1");
  assert.deepEqual(testcenterLogin?.bookletKeys, [
    "BOOKLET.SAMPLE-1",
    "BOOKLET.SAMPLE-2"
  ]);
  assert.equal(testcenterLogin?.displayName, null);
  assert.equal(testcenterLogin?.passwordRequired, true);
  const testcenterMonitorLogin = testcenterLoginImport.body.items.find(
    item => item.loginKey === "test-group-monitor"
  );
  assert.equal(testcenterMonitorLogin?.groupKey, "sample_group");
  assert.equal(testcenterMonitorLogin?.bookletKey, null);

  const jsonImport = await requestJson<typeof initialImport.body>(
    `/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/participant-roster`,
    {
      method: "POST",
      body: {
        rosterText: JSON.stringify({
          groups: [
            {
              groupKey: "group:json",
              booklets: [
                {
                  bookletKey: "booklet:json",
                  participants: [
                    { loginKey: "roster-f", displayName: "Faye JSON" },
                    {
                      login: "roster-g",
                      booklet: { id: "booklet:json-override" },
                      firstName: "Gus",
                      lastName: "JSON"
                    }
                  ]
                }
              ]
            }
          ]
        })
      }
    }
  );

  assert.equal(jsonImport.status, 201);
  assert.equal(jsonImport.body.importedCount, 2);
  assert.equal(jsonImport.body.updatedCount, 0);
  const jsonRosterF = jsonImport.body.items.find(item => item.loginKey === "roster-f");
  assert.equal(jsonRosterF?.groupKey, "group:json");
  assert.equal(jsonRosterF?.bookletKey, "booklet:json");
  assert.equal(jsonRosterF?.displayName, "Faye JSON");
  const jsonRosterG = jsonImport.body.items.find(item => item.loginKey === "roster-g");
  assert.equal(jsonRosterG?.groupKey, "group:json");
  assert.equal(jsonRosterG?.bookletKey, "booklet:json-override");
  assert.equal(jsonRosterG?.displayName, "Gus JSON");

  const nativeJsonImport = await requestJson<typeof initialImport.body>(
    `/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/participant-roster`,
    {
      method: "POST",
      body: {
        rosterText: {
          groups: [
            {
              id: "group:native-json",
              booklets: [
                {
                  id: "booklet:native-json",
                  participants: [
                    { loginKey: "roster-h", displayName: "Hana Native" },
                    {
                      username: "roster-i",
                      firstName: "Ivan",
                      lastName: "Native"
                    }
                  ]
                }
              ]
            }
          ]
        }
      }
    }
  );

  assert.equal(nativeJsonImport.status, 201);
  assert.equal(nativeJsonImport.body.importedCount, 2);
  assert.equal(nativeJsonImport.body.updatedCount, 0);
  const nativeJsonRosterH = nativeJsonImport.body.items.find(
    item => item.loginKey === "roster-h"
  );
  assert.equal(nativeJsonRosterH?.groupKey, "group:native-json");
  assert.equal(nativeJsonRosterH?.bookletKey, "booklet:native-json");
  assert.equal(nativeJsonRosterH?.displayName, "Hana Native");
  const nativeJsonRosterI = nativeJsonImport.body.items.find(
    item => item.loginKey === "roster-i"
  );
  assert.equal(nativeJsonRosterI?.groupKey, "group:native-json");
  assert.equal(nativeJsonRosterI?.bookletKey, "booklet:native-json");
  assert.equal(nativeJsonRosterI?.displayName, "Ivan Native");

  const invalidRosterImport = await requestJson<{
    error: string;
    message: string;
  }>(
    `/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/participant-roster`,
    {
      method: "POST",
      body: {
        rosterText: true
      }
    }
  );

  assert.equal(invalidRosterImport.status, 400);
  assert.equal(
    invalidRosterImport.body.error,
    "participant_roster_request_invalid"
  );

  const listedRoster = await requestJson<typeof initialImport.body>(
    `/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/participant-roster`
  );

  assert.equal(listedRoster.status, 200);
  assert.equal(listedRoster.body.items.length, 13);
  assert.deepEqual(
    listedRoster.body.items.map(item => item.loginKey),
    [
      "roster-a",
      "roster-alias-a",
      "roster-alias-b",
      "roster-b",
      "roster-c",
      "roster-d",
      "roster-e",
      "roster-f",
      "roster-g",
      "roster-h",
      "roster-i",
      "test",
      "test-group-monitor"
    ]
  );

  const rosterCsv = await fetch(
    `${baseUrl}/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/exports/participant-roster.csv`
  );
  assert.equal(rosterCsv.status, 200);
  assert.equal(
    rosterCsv.headers.get("content-type"),
    "text/csv; charset=utf-8"
  );
  const rosterCsvText = await rosterCsv.text();
  assert.match(
    rosterCsvText,
    /^tenantKey,workspaceKey,participantRosterEntryId,loginKey,groupKey,bookletKey,displayName,passwordRequired,importedAt,validationWarningCodes,validationWarningMessages,bookletKeys\n/
  );
  assert.match(
    rosterCsvText,
    /"integration-tenant-roster","integration-workspace-roster","[^"]+","roster-a","group:updated","booklet:updated","Ada Updated","false","[^"]+","active_content_release_missing","Booklet assignment cannot be validated because the workspace has no active content release\."/
  );
  assert.match(
    rosterCsvText,
    /"integration-tenant-roster","integration-workspace-roster","[^"]+","roster-alias-a","group:alias-a","booklet:alias-a","Ada Alias","true"/
  );
  assert.match(
    rosterCsvText,
    /"integration-tenant-roster","integration-workspace-roster","[^"]+","roster-c","group:xml","booklet:xml","Cara XML"/
  );
  assert.match(
    rosterCsvText,
    /"integration-tenant-roster","integration-workspace-roster","[^"]+","roster-e","group:nested","booklet:nested","Eve Nested"/
  );
  assert.match(
    rosterCsvText,
    /"integration-tenant-roster","integration-workspace-roster","[^"]+","test","sample_group","BOOKLET\.SAMPLE-1",""/
  );
  assert.match(
    rosterCsvText,
    /"integration-tenant-roster","integration-workspace-roster","[^"]+","test-group-monitor","sample_group","",""/
  );
  assert.match(
    rosterCsvText,
    /"integration-tenant-roster","integration-workspace-roster","[^"]+","roster-f","group:json","booklet:json","Faye JSON"/
  );
  assert.match(
    rosterCsvText,
    /"integration-tenant-roster","integration-workspace-roster","[^"]+","roster-g","group:json","booklet:json-override","Gus JSON"/
  );
  assert.match(
    rosterCsvText,
    /"integration-tenant-roster","integration-workspace-roster","[^"]+","roster-h","group:native-json","booklet:native-json","Hana Native"/
  );
  assert.match(
    rosterCsvText,
    /"integration-tenant-roster","integration-workspace-roster","[^"]+","roster-i","group:native-json","booklet:native-json","Ivan Native"/
  );

  const metricsResponse = await requestJson<{
    requestCountsByRoute: Record<string, number>;
  }>("/metrics");
  assert.equal(metricsResponse.status, 200);
  assert.ok(
    metricsResponse.body.requestCountsByRoute[
      "POST /api/v1/tenants/:tenantKey/workspaces/:workspaceKey/participant-roster"
    ] >= 1
  );
  assert.ok(
    metricsResponse.body.requestCountsByRoute[
      "GET /api/v1/tenants/:tenantKey/workspaces/:workspaceKey/participant-roster"
    ] >= 1
  );
  assert.ok(
    metricsResponse.body.requestCountsByRoute[
      "GET /api/v1/tenants/:tenantKey/workspaces/:workspaceKey/exports/participant-roster.csv"
    ] >= 1
  );

  const activityEvents = await requestJson<{
    items: Array<{ activityEvent: { eventType: string; details: unknown } }>;
  }>(
    `/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/activity-events?eventType=participant_roster_imported`
  );
  assert.equal(activityEvents.status, 200);
  assert.equal(activityEvents.body.items.length, 7);
});

test("participant runtime uses saved roster defaults for group and booklet", async () => {
  const tenantKey = "integration-tenant-roster-runtime";
  const workspaceKey = "integration-workspace-roster-runtime";

  await requestJson("/api/v1/platform/tenants", {
    method: "POST",
    body: { tenantKey, displayName: tenantKey }
  });
  await requestJson(`/api/v1/tenants/${tenantKey}/workspaces`, {
    method: "POST",
    body: { workspaceKey, displayName: workspaceKey }
  });

  const sourcePackage = await requestJson<{
    sourcePackage: { sourcePackageId: string };
  }>(`/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/source-packages`, {
    method: "POST",
    body: {
      fileName: "roster-runtime.json",
      mediaType: "application/json",
      contentStructure: {
        bookletEntries: [
          {
            bookletKey: "booklet:alpha",
            displayLabel: "Alpha Booklet",
            unitEntries: [{ unitKey: "unit-alpha-1", displayLabel: "Alpha 1" }]
          },
          {
            bookletKey: "booklet:beta",
            displayLabel: "Beta Booklet",
            unitEntries: [{ unitKey: "unit-beta-1", displayLabel: "Beta 1" }]
          }
        ]
      }
    }
  });
  const importResult = await requestJson<{
    stagedContentRelease: { contentReleaseId: string };
  }>(`/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/import-jobs`, {
    method: "POST",
    body: {
      sourcePackageId: sourcePackage.body.sourcePackage.sourcePackageId
    }
  });

  await requestJson(
    `/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/content-releases/${importResult.body.stagedContentRelease.contentReleaseId}/activate`,
    {
      method: "POST",
      body: { activatedByActorId: "integration-test" }
    }
  );

  const validRosterImport = await requestJson<{
    items: Array<{
      loginKey: string;
      validationWarnings: Array<{ code: string; message: string }>;
    }>;
  }>(
    `/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/participant-roster`,
    {
      method: "POST",
      body: {
        rosterText: [
          "roster-runtime-student,group:roster-runtime,booklet:beta,Roster Runtime",
          "roster-runtime-invalid,group:roster-runtime,booklet:missing,Invalid Booklet"
        ].join("\n")
      }
    }
  );
  assert.deepEqual(
    validRosterImport.body.items.find(
      item => item.loginKey === "roster-runtime-student"
    )?.validationWarnings,
    []
  );
  assert.deepEqual(
    validRosterImport.body.items
      .find(item => item.loginKey === "roster-runtime-invalid")
      ?.validationWarnings.map(warning => warning.code),
    ["booklet_not_found_in_active_release"]
  );

  const rosterMonitorSummary = await requestJson<{
    studyMonitorSummary: {
      bookletProgress: Array<{
        bookletKey: string;
        displayLabel: string;
        rosterEntryCount: number;
        expectedParticipantCount: number;
        notStartedCount: number;
        unitCount: number;
      }>;
      unitProgress: Array<{
        unitKey: string;
        rosterExpectedCount: number;
        expectedRunCount: number;
        responseCount: number;
        missingResponseCount: number;
      }>;
    };
  }>(
    `/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/study-monitor/summary`
  );
  const betaBookletProgress =
    rosterMonitorSummary.body.studyMonitorSummary.bookletProgress.find(
      booklet => booklet.bookletKey === "booklet:beta"
    );
  assert.equal(betaBookletProgress?.displayLabel, "Beta Booklet");
  assert.equal(betaBookletProgress?.rosterEntryCount, 1);
  assert.equal(betaBookletProgress?.expectedParticipantCount, 1);
  assert.equal(betaBookletProgress?.notStartedCount, 1);
  assert.equal(betaBookletProgress?.unitCount, 1);
  const betaUnitProgress =
    rosterMonitorSummary.body.studyMonitorSummary.unitProgress.find(
      unit => unit.unitKey === "unit-beta-1"
    );
  assert.equal(betaUnitProgress?.rosterExpectedCount, 1);
  assert.equal(betaUnitProgress?.expectedRunCount, 1);
  assert.equal(betaUnitProgress?.responseCount, 0);
  assert.equal(betaUnitProgress?.missingResponseCount, 1);

  const rosterUnitDetail = await requestJson<{
    studyMonitorUnit: {
      rosterExpectedCount: number;
      expectedRunCount: number;
      responseCount: number;
      missingResponseCount: number;
      rosterEntries: Array<{ loginKey: string; displayName: string | null }>;
    };
  }>(
    `/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/study-monitor/units/unit-beta-1`
  );
  assert.equal(rosterUnitDetail.status, 200);
  assert.equal(rosterUnitDetail.body.studyMonitorUnit.rosterExpectedCount, 1);
  assert.equal(rosterUnitDetail.body.studyMonitorUnit.expectedRunCount, 1);
  assert.equal(rosterUnitDetail.body.studyMonitorUnit.responseCount, 0);
  assert.equal(rosterUnitDetail.body.studyMonitorUnit.missingResponseCount, 1);
  assert.equal(
    rosterUnitDetail.body.studyMonitorUnit.rosterEntries[0]?.loginKey,
    "roster-runtime-student"
  );

  const signIn = await requestJson<{
    participantSession: {
      participantSessionId: string;
      loginKey: string;
      groupKey: string;
    };
  }>("/api/v1/participant/auth/sign-in", {
    method: "POST",
    body: {
      workspaceKey,
      loginKey: "roster-runtime-student"
    }
  });

  assert.equal(signIn.status, 200);
  assert.equal(signIn.body.participantSession.groupKey, "group:roster-runtime");

  const resumed = await requestJson<{
    testRun: {
      testRunId: string;
      bookletKey: string;
      currentUnitKey: string | null;
    };
  }>(
    `/api/v1/participant/sessions/${signIn.body.participantSession.participantSessionId}/resume`,
    {
      method: "POST",
      body: {}
    }
  );

  assert.equal(resumed.status, 200);
  assert.equal(resumed.body.testRun.bookletKey, "booklet:beta");
  assert.equal(resumed.body.testRun.currentUnitKey, "unit-beta-1");

  const rosterGroupDetailAfterResume = await requestJson<{
    studyMonitorGroup: {
      sessions: Array<{
        participantRosterEntry: { displayName: string | null } | null;
      }>;
      testRuns: Array<{
        participantRosterEntry: { displayName: string | null } | null;
      }>;
    };
  }>(
    `/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/study-monitor/groups/group%3Aroster-runtime`
  );
  assert.equal(rosterGroupDetailAfterResume.status, 200);
  assert.equal(
    rosterGroupDetailAfterResume.body.studyMonitorGroup.sessions[0]
      ?.participantRosterEntry?.displayName,
    "Roster Runtime"
  );
  assert.equal(
    rosterGroupDetailAfterResume.body.studyMonitorGroup.testRuns[0]
      ?.participantRosterEntry?.displayName,
    "Roster Runtime"
  );

  const rosterBookletDetailAfterResume = await requestJson<{
    studyMonitorBooklet: {
      testRuns: Array<{
        participantRosterEntry: { displayName: string | null } | null;
      }>;
    };
  }>(
    `/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/study-monitor/booklets/booklet%3Abeta`
  );
  assert.equal(rosterBookletDetailAfterResume.status, 200);
  assert.equal(
    rosterBookletDetailAfterResume.body.studyMonitorBooklet.testRuns[0]
      ?.participantRosterEntry?.displayName,
    "Roster Runtime"
  );

  const rosterUnitDetailAfterResume = await requestJson<{
    studyMonitorUnit: {
      testRuns: Array<{
        participantRosterEntry: { displayName: string | null } | null;
      }>;
    };
  }>(
    `/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/study-monitor/units/unit-beta-1`
  );
  assert.equal(rosterUnitDetailAfterResume.status, 200);
  assert.equal(
    rosterUnitDetailAfterResume.body.studyMonitorUnit.testRuns[0]
      ?.participantRosterEntry?.displayName,
    "Roster Runtime"
  );

  const participantSessions = await requestJson<{
    items: Array<{
      participantSession: { participantSessionId: string; loginKey: string };
      participantRosterEntry: {
        loginKey: string;
        displayName: string | null;
        bookletKey: string | null;
      } | null;
    }>;
  }>(
    `/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/participant-sessions?loginKey=roster-runtime-student`
  );
  assert.equal(participantSessions.status, 200);
  assert.equal(participantSessions.body.items.length, 1);
  assert.equal(
    participantSessions.body.items[0]?.participantRosterEntry?.displayName,
    "Roster Runtime"
  );
  assert.equal(
    participantSessions.body.items[0]?.participantRosterEntry?.bookletKey,
    "booklet:beta"
  );

  const participantSessionDetail = await requestJson<{
    participantSessionDetail: {
      participantRosterEntry: {
        loginKey: string;
        displayName: string | null;
        bookletKey: string | null;
      } | null;
    };
  }>(
    `/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/participant-sessions/${signIn.body.participantSession.participantSessionId}`
  );
  assert.equal(participantSessionDetail.status, 200);
  assert.equal(
    participantSessionDetail.body.participantSessionDetail.participantRosterEntry
      ?.displayName,
    "Roster Runtime"
  );

  const contentReleaseDetail = await requestJson<{
    contentReleaseDetail: {
      participantRosterEntries: Array<{
        loginKey: string;
        displayName: string | null;
        bookletKey: string | null;
      }>;
      participantSessions: Array<{ loginKey: string; participantSessionId: string }>;
      testRuns: Array<{ testRunId: string; participantSessionId: string }>;
    };
  }>(
    `/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/content-releases/${importResult.body.stagedContentRelease.contentReleaseId}`
  );
  assert.equal(contentReleaseDetail.status, 200);
  assert.equal(
    contentReleaseDetail.body.contentReleaseDetail.participantRosterEntries.find(
      entry => entry.loginKey === "roster-runtime-student"
    )?.displayName,
    "Roster Runtime"
  );
  assert.equal(
    contentReleaseDetail.body.contentReleaseDetail.participantSessions[0]?.loginKey,
    "roster-runtime-student"
  );
  assert.equal(
    contentReleaseDetail.body.contentReleaseDetail.testRuns[0]?.testRunId,
    resumed.body.testRun.testRunId
  );

  const saved = await requestJson<{
    testRun: { unitResponses: Record<string, string> };
  }>(`/api/v1/participant/test-runs/${resumed.body.testRun.testRunId}/save-progress`, {
    method: "POST",
    body: {
      currentUnitKey: "unit-beta-1",
      status: "paused",
      unitResponse: "Roster response"
    }
  });
  assert.equal(saved.status, 200);
  assert.equal(saved.body.testRun.unitResponses["unit-beta-1"], "Roster response");

  const detailedResponses = await requestJson<{
    items: Array<{
      participantRosterEntry: {
        loginKey: string;
        displayName: string | null;
        bookletKey: string | null;
      } | null;
      loginKey: string;
      unitKey: string;
      response: string;
    }>;
  }>(
    `/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/responses/detailed?loginKey=roster-runtime-student&bookletKey=booklet%3Abeta&testRunId=${resumed.body.testRun.testRunId}&unitKey=unit-beta-1&limit=1`
  );
  assert.equal(detailedResponses.status, 200);
  assert.equal(detailedResponses.body.items.length, 1);
  assert.equal(detailedResponses.body.items[0]?.response, "Roster response");
  assert.equal(
    detailedResponses.body.items[0]?.participantRosterEntry?.displayName,
    "Roster Runtime"
  );

  const responseCsv = await requestText(
    `/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/exports/responses.csv?loginKey=roster-runtime-student&bookletKey=booklet%3Abeta&testRunId=${resumed.body.testRun.testRunId}&unitKey=unit-beta-1&limit=1`
  );
  assert.equal(responseCsv.status, 200);
  assert.equal(responseCsv.contentType, "text/csv; charset=utf-8");
  assert.match(
    responseCsv.body,
    /^tenantKey,workspaceKey,loginKey,groupKey,participantSessionId,testRunId,bookletKey,unitKey,response,status,updatedAt,completedAt,participantDisplayName,rosterGroupKey,rosterBookletKey\n/
  );
  assert.match(
    responseCsv.body,
    /"Roster response".*"Roster Runtime","group:roster-runtime","booklet:beta"/
  );

  const createdReview = await requestJson<{
    item: {
      participantRosterEntry: {
        loginKey: string;
        displayName: string | null;
        bookletKey: string | null;
      } | null;
      review: { reviewId: string; category: string };
    };
  }>(`/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/reviews`, {
    method: "POST",
    body: {
      participantSessionId: signIn.body.participantSession.participantSessionId,
      testRunId: resumed.body.testRun.testRunId,
      unitKey: "unit-beta-1",
      reviewerId: "integration-reviewer",
      category: "roster-note",
      comment: "Roster review"
    }
  });
  assert.equal(createdReview.status, 201);
  assert.equal(
    createdReview.body.item.participantRosterEntry?.displayName,
    "Roster Runtime"
  );

  const reviews = await requestJson<{
    items: Array<{
      participantRosterEntry: {
        loginKey: string;
        displayName: string | null;
        bookletKey: string | null;
      } | null;
      review: { reviewId: string; category: string };
    }>;
  }>(
    `/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/reviews?loginKey=roster-runtime-student&bookletKey=booklet%3Abeta&testRunId=${resumed.body.testRun.testRunId}&category=roster-note&limit=1`
  );
  assert.equal(reviews.status, 200);
  assert.equal(reviews.body.items.length, 1);
  assert.equal(
    reviews.body.items[0]?.review.reviewId,
    createdReview.body.item.review.reviewId
  );
  assert.equal(
    reviews.body.items[0]?.participantRosterEntry?.displayName,
    "Roster Runtime"
  );

  const reviewCsv = await requestText(
    `/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/exports/reviews.csv?loginKey=roster-runtime-student&bookletKey=booklet%3Abeta&testRunId=${resumed.body.testRun.testRunId}&category=roster-note&limit=1`
  );
  assert.equal(reviewCsv.status, 200);
  assert.equal(reviewCsv.contentType, "text/csv; charset=utf-8");
  assert.match(
    reviewCsv.body,
    /^tenantKey,workspaceKey,reviewId,loginKey,groupKey,participantSessionId,testRunId,bookletKey,unitKey,reviewerId,category,comment,createdAt,updatedAt,participantDisplayName,rosterGroupKey,rosterBookletKey\n/
  );
  assert.match(
    reviewCsv.body,
    /"Roster review".*"Roster Runtime","group:roster-runtime","booklet:beta"/
  );
});

test("study monitor counts saved roster participants before sign-in", async () => {
  const tenantKey = "integration-tenant-roster-monitor";
  const workspaceKey = "integration-workspace-roster-monitor";

  await requestJson("/api/v1/platform/tenants", {
    method: "POST",
    body: { tenantKey, displayName: tenantKey }
  });
  await requestJson(`/api/v1/tenants/${tenantKey}/workspaces`, {
    method: "POST",
    body: { workspaceKey, displayName: workspaceKey }
  });

  await requestJson(
    `/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/participant-roster`,
    {
      method: "POST",
      body: {
        rosterText: [
          "monitor-a,group:monitor-alpha,booklet:starter,Monitor Alpha",
          "monitor-b,group:monitor-beta,booklet:starter,Monitor Beta"
        ].join("\n")
      }
    }
  );

  const summary = await requestJson<{
    studyMonitorSummary: {
      expectedParticipantCount: number;
      rosterEntryCount: number;
      participantSessionCount: number;
      notStartedCount: number;
      notStartedParticipants: Array<{
        loginKey: string;
        groupKey: string;
        bookletKey: string | null;
        displayName: string | null;
      }>;
      groups: Array<{
        groupKey: string;
        expectedParticipantCount: number;
        rosterEntryCount: number;
        participantSessionCount: number;
        notStartedCount: number;
      }>;
      bookletProgress: Array<{
        bookletKey: string;
        expectedParticipantCount: number;
        rosterEntryCount: number;
        participantSessionCount: number;
        testRunCount: number;
        notStartedCount: number;
      }>;
    };
  }>(
    `/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/study-monitor/summary`
  );

  assert.equal(summary.status, 200);
  assert.equal(summary.body.studyMonitorSummary.expectedParticipantCount, 2);
  assert.equal(summary.body.studyMonitorSummary.rosterEntryCount, 2);
  assert.equal(summary.body.studyMonitorSummary.participantSessionCount, 0);
  assert.equal(summary.body.studyMonitorSummary.notStartedCount, 2);
  assert.deepEqual(
    summary.body.studyMonitorSummary.notStartedParticipants.map(entry => ({
      loginKey: entry.loginKey,
      groupKey: entry.groupKey,
      bookletKey: entry.bookletKey,
      displayName: entry.displayName
    })),
    [
      {
        loginKey: "monitor-a",
        groupKey: "group:monitor-alpha",
        bookletKey: "booklet:starter",
        displayName: "Monitor Alpha"
      },
      {
        loginKey: "monitor-b",
        groupKey: "group:monitor-beta",
        bookletKey: "booklet:starter",
        displayName: "Monitor Beta"
      }
    ]
  );
  assert.deepEqual(
    summary.body.studyMonitorSummary.groups.map(group => ({
      groupKey: group.groupKey,
      expectedParticipantCount: group.expectedParticipantCount,
      rosterEntryCount: group.rosterEntryCount,
      participantSessionCount: group.participantSessionCount,
      notStartedCount: group.notStartedCount
    })),
    [
      {
        groupKey: "group:monitor-alpha",
        expectedParticipantCount: 1,
        rosterEntryCount: 1,
        participantSessionCount: 0,
        notStartedCount: 1
      },
      {
        groupKey: "group:monitor-beta",
        expectedParticipantCount: 1,
        rosterEntryCount: 1,
        participantSessionCount: 0,
        notStartedCount: 1
      }
    ]
  );
  assert.deepEqual(
    summary.body.studyMonitorSummary.bookletProgress.map(booklet => ({
      bookletKey: booklet.bookletKey,
      expectedParticipantCount: booklet.expectedParticipantCount,
      rosterEntryCount: booklet.rosterEntryCount,
      participantSessionCount: booklet.participantSessionCount,
      testRunCount: booklet.testRunCount,
      notStartedCount: booklet.notStartedCount
    })),
    [
      {
        bookletKey: "booklet:starter",
        expectedParticipantCount: 2,
        rosterEntryCount: 2,
        participantSessionCount: 0,
        testRunCount: 0,
        notStartedCount: 2
      }
    ]
  );

  const groupDetail = await requestJson<{
    studyMonitorGroup: {
      expectedParticipantCount: number;
      rosterEntryCount: number;
      participantSessionCount: number;
      notStartedCount: number;
      rosterEntries: Array<{ loginKey: string; displayName: string | null }>;
    };
  }>(
    `/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/study-monitor/groups/group%3Amonitor-alpha`
  );

  assert.equal(groupDetail.status, 200);
  assert.equal(groupDetail.body.studyMonitorGroup.expectedParticipantCount, 1);
  assert.equal(groupDetail.body.studyMonitorGroup.rosterEntryCount, 1);
  assert.equal(groupDetail.body.studyMonitorGroup.participantSessionCount, 0);
  assert.equal(groupDetail.body.studyMonitorGroup.notStartedCount, 1);
  assert.equal(
    groupDetail.body.studyMonitorGroup.rosterEntries[0]?.loginKey,
    "monitor-a"
  );

  const bookletDetail = await requestJson<{
    studyMonitorBooklet: {
      expectedParticipantCount: number;
      rosterEntryCount: number;
      participantSessionCount: number;
      testRunCount: number;
      notStartedCount: number;
      rosterEntries: Array<{ loginKey: string; displayName: string | null }>;
    };
  }>(
    `/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/study-monitor/booklets/booklet%3Astarter`
  );

  assert.equal(bookletDetail.status, 200);
  assert.equal(bookletDetail.body.studyMonitorBooklet.expectedParticipantCount, 2);
  assert.equal(bookletDetail.body.studyMonitorBooklet.rosterEntryCount, 2);
  assert.equal(bookletDetail.body.studyMonitorBooklet.participantSessionCount, 0);
  assert.equal(bookletDetail.body.studyMonitorBooklet.testRunCount, 0);
  assert.equal(bookletDetail.body.studyMonitorBooklet.notStartedCount, 2);
  assert.deepEqual(
    bookletDetail.body.studyMonitorBooklet.rosterEntries.map(entry => ({
      loginKey: entry.loginKey,
      displayName: entry.displayName
    })),
    [
      { loginKey: "monitor-a", displayName: "Monitor Alpha" },
      { loginKey: "monitor-b", displayName: "Monitor Beta" }
    ]
  );
});

test("participant session launch can target a specific booklet", async () => {
  const tenantKey = "integration-tenant-booklet-launch";
  const workspaceKey = "integration-workspace-booklet-launch";

  await requestJson("/api/v1/platform/tenants", {
    method: "POST",
    body: { tenantKey, displayName: tenantKey }
  });
  await requestJson(`/api/v1/tenants/${tenantKey}/workspaces`, {
    method: "POST",
    body: { workspaceKey, displayName: workspaceKey }
  });

  const sourcePackage = await requestJson<{
    sourcePackage: { sourcePackageId: string };
  }>(`/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/source-packages`, {
    method: "POST",
    body: {
      fileName: "booklet-launch.json",
      mediaType: "application/json",
      contentStructure: {
        bookletEntries: [
          {
            bookletKey: "booklet:alpha",
            displayLabel: "Alpha Booklet",
            unitEntries: [{ unitKey: "unit-alpha-1", displayLabel: "Alpha 1" }]
          },
          {
            bookletKey: "booklet:beta",
            displayLabel: "Beta Booklet",
            unitEntries: [
              { unitKey: "unit-beta-1", displayLabel: "Beta 1" },
              { unitKey: "unit-beta-2", displayLabel: "Beta 2" }
            ]
          }
        ]
      }
    }
  });
  const importResult = await requestJson<{
    stagedContentRelease: { contentReleaseId: string };
  }>(`/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/import-jobs`, {
    method: "POST",
    body: {
      sourcePackageId: sourcePackage.body.sourcePackage.sourcePackageId
    }
  });

  await requestJson(
    `/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/content-releases/${importResult.body.stagedContentRelease.contentReleaseId}/activate`,
    {
      method: "POST",
      body: { activatedByActorId: "integration-test" }
    }
  );

  const multiBookletRoster = await requestJson<{
    items: Array<{
      loginKey: string;
      bookletKey: string | null;
      bookletKeys?: string[];
      validationWarnings: Array<{ code: string }>;
    }>;
  }>(
    `/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/participant-roster`,
    {
      method: "POST",
      body: {
        rosterText: [
          "<Testtakers>",
          "  <Group id=\"group:booklet-launch\">",
          "    <Login mode=\"run-hot-return\" name=\"booklet-launch-student\">",
          "      <Booklet>booklet:beta</Booklet>",
          "      <Booklet>booklet:alpha</Booklet>",
          "    </Login>",
          "  </Group>",
          "</Testtakers>"
        ].join("\n")
      }
    }
  );
  const multiBookletEntry = multiBookletRoster.body.items.find(
    item => item.loginKey === "booklet-launch-student"
  );
  assert.equal(multiBookletEntry?.bookletKey, "booklet:beta");
  assert.deepEqual(multiBookletEntry?.bookletKeys, [
    "booklet:beta",
    "booklet:alpha"
  ]);
  assert.deepEqual(multiBookletEntry?.validationWarnings, []);

  const firstSignIn = await requestJson<{
    participantSession: { participantSessionId: string };
  }>("/api/v1/participant/auth/sign-in", {
    method: "POST",
    body: {
      workspaceKey,
      loginKey: "booklet-launch-student",
      groupKey: "group:booklet-launch"
    }
  });

  const betaRun = await requestJson<{
    testRun: {
      testRunId: string;
      bookletKey: string;
      currentUnitKey: string | null;
      status: string;
    };
  }>(
    `/api/v1/participant/sessions/${firstSignIn.body.participantSession.participantSessionId}/resume`,
    {
      method: "POST",
      body: { bookletKey: "booklet:beta" }
    }
  );

  assert.equal(betaRun.status, 200);
  assert.equal(betaRun.body.testRun.status, "running");
  assert.equal(betaRun.body.testRun.bookletKey, "booklet:beta");
  assert.equal(betaRun.body.testRun.currentUnitKey, "unit-beta-1");

  const conflictingBookletRun = await requestJson<{ error: string }>(
    `/api/v1/participant/sessions/${firstSignIn.body.participantSession.participantSessionId}/resume`,
    {
      method: "POST",
      body: { bookletKey: "booklet:alpha" }
    }
  );

  assert.equal(conflictingBookletRun.status, 409);
  assert.equal(
    conflictingBookletRun.body.error,
    "participant_session_open_run_booklet_conflict"
  );

  const completedBetaRun = await requestJson<{
    testRun: { status: string };
  }>(`/api/v1/participant/test-runs/${betaRun.body.testRun.testRunId}/complete`, {
    method: "POST"
  });
  assert.equal(completedBetaRun.status, 200);
  assert.equal(completedBetaRun.body.testRun.status, "completed");

  const betweenBooklets = await requestJson<{
    runtimeState: {
      participantSession: { status: string };
      runtimeStatus: string;
      availableAction: string;
      booklets: Array<{ bookletKey: string; status: string }>;
    };
  }>(
    `/api/v1/participant/sessions/${firstSignIn.body.participantSession.participantSessionId}/runtime-state`
  );
  assert.equal(betweenBooklets.body.runtimeState.participantSession.status, "signed_in");
  assert.equal(betweenBooklets.body.runtimeState.runtimeStatus, "ready_to_launch");
  assert.equal(betweenBooklets.body.runtimeState.availableAction, "launch");
  assert.deepEqual(
    betweenBooklets.body.runtimeState.booklets.map(booklet => ({
      bookletKey: booklet.bookletKey,
      status: booklet.status
    })),
    [
    { bookletKey: "booklet:alpha", status: "available" },
    { bookletKey: "booklet:beta", status: "completed" }
    ]
  );

  const alphaRun = await requestJson<{
    testRun: { testRunId: string; bookletKey: string; status: string };
  }>(
    `/api/v1/participant/sessions/${firstSignIn.body.participantSession.participantSessionId}/resume`,
    {
      method: "POST",
      body: { bookletKey: "booklet:alpha" }
    }
  );
  assert.equal(alphaRun.status, 200);
  assert.equal(alphaRun.body.testRun.bookletKey, "booklet:alpha");

  await requestJson(
    `/api/v1/participant/test-runs/${alphaRun.body.testRun.testRunId}/complete`,
    { method: "POST" }
  );
  const afterAllBooklets = await requestJson<{
    runtimeState: {
      participantSession: { status: string };
      runtimeStatus: string;
      availableAction: string;
    };
  }>(
    `/api/v1/participant/sessions/${firstSignIn.body.participantSession.participantSessionId}/runtime-state`
  );
  assert.equal(afterAllBooklets.body.runtimeState.participantSession.status, "closed");
  assert.equal(afterAllBooklets.body.runtimeState.runtimeStatus, "completed");
  assert.equal(afterAllBooklets.body.runtimeState.availableAction, "none");

  const directLaunch = await requestJson<{
    participantSession: {
      participantSessionId: string;
      loginKey: string;
      groupKey: string;
      status: string;
    };
    testRun: {
      participantSessionId: string;
      bookletKey: string;
      currentUnitKey: string | null;
    };
  }>("/api/v1/participant/starter:launch", {
    method: "POST",
    body: {
      tenantKey,
      workspaceKey,
      loginKey: "direct-booklet-launch-student",
      groupKey: "group:booklet-launch-direct",
      bookletKey: "booklet:beta"
    }
  });

  assert.equal(directLaunch.status, 200);
  assert.equal(
    directLaunch.body.participantSession.loginKey,
    "direct-booklet-launch-student"
  );
  assert.equal(
    directLaunch.body.participantSession.groupKey,
    "group:booklet-launch-direct"
  );
  assert.equal(directLaunch.body.participantSession.status, "launched");
  assert.equal(
    directLaunch.body.testRun.participantSessionId,
    directLaunch.body.participantSession.participantSessionId
  );
  assert.equal(directLaunch.body.testRun.bookletKey, "booklet:beta");
  assert.equal(directLaunch.body.testRun.currentUnitKey, "unit-beta-1");

  const secondSignIn = await requestJson<{
    participantSession: { participantSessionId: string };
  }>("/api/v1/participant/auth/sign-in", {
    method: "POST",
    body: {
      workspaceKey,
      loginKey: "unknown-booklet-student",
      groupKey: "group:booklet-launch"
    }
  });

  const unknownBooklet = await requestJson<{ error: string }>(
    `/api/v1/participant/sessions/${secondSignIn.body.participantSession.participantSessionId}/resume`,
    {
      method: "POST",
      body: { bookletKey: "booklet:missing" }
    }
  );

  assert.equal(unknownBooklet.status, 404);
  assert.equal(unknownBooklet.body.error, "booklet_not_found");
});

test("activation guard returns blocking open-run details", async () => {
  const tenantKey = "integration-tenant-activation";
  const workspaceKey = "integration-workspace-activation";

  await requestJson("/api/v1/platform/tenants", {
    method: "POST",
    body: { tenantKey, displayName: tenantKey }
  });
  await requestJson(`/api/v1/tenants/${tenantKey}/workspaces`, {
    method: "POST",
    body: { workspaceKey, displayName: workspaceKey }
  });

  const firstPackage = await requestJson<{
    sourcePackage: { sourcePackageId: string };
  }>(`/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/source-packages`, {
    method: "POST",
    body: {
      fileName: "alpha.xml",
      mediaType: "application/xml",
      sourceDocument:
        "<assessment><booklet key=\"booklet:alpha\" label=\"Alpha\"><unit key=\"unit-alpha\" label=\"Alpha Unit\" /></booklet></assessment>"
    }
  });
  const firstImport = await requestJson<{
    stagedContentRelease: { contentReleaseId: string };
  }>(`/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/import-jobs`, {
    method: "POST",
    body: {
      sourcePackageId: firstPackage.body.sourcePackage.sourcePackageId
    }
  });

  const firstReleaseId = firstImport.body.stagedContentRelease.contentReleaseId;
  await requestJson(
    `/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/content-releases/${firstReleaseId}/activate`,
    {
      method: "POST",
      body: { activatedByActorId: "integration-test" }
    }
  );

  const signIn = await requestJson<{
    participantSession: { participantSessionId: string };
  }>("/api/v1/participant/auth/sign-in", {
    method: "POST",
    body: {
      workspaceKey,
      loginKey: "activation-student"
    }
  });

  await requestJson(
    `/api/v1/participant/sessions/${signIn.body.participantSession.participantSessionId}/resume`,
    { method: "POST" }
  );
  await requestJson(
    `/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/participant-roster`,
    {
      method: "POST",
      body: {
        rosterText:
          "activation-student,group:activation,booklet:alpha,Activation Student"
      }
    }
  );

  const secondPackage = await requestJson<{
    sourcePackage: { sourcePackageId: string };
  }>(`/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/source-packages`, {
    method: "POST",
    body: {
      fileName: "beta.xml",
      mediaType: "application/xml",
      sourceDocument:
        "<assessment><booklet key=\"booklet:beta\" label=\"Beta\"><unit key=\"unit-beta\" label=\"Beta Unit\" /></booklet></assessment>"
    }
  });
  const secondImport = await requestJson<{
    stagedContentRelease: { contentReleaseId: string };
  }>(`/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/import-jobs`, {
    method: "POST",
    body: {
      sourcePackageId: secondPackage.body.sourcePackage.sourcePackageId
    }
  });

  const readiness = await requestJson<{
    activationReadiness: {
      canActivate: boolean;
      activeContentReleaseId: string | null;
      blockingOpenRuns: Array<{
        status: string;
        participantRosterEntry: { displayName: string | null } | null;
      }>;
      participantRosterWarnings: Array<{
        loginKey: string;
        validationWarnings: Array<{ code: string }>;
      }>;
    };
  }>(
    `/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/content-releases/${secondImport.body.stagedContentRelease.contentReleaseId}/activation-readiness`
  );

  assert.equal(readiness.status, 200);
  assert.equal(readiness.body.activationReadiness.canActivate, false);
  assert.equal(
    readiness.body.activationReadiness.activeContentReleaseId,
    firstReleaseId
  );
  assert.equal(readiness.body.activationReadiness.blockingOpenRuns.length, 1);
  assert.equal(
    readiness.body.activationReadiness.blockingOpenRuns[0]?.status,
    "running"
  );
  assert.equal(
    readiness.body.activationReadiness.blockingOpenRuns[0]?.participantRosterEntry
      ?.displayName,
    "Activation Student"
  );
  assert.equal(
    readiness.body.activationReadiness.participantRosterWarnings[0]?.loginKey,
    "activation-student"
  );
  assert.deepEqual(
    readiness.body.activationReadiness.participantRosterWarnings[0]?.validationWarnings.map(
      warning => warning.code
    ),
    ["booklet_not_found_in_active_release"]
  );

  const blockedActivation = await requestJson<{
    error: string;
    message: string;
    details: {
      activeContentReleaseId: string;
      openRuns: Array<{
        participantSessionId: string;
        status: string;
        loginKey: string;
        participantRosterEntry: { displayName: string | null } | null;
      }>;
    };
  }>(
    `/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/content-releases/${secondImport.body.stagedContentRelease.contentReleaseId}/activate`,
    {
      method: "POST",
      body: { activatedByActorId: "integration-test" }
    }
  );

  assert.equal(blockedActivation.status, 409);
  assert.equal(blockedActivation.body.error, "active_content_release_has_open_runs");
  assert.equal(
    blockedActivation.body.details.activeContentReleaseId,
    firstReleaseId
  );
  assert.equal(blockedActivation.body.details.openRuns.length, 1);
  assert.equal(blockedActivation.body.details.openRuns[0]?.status, "running");
  assert.equal(
    blockedActivation.body.details.openRuns[0]?.loginKey,
    "activation-student"
  );
  assert.equal(
    blockedActivation.body.details.openRuns[0]?.participantSessionId,
    signIn.body.participantSession.participantSessionId
  );
  assert.equal(
    blockedActivation.body.details.openRuns[0]?.participantRosterEntry?.displayName,
    "Activation Student"
  );

  const activityEvents = await requestJson<{
    items: Array<{
      activityEvent: { eventType: string; details: { activeContentReleaseId?: string } };
    }>;
  }>(
    `/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/activity-events`
  );

  assert.equal(activityEvents.status, 200);
  assert.equal(
    activityEvents.body.items.some(
      item =>
        item.activityEvent.eventType === "content_release_activation_blocked" &&
        item.activityEvent.details.activeContentReleaseId === firstReleaseId
    ),
    true
  );

  const forcedActivation = await requestJson<{
    contentRelease: {
      contentReleaseId: string;
      status: string;
    };
    activation: {
      forced: boolean;
      previousActiveContentReleaseId: string | null;
      supersededOpenRunCount: number;
      supersededOpenRuns: Array<{
        loginKey: string;
        participantRosterEntry: { displayName: string | null } | null;
      }>;
    };
  }>(
    `/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/content-releases/${secondImport.body.stagedContentRelease.contentReleaseId}/activate`,
    {
      method: "POST",
      body: {
        activatedByActorId: "integration-test",
        forceActivation: true
      }
    }
  );

  assert.equal(forcedActivation.status, 200);
  assert.equal(
    forcedActivation.body.contentRelease.contentReleaseId,
    secondImport.body.stagedContentRelease.contentReleaseId
  );
  assert.equal(forcedActivation.body.contentRelease.status, "active");
  assert.equal(forcedActivation.body.activation.forced, true);
  assert.equal(
    forcedActivation.body.activation.previousActiveContentReleaseId,
    firstReleaseId
  );
  assert.equal(forcedActivation.body.activation.supersededOpenRunCount, 1);
  assert.equal(
    forcedActivation.body.activation.supersededOpenRuns[0]?.loginKey,
    "activation-student"
  );
  assert.equal(
    forcedActivation.body.activation.supersededOpenRuns[0]?.participantRosterEntry
      ?.displayName,
    "Activation Student"
  );

  const firstReleaseAfterForce = await requestJson<{
    contentReleaseDetail: {
      contentRelease: { status: string };
    };
  }>(
    `/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/content-releases/${firstReleaseId}`
  );
  assert.equal(firstReleaseAfterForce.status, 200);
  assert.equal(
    firstReleaseAfterForce.body.contentReleaseDetail.contentRelease.status,
    "superseded"
  );

  const forcedActivityEvents = await requestJson<{
    items: Array<{
      activityEvent: {
        eventType: string;
        subjectId: string;
        details: {
          forced?: boolean;
          previousActiveContentReleaseId?: string | null;
          supersededOpenRunCount?: number;
          supersededOpenRuns?: Array<{
            loginKey: string;
            participantRosterEntry: { displayName: string | null } | null;
          }>;
        };
      };
    }>;
  }>(
    `/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/activity-events?eventType=content_release_activated&limit=1`
  );

  assert.equal(forcedActivityEvents.status, 200);
  assert.equal(
    forcedActivityEvents.body.items[0]?.activityEvent.subjectId,
    secondImport.body.stagedContentRelease.contentReleaseId
  );
  assert.equal(
    forcedActivityEvents.body.items[0]?.activityEvent.details.forced,
    true
  );
  assert.equal(
    forcedActivityEvents.body.items[0]?.activityEvent.details
      .previousActiveContentReleaseId,
    firstReleaseId
  );
  assert.equal(
    forcedActivityEvents.body.items[0]?.activityEvent.details
      .supersededOpenRunCount,
    1
  );
  assert.equal(
    forcedActivityEvents.body.items[0]?.activityEvent.details.supersededOpenRuns?.[0]
      ?.loginKey,
    "activation-student"
  );
  assert.equal(
    forcedActivityEvents.body.items[0]?.activityEvent.details.supersededOpenRuns?.[0]
      ?.participantRosterEntry?.displayName,
    "Activation Student"
  );
});

test("activation guard clears after monitor completes blocking run", async () => {
  const tenantKey = "integration-tenant-activation-monitor";
  const workspaceKey = "integration-workspace-activation-monitor";

  await requestJson("/api/v1/platform/tenants", {
    method: "POST",
    body: { tenantKey, displayName: tenantKey }
  });
  await requestJson(`/api/v1/tenants/${tenantKey}/workspaces`, {
    method: "POST",
    body: { workspaceKey, displayName: workspaceKey }
  });

  const firstPackage = await requestJson<{
    sourcePackage: { sourcePackageId: string };
  }>(`/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/source-packages`, {
    method: "POST",
    body: {
      fileName: "alpha-monitor.xml",
      mediaType: "application/xml",
      sourceDocument:
        "<assessment><booklet key=\"booklet:alpha\" label=\"Alpha\"><unit key=\"unit-alpha\" label=\"Alpha Unit\" /></booklet></assessment>"
    }
  });
  const firstImport = await requestJson<{
    stagedContentRelease: { contentReleaseId: string };
  }>(`/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/import-jobs`, {
    method: "POST",
    body: {
      sourcePackageId: firstPackage.body.sourcePackage.sourcePackageId
    }
  });
  const firstReleaseId = firstImport.body.stagedContentRelease.contentReleaseId;

  await requestJson(
    `/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/content-releases/${firstReleaseId}/activate`,
    {
      method: "POST",
      body: { activatedByActorId: "integration-test" }
    }
  );

  const signIn = await requestJson<{
    participantSession: { participantSessionId: string };
  }>("/api/v1/participant/auth/sign-in", {
    method: "POST",
    body: {
      workspaceKey,
      loginKey: "activation-monitor-student"
    }
  });
  const resumed = await requestJson<{
    testRun: { testRunId: string; status: string };
  }>(
    `/api/v1/participant/sessions/${signIn.body.participantSession.participantSessionId}/resume`,
    { method: "POST" }
  );

  assert.equal(resumed.status, 200);
  assert.equal(resumed.body.testRun.status, "running");

  const secondPackage = await requestJson<{
    sourcePackage: { sourcePackageId: string };
  }>(`/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/source-packages`, {
    method: "POST",
    body: {
      fileName: "beta-monitor.xml",
      mediaType: "application/xml",
      sourceDocument:
        "<assessment><booklet key=\"booklet:beta\" label=\"Beta\"><unit key=\"unit-beta\" label=\"Beta Unit\" /></booklet></assessment>"
    }
  });
  const secondImport = await requestJson<{
    stagedContentRelease: { contentReleaseId: string };
  }>(`/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/import-jobs`, {
    method: "POST",
    body: {
      sourcePackageId: secondPackage.body.sourcePackage.sourcePackageId
    }
  });
  const secondReleaseId = secondImport.body.stagedContentRelease.contentReleaseId;

  const blockedReadiness = await requestJson<{
    activationReadiness: {
      canActivate: boolean;
      blockingOpenRuns: Array<{ testRunId: string; status: string }>;
    };
  }>(
    `/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/content-releases/${secondReleaseId}/activation-readiness`
  );

  assert.equal(blockedReadiness.status, 200);
  assert.equal(blockedReadiness.body.activationReadiness.canActivate, false);
  assert.equal(
    blockedReadiness.body.activationReadiness.blockingOpenRuns[0]?.testRunId,
    resumed.body.testRun.testRunId
  );

  const completeCommand = await requestJson<{
    command: {
      commandType: string;
      testRun: { status: string; completedAt: string | null };
      participantSession: { status: string };
    };
  }>(
    `/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/monitor/open-runs/${resumed.body.testRun.testRunId}/commands`,
    {
      method: "POST",
      body: {
        commandType: "complete",
        actorId: "activation-operator"
      }
    }
  );

  assert.equal(completeCommand.status, 200);
  assert.equal(completeCommand.body.command.commandType, "complete");
  assert.equal(completeCommand.body.command.testRun.status, "completed");
  assert.match(completeCommand.body.command.testRun.completedAt ?? "", ISO_DATE_REGEX);
  assert.equal(completeCommand.body.command.participantSession.status, "closed");

  const clearReadiness = await requestJson<{
    activationReadiness: {
      canActivate: boolean;
      blockingOpenRuns: Array<unknown>;
    };
  }>(
    `/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/content-releases/${secondReleaseId}/activation-readiness`
  );

  assert.equal(clearReadiness.status, 200);
  assert.equal(clearReadiness.body.activationReadiness.canActivate, true);
  assert.equal(clearReadiness.body.activationReadiness.blockingOpenRuns.length, 0);

  const activation = await requestJson<{
    contentRelease: { contentReleaseId: string; status: string };
    activation: {
      forced: boolean;
      previousActiveContentReleaseId: string | null;
      supersededOpenRunCount: number;
    };
  }>(
    `/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/content-releases/${secondReleaseId}/activate`,
    {
      method: "POST",
      body: { activatedByActorId: "activation-operator" }
    }
  );

  assert.equal(activation.status, 200);
  assert.equal(activation.body.contentRelease.contentReleaseId, secondReleaseId);
  assert.equal(activation.body.contentRelease.status, "active");
  assert.equal(activation.body.activation.forced, false);
  assert.equal(activation.body.activation.previousActiveContentReleaseId, firstReleaseId);
  assert.equal(activation.body.activation.supersededOpenRunCount, 0);
});

test("workspace participant-session list shows latest run and active release", async () => {
  const tenantKey = "integration-tenant-sessions";
  const workspaceKey = "integration-workspace-sessions";

  await requestJson("/api/v1/platform/tenants", {
    method: "POST",
    body: { tenantKey, displayName: tenantKey }
  });
  await requestJson(`/api/v1/tenants/${tenantKey}/workspaces`, {
    method: "POST",
    body: { workspaceKey, displayName: workspaceKey }
  });

  const sourcePackage = await requestJson<{
    sourcePackage: { sourcePackageId: string };
  }>(`/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/source-packages`, {
    method: "POST",
    body: {
      fileName: "session.xml",
      mediaType: "application/xml",
      sourceDocument:
        "<assessment><booklet key=\"booklet:session\" label=\"Session\"><unit key=\"unit-session\" label=\"Session Unit\" /></booklet></assessment>"
    }
  });
  const importResult = await requestJson<{
    stagedContentRelease: { contentReleaseId: string };
  }>(`/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/import-jobs`, {
    method: "POST",
    body: {
      sourcePackageId: sourcePackage.body.sourcePackage.sourcePackageId
    }
  });

  const contentReleaseId = importResult.body.stagedContentRelease.contentReleaseId;
  await requestJson(
    `/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/content-releases/${contentReleaseId}/activate`,
    {
      method: "POST",
      body: { activatedByActorId: "integration-test" }
    }
  );

  const signIn = await requestJson<{
    participantSession: { participantSessionId: string; loginKey: string };
  }>("/api/v1/participant/auth/sign-in", {
    method: "POST",
    body: {
      workspaceKey,
      loginKey: "session-student"
    }
  });
  const resumedRun = await requestJson<{
    testRun: { testRunId: string; status: string };
  }>(
    `/api/v1/participant/sessions/${signIn.body.participantSession.participantSessionId}/resume`,
    { method: "POST" }
  );
  const signedInOnly = await requestJson<{
    participantSession: { participantSessionId: string; loginKey: string };
  }>("/api/v1/participant/auth/sign-in", {
    method: "POST",
    body: {
      workspaceKey,
      loginKey: "session-student-waiting"
    }
  });

  const participantSessions = await requestJson<{
    items: Array<{
      participantSession: {
        loginKey: string;
        participantSessionId: string;
        groupKey: string;
        status: string;
      };
      latestTestRun: { testRunId: string; bookletKey: string; status: string } | null;
      contentRelease: { contentReleaseId: string; status: string } | null;
    }>;
  }>(
    `/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/participant-sessions`
  );

  assert.equal(participantSessions.status, 200);
  assert.equal(participantSessions.body.items.length, 2);
  const resumedSessionItem = participantSessions.body.items.find(
    item =>
      item.participantSession.participantSessionId ===
      signIn.body.participantSession.participantSessionId
  );
  assert.notEqual(resumedSessionItem, undefined);
  assert.equal(
    resumedSessionItem?.participantSession.loginKey,
    "session-student"
  );
  assert.equal(
    resumedSessionItem?.latestTestRun?.testRunId,
    resumedRun.body.testRun.testRunId
  );
  assert.equal(
    resumedSessionItem?.latestTestRun?.status,
    "running"
  );
  assert.equal(
    resumedSessionItem?.latestTestRun?.bookletKey,
    "booklet:session"
  );
  assert.equal(
    resumedSessionItem?.contentRelease?.contentReleaseId,
    contentReleaseId
  );
  assert.equal(resumedSessionItem?.contentRelease?.status, "active");

  const loginFilteredSessions = await requestJson<typeof participantSessions.body>(
    `/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/participant-sessions?loginKey=session-student`
  );

  assert.equal(loginFilteredSessions.status, 200);
  assert.equal(loginFilteredSessions.body.items.length, 1);
  assert.equal(
    loginFilteredSessions.body.items[0]?.participantSession.participantSessionId,
    signIn.body.participantSession.participantSessionId
  );

  const groupFilteredSessions = await requestJson<typeof participantSessions.body>(
    `/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/participant-sessions?groupKey=group%3Asession-student-waiting`
  );

  assert.equal(groupFilteredSessions.status, 200);
  assert.equal(groupFilteredSessions.body.items.length, 1);
  assert.equal(
    groupFilteredSessions.body.items[0]?.participantSession.participantSessionId,
    signedInOnly.body.participantSession.participantSessionId
  );

  const launchedSessions = await requestJson<typeof participantSessions.body>(
    `/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/participant-sessions?status=launched`
  );

  assert.equal(launchedSessions.status, 200);
  assert.equal(launchedSessions.body.items.length, 1);
  assert.equal(
    launchedSessions.body.items[0]?.participantSession.participantSessionId,
    signIn.body.participantSession.participantSessionId
  );

  const bookletFilteredSessions = await requestJson<typeof participantSessions.body>(
    `/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/participant-sessions?bookletKey=booklet%3Asession`
  );

  assert.equal(bookletFilteredSessions.status, 200);
  assert.equal(bookletFilteredSessions.body.items.length, 1);
  assert.equal(
    bookletFilteredSessions.body.items[0]?.participantSession.participantSessionId,
    signIn.body.participantSession.participantSessionId
  );
  assert.equal(
    bookletFilteredSessions.body.items[0]?.latestTestRun?.bookletKey,
    "booklet:session"
  );

  const releaseFilteredSessions = await requestJson<typeof participantSessions.body>(
    `/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/participant-sessions?contentReleaseId=${contentReleaseId}&limit=1`
  );

  assert.equal(releaseFilteredSessions.status, 200);
  assert.equal(releaseFilteredSessions.body.items.length, 1);
  assert.equal(
    releaseFilteredSessions.body.items[0]?.contentRelease?.contentReleaseId,
    contentReleaseId
  );

  const participantSessionsCsv = await requestText(
    `/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/exports/participant-sessions.csv?bookletKey=booklet%3Asession&limit=10`
  );

  assert.equal(participantSessionsCsv.status, 200);
  assert.match(
    participantSessionsCsv.body,
    /^tenantKey,workspaceKey,participantSessionId,loginKey,groupKey,sessionStatus,createdAt,contentReleaseId,releaseLabel,latestTestRunId,latestBookletKey,latestRunStatus,latestCurrentUnitKey,latestRunUpdatedAt,rosterBookletKey,rosterDisplayName\n/
  );
  assert.match(participantSessionsCsv.body, /booklet:session/);
  assert.equal(participantSessionsCsv.body.trim().split("\n").length, 2);

  const invalidParticipantSessionStatus = await requestJson<{ error: string }>(
    `/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/participant-sessions?status=unsupported`
  );

  assert.equal(invalidParticipantSessionStatus.status, 400);
  assert.equal(
    invalidParticipantSessionStatus.body.error,
    "participant_session_status_invalid"
  );

  const invalidParticipantSessionLimit = await requestJson<{ error: string }>(
    `/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/participant-sessions?limit=0`
  );

  assert.equal(invalidParticipantSessionLimit.status, 400);
  assert.equal(
    invalidParticipantSessionLimit.body.error,
    "participant_session_limit_invalid"
  );

  const participantSessionDetail = await requestJson<{
    participantSessionDetail: {
      participantSession: { participantSessionId: string; loginKey: string };
      contentRelease: { contentReleaseId: string; status: string } | null;
      testRuns: Array<{ testRunId: string; status: string }>;
      runSummaries: Array<{
        testRun: { testRunId: string; status: string };
        responseCount: number;
        reviewCount: number;
      }>;
      responseCount: number;
      reviewCount: number;
      reviews: Array<{ reviewId: string }>;
    };
  }>(
    `/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/participant-sessions/${signIn.body.participantSession.participantSessionId}`
  );

  assert.equal(participantSessionDetail.status, 200);
  assert.equal(
    participantSessionDetail.body.participantSessionDetail.participantSession.loginKey,
    "session-student"
  );
  assert.equal(
    participantSessionDetail.body.participantSessionDetail.contentRelease?.contentReleaseId,
    contentReleaseId
  );
  assert.equal(
    participantSessionDetail.body.participantSessionDetail.testRuns[0]?.testRunId,
    resumedRun.body.testRun.testRunId
  );
  assert.equal(participantSessionDetail.body.participantSessionDetail.responseCount, 0);
  assert.equal(participantSessionDetail.body.participantSessionDetail.reviewCount, 0);
  assert.equal(participantSessionDetail.body.participantSessionDetail.reviews.length, 0);
  assert.equal(
    participantSessionDetail.body.participantSessionDetail.runSummaries[0]?.testRun
      .testRunId,
    resumedRun.body.testRun.testRunId
  );
  assert.equal(
    participantSessionDetail.body.participantSessionDetail.runSummaries[0]
      ?.responseCount,
    0
  );
  assert.equal(
    participantSessionDetail.body.participantSessionDetail.runSummaries[0]?.reviewCount,
    0
  );

  const activityEvents = await requestJson<{
    items: Array<{
      activityEvent: { eventType: string; subjectId: string };
    }>;
  }>(
    `/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/activity-events`
  );

  assert.equal(activityEvents.status, 200);
  assert.equal(
    activityEvents.body.items.some(
      item =>
        item.activityEvent.eventType === "participant_signed_in" &&
        item.activityEvent.subjectId ===
          signIn.body.participantSession.participantSessionId
    ),
    true
  );
  assert.equal(
    activityEvents.body.items.some(
      item =>
        item.activityEvent.eventType === "participant_session_resumed" &&
        item.activityEvent.subjectId === resumedRun.body.testRun.testRunId
    ),
    true
  );

  const signedInActivityEvents = await requestJson<{
    items: Array<{ activityEvent: { eventType: string } }>;
  }>(
    `/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/activity-events?eventType=participant_signed_in`
  );

  assert.equal(signedInActivityEvents.status, 200);
  assert.equal(signedInActivityEvents.body.items.length > 0, true);
  assert.equal(
    signedInActivityEvents.body.items.every(
      item => item.activityEvent.eventType === "participant_signed_in"
    ),
    true
  );

  const sessionActivityEvents = await requestJson<{
    items: Array<{
      activityEvent: { subjectType: string; subjectId: string };
    }>;
  }>(
    `/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/activity-events?subjectType=participant_session&subjectId=${signIn.body.participantSession.participantSessionId}`
  );

  assert.equal(sessionActivityEvents.status, 200);
  assert.equal(sessionActivityEvents.body.items.length, 1);
  assert.equal(
    sessionActivityEvents.body.items[0]?.activityEvent.subjectType,
    "participant_session"
  );
  assert.equal(
    sessionActivityEvents.body.items[0]?.activityEvent.subjectId,
    signIn.body.participantSession.participantSessionId
  );

  const limitedActivityEvents = await requestJson<{ items: unknown[] }>(
    `/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/activity-events?limit=1`
  );

  assert.equal(limitedActivityEvents.status, 200);
  assert.equal(limitedActivityEvents.body.items.length, 1);

  const invalidActivityEventType = await requestJson<{ error: string }>(
    `/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/activity-events?eventType=unsupported`
  );

  assert.equal(invalidActivityEventType.status, 400);
  assert.equal(
    invalidActivityEventType.body.error,
    "workspace_activity_event_type_invalid"
  );

  const invalidActivitySubjectType = await requestJson<{ error: string }>(
    `/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/activity-events?subjectType=unsupported`
  );

  assert.equal(invalidActivitySubjectType.status, 400);
  assert.equal(
    invalidActivitySubjectType.body.error,
    "workspace_activity_subject_type_invalid"
  );

  const invalidActivityLimit = await requestJson<{ error: string }>(
    `/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/activity-events?limit=0`
  );

  assert.equal(invalidActivityLimit.status, 400);
  assert.equal(invalidActivityLimit.body.error, "workspace_activity_limit_invalid");
});

test("metrics endpoint exposes runtime counters and request ids", async () => {
  const healthResponse = await fetch(`${baseUrl}/healthz`);
  assert.equal(healthResponse.status, 200);
  assert.ok(healthResponse.headers.get("x-request-id"));
  assertSecurityHeaders(healthResponse);

  const headHealthResponse = await fetch(`${baseUrl}/healthz`, { method: "HEAD" });
  assert.equal(headHealthResponse.status, 200);
  assert.ok(headHealthResponse.headers.get("x-request-id"));
  assertSecurityHeaders(headHealthResponse);
  assert.equal(await headHealthResponse.text(), "");

  const metricsResponse = await fetch(`${baseUrl}/metrics`);
  assert.equal(metricsResponse.status, 200);
  assert.ok(metricsResponse.headers.get("x-request-id"));
  assertSecurityHeaders(metricsResponse);

  const metrics = (await metricsResponse.json()) as {
    phase: string;
    runtime: {
      activeRequests: number;
      totalRequests: number;
      completedRequests: number;
    };
    memory: {
      rssBytes: number;
      heapTotalBytes: number;
      heapUsedBytes: number;
      externalBytes: number;
      arrayBuffersBytes: number;
    };
    requestCountsByMethod: Record<string, number>;
    requestCountsByRoute: Record<string, number>;
    responseCountsByStatusCode: Record<string, number>;
    requestLatencyByRoute: Record<
      string,
      { count: number; totalMs: number; maxMs: number; bucketCounts: Record<string, number> }
    >;
    errorCounts: {
      firstSlice: number;
      invalidJson: number;
      routeNotFound: number;
      storageNotReady: number;
      internal: number;
    };
  };

  assert.equal(metrics.phase, "production-baseline");
  assert.ok(metrics.runtime.totalRequests >= 3);
  assert.ok(metrics.runtime.completedRequests >= 1);
  assert.ok(metrics.requestCountsByMethod.GET >= 2);
  assert.ok(metrics.requestCountsByMethod.HEAD >= 1);
  assert.ok(metrics.requestCountsByRoute["GET /healthz"] >= 2);
  assert.ok(metrics.requestCountsByRoute["GET /metrics"] >= 1);
  assert.ok(metrics.responseCountsByStatusCode["200"] >= 1);
  assert.equal(typeof metrics.memory.rssBytes, "number");
  assert.ok(metrics.memory.rssBytes > 0);
  assert.ok(metrics.requestLatencyByRoute["GET /healthz"]?.count >= 1);
  assert.ok(
    typeof metrics.requestLatencyByRoute["GET /healthz"]?.bucketCounts["+Inf"] ===
      "number"
  );
  assert.equal(typeof metrics.errorCounts.internal, "number");

  const prometheusResponse = await fetch(`${baseUrl}/metrics/prometheus`);
  assert.equal(prometheusResponse.status, 200);
  assertSecurityHeaders(prometheusResponse);
  assert.match(
    prometheusResponse.headers.get("content-type") ?? "",
    /text\/plain/
  );

  const prometheusBody = await prometheusResponse.text();
  assert.match(prometheusBody, /rewrite_app_total_requests /);
  assert.match(prometheusBody, /rewrite_app_build_info\{/);
  assert.match(prometheusBody, /rewrite_app_request_count_by_route\{route="GET \/healthz"\}/);
  assert.match(prometheusBody, /rewrite_app_request_duration_ms_bucket\{route="GET \/healthz",le="\+Inf"\}/);
  assert.match(prometheusBody, /rewrite_app_process_resident_memory_bytes /);

  const diagnosticsResponse = await fetch(`${baseUrl}/diagnostics/runtime`);
  assert.equal(diagnosticsResponse.status, 200);
  assertSecurityHeaders(diagnosticsResponse);
  const diagnostics = (await diagnosticsResponse.json()) as {
    storage: { kind: string; location: string | null };
    recentEvents: Array<{ event: string; details: { route?: string } }>;
  };

  assert.equal(typeof diagnostics.storage.kind, "string");
  assertPostgresLocationRedacted(
    "diagnostics.storage.location",
    diagnostics.storage.location
  );
  assert.equal(Array.isArray(diagnostics.recentEvents), true);
  assert.equal(
    diagnostics.recentEvents.some(
      event =>
        event.event === "http_request_completed" &&
        event.details.route === "GET /healthz"
    ),
    true
  );

  const configResponse = await fetch(`${baseUrl}/diagnostics/config`);
  assert.equal(configResponse.status, 200);
  const config = (await configResponse.json()) as {
    runtimeConfig: {
      port: number;
      shutdownDrainDelayMs: number;
      maxJsonBodyBytes: number;
      httpTimeouts: {
        headersTimeoutMs: number;
        requestTimeoutMs: number;
        keepAliveTimeoutMs: number;
      };
      storage: { kind: string; location: string | null };
      environment: {
        firstSliceStore: string;
        firstSlicePostgresUrlPresent: boolean;
      };
    };
  };

  assert.equal(typeof config.runtimeConfig.port, "number");
  assert.equal(typeof config.runtimeConfig.shutdownDrainDelayMs, "number");
  assert.equal(typeof config.runtimeConfig.maxJsonBodyBytes, "number");
  assert.equal(typeof config.runtimeConfig.httpTimeouts.headersTimeoutMs, "number");
  assert.equal(typeof config.runtimeConfig.httpTimeouts.requestTimeoutMs, "number");
  assert.equal(
    typeof config.runtimeConfig.httpTimeouts.keepAliveTimeoutMs,
    "number"
  );
  assert.equal(config.runtimeConfig.storage.kind, diagnostics.storage.kind);
  assert.equal(
    typeof config.runtimeConfig.environment.firstSliceStore,
    "string"
  );
  assert.equal(
    typeof config.runtimeConfig.environment.firstSlicePostgresUrlPresent,
    "boolean"
  );
  assertPostgresLocationRedacted(
    "runtimeConfig.storage.location",
    config.runtimeConfig.storage.location
  );

  const manifestResponse = await fetch(`${baseUrl}/manifest`);
  assert.equal(manifestResponse.status, 200);
  const manifest = (await manifestResponse.json()) as {
    storage: { kind: string; location: string | null };
    capabilities: string[];
    routes: {
      platform: {
        exportTenantsCsv: string;
      };
      workspace: {
        exportWorkspacesCsv: string;
        exportWorkspaceOverviewCsv: string;
        importParticipantRoster: string;
        listParticipantRoster: string;
        exportParticipantRosterCsv: string;
        exportParticipantSessionsCsv: string;
        exportSourcePackagesCsv: string;
        exportImportJobsCsv: string;
        exportContentReleasesCsv: string;
        listDetailedResponses: string;
        exportStudyMonitorCsv: string;
        getStudyMonitorParticipantMatrix: string;
        getStudyMonitorParticipant: string;
        exportStudyMonitorParticipantMatrixCsv: string;
        exportStudyMonitorRunCsv: string;
        exportOpenRunsCsv: string;
        exportResponseCsv: string;
        exportLogCsv: string;
        exportReviewCsv: string;
        listReviews: string;
        deleteGroupResults: string;
        getContentReleaseActivationReadiness: string;
      };
      system: {
        getRuntimeDiagnostics: string;
        getRuntimeConfig: string;
      };
      admin: {
        listSessions: string;
        revokeSession: string;
        exportSessionsCsv: string;
        exportUsersCsv: string;
        exportAuditEventsCsv: string;
      };
      monitor: {
        openRuns: string;
        issueRunCommand: string;
      };
    };
  };

  assertPostgresLocationRedacted("manifest.storage.location", manifest.storage.location);

  for (const capability of [
    "admin_session_read",
    "admin_user_directory",
    "admin_session_revoke",
    "admin_session_csv_export",
    "admin_user_csv_export",
    "admin_audit_read",
    "admin_audit_csv_export",
    "tenant_directory_csv_export",
    "workspace_directory_csv_export",
    "workspace_overview_csv_export",
    "source_package_read",
    "source_package_csv_export",
    "source_package_retry",
    "import_job_read",
    "import_job_csv_export",
    "content_release_read",
    "content_release_csv_export",
    "content_release_readiness",
    "participant_roster_import",
    "participant_roster_read",
    "participant_roster_csv_export",
    "participant_session_read",
    "participant_session_csv_export",
    "detailed_response_read",
    "response_csv_export",
    "review_workflow",
    "review_csv_export",
    "log_csv_export",
    "study_monitor_csv_export",
    "study_monitor_participant_matrix_csv_export",
    "study_monitor_run_csv_export",
    "result_deletion",
    "study_monitor_read",
    "study_monitor_attention",
    "monitor_open_runs_csv_export",
    "monitor_run_control",
    "system_diagnostics",
    "frontend_shell"
  ]) {
    assert.ok(
      manifest.capabilities.includes(capability),
      `Expected manifest capability ${capability}`
    );
  }

  assert.match(manifest.routes.platform.exportTenantsCsv, /tenants\.csv/);
  assert.match(manifest.routes.workspace.exportWorkspacesCsv, /workspaces\.csv/);
  assert.match(manifest.routes.workspace.importParticipantRoster, /participant-roster/);
  assert.match(
    manifest.routes.workspace.exportWorkspaceOverviewCsv,
    /workspace-overview\.csv/
  );
  assert.match(manifest.routes.workspace.listParticipantRoster, /participant-roster/);
  assert.match(
    manifest.routes.workspace.exportParticipantRosterCsv,
    /participant-roster\.csv/
  );
  assert.match(
    manifest.routes.workspace.exportParticipantSessionsCsv,
    /participant-sessions\.csv/
  );
  assert.match(
    manifest.routes.workspace.exportSourcePackagesCsv,
    /source-packages\.csv/
  );
  assert.match(
    manifest.routes.workspace.exportImportJobsCsv,
    /import-jobs\.csv/
  );
  assert.match(
    manifest.routes.workspace.exportContentReleasesCsv,
    /content-releases\.csv/
  );
  assert.match(manifest.routes.workspace.listDetailedResponses, /responses\/detailed/);
  assert.match(manifest.routes.workspace.exportStudyMonitorCsv, /study-monitor\.csv/);
  assert.match(
    manifest.routes.workspace.getStudyMonitorParticipantMatrix,
    /study-monitor\/participants/
  );
  assert.match(
    manifest.routes.workspace.getStudyMonitorParticipant,
    /study-monitor\/participants\/:loginKey/
  );
  assert.match(
    manifest.routes.workspace.exportStudyMonitorParticipantMatrixCsv,
    /study-monitor-participants\.csv/
  );
  assert.match(
    manifest.routes.workspace.exportStudyMonitorRunCsv,
    /study-monitor-runs\/:testRunId\.csv/
  );
  assert.match(manifest.routes.workspace.exportOpenRunsCsv, /open-runs\.csv/);
  assert.match(manifest.routes.workspace.exportResponseCsv, /responses\.csv/);
  assert.match(manifest.routes.workspace.exportLogCsv, /logs\.csv/);
  assert.match(manifest.routes.workspace.exportReviewCsv, /reviews\.csv/);
  assert.match(manifest.routes.workspace.listReviews, /reviews/);
  assert.match(manifest.routes.workspace.deleteGroupResults, /results\/groups/);
  assert.match(
    manifest.routes.workspace.getContentReleaseActivationReadiness,
    /activation-readiness/
  );
  assert.match(manifest.routes.admin.listSessions, /auth\/sessions/);
  assert.match(manifest.routes.admin.revokeSession, /auth\/sessions\/:adminSessionId/);
  assert.match(manifest.routes.admin.exportSessionsCsv, /sessions\.csv/);
  assert.match(manifest.routes.admin.exportUsersCsv, /users\.csv/);
  assert.match(manifest.routes.admin.exportAuditEventsCsv, /audit-events\.csv/);
  assert.match(manifest.routes.monitor.openRuns, /monitor\/open-runs/);
  assert.match(
    manifest.routes.monitor.issueRunCommand,
    /monitor\/open-runs\/:testRunId\/commands/
  );
  assert.equal(manifest.routes.system.getRuntimeDiagnostics, "/diagnostics/runtime");
  assert.equal(manifest.routes.system.getRuntimeConfig, "/diagnostics/config");
});

test("frontend shell exposes multi-view navigation and diagnostics entrypoints", async () => {
  const appHeadResponse = await requestText("/app", { method: "HEAD" });
  assert.equal(appHeadResponse.status, 200);
  assert.match(appHeadResponse.contentType ?? "", /text\/html/);
  assert.equal(appHeadResponse.body, "");
  const appHeadFetchResponse = await fetch(`${baseUrl}/app`, { method: "HEAD" });
  assertSecurityHeaders(appHeadFetchResponse);

  const appResponse = await requestText("/app");

  assert.equal(appResponse.status, 200);
  assert.match(appResponse.contentType ?? "", /text\/html/);
  assert.match(appResponse.body, /<app-root><\/app-root>/);
  assert.match(appResponse.body, /<base href="\/app\/"\s*\/?>/);
  assert.match(appResponse.body, /<title>Testcenter Rewrite App<\/title>/);
  const appFetchResponse = await fetch(`${baseUrl}/app`);
  assertSecurityHeaders(appFetchResponse);

  const participantEntryResponse = await fetch(
    `${baseUrl}/participant?workspaceKey=demo-workspace`,
    { redirect: "manual" }
  );
  assert.equal(participantEntryResponse.status, 302);
  assertSecurityHeaders(participantEntryResponse);
  assert.equal(
    participantEntryResponse.headers.get("location"),
    "/app/participant?workspaceKey=demo-workspace"
  );

  const participantEntryHeadResponse = await fetch(
    `${baseUrl}/participant?workspaceKey=demo-workspace`,
    { method: "HEAD", redirect: "manual" }
  );
  assert.equal(participantEntryHeadResponse.status, 302);
  assertSecurityHeaders(participantEntryHeadResponse);
  assert.equal(
    participantEntryHeadResponse.headers.get("location"),
    "/app/participant?workspaceKey=demo-workspace"
  );
  assert.equal(await participantEntryHeadResponse.text(), "");

  const scriptMatch = appResponse.body.match(
    /<script src="([^"]*main[^"]*\.js)" type="module"><\/script>/
  );
  assert.ok(scriptMatch, "Expected Angular app shell to reference a main bundle.");

  const stylesheetMatch = appResponse.body.match(
    /<link rel="stylesheet" href="([^"]*styles[^"]*\.css)"/
  );
  assert.ok(
    stylesheetMatch,
    "Expected Angular app shell to reference a stylesheet bundle."
  );

  const scriptResponse = await fetch(`${baseUrl}/app/${scriptMatch[1]}`);
  assert.equal(scriptResponse.status, 200);
  assertSecurityHeaders(scriptResponse);
  assert.match(scriptResponse.headers.get("content-type") ?? "", /javascript/);

  const stylesheetResponse = await fetch(`${baseUrl}/app/${stylesheetMatch[1]}`);
  assert.equal(stylesheetResponse.status, 200);
  assertSecurityHeaders(stylesheetResponse);
  assert.match(stylesheetResponse.headers.get("content-type") ?? "", /text\/css/);
});
