import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'www.sakinah.now' }],
        destination: 'https://sakinah.now/:path*',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
