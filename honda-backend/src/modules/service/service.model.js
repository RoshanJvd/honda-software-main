import { Schema, model } from 'mongoose';

const ServiceSchema = new Schema({
  name: { type: String, required: true, unique: true },
  barcode: { type: String, index: true },
  assignedTo: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  price: { type: Number, default: 0 },
  description: String
}, { timestamps: true });

ServiceSchema.index({ createdAt: 1 });

export const Service = model('Service', ServiceSchema);
