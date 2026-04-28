import type { NextConfig } from "next";

const apiServerBaseUrl = (process.env.API_SERVER_BASE_URL || "http://api:4000")
  .replace(/\/+$/, "")
  .replace(/\/api$/i, "");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${apiServerBaseUrl}/api/:path*`,
      },
      {
        source: "/uploads/:path*",
        destination: `${apiServerBaseUrl}/uploads/:path*`,
      },
    ];
  },
};

export default nextConfig;
