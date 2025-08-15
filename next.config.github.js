/** @type {import('next').NextConfig} */
const nextConfig = {
  // GitHub Pages configuration
  output: 'export',
  trailingSlash: true,
  images: {
    unoptimized: true
  },
  // Set base path if repository name isn't username.github.io
  basePath: process.env.NODE_ENV === 'production' ? '/BetterDB' : '',
  assetPrefix: process.env.NODE_ENV === 'production' ? '/BetterDB/' : '',
};

module.exports = nextConfig;