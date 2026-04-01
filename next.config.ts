const nextConfig = {
  /* config options here */
  reactCompiler: true,
  serverExternalPackages: ['duckdb'],

  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
