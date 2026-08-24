import { env } from './env.js';
import express from 'express';
import cors from 'cors';
import { toNodeHandler } from 'better-auth/node';
import { auth } from './auth.js';
import { usersRouter } from './routes/users.js';
import { inboundEmailRouter } from './routes/inbound-email.js';
import { ticketsRouter } from './routes/tickets.js';

const app = express();
const port = env.PORT ?? 3000;

app.use(cors({ origin: env.FRONTEND_URL, credentials: true }));

app.all('/api/auth/*splat', toNodeHandler(auth));

app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/users', usersRouter);
app.use('/api/tickets', ticketsRouter);
app.use('/api/webhooks/inbound-email', inboundEmailRouter);

app.listen(port, () => {
  console.log(`Backend listening on http://localhost:${port}`);
});