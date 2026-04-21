/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  output: "standalone",
  experimental: {
    serverComponentsExternalPackages: ["bcrypt", "sharp", "pg", "ioredis"],
  },
  images: {
    remotePatterns: [
      { protocol: "http", hostname: "**" },
      { protocol: "https", hostname: "**" },
    ],
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
