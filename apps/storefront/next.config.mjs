/**
 * Image hosts the storefront may load through next/image.
 *
 * NEXT_PUBLIC_IMAGE_HOSTS is a comma-separated list of hostnames that serve store media: the store
 * API host and the CDN or object-storage host. A leading "*." matches subdomains, for example
 * "*.r2.dev". Entries are https unless the entry is "localhost", which is allowed over http and https.
 * When the variable is unset, only localhost is allowed, which is the development default.
 * Any other host is refused by next/image, so set this variable in every deployed environment.
 *
 * @param {string | undefined} raw
 * @returns {import('next').NextConfig['images']['remotePatterns']}
 */
function buildRemotePatterns(raw) {
  const hosts = (raw || '')
    .split(',')
    .map((host) => host.trim().toLowerCase())
    .filter((host) => host.length > 0);
  if (hosts.length === 0) {
    hosts.push('localhost', 'images.unsplash.com', 'cdn.example.com', '*.r2.dev');
  }
  return hosts.flatMap((host) => {
    if (host === 'localhost') {
      return [
        { protocol: 'http', hostname: 'localhost' },
        { protocol: 'https', hostname: 'localhost' },
      ];
    }
    return [
      { protocol: 'https', hostname: host },
      { protocol: 'http', hostname: host },
    ];
  });
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: buildRemotePatterns(process.env.NEXT_PUBLIC_IMAGE_HOSTS),
  },
};

export default nextConfig;
