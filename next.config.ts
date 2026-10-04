import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Tool uploads from the browser (src/app/actions/upload.ts) carry up to
    // 3 MB of files plus multipart overhead.
    serverActions: { bodySizeLimit: "4mb" },
  },

  // Hangar's own pages can never be framed, and may only frame Hangar. The
  // second rule is what keeps a hosted tool's frame from navigating itself
  // to an outside address: the browser checks every load into a frame
  // against the parent page's frame-src.
  //
  // Hosted tools (/run) and their assets (/a) are excluded here only because
  // their route handlers set a stricter policy themselves: a CSP sandbox
  // plus frame-ancestors 'self', so Hangar can frame a tool and nobody else
  // can.
  async headers() {
    return [
      {
        source: "/:path((?!run/|a/).*)",
        headers: [
          { key: "Content-Security-Policy", value: "frame-src 'self'; frame-ancestors 'none'; object-src 'none'" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
