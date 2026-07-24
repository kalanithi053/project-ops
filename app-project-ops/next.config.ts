import type { NextConfig } from "next";

/**
 * Proxy the ProjectOps API through Next.js so the browser talks to the
 * app's own origin (no CORS). Requests to `/api/v1/*` are rewritten
 * server-side to the upstream API. Set `API_UPSTREAM_URL` per environment.
 */
const API_UPSTREAM_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ??
  "http://localhost:3000/api/v1";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: `${API_UPSTREAM_URL}/:path*`,
      },
    ];
  },
};

export default nextConfig;
