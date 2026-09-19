export function Logo({ size = 22 }: { size?: number }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.5rem",
        fontWeight: 700,
        fontSize: size,
        letterSpacing: "-0.02em",
      }}
    >
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M2 20V11.2c0-.5.25-.96.67-1.24l8.2-5.4a2 2 0 0 1 2.26 0l8.2 5.4c.42.28.67.74.67 1.24V20"
          stroke="var(--accent)"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path d="M2 20h20" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" />
        <path
          d="M8 20v-5.5a4 4 0 0 1 8 0V20"
          stroke="var(--text-muted)"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
      Hangar
    </span>
  );
}
