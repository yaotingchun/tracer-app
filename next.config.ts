import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Keep firebase-admin and its heavy deps server-side only
  serverExternalPackages: ['firebase-admin', '@google-cloud/firestore', 'google-auth-library', '@google/genai'],

  // Set workspace root to silence multi-lockfile warning
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
