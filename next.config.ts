import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  serverExternalPackages: ['postgres', 'twilio'],
  async headers() {
    // mascot art URLs carry ?v=NAMI_ART_VERSION, so browsers can keep them forever
    return [{ source: '/nami/:file*', headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }] }];
  },
};

export default nextConfig;
