/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['ipfs.io', 'gateway.ipfs.io', 'dweb.link', 'pool.pm'],
    unoptimized: true
  },
  trailingSlash: true,
}

module.exports = nextConfig
