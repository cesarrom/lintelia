/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '5mb',
    },
    turbo: {
      resolveAlias: {},
      resolveExtensions: ['.mdx', '.tsx', '.ts', '.jsx', '.js', '.json'],
    },
  },
  transpilePackages: ['@descope/node-sdk', 'typeorm'],
};

export default nextConfig;
