import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow images from local uploads
  images: {
    domains: ["localhost"],
  },
  // Disable server-side minification issues with better-sqlite3
  serverExternalPackages: ["better-sqlite3", "@prisma/adapter-better-sqlite3"],
};

export default nextConfig;
