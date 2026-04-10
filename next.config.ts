import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,

  // Cache static assets lebih agresif — kurangi repeat requests ke server
  headers: async () => [
    {
      source: '/:all*(svg|jpg|jpeg|png|gif|webp|ico|woff|woff2)',
      headers: [
        {
          key: 'Cache-Control',
          value: 'public, max-age=31536000, immutable',
        },
      ],
    },
  ],
};

export default nextConfig;
