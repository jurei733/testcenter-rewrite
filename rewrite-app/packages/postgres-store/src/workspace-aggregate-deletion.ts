import type {PoolClient} from 'pg';
import type {WorkspaceAggregateDeletionCounts} from '@testcenter-rewrite-app/domain';
/** Caller retains the parent workspace row lock through this transaction. */
export async function deleteWorkspaceAggregateRows(client:PoolClient,scope:{tenantId:string;workspaceId:string;workspaceKey:string}):Promise<WorkspaceAggregateDeletionCounts> {
 const args=[scope.tenantId,scope.workspaceId];
 // Artifact writers retain a person/run KEY SHARE lock even when they do not
 // touch the workspace row. Retire those parents before deleting any child.
 await client.query('SELECT participant_session_id FROM participant_sessions WHERE tenant_id=$1 AND workspace_id=$2 ORDER BY participant_session_id FOR UPDATE',args);
 await client.query('SELECT test_run_id FROM test_runs WHERE tenant_id=$1 AND workspace_id=$2 ORDER BY test_run_id FOR UPDATE',args);
 await client.query('DELETE FROM participant_access_credentials WHERE participant_session_id IN (SELECT participant_session_id FROM participant_sessions WHERE tenant_id=$1 AND workspace_id=$2)',args);
 await client.query('DELETE FROM participant_connection_presence WHERE test_run_id IN (SELECT test_run_id FROM test_runs WHERE tenant_id=$1 AND workspace_id=$2)',args);
 const counts:WorkspaceAggregateDeletionCounts={deletedWorkspaceCount:0,deletedAdminRoleAssignmentCount:0,deletedAttachmentFileCount:0,deletedActivityEventCount:0,deletedReviewCount:0,deletedSourcePackageCount:0,deletedImportJobCount:0,deletedContentReleaseCount:0,deletedParticipantSessionCount:0,deletedRosterEntryCount:0,deletedLoginAttemptCount:0,deletedTestRunCount:0,deletedTestLogCount:0};
 const fields={"admin_role_assignments": "deletedAdminRoleAssignmentCount", "attachment_files": "deletedAttachmentFileCount", "workspace_activity_events": "deletedActivityEventCount", "workspace_reviews": "deletedReviewCount", "source_packages": "deletedSourcePackageCount", "import_jobs": "deletedImportJobCount", "content_releases": "deletedContentReleaseCount", "participant_sessions": "deletedParticipantSessionCount", "participant_roster_entries": "deletedRosterEntryCount", "participant_login_attempts": "deletedLoginAttemptCount", "test_runs": "deletedTestRunCount", "participant_test_logs": "deletedTestLogCount"} as const;
 for(const table of ["original_native_commands", "participant_run_commands", "participant_progress_deliveries", "original_native_units", "original_native_reviews", "original_test_numbers", "original_person_numbers", "original_session_tokens", "original_login_bindings", "original_participant_groups", "original_workspace_numbers", "admin_role_assignments", "attachment_files", "workspace_activity_events", "workspace_reviews", "source_packages", "import_jobs", "content_releases", "participant_sessions", "participant_roster_entries", "operational_login_migration_candidates", "participant_login_attempts", "test_runs", "participant_test_logs"]){const result=await client.query('DELETE FROM '+table+' WHERE tenant_id=$1 AND workspace_id=$2',args);if(table in fields)counts[fields[table as keyof typeof fields]]=result.rowCount??0;}
 const result=await client.query('DELETE FROM workspaces WHERE tenant_id=$1 AND workspace_id=$2 AND workspace_key=$3',[...args,scope.workspaceKey]);
 if(result.rowCount!==1)throw Error('Workspace deletion identity changed.');counts.deletedWorkspaceCount=1;
 return counts;
}
