import 'dotenv/config';

export const PORT = Number(process.env.PORT || 4000);
export const MONGO_URI = process.env.MONGO_URI;
export const CORS_ORIGIN = [
  'https://honda-software-main.vercel.app',
  'https://www.masterhonda.com',
  'http://localhost:3000',
  'http://localhost:5000',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5000',
  'http://127.0.0.1:5500',
  'http://localhost:5500',
  'http://127.0.0.1:5501',
  'http://localhost:5501',
  'http://127.0.0.1:5502',
  'http://localhost:5502'
];
