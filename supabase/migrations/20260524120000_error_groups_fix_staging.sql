-- Fix-staging columns for the debug-telemetry-errors skill's reconciliation phase.
--
-- A group with fix_staged_version SET but resolved_at NULL means: a fix was
-- authored against that ext_version and is awaiting a later release to verify.
-- The skill's Phase 0 reconciliation auto-resolves it once telemetry shows the
-- targeted symptom went quiet on a newer shipped version (date-gated on the
-- release rollout), and reopens it (clears staging) if the symptom persists.
--
--   fix_target = 'code'   -> bug fixed at source; verify the symptom count drops
--                            to 0 on shipped versions newer than fix_staged_version.
--   fix_target = 'filter' -> noise dropped at the telemetry funnel client-side;
--                            verify ZERO occurrences arrive after the release
--                            rollout (including ext_version '0.0.0', since those
--                            are exactly what the funnel now suppresses).
--
-- Server-side bookkeeping only -- never transmitted from clients, so this has no
-- PRIVACY.md §6 contract impact.

ALTER TABLE error_groups
    ADD COLUMN IF NOT EXISTS fix_staged_version text,
    ADD COLUMN IF NOT EXISTS fix_target text; -- 'code' | 'filter'
