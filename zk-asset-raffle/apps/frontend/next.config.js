/** @type {import('next').NextConfig} */
const nextConfig = {
  // Disable TypeScript checking during build to work around Next.js 15 type issues
  typescript: {
    // !! WARN !!
    // Dangerously allow production builds to successfully complete even if
    // your project has type errors.
    ignoreBuildErrors: true,
  },
  // Enforce ESLint during production builds
  eslint: {
    ignoreDuringBuilds: false,
  },
  transpilePackages: [
    "@zk-asset-raffle/sdk",
    "@zk-asset-raffle/types",
    "@zk-asset-raffle/crypto",
    "@zk-asset-raffle/trpc",
  ],
};

module.exports = nextConfig;
