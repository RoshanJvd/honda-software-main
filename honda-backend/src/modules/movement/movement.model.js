import { Schema, model, Types } from 'mongoose';

const MovementSchema = new Schema({
  itemId: { type: Types.ObjectId, ref: 'Item', required: true },
  qty: { type: Number, required: true }, // +in / -out
  type: { type: String, enum: ['seed','purchase','sale','return','service','adjustment'], required: true }
}, { timestamps: true });

MovementSchema.index({ createdAt: 1 }); // time index

export const Movement = model('Movement', MovementSchema);
