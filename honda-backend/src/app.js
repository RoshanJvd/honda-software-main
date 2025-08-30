import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import routes from './routes/index.js';
import { errorHandler } from './middleware/error.js';
import { CORS_ORIGIN } from './config/index.js';

export function createApp() {
  const app = express();
  app.use(cors({ origin: CORS_ORIGIN, credentials: true }));
  app.use(express.json({ limit: '2mb' }));
  app.use(morgan('dev'));
  app.use('/api', routes);
  app.use(errorHandler);
  return app;
}
