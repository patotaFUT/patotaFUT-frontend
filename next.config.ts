import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  turbopack: { root: process.cwd() },
  experimental: {
    workerThreads: process.env.NEXT_BUILD_WORKER_THREADS === 'true',
  },
};

export default nextConfig;
