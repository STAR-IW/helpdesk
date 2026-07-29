import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { prisma } from './db.js';

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: 'postgresql' }),
  emailAndPassword: { enabled: true, disableSignUp: true },
  trustedOrigins: ['http://localhost:5173'],
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
