import { betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import { db } from './db.js'

export const auth = betterAuth({
  database: prismaAdapter(db, {
    provider: 'postgresql',
  }),
  basePath: '/api/auth',
  trustedOrigins: [process.env['FRONTEND_URL'] ?? 'http://localhost:3000'],
  socialProviders: {
    github: {
      clientId: process.env['GITHUB_CLIENT_ID'] ?? '',
      clientSecret: process.env['GITHUB_CLIENT_SECRET'] ?? '',
      scope: ['read:user', 'user:email', 'repo'],
      redirectURI: `${process.env['BETTER_AUTH_URL'] ?? 'http://localhost:4000'}/api/auth/callback/github`,
    },
  },
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 60 * 60 * 24 * 7, // 7 days
    },
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
  },
  // Redirect to frontend after successful OAuth
  callbacks: {
    redirect: {
      afterSignIn: () => `${process.env['FRONTEND_URL'] ?? 'http://localhost:3000'}/dashboard`,
      afterSignUp: () => `${process.env['FRONTEND_URL'] ?? 'http://localhost:3000'}/dashboard`,
    },
  },
})

export type Auth = typeof auth
