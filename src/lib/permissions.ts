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
] as const;
export type Capability = (typeof CAPABILITIES)[number];

const VIEWER_CAPS: Capability[] = ["team:view", "member:list", "app:view", "app:run"];

const EDITOR_CAPS: Capability[] = [
  ...VIEWER_CAPS,
  "app:create",
  "app:edit",
  "app:archive",
];

const OWNER_CAPS: Capability[] = [
  ...EDITOR_CAPS,
  "team:rename",
  "team:delete",
  "member:invite",
  "member:remove",
  "member:change_role",
  "app:delete",
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
