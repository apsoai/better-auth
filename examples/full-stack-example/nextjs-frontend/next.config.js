/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    BETTER_AUTH_URL: process.env.BETTER_AUTH_URL || 'http://localhost:3000',
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET || 'your-secret-key-here',
    APSO_BASE_URL: process.env.APSO_BASE_URL || 'http://localhost:3001',
  },
}

module.exports = nextConfig