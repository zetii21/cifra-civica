import type { NextConfig } from "next";

const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "form-action 'self'",
  // React server components emit inline bootstrap data. We do not allow third-
  // party script hosts or eval in production.
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "worker-src 'self' blob:",
  "media-src 'self'",
].join("; ");

// The media widget is the only route that may be framed by third parties. It
// serves exclusively public aggregate statistics, sets no cookies and takes
// no input, so clickjacking has no target. Modern browsers ignore
// X-Frame-Options when frame-ancestors is present (CSP2), which lets us keep
// the global DENY as a conservative fallback for legacy agents.
const widgetContentSecurityPolicy = contentSecurityPolicy.replace(
  "frame-ancestors 'none'",
  "frame-ancestors *",
);

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: contentSecurityPolicy },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()",
          },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "X-DNS-Prefetch-Control", value: "off" },
        ],
      },
      {
        source: "/widget/:path*",
        headers: [
          { key: "Content-Security-Policy", value: widgetContentSecurityPolicy },
        ],
      },
    ];
  },
};

export default nextConfig;
