/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['ipfs.io', 'gateway.ipfs.io', 'dweb.link', 'pool.pm'],
  },
  // Optimize bundle size
  swcMinify: true,
  // Reduce size by excluding unnecessary files
  webpack: (config) => {
    config.optimization.minimize = true;
    return config;
  },
}

module.exports = nextConfig
