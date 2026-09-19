import { describe, expect, it } from "vitest";
import {
  CAPABILITIES,
  ROLES,
  can,
  capabilitiesFor,
  isRole,
  wouldOrphanTeam,
  type Capability,
} from "./permissions";

describe("role matrix", () => {
  it("lets every role see the team and open its tools", () => {
    for (const role of ROLES) {
      expect(can(role, "team:view")).toBe(true);
      expect(can(role, "app:view")).toBe(true);
      expect(can(role, "app:run")).toBe(true);
    }
  });

  it("does not let a viewer change anything", () => {
    const writes: Capability[] = [
      "team:rename",
      "team:delete",
      "member:invite",
      "member:remove",
      "member:change_role",
      "app:create",
      "app:edit",
      "app:archive",
      "app:delete",
    ];
    for (const capability of writes) {
      expect(can("VIEWER", capability)).toBe(false);
    }
  });

  it("lets an editor manage tools but never people", () => {
    expect(can("EDITOR", "app:create")).toBe(true);
    expect(can("EDITOR", "app:edit")).toBe(true);
    expect(can("EDITOR", "app:archive")).toBe(true);

    expect(can("EDITOR", "member:invite")).toBe(false);
    expect(can("EDITOR", "member:remove")).toBe(false);
    expect(can("EDITOR", "member:change_role")).toBe(false);
    expect(can("EDITOR", "team:delete")).toBe(false);
    // Deleting is owner-only; an editor archives instead.
    expect(can("EDITOR", "app:delete")).toBe(false);
  });

  it("gives an owner every capability", () => {
    for (const capability of CAPABILITIES) {
      expect(can("OWNER", capability)).toBe(true);
    }
  });

  it("keeps each role a superset of the one below it", () => {
    const viewer = new Set(capabilitiesFor("VIEWER"));
    const editor = new Set(capabilitiesFor("EDITOR"));
    const owner = new Set(capabilitiesFor("OWNER"));

    for (const capability of viewer) expect(editor.has(capability)).toBe(true);
    for (const capability of editor) expect(owner.has(capability)).toBe(true);
  });

  it("rejects unknown role strings", () => {
    expect(isRole("OWNER")).toBe(true);
    expect(isRole("owner")).toBe(false);
    expect(isRole("ADMIN")).toBe(false);
    expect(isRole(null)).toBe(false);
    expect(isRole(undefined)).toBe(false);
  });
});

describe("last-owner protection", () => {
  it("blocks demoting the only owner", () => {
    expect(wouldOrphanTeam(["OWNER", "EDITOR"], { index: 0, next: "EDITOR" })).toBe(true);
  });

  it("blocks removing the only owner", () => {
    expect(wouldOrphanTeam(["OWNER", "VIEWER"], { index: 0, next: null })).toBe(true);
  });

  it("allows demoting one owner when another remains", () => {
    expect(wouldOrphanTeam(["OWNER", "OWNER"], { index: 0, next: "VIEWER" })).toBe(false);
  });

  it("allows removing one owner when another remains", () => {
    expect(wouldOrphanTeam(["OWNER", "OWNER"], { index: 1, next: null })).toBe(false);
  });

  it("allows removing a non-owner", () => {
    expect(wouldOrphanTeam(["OWNER", "EDITOR"], { index: 1, next: null })).toBe(false);
  });

  it("allows promoting someone to owner", () => {
    expect(wouldOrphanTeam(["OWNER", "VIEWER"], { index: 1, next: "OWNER" })).toBe(false);
  });

  it("blocks emptying a single-member team of its owner", () => {
    expect(wouldOrphanTeam(["OWNER"], { index: 0, next: null })).toBe(true);
  });
});
