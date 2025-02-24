/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '5mb',
    }
  },
  transpilePackages: ['@descope/node-sdk', 'typeorm'],
  webpack: (config, { isServer }) => {
    
    if (isServer) {
      config.externals.push('typeorm');
    }
    
    return config;
  },
};

export default nextConfig;
