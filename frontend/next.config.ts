import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Exclude native modules from webpack bundling (they're handled by Node.js)
  serverExternalPackages: ['mupdf', 'sharp'],
  
  // Increase body size limit for file uploads
  experimental: {
    serverActions: {
      bodySizeLimit: '50mb',
    },
  },
};

export default nextConfig;
