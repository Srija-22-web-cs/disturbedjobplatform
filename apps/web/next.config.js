/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: [
    '@distributed-job-platform/shared-types',
    '@distributed-job-platform/shared-utils',
  ],
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
  },
};

module.exports = nextConfig;
