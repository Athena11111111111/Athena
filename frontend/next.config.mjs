/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    const backend = (process.env.ATHENA_API_URL || 'http://127.0.0.1:8000').replace(/\/$/, '')
    return [{ source: '/api/:path*', destination: `${backend}/api/:path*` }]
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
