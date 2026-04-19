/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  output: "standalone",
  experimental: {
    serverComponentsExternalPackages: ["bcrypt", "sharp", "pg", "ioredis"],
  },
};

export default config;
