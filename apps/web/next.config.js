/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  experimental: {
    serverComponentsExternalPackages: ['@prisma/client'],
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.gdcatalog.go.th' },
    ],
  },
}

module.exports = nextConfig
