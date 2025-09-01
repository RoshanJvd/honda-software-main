import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import routes from './routes/index.js';
import { errorHandler } from './middleware/error.js';
import { CORS_ORIGIN } from './config/index.js';

export function createApp() {
  const app = express();
  // Explicit CORS headers middleware to ensure preflight responses include required headers
  app.use((req, res, next) => {
    const allowed = Array.isArray(CORS_ORIGIN) ? CORS_ORIGIN : [CORS_ORIGIN];
    const origin = req.headers.origin;
    if (!origin || allowed.indexOf(origin) !== -1 || allowed.includes('*')) {
      res.setHeader('Access-Control-Allow-Origin', origin || allowed[0] || '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,PATCH,OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-role, x-user-id');
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
  });
  app.use(cors({
    origin: CORS_ORIGIN,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'x-role', 'x-user-id'],
    credentials: true
  }));
  app.use(express.json({ limit: '2mb' }));
  app.use(morgan('dev'));
  app.use('/api', routes);
  app.use(errorHandler);
  return app;
}
