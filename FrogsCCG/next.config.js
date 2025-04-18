/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['ipfs.io', 'gateway.ipfs.io', 'dweb.link', 'pool.pm'],
    unoptimized: true
  },
  // Optimize bundle size
  swcMinify: true,
  // Reduce size by excluding unnecessary files
  webpack: (config) => {
    config.optimization.minimize = true;
    return config;
  },
  // Add trailing slashes to help with routing
  trailingSlash: true,
  // Ensure static exports work properly
  output: 'standalone',
}

module.exports = nextConfig
