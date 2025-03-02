import NextAuth, { DefaultSession, NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { firebaseAdmin } from "@/lib/firebaseAdmin"

// Extend the built-in session types
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
    } & DefaultSession["user"]
  }
}

// For more information on each option (and a full list of options) go to
// https://next-auth.js.org/configuration/options
if (!process.env.NEXTAUTH_SECRET) {
  throw new Error('Please define NEXTAUTH_SECRET environment variable')
}

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  // https://next-auth.js.org/configuration/providers
  providers: [
    CredentialsProvider({
      id: "credentials",
      name: "Credentials",
      credentials: {
        idToken: { label: "ID Token", type: "text" }
      },
      async authorize(credentials) {
        try {
          if (!credentials?.idToken) {
            throw new Error('No ID token provided')
          }
          const decoded = await firebaseAdmin.auth().verifyIdToken(credentials.idToken)
          return {
            id: decoded.uid,
            name: decoded.name || decoded.email?.split('@')[0] || decoded.uid,
            email: decoded.email,
            image: decoded.picture
          }
        } catch (error) {
          console.error('Auth error:', error)
          return null
        }
      },
    }),
  ],

  // The secret should be set to a reasonably long random string.
  // It is used to sign cookies and to sign and encrypt JSON Web Tokens, unless
  // a separate secret is defined explicitly for encrypting the JWT.
  session: {
    strategy: "jwt" as const,
    // Seconds - How long until an idle session expires and is no longer valid.
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },

  // JSON Web tokens are only used for sessions if the `jwt: true` session
  // option is set - or by default if no database is specified.
  // https://next-auth.js.org/configuration/options#jwt
  jwt: {
    // A secret to use for key generation (you should set this explicitly)
    secret: process.env.NEXTAUTH_SECRET,
  },

  // You can define custom pages to override the built-in ones. These will be regular Next.js pages
  // so ensure that they are placed outside of the '/api' folder, e.g. signIn: '/auth/mycustom-signin'
  // The routes shown here are the default URLs that will be used when a custom
  // pages is not specified for that route.
  // https://next-auth.js.org/configuration/pages
  pages: {
    signIn: "/auth/signin", // Displays signin buttons
    error: '/auth/error'
  },

  // Callbacks are asynchronous functions you can use to control what happens
  // when an action is performed.
  // https://next-auth.js.org/configuration/callbacks
  callbacks: {
    jwt: async ({ token, user }) => {
      if (user) {
        // Include Firebase UID and other custom claims
        token.uid = user.id
        token = {
          ...token,
          ...user
        }
      }
      return token
    },
    
    // Add session callback to include user data
    session: async ({ session, token }: { session: any, token: any }) => {
      if (token && session.user) {
        session.user.id = token.uid as string
      }
      return session
    }
  },

  // Events are useful for logging
  // https://next-auth.js.org/configuration/events
  events: {},

  // Enable debug messages in the console if you are having problems
  debug: process.env.NODE_ENV !== "production",
}

export default NextAuth(authOptions)