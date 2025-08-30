import mongoose from 'mongoose';
import { MONGO_URI } from './config/index.js';

export async function connectDB() {
  if (!MONGO_URI) throw new Error('MONGO_URI missing');
  mongoose.set('strictQuery', true);
  await mongoose.connect(MONGO_URI);
  console.log('Mongo connected');
}
