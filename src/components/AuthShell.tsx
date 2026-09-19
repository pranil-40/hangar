import { Logo } from "@/components/Logo";

export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "grid",
        placeItems: "center",
        padding: "2rem 1rem",
      }}
    >
      <div style={{ width: "100%", maxWidth: 400 }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: "1.5rem" }}>
          <Logo />
        </div>

        <div className="card" style={{ padding: "1.6rem" }}>
          <h1 style={{ margin: "0 0 0.3rem", fontSize: "1.25rem", letterSpacing: "-0.01em" }}>
            {title}
          </h1>
          <p className="muted" style={{ margin: "0 0 1.3rem", fontSize: "0.88rem" }}>
            {subtitle}
          </p>
          {children}
        </div>
      </div>
    </main>
  );
}
