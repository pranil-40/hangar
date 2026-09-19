import Link from "next/link";

export function NoAccess({
  slug,
  message,
}: {
  slug: string;
  message: string;
}) {
  return (
    <div className="card" style={{ padding: "2.5rem", textAlign: "center", maxWidth: 520 }}>
      <p style={{ margin: "0 0 0.4rem", fontWeight: 600 }}>You don&rsquo;t have access to this</p>
      <p className="muted" style={{ margin: "0 0 1.2rem", fontSize: "0.9rem" }}>
        {message}
      </p>
      <Link href={`/t/${slug}`} className="btn">
        Back to tools
      </Link>
    </div>
  );
}
