/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  experimental: {
    serverActions: { allowedOrigins: ["localhost:1004", "atelier-frontend:3000"] },
  },
  async rewrites() {
    return [
      {
        source: "/api/atelier/:path*",
        destination: `${process.env.ATELIER_API_URL || "http://atelier-backend:8000"}/:path*`,
      },
    ];
  },
};

export default nextConfig;
