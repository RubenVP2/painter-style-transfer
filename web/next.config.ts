import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emits .next/standalone so the Docker runtime stage stays tiny.
  output: "standalone",
  // The repo root is the Docker build context (prompts/ has to be visible at
  // build time); tell Next where to stop looking for the workspace root.
  outputFileTracingRoot: __dirname,
  // Next serves public/ with `max-age=0`, which would re-download every
  // thumbnail on every visit. Gallery filenames are stable and their content
  // never changes under a given name, so they can be cached forever.
  async headers() {
    return [
      {
        source: "/gallery/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
    ];
  },
};

export default nextConfig;
