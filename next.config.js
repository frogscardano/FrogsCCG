/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['ipfs.io', 'gateway.ipfs.io', 'dweb.link', 'pool.pm'],
    unoptimized: true
  },
  // Optimize bundle size
  webpack: (config) => {
    config.optimization.minimize = true;
    return config;
  },
  // Add trailing slashes to help with routing
  trailingSlash: true,
  // Remove standalone output for Vercel compatibility
  // output: 'standalone',
}

module.exports = nextConfig
