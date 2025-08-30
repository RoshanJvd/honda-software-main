import 'dotenv/config';
export const PORT = Number(process.env.PORT || 4000);
export const MONGO_URI = process.env.MONGO_URI;
export const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';
