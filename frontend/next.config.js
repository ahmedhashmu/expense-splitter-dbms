/** @type {import('next').NextConfig} */

// The browser calls /api/...; Next.js forwards it to the FastAPI backend.
// Same origin for the browser, so the backend needs no CORS setup.
const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";

module.exports = {
  reactStrictMode: true,
  // stop next dev from writing AGENTS.md into the project
  agentRules: false,
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${BACKEND_URL}/:path*` }];
  },
};
