import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // O contracts exporta TypeScript cru (sem build): o Next precisa transpilá-lo.
  transpilePackages: ['@plant-monitor/contracts'],
};

export default nextConfig;
