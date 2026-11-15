// The core middleware's frontend API over HTTP: POST one request of the
// protocol described in core/api.ts, get its reply. Mounted at
// /api/core/call, and at /api/call as well when the server is started
// with MIDDLEWARE=core.

import { Router } from 'express';
import { callCore } from '../core/api.js';

export const coreCallRouter = Router();

coreCallRouter.post('/', (req, res) => {
  const body = typeof req.body === 'string' ? req.body : '';
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : undefined;
  const reply = callCore(body, token);
  res.status(reply.status).type('text/csv').send(reply.body);
});
