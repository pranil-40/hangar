"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function TeamTabs({
  slug,
  canManageMembers,
}: {
  slug: string;
  canManageMembers: boolean;
}) {
  const pathname = usePathname();

  const tabs = [
    { href: `/t/${slug}`, label: "Tools", exact: true },
    { href: `/t/${slug}/members`, label: canManageMembers ? "Members" : "People", exact: false },
    { href: `/t/${slug}/settings`, label: "Settings", exact: false },
  ];

  return (
    <nav style={{ display: "flex", gap: "0.25rem" }}>
      {tabs.map((tab) => {
        const active = tab.exact ? pathname === tab.href : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            style={{
              padding: "0.5rem 0.75rem",
              fontSize: "0.87rem",
              fontWeight: 550,
              color: active ? "var(--text)" : "var(--text-muted)",
              borderBottom: `2px solid ${active ? "var(--accent)" : "transparent"}`,
              marginBottom: -1,
            }}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
