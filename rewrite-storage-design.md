# Testcenter Rewrite Storage Design

## Purpose

This document translates the module map into a storage design draft.

It covers:

- relational schema groups
- core tables
- key and foreign-key strategy
- JSON vs relational storage choices
- index strategy
- object storage layout
- partitioning and retention
- projection refresh strategy
- legacy-to-rewrite mapping hints

It is still a design document, not a migration script.

## Storage Principles

- tenant isolation is mandatory
- canonical content is immutable
- runtime state is mutable but version-aware
- source artifacts stay traceable
- generated projections are rebuildable
- object storage holds blobs, DB holds business state
- JSON is allowed for nested content payloads, but not as a substitute for core relational integrity

## Recommended Relational Database

Recommended target: PostgreSQL.

Why:

- strong relational modeling
- JSONB for canonical payloads and compiled bundles
- partial indexes
- good support for multi-tenant filtering
- good operational tooling for migrations and observability

## Schema Grouping

Use logical schema groupings. This can be actual PostgreSQL schemas or naming conventions.

Recommended groups:

- `platform_*`
- `tenant_*`
- `iam_*`
- `import_*`
- `content_*`
- `runtime_*`
- `monitor_*`
- `review_*`
- `attachment_*`
- `syscheck_*`
- `report_*`
- `config_*`
- `audit_*`

## Global Key Rules

### Primary Keys

- use `uuid` or `ulid` primary keys for record identity

### Tenant Boundary

- all tenant-owned tables include `tenant_id not null`

### Workspace Boundary

- workspace-scoped tables include `workspace_id not null`

### Content Version Boundary

- canonical content tables include `content_release_id not null`

### Business Keys

- store normalized business keys separately
- use unique constraints in tenant/workspace/release scope as needed

Examples:

- `(tenant_id, tenant_key)` unique
- `(tenant_id, workspace_key)` unique
- `(content_release_id, unit_key)` unique
- `(content_release_id, booklet_key)` unique
- `(content_release_id, syscheck_key)` unique

## Core Table Design

## 1. Platform And Tenant Tables

### `platform_tenants`

Columns:

- `tenant_id pk`
- `tenant_key`
- `display_name`
- `status`
- `created_at`
- `suspended_at nullable`

Indexes:

- unique `(tenant_key)`
- index `(status)`

### `platform_tenant_domains`

Columns:

- `tenant_domain_id pk`
- `tenant_id fk`
- `domain_name`
- `is_primary`
- `verified_at nullable`

Indexes:

- unique `(domain_name)`
- index `(tenant_id, is_primary)`

### `tenant_workspaces`

Columns:

- `workspace_id pk`
- `tenant_id fk`
- `workspace_key`
- `display_name`
- `status`
- `active_content_release_id nullable`
- `created_at`

Indexes:

- unique `(tenant_id, workspace_key)`
- index `(tenant_id, status)`

## 2. Identity And Access Tables

### `iam_admin_users`

Columns:

- `admin_user_id pk`
- `tenant_id nullable`
- `username`
- `status`
- `must_rotate_password`
- `created_at`

Indexes:

- unique `(tenant_id, username)` for tenant admins
- unique `(username)` where `tenant_id is null` for platform admins

### `iam_admin_password_credentials`

Columns:

- `admin_user_id pk fk`
- `password_hash`
- `password_version`
- `updated_at`

### `iam_role_assignments`

Columns:

- `role_assignment_id pk`
- `admin_user_id fk`
- `tenant_id nullable`
- `workspace_id nullable`
- `role_key`
- `created_at`

Indexes:

- index `(admin_user_id)`
- index `(tenant_id, workspace_id, role_key)`

### `iam_auth_sessions`

Columns:

- `auth_session_id pk`
- `tenant_id nullable`
- `session_type`
- `subject_kind`
- `subject_ref`
- `token_hash`
- `expires_at`
- `revoked_at nullable`
- `created_at`

Indexes:

- unique `(token_hash)`
- index `(expires_at)`
- index `(tenant_id, subject_ref)`

### `iam_participant_login_attempts`

Columns:

- `participant_login_attempt_id pk`
- `tenant_id`
- `workspace_id`
- `login_key nullable`
- `client_fingerprint nullable`
- `ip_hash nullable`
- `outcome`
- `attempted_at`

Indexes:

- index `(tenant_id, workspace_id, attempted_at)`
- index `(login_key, attempted_at)`

### `iam_security_locks`

Columns:

- `security_lock_id pk`
- `tenant_id`
- `lock_scope`
- `lock_key`
- `reason`
- `expires_at`

Indexes:

- unique `(tenant_id, lock_scope, lock_key)`
- index `(expires_at)`

## 3. Source Package And Import Tables

### `import_source_packages`

Columns:

- `source_package_id pk`
- `tenant_id`
- `workspace_id`
- `uploaded_by`
- `format_key`
- `storage_uri`
- `manifest_hash`
- `uploaded_at`

Indexes:

- index `(tenant_id, workspace_id, uploaded_at desc)`
- unique `(workspace_id, manifest_hash)`

### `import_source_artifacts`

Columns:

- `source_artifact_id pk`
- `source_package_id fk`
- `artifact_key`
- `artifact_type`
- `storage_uri`
- `content_hash`
- `size_bytes`

Indexes:

- unique `(source_package_id, artifact_key)`
- index `(source_package_id, artifact_type)`

### `import_jobs`

Columns:

- `import_job_id pk`
- `tenant_id`
- `workspace_id`
- `source_package_id fk`
- `status`
- `started_at nullable`
- `finished_at nullable`
- `summary_jsonb`

Indexes:

- index `(tenant_id, workspace_id, created_at desc)`
- index `(status)`

### `import_messages`

Columns:

- `import_message_id pk`
- `import_job_id fk`
- `artifact_key nullable`
- `severity`
- `code`
- `path nullable`
- `message`
- `details_jsonb nullable`

Indexes:

- index `(import_job_id, severity)`
- index `(import_job_id, artifact_key)`

### `import_traces`

Columns:

- `import_trace_id pk`
- `import_job_id fk`
- `trace_type`
- `payload_jsonb`

Indexes:

- index `(import_job_id, trace_type)`

## 4. Content Release Tables

### `content_releases`

Columns:

- `content_release_id pk`
- `tenant_id`
- `workspace_id`
- `source_package_id fk`
- `release_label`
- `status`
- `created_at`
- `activated_at nullable`

Indexes:

- index `(workspace_id, created_at desc)`
- index `(workspace_id, status)`

### `content_units`

Columns:

- `unit_definition_id pk`
- `content_release_id`
- `tenant_id`
- `workspace_id`
- `unit_key`
- `title`
- `player_asset_id nullable`
- `definition_payload_jsonb`
- `metadata_jsonb`

Indexes:

- unique `(content_release_id, unit_key)`
- index `(player_asset_id)`

### `content_unit_dependencies`

Columns:

- `unit_dependency_id pk`
- `unit_definition_id fk`
- `dependency_kind`
- `target_key`
- `target_ref_type`
- `target_ref_id nullable`

Indexes:

- index `(unit_definition_id, dependency_kind)`
- index `(target_ref_type, target_ref_id)`

### `content_player_assets`

Columns:

- `player_asset_id pk`
- `content_release_id`
- `player_key`
- `api_major_version`
- `storage_uri`
- `content_hash`
- `metadata_jsonb`

Indexes:

- unique `(content_release_id, player_key)`
- index `(content_release_id, api_major_version)`

### `content_resource_assets`

Columns:

- `resource_asset_id pk`
- `content_release_id`
- `resource_key`
- `resource_type`
- `storage_uri`
- `content_hash`
- `metadata_jsonb`

Indexes:

- unique `(content_release_id, resource_key)`
- index `(content_release_id, resource_type)`

### `content_booklets`

Columns:

- `booklet_definition_id pk`
- `content_release_id`
- `tenant_id`
- `workspace_id`
- `booklet_key`
- `title`
- `runtime_config_jsonb`
- `metadata_jsonb`

Indexes:

- unique `(content_release_id, booklet_key)`

### `content_booklet_nodes`

Columns:

- `booklet_node_id pk`
- `booklet_definition_id fk`
- `node_order`
- `node_type`
- `parent_node_id nullable`
- `unit_key nullable`
- `unit_alias nullable`
- `label nullable`
- `payload_jsonb`

Indexes:

- index `(booklet_definition_id, node_order)`
- index `(booklet_definition_id, unit_key)`

### `content_booklet_states`

Columns:

- `booklet_state_id pk`
- `booklet_definition_id fk`
- `state_key`

Indexes:

- unique `(booklet_definition_id, state_key)`

### `content_booklet_state_options`

Columns:

- `booklet_state_option_id pk`
- `booklet_state_id fk`
- `option_key`
- `conditions_jsonb`
- `is_default`

Indexes:

- unique `(booklet_state_id, option_key)`
- index `(booklet_state_id, is_default)`

### `content_adaptivity_rules`

Columns:

- `adaptivity_rule_id pk`
- `booklet_definition_id fk`
- `rule_order`
- `trigger_jsonb`
- `effect_jsonb`

Indexes:

- index `(booklet_definition_id, rule_order)`

### `content_login_collections`

Columns:

- `login_collection_id pk`
- `content_release_id`
- `collection_key`
- `source_artifact_ref`

Indexes:

- unique `(content_release_id, collection_key)`

### `content_groups`

Columns:

- `group_definition_id pk`
- `login_collection_id fk`
- `group_key`
- `display_label`
- `valid_from nullable`
- `valid_to nullable`
- `valid_for_minutes nullable`

Indexes:

- unique `(login_collection_id, group_key)`

### `content_participant_logins`

Columns:

- `participant_login_definition_id pk`
- `login_collection_id fk`
- `group_definition_id fk`
- `login_key`
- `mode_key`
- `password_hash nullable`
- `custom_text_overrides_jsonb`
- `view_settings_jsonb`

Indexes:

- unique `(login_collection_id, login_key)`
- index `(group_definition_id)`
- index `(mode_key)`

### `content_booklet_assignments`

Columns:

- `booklet_assignment_id pk`
- `participant_login_definition_id fk`
- `assignment_key`
- `booklet_key`
- `required_code nullable`
- `initial_state_overrides_jsonb`
- `assignment_order`

Indexes:

- unique `(participant_login_definition_id, assignment_key)`
- index `(participant_login_definition_id, required_code)`
- index `(participant_login_definition_id, assignment_order)`

### `content_monitor_profiles`

Columns:

- `monitor_profile_definition_id pk`
- `participant_login_definition_id fk`
- `profile_key`
- `label`
- `settings_jsonb`
- `filters_jsonb`

Indexes:

- unique `(participant_login_definition_id, profile_key)`

### `content_syschecks`

Columns:

- `syscheck_definition_id pk`
- `content_release_id`
- `syscheck_key`
- `title`
- `description`
- `save_key nullable`
- `skip_network`
- `embedded_unit_key nullable`
- `custom_text_overrides_jsonb`

Indexes:

- unique `(content_release_id, syscheck_key)`
- index `(content_release_id, embedded_unit_key)`

### `content_syscheck_questions`

Columns:

- `syscheck_question_id pk`
- `syscheck_definition_id fk`
- `question_order`
- `question_key`
- `question_type`
- `prompt`
- `required`
- `options_jsonb`

Indexes:

- index `(syscheck_definition_id, question_order)`

### `content_attachment_slot_definitions`

Columns:

- `attachment_slot_definition_id pk`
- `content_release_id`
- `unit_key`
- `variable_key`
- `attachment_type`
- `metadata_jsonb`

Indexes:

- unique `(content_release_id, unit_key, variable_key)`
- index `(content_release_id, attachment_type)`

### `content_relationships`

Columns:

- `content_relationship_id pk`
- `content_release_id`
- `subject_type`
- `subject_key`
- `relationship_type`
- `object_type`
- `object_key`

Indexes:

- index `(content_release_id, subject_type, subject_key)`
- index `(content_release_id, object_type, object_key)`

### `content_runtime_bundles`

Columns:

- `runtime_bundle_id pk`
- `content_release_id`
- `bundle_type`
- `bundle_key`
- `payload_jsonb`
- `payload_hash`

Indexes:

- unique `(content_release_id, bundle_type, bundle_key)`
- index `(content_release_id, bundle_type)`

## 5. Runtime Tables

### `runtime_test_runs`

Columns:

- `test_run_id pk`
- `tenant_id`
- `workspace_id`
- `content_release_id`
- `group_key`
- `login_key`
- `booklet_assignment_id`
- `mode_key`
- `status`
- `started_at`
- `ended_at nullable`

Indexes:

- index `(tenant_id, workspace_id, status)`
- index `(workspace_id, group_key, status)`
- index `(workspace_id, login_key, started_at desc)`

### `runtime_run_policy_snapshots`

Columns:

- `test_run_id pk fk`
- `policy_jsonb`
- `policy_hash`

### `runtime_unit_attempts`

Columns:

- `unit_attempt_id pk`
- `test_run_id fk`
- `unit_key`
- `booklet_node_ref`
- `visit_index`
- `visit_state`
- `current_page nullable`
- `entered_at`
- `left_at nullable`

Indexes:

- index `(test_run_id, unit_key, visit_index)`
- index `(test_run_id, entered_at)`

### `runtime_response_snapshots`

Columns:

- `response_snapshot_id pk`
- `test_run_id fk`
- `unit_key`
- `part_key`
- `response_type`
- `content_jsonb`
- `client_ts`
- `server_ts`

Indexes:

- index `(test_run_id, unit_key)`
- index `(test_run_id, part_key)`
- index `(test_run_id, server_ts desc)`

### `runtime_unit_state_snapshots`

Columns:

- `unit_state_snapshot_id pk`
- `test_run_id fk`
- `unit_key`
- `state_jsonb`
- `client_ts`
- `server_ts`

Indexes:

- index `(test_run_id, unit_key, server_ts desc)`

### `runtime_run_state_snapshots`

Columns:

- `run_state_snapshot_id pk`
- `test_run_id fk`
- `state_jsonb`
- `client_ts`
- `server_ts`

Indexes:

- index `(test_run_id, server_ts desc)`

### `runtime_events`

Columns:

- `runtime_event_id pk`
- `tenant_id`
- `workspace_id`
- `test_run_id`
- `event_type`
- `payload_jsonb`
- `occurred_at`

Indexes:

- index `(test_run_id, occurred_at)`
- index `(workspace_id, event_type, occurred_at desc)`

### `runtime_run_command_inbox`

Columns:

- `run_command_id pk`
- `test_run_id fk`
- `command_type`
- `payload_jsonb`
- `issued_at`
- `delivered_at nullable`

Indexes:

- index `(test_run_id, delivered_at)`

### `runtime_run_command_acks`

Columns:

- `run_command_ack_id pk`
- `run_command_id fk`
- `ack_status`
- `ack_payload_jsonb`
- `acked_at`

Indexes:

- index `(run_command_id, acked_at desc)`

## 6. Monitoring Tables

### `monitor_profiles`

Columns:

- `monitor_profile_id pk`
- `tenant_id`
- `workspace_id`
- `group_key`
- `profile_key`
- `definition_jsonb`

Indexes:

- unique `(workspace_id, group_key, profile_key)`

### `monitor_filters`

Columns:

- `monitor_filter_id pk`
- `tenant_id`
- `workspace_id`
- `group_key`
- `created_by`
- `filter_jsonb`
- `created_at`

Indexes:

- index `(workspace_id, group_key, created_at desc)`

### `monitor_operator_commands`

Columns:

- `operator_command_id pk`
- `tenant_id`
- `workspace_id`
- `group_key nullable`
- `issued_by`
- `command_type`
- `target_selector_jsonb`
- `issued_at`
- `status`

Indexes:

- index `(workspace_id, issued_at desc)`
- index `(workspace_id, group_key, issued_at desc)`

### `monitor_operator_command_targets`

Columns:

- `operator_command_target_id pk`
- `operator_command_id fk`
- `test_run_id`
- `delivery_status`

Indexes:

- index `(operator_command_id)`
- index `(test_run_id, delivery_status)`

### `monitor_operator_command_acks`

Columns:

- `operator_command_ack_id pk`
- `operator_command_target_id fk`
- `ack_status`
- `ack_payload_jsonb`
- `acked_at`

Indexes:

- index `(operator_command_target_id, acked_at desc)`

### `monitor_session_projection`

Columns:

- `monitor_session_projection_id pk`
- `tenant_id`
- `workspace_id`
- `group_key`
- `test_run_id`
- `projection_jsonb`
- `updated_at`

Indexes:

- unique `(workspace_id, test_run_id)`
- index `(workspace_id, group_key, updated_at desc)`

### `study_monitor_projection`

Columns:

- `study_monitor_projection_id pk`
- `tenant_id`
- `workspace_id`
- `group_key`
- `projection_jsonb`
- `updated_at`

Indexes:

- unique `(workspace_id, group_key)`
- index `(workspace_id, updated_at desc)`

## 7. Review Tables

### `review_entries`

Columns:

- `review_entry_id pk`
- `tenant_id`
- `workspace_id`
- `test_run_id`
- `unit_key nullable`
- `author_ref`
- `priority`
- `categories_jsonb`
- `entry_text`
- `created_at`
- `updated_at`
- `deleted_at nullable`

Indexes:

- index `(test_run_id, unit_key, created_at)`
- index `(workspace_id, created_at desc)`
- partial index on `deleted_at is null`

## 8. Attachment Tables

### `attachment_slots`

Columns:

- `attachment_slot_id pk`
- `tenant_id`
- `workspace_id`
- `content_release_id`
- `unit_key`
- `variable_key`
- `attachment_type`

Indexes:

- unique `(content_release_id, unit_key, variable_key)`
- index `(workspace_id, attachment_type)`

### `attachment_submissions`

Columns:

- `attachment_submission_id pk`
- `tenant_id`
- `workspace_id`
- `test_run_id`
- `attachment_slot_id fk`
- `submitted_by`
- `submitted_at`
- `status`

Indexes:

- index `(workspace_id, submitted_at desc)`
- index `(test_run_id, attachment_slot_id)`

### `attachment_submission_assets`

Columns:

- `attachment_submission_asset_id pk`
- `attachment_submission_id fk`
- `storage_uri`
- `content_hash`
- `mime_type`
- `created_at`

Indexes:

- index `(attachment_submission_id)`

### `attachment_batches`

Columns:

- `attachment_batch_id pk`
- `tenant_id`
- `workspace_id`
- `created_by`
- `selection_jsonb`
- `pdf_storage_uri`
- `created_at`

Indexes:

- index `(workspace_id, created_at desc)`

## 9. System Check Tables

### `syscheck_runs`

Columns:

- `syscheck_run_id pk`
- `tenant_id`
- `workspace_id`
- `content_release_id`
- `syscheck_key`
- `login_key nullable`
- `status`
- `started_at`
- `submitted_at nullable`

Indexes:

- index `(workspace_id, syscheck_key, started_at desc)`

### `syscheck_answers`

Columns:

- `syscheck_answer_id pk`
- `syscheck_run_id fk`
- `question_key`
- `answer_jsonb`
- `updated_at`

Indexes:

- unique `(syscheck_run_id, question_key)`

### `syscheck_network_results`

Columns:

- `syscheck_network_result_id pk`
- `syscheck_run_id fk`
- `payload_jsonb`
- `updated_at`

Indexes:

- unique `(syscheck_run_id)`

### `syscheck_embedded_unit_results`

Columns:

- `syscheck_embedded_unit_result_id pk`
- `syscheck_run_id fk`
- `payload_jsonb`
- `updated_at`

Indexes:

- unique `(syscheck_run_id)`

### `syscheck_reports`

Columns:

- `syscheck_report_id pk`
- `tenant_id`
- `workspace_id`
- `syscheck_run_id fk`
- `report_key nullable`
- `password_gate_result`
- `payload_jsonb`
- `created_at`

Indexes:

- index `(workspace_id, created_at desc)`
- index `(workspace_id, report_key)`

## 10. Reporting And Export Tables

### `report_export_jobs`

Columns:

- `export_job_id pk`
- `tenant_id`
- `workspace_id`
- `requested_by`
- `export_type`
- `selection_jsonb`
- `status`
- `created_at`
- `finished_at nullable`

Indexes:

- index `(workspace_id, export_type, created_at desc)`
- index `(status)`

### `report_export_artifacts`

Columns:

- `export_artifact_id pk`
- `export_job_id fk`
- `storage_uri`
- `content_hash`
- `row_count nullable`
- `created_at`

Indexes:

- index `(export_job_id)`

### `report_result_deletion_requests`

Columns:

- `result_deletion_request_id pk`
- `tenant_id`
- `workspace_id`
- `requested_by`
- `selection_jsonb`
- `status`
- `created_at`
- `finished_at nullable`

Indexes:

- index `(workspace_id, created_at desc)`

## 11. Configuration Tables

### `config_branding_profiles`

Columns:

- `branding_profile_id pk`
- `tenant_id`
- `workspace_id nullable`
- `app_title`
- `logo_uri nullable`
- `intro_html nullable`
- `legal_notice_html nullable`
- `theme_key`
- `active_from`

Indexes:

- index `(tenant_id, workspace_id, active_from desc)`

### `config_text_bundles`

Columns:

- `text_bundle_id pk`
- `tenant_id`
- `workspace_id nullable`
- `scope_key`
- `entries_jsonb`
- `active_from`

Indexes:

- index `(tenant_id, workspace_id, scope_key, active_from desc)`

### `config_warning_banners`

Columns:

- `warning_banner_id pk`
- `tenant_id`
- `workspace_id nullable`
- `message_text`
- `expires_at nullable`
- `active_from`

Indexes:

- index `(tenant_id, workspace_id, active_from desc)`
- index `(expires_at)`

### `config_change_history`

Columns:

- `config_change_history_id pk`
- `tenant_id`
- `workspace_id nullable`
- `changed_by`
- `change_type`
- `payload_jsonb`
- `changed_at`

Indexes:

- index `(tenant_id, workspace_id, changed_at desc)`

## 12. Audit Tables

### `audit_events`

Columns:

- `audit_event_id pk`
- `tenant_id nullable`
- `workspace_id nullable`
- `actor_ref nullable`
- `event_type`
- `entity_type nullable`
- `entity_ref nullable`
- `payload_jsonb`
- `occurred_at`

Indexes:

- index `(tenant_id, workspace_id, occurred_at desc)`
- index `(entity_type, entity_ref, occurred_at desc)`
- index `(event_type, occurred_at desc)`

### `audit_security_events`

Columns:

- `security_event_id pk`
- `tenant_id nullable`
- `subject_ref nullable`
- `event_type`
- `payload_jsonb`
- `occurred_at`

Indexes:

- index `(tenant_id, occurred_at desc)`
- index `(subject_ref, occurred_at desc)`

### `audit_operational_events`

Columns:

- `operational_event_id pk`
- `tenant_id nullable`
- `workspace_id nullable`
- `component_key`
- `event_type`
- `payload_jsonb`
- `occurred_at`

Indexes:

- index `(component_key, occurred_at desc)`
- index `(tenant_id, workspace_id, occurred_at desc)`

## JSON vs Relational Decisions

## Use Relational Tables For

- aggregate identity
- tenant/workspace/content-release boundaries
- foreign-key integrity
- lists that must be filtered or joined often
- operator selections and permissions

## Use JSONB For

- canonical definition payload fragments
- runtime policy snapshots
- unit state blobs
- response content payloads
- monitor projection payloads
- import trace details
- configuration bundles

## Strong Recommendation

Do not decompose every XML nuance into hundreds of tiny tables.

Good split:

- relational for identity and joins
- JSONB for nested rule payloads and compiled content

Examples:

- `content_booklet_nodes.payload_jsonb` is good
- `runtime_run_policy_snapshots.policy_jsonb` is good
- `runtime_response_snapshots.content_jsonb` is good
- `content_releases` without relational links to units/booklets is not good

## Index Strategy

## Always Index

- `tenant_id`
- `workspace_id`
- foreign keys
- time-ordered read paths for admin/operator UIs
- business-key uniqueness inside scope

## Add Partial Indexes For

- active, non-deleted rows
- unfinished jobs
- non-revoked sessions

Examples:

- `review_entries where deleted_at is null`
- `report_export_jobs where status in ('queued','running')`
- `iam_auth_sessions where revoked_at is null`

## Time-Series Style Indexes

For append-heavy tables:

- `runtime_events`
- `audit_events`
- `audit_security_events`
- `audit_operational_events`

Prefer indexes on:

- `(tenant_id, occurred_at desc)`
- `(workspace_id, occurred_at desc)` where relevant

## Partitioning Strategy

Start simple. Do not partition every table in v1.

### Good Early Partition Candidates

- `runtime_events`
- `audit_events`
- `audit_security_events`
- `audit_operational_events`
- possibly `runtime_response_snapshots` if volume becomes very large

### Suggested Partition Rule

- partition by month on `occurred_at` or `server_ts`
- keep tenant columns inside partitions for filtering

### Do Not Partition Early

- content tables
- tenant tables
- small config tables

## Object Storage Layout

Recommended key prefixes:

- `tenant/{tenant_key}/workspace/{workspace_key}/source/{source_package_id}/...`
- `tenant/{tenant_key}/workspace/{workspace_key}/release/{content_release_id}/players/...`
- `tenant/{tenant_key}/workspace/{workspace_key}/release/{content_release_id}/resources/...`
- `tenant/{tenant_key}/workspace/{workspace_key}/exports/{export_job_id}/...`
- `tenant/{tenant_key}/workspace/{workspace_key}/attachments/{attachment_submission_id}/...`
- `tenant/{tenant_key}/workspace/{workspace_key}/syscheck/{syscheck_run_id}/...`

Recommended metadata on stored objects:

- `tenant_id`
- `workspace_id`
- `content_release_id` where relevant
- `content_hash`
- `source_package_id` where relevant

## Projection Refresh Strategy

## Projection Types

### Synchronous Projections

Refresh in request transaction when cheap:

- `current_session_v`-style tables or materialized row updates
- simple starter-card projections
- direct command ack state

### Asynchronous Projections

Refresh via jobs or event consumers when heavier:

- `monitor_session_projection`
- `study_monitor_projection`
- `workspace_result_summary_v`
- `effective_branding_v` if derived from layered overrides

## Rebuild Rule

Every projection must be rebuildable from source-of-truth tables.

That means:

- no projection-only business facts
- no operator-critical state that exists only in a denormalized table

## Suggested Projection Refresh Triggers

- runtime event append
- review entry create/update/delete
- sys-check report submit
- config change
- content release activation

## Legacy Mapping Hints

Current legacy concepts should map roughly like this:

### Legacy `workspaces`

- becomes `tenant_workspaces`

### Legacy `users`, `workspace_users`, `admin_sessions`

- become `iam_admin_users`, `iam_role_assignments`, `iam_auth_sessions`

### Legacy `logins`, `login_sessions`, `person_sessions`

- split into:
  - canonical `content_participant_logins`
  - runtime/auth session tables
  - `runtime_test_runs`

### Legacy `tests`

- becomes `runtime_test_runs`

### Legacy `units`

- mostly becomes `runtime_unit_attempts`

### Legacy `unit_data`

- splits into:
  - `runtime_response_snapshots`
  - attachment-specific tables for attachment submissions

### Legacy `test_logs`, `unit_logs`

- become events and export projections rather than bespoke log tables only

### Legacy `test_reviews`, `unit_reviews`

- unify into `review_entries` with nullable `unit_key`

### Legacy `files`, `file_relations`, `unit_defs_attachments`

- become:
  - source/import tables
  - content registry tables
  - `content_relationships`
  - `content_attachment_slot_definitions`

### Legacy `meta`

- split into typed config tables and release metadata

## Retention Strategy

## Keep Long-Term

- tenants
- workspaces
- content releases
- source package metadata
- audits
- generated exports for configured retention period

## Retain With Policy

- auth sessions
- runtime events
- sys-check run details
- attachment submissions
- large generated artifacts

Recommended policy:

- keep canonical content and audits effectively permanently
- keep high-volume event and artifact data by explicit retention settings per tenant if needed

## Recommended Next Step

The next useful artifact is an API contract draft:

- endpoint-by-endpoint request and response shapes
- auth rules per endpoint
- compatibility adapter coverage
- event payload shapes for runtime and monitoring
