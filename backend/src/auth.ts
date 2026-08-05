import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { prisma } from './db.js';
import { env } from './env.js';

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: 'postgresql' }),
  emailAndPassword: { enabled: true, disableSignUp: true },
  trustedOrigins: [env.FRONTEND_URL],
  rateLimit: {
    enabled: env.NODE_ENV === 'production',
    storage: 'database',
  },
  user: {
    additionalFields: {
      role: {
        type: ['admin', 'agent'],
        required: false,
        defaultValue: 'agent',
        input: false,
      },
    },
  },
});
