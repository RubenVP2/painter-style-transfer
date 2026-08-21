import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emits .next/standalone so the Docker runtime stage stays tiny.
  output: "standalone",
  // The repo root is the Docker build context (prompts/ has to be visible at
  // build time); tell Next where to stop looking for the workspace root.
  outputFileTracingRoot: __dirname,
};

export default nextConfig;
