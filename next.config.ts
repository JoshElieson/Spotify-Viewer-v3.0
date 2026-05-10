import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /** Hide the default bottom-left “N” dev badge (only in `next dev`; production is unchanged). */
  devIndicators: false,
  /** Dev HMR when opening the site via http://127.0.0.1:3000 instead of localhost. */
  allowedDevOrigins: ["127.0.0.1"],
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
