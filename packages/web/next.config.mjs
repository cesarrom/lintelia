/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '5mb',
    }
  },
  webpack: (config) => {
    config.resolve.alias.canvas = false;

    return config;
  },
};

export default nextConfig;
