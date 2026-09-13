import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://backend:3001/:path*",
      },
      {
        source: "/socket.io/:path*",
        destination: "http://backend:3001/socket.io/:path*",
      },
    ];
  },
};

export default nextConfig;
