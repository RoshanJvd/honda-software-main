import { Schema, model } from 'mongoose';

const ServiceSchema = new Schema({
  name: { type: String, required: true, unique: true },
  price: { type: Number, default: 0 },
  description: String
}, { timestamps: true });

ServiceSchema.index({ createdAt: 1 });

export const Service = model('Service', ServiceSchema);
