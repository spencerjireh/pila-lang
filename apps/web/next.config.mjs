// Build the image remotePatterns allow-list from the configured S3 hosts so the
// optimizer is not an open image proxy. Tenant logos are the only remote images
// next/image serves — the rest live under apps/web/public and never hit the
// remote-pattern check. Derives from env so dev (localhost:9000) and prod
// (real S3 host) stay in sync without a config fork.
function imageRemotePatterns() {
  const hosts = [process.env.S3_ENDPOINT, process.env.S3_PUBLIC_URL_BASE]
    .filter(Boolean)
    .map((raw) => {
      try {
        const u = new URL(raw);
        return { protocol: u.protocol.replace(":", ""), hostname: u.hostname };
      } catch {
        return null;
      }
    })
    .filter(Boolean);
  // Deduplicate on protocol+hostname.
  const seen = new Set();
  return hosts.filter(({ protocol, hostname }) => {
    const key = `${protocol}://${hostname}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  output: "standalone",
  experimental: {
    serverComponentsExternalPackages: ["bcrypt", "sharp", "pg", "ioredis"],
  },
  images: {
    remotePatterns: imageRemotePatterns(),
    dangerouslyAllowSVG: true,
    contentDispositionType: "attachment",
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
  webpack: (webpackConfig, { isServer }) => {
    if (isServer) {
      // bcrypt reaches for @mapbox/node-pre-gyp which in turn \`require()\`s
      // `aws-sdk`, `mock-aws-s3`, `nock`, and an HTML file — none of which
      // ship in a prod build. Externalizing the whole bcrypt module lets
      // Node resolve it at runtime from node_modules.
      webpackConfig.externals.push("bcrypt");
    }
    return webpackConfig;
  },
  async rewrites() {
    // Dev convenience: forward /api/v1/* to the standalone apps/api on
    // port 3001 so client fetches with relative paths work without CORS.
    // In prod, Coolify+Traefik does this routing — we keep this empty so
    // Next never proxies API traffic through its dev server. SSE always
    // bypasses rewrites via NEXT_PUBLIC_API_BASE_URL (apps/web/lib/sse/
    // use-live-stream.ts) because Node's http proxy can buffer streams.
    if (process.env.NODE_ENV === "production") return [];
    const apiBase =
      process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";
    return [
      { source: "/api/v1/:path*", destination: `${apiBase}/api/v1/:path*` },
    ];
  },
  async headers() {
    return [
      {
        source: "/.well-known/apple-app-site-association",
        headers: [
          { key: "Content-Type", value: "application/json" },
          { key: "Cache-Control", value: "public, max-age=3600" },
        ],
      },
      {
        source: "/.well-known/assetlinks.json",
        headers: [
          { key: "Content-Type", value: "application/json" },
          { key: "Cache-Control", value: "public, max-age=3600" },
        ],
      },
    ];
  },
};

export default config;
