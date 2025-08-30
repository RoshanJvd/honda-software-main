import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import routes from './routes/index.js';
import { errorHandler } from './middleware/error.js';
import { CORS_ORIGIN } from './config/index.js';

export function createApp() {
  const app = express();
  app.use(cors({
    origin: function(origin, callback) {
      // allow requests with no origin (like mobile apps or curl requests)
      if(!origin) return callback(null, true);
      
      const origins = Array.isArray(CORS_ORIGIN) ? CORS_ORIGIN : [CORS_ORIGIN];
      if(origins.indexOf(origin) !== -1 || origins.includes('*')) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true
  }));
  app.use(express.json({ limit: '2mb' }));
  app.use(morgan('dev'));
  app.use('/api', routes);
  app.use(errorHandler);
  return app;
}
