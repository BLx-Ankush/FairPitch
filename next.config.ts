import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Compress responses with Gzip/Brotli to reduce network egress bandwidth by ~75%
  compress: true,
  // Remove X-Powered-By header for security and payload reduction
  poweredByHeader: false,
  // Cache static chunks and headers for peak performance
  headers: async () => [
    {
      source: '/:path*',
      headers: [
        {
          key: 'X-DNS-Prefetch-Control',
          value: 'on',
        },
        {
          key: 'X-Content-Type-Options',
          value: 'nosniff',
        },
      ],
    },
  ],
};

export default nextConfig;
