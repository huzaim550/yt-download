/** @type {import('next').NextConfig} */
const isProduction = process.env.NODE_ENV === "production";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  },
];

if (isProduction) {
  securityHeaders.push(
    {
      key: "Content-Security-Policy",
      value: [
        "default-src 'self'",
        // Next.js injects inline bootstrap scripts. A nonce-based CSP would be
        // stricter, but this still blocks external and eval-based scripts.
        "script-src 'self' 'unsafe-inline'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: blob: https://*.ytimg.com https://img.youtube.com",
        "font-src 'self'",
        "connect-src 'self'",
        "frame-src 'none'",
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "object-src 'none'",
      ].join("; "),
    },
    {
      // Ignored over plain HTTP; useful when the app is served through HTTPS.
      key: "Strict-Transport-Security",
      value: "max-age=31536000",
    }
  );
}

const allowedDevOrigins = process.env.ALLOWED_DEV_ORIGINS
  ?.split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const nextConfig = {
  // Emit a self-contained server bundle (.next/standalone) for the Docker image.
  output: "standalone",
  // Optional: allow the dev server to be reached from another origin/device.
  ...(allowedDevOrigins?.length ? { allowedDevOrigins } : {}),
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.ytimg.com" },
      { protocol: "https", hostname: "img.youtube.com" },
    ],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
