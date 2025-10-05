/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@local-office/ui'],
  eslint: {
    ignoreDuringBuilds: true
  }
};

export default nextConfig;
