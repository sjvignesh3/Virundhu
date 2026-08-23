/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  /**
   * Rewrites: proxy /api/* → NestJS backend so the browser never issues a
   * cross-origin request (no CORS issues in development/production on the
   * same host). The backend remains independently deployable — just configure
   * the env var below.
   *
   * In production on a split deployment (e.g. Vercel + Railway) remove the
   * rewrite block and rely on CORS + the NEXT_PUBLIC_API_URL env var.
   */
  async rewrites() {
    // Server-side-only target for the rewrite (never sent to the browser).
    // Falls back to NEXT_PUBLIC_API_URL only when it is an absolute URL
    // (i.e. not already pointing back at "/proxy-api", which would loop).
    const publicUrl = process.env.NEXT_PUBLIC_API_URL ?? "";
    const fallback = /^https?:\/\//.test(publicUrl) ? publicUrl : "http://localhost:4000/api";
    const apiUrl = process.env.API_PROXY_TARGET ?? fallback;
    // Strip trailing /api so we can append the path cleanly.
    const apiBase = apiUrl.replace(/\/api\/?$/, "");
    return [
      {
        source: "/proxy-api/:path*",
        destination: `${apiBase}/api/:path*`,
      },
    ];
  },

  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
    ],
  },
};

export default nextConfig;
