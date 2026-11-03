import type { NextConfig } from "next";

// Static, read-only site: no API routes, server actions, database or live data.
const nextConfig: NextConfig = {
  output: "export",
};

export default nextConfig;
