import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import type { AddressInfo } from "node:net";

import { createProductionApiServer } from "./index.js";

let server: Awaited<ReturnType<typeof createProductionApiServer>>;

let baseUrl = "";

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

    const participantSignIn = await requestJsonAt<{
      participantSession: { participantSessionId: string; loginKey: string };
    }>(isolated.baseUrl, "/api/v1/participant/auth/sign-in", {
      method: "POST",
      body: {
        workspaceKey: "demo-workspace",
        loginKey: "student-demo"
      }
    });

    assert.equal(participantSignIn.status, 200);
    assert.equal(participantSignIn.body.participantSession.loginKey, "student-demo");

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
        bookletUnits: Array<{ unitKey: string; displayLabel: string }>;
      };
    }>(
      isolated.baseUrl,
      `/api/v1/participant/sessions/${participantSignIn.body.participantSession.participantSessionId}/current-state`
    );

    assert.equal(currentState.status, 200);
    assert.deepEqual(
      currentState.body.currentRunState.bookletUnits.map(unit => unit.unitKey),
      ["unit-intro", "unit-practice", "unit-finish"]
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

    const stateAfterResponse = await requestJsonAt<{
      currentRunState: {
        testRun: { unitResponses: Record<string, string> };
      };
    }>(
      isolated.baseUrl,
      `/api/v1/participant/sessions/${participantSignIn.body.participantSession.participantSessionId}/current-state`
    );

    assert.equal(stateAfterResponse.status, 200);
    assert.equal(
      stateAfterResponse.body.currentRunState.testRun.unitResponses["unit-intro"],
      "My first demo response"
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
      "unit-intro"
    ]);
    assert.equal(detailedResponses.body.items[0]?.loginKey, "student-demo");
    assert.equal(detailedResponses.body.items[0]?.groupKey, "group:student-demo");
    assert.equal(detailedResponses.body.items[0]?.bookletKey, "booklet:demo");
    assert.equal(detailedResponses.body.items[0]?.response, "My first demo response");
    assert.equal(detailedResponses.body.items[0]?.responseLength, 22);

    const filteredDetailedResponses = await requestJsonAt<{
      items: Array<{
        loginKey: string;
        groupKey: string;
        testRunId: string;
        unitKey: string;
        status: string;
      }>;
    }>(
      isolated.baseUrl,
      `/api/v1/tenants/demo-tenant/workspaces/demo-workspace/responses/detailed?loginKey=student-demo&groupKey=group%3Astudent-demo&participantSessionId=${participantSignIn.body.participantSession.participantSessionId}&testRunId=${resumed.body.testRun.testRunId}&unitKey=unit-intro&status=running&limit=1`,
      {
        headers: {
          authorization: `Bearer ${signIn.body.sessionToken}`
        }
      }
    );

    assert.equal(filteredDetailedResponses.status, 200);
    assert.equal(filteredDetailedResponses.body.items.length, 1);
    assert.equal(filteredDetailedResponses.body.items[0]?.loginKey, "student-demo");
    assert.equal(filteredDetailedResponses.body.items[0]?.unitKey, "unit-intro");
    assert.equal(filteredDetailedResponses.body.items[0]?.status, "running");

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
        groups: Array<{
          groupKey: string;
          participantSessionCount: number;
          runningCount: number;
          responseCount: number;
          reviewCount: number;
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
    assert.equal(studyMonitor.body.studyMonitorSummary.responseCount, 1);
    assert.equal(studyMonitor.body.studyMonitorSummary.reviewCount, 0);
    assert.equal(
      studyMonitor.body.studyMonitorSummary.groups[0]?.groupKey,
      "group:student-demo"
    );
    assert.equal(
      studyMonitor.body.studyMonitorSummary.groups[0]?.participantSessionCount,
      1
    );
    assert.equal(studyMonitor.body.studyMonitorSummary.groups[0]?.reviewCount, 0);

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
      }>;
    }>(
      isolated.baseUrl,
      `/api/v1/tenants/demo-tenant/workspaces/demo-workspace/reviews?loginKey=student-demo&groupKey=group%3Astudent-demo&participantSessionId=${participantSignIn.body.participantSession.participantSessionId}&testRunId=${resumed.body.testRun.testRunId}&unitKey=unit-intro&reviewerId=integration-reviewer&category=final-check&limit=1`,
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
    assert.equal(participantSessionDetail.body.participantSessionDetail.responseCount, 1);
    assert.equal(participantSessionDetail.body.participantSessionDetail.reviewCount, 1);
    assert.equal(
      participantSessionDetail.body.participantSessionDetail.runSummaries[0]?.testRun
        .testRunId,
      resumed.body.testRun.testRunId
    );
    assert.equal(
      participantSessionDetail.body.participantSessionDetail.runSummaries[0]
        ?.responseCount,
      1
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
    assert.equal(studyMonitorGroup.body.studyMonitorGroup.responseCount, 1);
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
      1
    );
    assert.equal(studyMonitorGroup.body.studyMonitorGroup.sessions[0]?.reviewCount, 1);
    assert.equal(
      studyMonitorGroup.body.studyMonitorGroup.testRuns[0]?.testRun.testRunId,
      resumed.body.testRun.testRunId
    );
    assert.equal(studyMonitorGroup.body.studyMonitorGroup.testRuns[0]?.reviewCount, 1);

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
      `/api/v1/tenants/demo-tenant/workspaces/demo-workspace/exports/reviews.csv?reviewerId=integration-reviewer&category=final-check&limit=1`,
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
    assert.equal(groupDeletion.body.deletion.deletedResponseCount, 1);
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
        fileName: "fixed.xml",
        mediaType: "application/xml",
        sourceDocument:
          "<Assessment><Booklet Key='booklet:fixed' Label='Fixed'><Unit Key='unit-fixed' Label='Fixed Unit' /></Booklet></Assessment>"
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
    `/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/source-packages?status=accepted&mediaType=application%2Fxml&fileName=fixed.xml&latestImportStatus=completed&limit=1`
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
                { unitId: " unit-alpha ", title: " Alpha Unit " },
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
            { unitKey: "unit-alpha", displayLabel: "Alpha Unit" },
            { unitKey: "unit-beta", displayLabel: "Unit unit beta" },
            { unitKey: "unit-gamma", displayLabel: "Gamma Unit" }
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
      fileName: "testcenter-style.xml",
      mediaType: "application/xml",
      sourceDocument: `
        <assessment xmlns:tc="https://example.testcenter.local/schema">
          <tc:testlet tc:key="booklet:alias" tc:title="Alias Booklet">
            <tc:unitRef tc:ref="unit-alpha" tc:label="Alpha Unit" />
            <unitDefinition alias="unit-beta" displayName="Beta Unit" />
            <tc:item code="unit-beta" label="Duplicate Beta Unit" />
            <item href="unit-gamma" />
          </tc:testlet>
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
        }
      ]
    }
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

  const firstSignIn = await requestJson<{
    participantSession: { participantSessionId: string; status: string };
  }>("/api/v1/participant/auth/sign-in", {
    method: "POST",
    body: {
      workspaceKey,
      loginKey: "reentry-student"
    }
  });
  const secondSignIn = await requestJson<{
    participantSession: { participantSessionId: string; status: string };
  }>("/api/v1/participant/auth/sign-in", {
    method: "POST",
    body: {
      workspaceKey,
      loginKey: "reentry-student"
    }
  });

  assert.equal(secondSignIn.status, 200);
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
      workspaceKey,
      loginKey: "reentry-student"
    }
  });

  assert.equal(
    thirdSignIn.body.participantSession.participantSessionId,
    firstSignIn.body.participantSession.participantSessionId
  );
  assert.equal(thirdSignIn.body.participantSession.status, "launched");

  const participantSessions = await requestJson<{
    items: Array<{ participantSession: { loginKey: string } }>;
  }>(
    `/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/participant-sessions`
  );

  assert.equal(participantSessions.status, 200);
  assert.equal(
    participantSessions.body.items.filter(
      item => item.participantSession.loginKey === "reentry-student"
    ).length,
    1
  );
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
      blockingOpenRuns: Array<{ status: string }>;
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

  const blockedActivation = await requestJson<{
    error: string;
    message: string;
    details: {
      activeContentReleaseId: string;
      openRuns: Array<{ status: string; loginKey: string }>;
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
      latestTestRun: { testRunId: string; status: string } | null;
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

  const releaseFilteredSessions = await requestJson<typeof participantSessions.body>(
    `/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/participant-sessions?contentReleaseId=${contentReleaseId}&limit=1`
  );

  assert.equal(releaseFilteredSessions.status, 200);
  assert.equal(releaseFilteredSessions.body.items.length, 1);
  assert.equal(
    releaseFilteredSessions.body.items[0]?.contentRelease?.contentReleaseId,
    contentReleaseId
  );

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

  const headHealthResponse = await fetch(`${baseUrl}/healthz`, { method: "HEAD" });
  assert.equal(headHealthResponse.status, 200);
  assert.ok(headHealthResponse.headers.get("x-request-id"));
  assert.equal(await headHealthResponse.text(), "");

  const metricsResponse = await fetch(`${baseUrl}/metrics`);
  assert.equal(metricsResponse.status, 200);
  assert.ok(metricsResponse.headers.get("x-request-id"));

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
  const diagnostics = (await diagnosticsResponse.json()) as {
    storage: { kind: string; location: string | null };
    recentEvents: Array<{ event: string; details: { route?: string } }>;
  };

  assert.equal(typeof diagnostics.storage.kind, "string");
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
      storage: { kind: string; location: string | null };
      environment: {
        firstSliceStore: string;
        firstSlicePostgresUrlPresent: boolean;
      };
    };
  };

  assert.equal(typeof config.runtimeConfig.port, "number");
  assert.equal(typeof config.runtimeConfig.shutdownDrainDelayMs, "number");
  assert.equal(config.runtimeConfig.storage.kind, diagnostics.storage.kind);
  assert.equal(
    typeof config.runtimeConfig.environment.firstSliceStore,
    "string"
  );
  assert.equal(
    typeof config.runtimeConfig.environment.firstSlicePostgresUrlPresent,
    "boolean"
  );
});

test("frontend shell exposes multi-view navigation and diagnostics entrypoints", async () => {
  const appHeadResponse = await requestText("/app", { method: "HEAD" });
  assert.equal(appHeadResponse.status, 200);
  assert.match(appHeadResponse.contentType ?? "", /text\/html/);
  assert.equal(appHeadResponse.body, "");

  const appResponse = await requestText("/app");

  assert.equal(appResponse.status, 200);
  assert.match(appResponse.contentType ?? "", /text\/html/);
  assert.match(appResponse.body, /<app-root><\/app-root>/);
  assert.match(appResponse.body, /<base href="\/app\/"\s*\/?>/);
  assert.match(appResponse.body, /<title>Testcenter Rewrite App<\/title>/);

  const participantEntryResponse = await fetch(
    `${baseUrl}/participant?workspaceKey=demo-workspace`,
    { redirect: "manual" }
  );
  assert.equal(participantEntryResponse.status, 302);
  assert.equal(
    participantEntryResponse.headers.get("location"),
    "/app/participant?workspaceKey=demo-workspace"
  );

  const participantEntryHeadResponse = await fetch(
    `${baseUrl}/participant?workspaceKey=demo-workspace`,
    { method: "HEAD", redirect: "manual" }
  );
  assert.equal(participantEntryHeadResponse.status, 302);
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
  assert.match(scriptResponse.headers.get("content-type") ?? "", /javascript/);

  const stylesheetResponse = await fetch(`${baseUrl}/app/${stylesheetMatch[1]}`);
  assert.equal(stylesheetResponse.status, 200);
  assert.match(stylesheetResponse.headers.get("content-type") ?? "", /text\/css/);
});
