/**
 * The permission model.
 *
 * Every authorisation decision in Hangar resolves to `can(role, capability)`.
 * Nothing else may branch on a role string directly — if you find yourself
 * writing `role === "OWNER"` in a page or action, add a capability here
 * instead. That keeps the matrix auditable in one place, which matters
 * because this is the part pilot teams will notice when it is wrong.
 */

export const ROLES = ["OWNER", "EDITOR", "VIEWER"] as const;
export type Role = (typeof ROLES)[number];

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

export const CAPABILITIES = [
  // Team
  "team:view",
  "team:rename",
  "team:delete",
  // Membership
  "member:list",
  "member:invite",
  "member:remove",
  "member:change_role",
  // Apps
  "app:view",
  "app:run",
  "app:create",
  "app:edit",
  "app:archive",
  "app:delete",
  // Agents and audit
  "token:create",
  "token:revoke_any",
  "audit:view",
  // Company data
  "connector:manage",
] as const;
export type Capability = (typeof CAPABILITIES)[number];

const VIEWER_CAPS: Capability[] = ["team:view", "member:list", "app:view", "app:run"];

const EDITOR_CAPS: Capability[] = [
  ...VIEWER_CAPS,
  "app:create",
  "app:edit",
  "app:archive",
  "token:create",
];

const OWNER_CAPS: Capability[] = [
  ...EDITOR_CAPS,
  "team:rename",
  "team:delete",
  "member:invite",
  "member:remove",
  "member:change_role",
  "app:delete",
  "token:revoke_any",
  "audit:view",
  "connector:manage",
];

const MATRIX: Record<Role, ReadonlySet<Capability>> = {
  OWNER: new Set(OWNER_CAPS),
  EDITOR: new Set(EDITOR_CAPS),
  VIEWER: new Set(VIEWER_CAPS),
};

export function can(role: Role, capability: Capability): boolean {
  return MATRIX[role].has(capability);
}

export function capabilitiesFor(role: Role): Capability[] {
  return [...MATRIX[role]];
}

/** Plain-language names for the permission table on the Settings page. */
export const CAPABILITY_LABELS: Record<Capability, string> = {
  "team:view": "See the team",
  "team:rename": "Rename the team",
  "team:delete": "Delete the team",
  "member:list": "See who is on the team",
  "member:invite": "Add people and crew",
  "member:remove": "Remove people",
  "member:change_role": "Change someone's role",
  "app:view": "See the tools",
  "app:run": "Open and use tools",
  "app:create": "Deploy new tools",
  "app:edit": "Redeploy, edit and roll back tools",
  "app:archive": "Archive tools",
  "app:delete": "Delete tools",
  "token:create": "Create deploy tokens for their agent",
  "token:revoke_any": "Revoke anyone's deploy token",
  "audit:view": "See the activity log",
  "connector:manage": "Connect databases and approve tool queries",
};

export const ROLE_LABELS: Record<Role, string> = {
  OWNER: "Owner",
  EDITOR: "Editor",
  VIEWER: "Viewer",
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  OWNER: "Full control. Manages members, settings and can delete the team.",
  EDITOR: "Can add and edit tools, but cannot manage who has access.",
  VIEWER: "Can open and use the team's tools. Cannot change anything.",
};

/**
 * A team must never be left without an owner — otherwise nobody can manage
 * members and the team is permanently stuck. Every role change and member
 * removal is checked against this.
 */
export function wouldOrphanTeam(
  currentRoles: Role[],
  changingIndexToRole: { index: number; next: Role | null },
): boolean {
  const next = [...currentRoles];
  if (changingIndexToRole.next === null) {
    next.splice(changingIndexToRole.index, 1);
  } else {
    next[changingIndexToRole.index] = changingIndexToRole.next;
  }
  return !next.includes("OWNER");
}
