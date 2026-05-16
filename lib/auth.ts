import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import GoogleProvider from 'next-auth/providers/google'
import GithubProvider from 'next-auth/providers/github'
import { PrismaAdapter } from '@auth/prisma-adapter'
import bcrypt from 'bcryptjs'
import { prisma } from './prisma'

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as any,
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
        totp: { label: 'Authenticator Code', type: 'text', placeholder: '000000' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Invalid credentials')
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        })

        // Always run bcrypt compare to prevent timing-based account enumeration.
        // If no user (or no password hash), compare against a dummy hash so the
        // response time is indistinguishable from a real failed login.
        const isValid = user?.password
          ? await bcrypt.compare(credentials.password, user.password)
          : await bcrypt.compare(credentials.password, '$2a$12$dummyhashtopreventtimingXXXXXXXXXXXXXXXXXXXX')

        if (!user || !user.password || !isValid) {
          throw new Error('Invalid email or password')
        }

        // Check 2FA
        const prefs = await prisma.userPreferences.findUnique({ where: { userId: user.id } })
        if (prefs?.twoFactorEnabled && prefs.twoFactorSecret) {
          const totp = (credentials as any).totp as string | undefined
          if (!totp) {
            throw new Error('TOTP_REQUIRED')
          }
          const { verifyToken } = await import('@/lib/totp')
          const secret = Buffer.from(prefs.twoFactorSecret, 'base64').toString()
          const valid = verifyToken(totp, secret)
          if (!valid) {
            throw new Error('Invalid authenticator code')
          }
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
        }
      },
    }),
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          }),
        ]
      : []),
    ...(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET
      ? [
          GithubProvider({
            clientId: process.env.GITHUB_CLIENT_ID,
            clientSecret: process.env.GITHUB_CLIENT_SECRET,
          }),
        ]
      : []),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id as string
      }
      return session
    },
  },
  events: {
    async createUser({ user }) {
      // Create default preferences for new users
      await prisma.userPreferences.create({
        data: {
          userId: user.id,
          assistantName: 'NEXUS',
        },
      })
      // Log initial activity
      await prisma.activityLog.create({
        data: {
          userId: user.id,
          action: 'ACCOUNT_CREATED',
          details: 'Welcome to NEXUS — your AI Personal Operating System',
        },
      })
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
}
