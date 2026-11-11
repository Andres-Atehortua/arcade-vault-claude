import type { NextConfig } from 'next';

// Security headers applied to every route (spec 13). CSP and COEP are intentionally out of scope.
const securityHeaders: { key: string; value: string }[] = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  { key: 'X-Permitted-Cross-Domain-Policies', value: 'none' },
];

const nextConfig: NextConfig = {
  allowedDevOrigins: ['169.254.10.29', '192.168.1.108'],
  poweredByHeader: false,
  headers: async () => [{ source: '/(.*)', headers: securityHeaders }],
};

export default nextConfig;
