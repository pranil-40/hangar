import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Imported apps are rendered in a sandboxed iframe on the app detail page.
  // We never widen framing permissions for Hangar's own pages.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
