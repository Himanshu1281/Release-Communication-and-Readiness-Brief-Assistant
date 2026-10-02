/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Prompts are read from disk at runtime; make sure Vercel bundles them with the analyze route.
    outputFileTracingIncludes: { "/api/versions/[id]/analyze": ["./prompts/**"] },
  },
};

export default nextConfig;
