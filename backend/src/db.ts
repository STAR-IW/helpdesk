import { PrismaClient } from './generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });

// User.email must always be stored lowercase: better-auth's sign-in lookup
// lowercases the email it queries with, so any mixed-case row can never be
// matched again. Normalizing here (not at each call site) makes every
// current and future write/lookup on User.email safe by construction.
export const prisma = new PrismaClient({ adapter }).$extends({
  query: {
    user: {
      $allOperations({ args, query }) {
        const where = 'where' in args ? args.where : undefined;
        if (where && typeof where === 'object' && typeof where.email === 'string') {
          where.email = where.email.toLowerCase();
        }

        const data = 'data' in args ? args.data : undefined;
        if (data && typeof data === 'object' && !Array.isArray(data) && typeof data.email === 'string') {
          data.email = data.email.toLowerCase();
        }

        return query(args);
      },
    },
  },
});