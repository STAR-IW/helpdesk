import { createAuthClient } from 'better-auth/react'
import { inferAdditionalFields } from 'better-auth/client/plugins'

export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_API_URL,
  plugins: [
    inferAdditionalFields({
      user: {
        role: { type: 'string' },
      },
    }),
  ],
})

export const { signIn, signOut, useSession } = authClient
