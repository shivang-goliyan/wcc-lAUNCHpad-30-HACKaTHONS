import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  serverExternalPackages: ['postgres', 'twilio'],
  outputFileTracingIncludes: { '/*': ['./lib/db/schema.sql'] },
};

export default nextConfig;
