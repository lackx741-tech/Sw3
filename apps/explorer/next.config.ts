import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@sw3/ui", "@sw3/config", "@sw3/shared-types"],
  experimental: {
    typedRoutes: true,
  },
};

export default nextConfig;
