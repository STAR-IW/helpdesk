import type { auth } from '../auth.js';

type Session = typeof auth.$Infer.Session;

declare global {
  namespace Express {
    interface Request {
      session?: Session['session'];
      user?: Session['user'];
    }
  }
}

export {};