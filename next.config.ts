import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  serverExternalPackages: ['duckdb'],
};

export default nextConfig;
