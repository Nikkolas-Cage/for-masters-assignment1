/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Transpile MediaPipe packages for compatibility
  transpilePackages: ['@mediapipe/face_mesh'],
  // Turbopack configuration (Next.js 16 uses Turbopack by default)
  turbopack: {
    // Empty config - dynamic imports handle MediaPipe modules
  },
};

export default nextConfig;
