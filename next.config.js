/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable standalone output for Docker
  output: 'standalone',
  
  // Optimize for production
  poweredByHeader: false,
  
  // Image optimization
  images: {
    domains: [],
    unoptimized: true, // For static export if needed
  },
  
  // Experimental features
  experimental: {
    // Reduce bundle size
    optimizePackageImports: ['lucide-react'],
  },
  
  // API route configuration
  api: {
    bodyParser: {
      sizeLimit: '1mb',
    },
  },
};

module.exports = nextConfig;
