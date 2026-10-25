import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Em desenvolvimento, /api vai para o backend (mesmo domínio = cookies simples).
  // Em produção o proxy do EasyPanel roteia /api direto para o backend.
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${process.env.BACKEND_INTERNAL_URL ?? "http://127.0.0.1:8000"}/api/:path*`,
      },
    ];
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
