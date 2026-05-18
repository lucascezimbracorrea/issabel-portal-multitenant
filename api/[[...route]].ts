import { Hono } from 'hono';
import { handle } from 'hono/vercel';
import { app as apiApp } from '../apps/api/dist/index.js';

/** Mount portal API under /api (matches Vite dev proxy and web client base path). */
const gateway = new Hono();
gateway.route('/api', apiApp);

export const config = {
  runtime: 'nodejs20.x',
  maxDuration: 60,
};

export default handle(gateway);
