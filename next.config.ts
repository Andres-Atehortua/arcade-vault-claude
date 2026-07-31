import type { NextConfig } from 'next';

const isProduction = process.env.NODE_ENV === 'production';

const nextConfig: NextConfig = {
  output: 'export',

  basePath: isProduction ? '/arcade-vault-claude' : '',
  assetPrefix: isProduction ? '/arcade-vault-claude/' : '',

  images: {
    unoptimized: true
  },

  trailingSlash: true
};

export default nextConfig;
