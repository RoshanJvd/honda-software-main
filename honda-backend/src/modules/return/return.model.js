import { Schema, model, Types } from 'mongoose';

const ReturnSchema = new Schema({
  invoiceId: { type: Types.ObjectId, ref: 'Invoice', required: true },
  lines: [{ itemId: { type: Types.ObjectId, ref: 'Item', required: true }, qty: { type: Number, required: true } }],
  reason: String,
  refund: { type: Number, default: 0 }
}, { timestamps: true });

ReturnSchema.index({ createdAt: 1 });

export const ReturnDoc = model('Return', ReturnSchema);
