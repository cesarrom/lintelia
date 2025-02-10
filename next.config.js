/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '5mb',
    }
  },
  transpilePackages: ['@descope/node-sdk'],
};

export default nextConfig;
