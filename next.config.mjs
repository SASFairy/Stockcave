/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Let's enable instrumentation so we can start node-cron on server startup.
  experimental: {
    instrumentationHook: true,
  },
};

export default nextConfig;
