// src/services/workspaceService.js
import { supabase } from "./supabaseClient";

function normaliseMembership(row) {
  const organisation = Array.isArray(row?.organisations)
    ? row.organisations[0]
    : row?.organisations;

  return {
    membershipId: row?.id || "",
    organisationId: row?.organisation_id || organisation?.id || "",
    organisationName: organisation?.name || "Unnamed workspace",
    userId: row?.user_id || "",
    role: row?.role || "viewer",
    status: row?.status || "active",
    createdAt: row?.created_at || "",
  };
}

/**
 * Load every active organisation membership available to a user.
 *
 * RLS remains the final security authority. The user_id filter also helps
 * Postgres use the membership index efficiently.
 */
export async function getUserWorkspaces(userId) {
  if (!userId) return [];

  const { data, error } = await supabase
    .from("organisation_members")
    .select(`
      id,
      organisation_id,
      user_id,
      role,
      status,
      created_at,
      organisations!organisation_members_organisation_id_fkey (
        id,
        name,
        created_at,
        updated_at
      )
    `)
    .eq("user_id", userId)
    .eq("status", "active")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Unable to load user workspaces:", error);
    throw new Error(
      error.message || "Unable to load your Theraa Nurse workspace."
    );
  }

  return (data || [])
    .map(normaliseMembership)
    .filter((item) => item.organisationId);
}

export async function getPrimaryWorkspaceForUser(userId) {
  const workspaces = await getUserWorkspaces(userId);
  return workspaces[0] || null;
}

export async function getOrganisationMembers(organisationId) {
  if (!organisationId) return [];

  const { data, error } = await supabase
    .from("organisation_members")
    .select(`
      id,
      organisation_id,
      user_id,
      role,
      status,
      created_at
    `)
    .eq("organisation_id", organisationId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Unable to load organisation members:", error);
    throw new Error(
      error.message || "Unable to load organisation members."
    );
  }

  return data || [];
}

export function isWorkspaceManager(role) {
  return ["provider_admin", "manager"].includes(role);
}

export function canManageParticipants(role) {
  return [
    "provider_admin",
    "manager",
    "support_coordinator",
  ].includes(role);
}

export function canCreateCarePlans(role) {
  return [
    "provider_admin",
    "manager",
    "support_coordinator",
    "nurse",
    "allied_health",
  ].includes(role);
}

export function getRoleLabel(role) {
  const labels = {
    provider_admin: "Provider Admin",
    manager: "Manager",
    support_coordinator: "Support Coordinator",
    support_worker: "Support Worker",
    nurse: "Nurse",
    allied_health: "Allied Health",
    viewer: "Viewer",
  };

  return labels[role] || "Workspace Member";
}