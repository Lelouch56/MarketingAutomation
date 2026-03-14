/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow images from any domain (for blog/LinkedIn image URLs from LLMs)
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
      { protocol: 'http',  hostname: '**' },
    ],
  },
};

module.exports = nextConfig;
