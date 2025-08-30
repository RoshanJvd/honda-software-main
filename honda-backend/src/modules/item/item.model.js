import { Schema, model } from 'mongoose';

const ItemSchema = new Schema({
  name: { type: String, required: true, index: true },
  sku: { type: String, required: true, unique: true }, // code
  qty: { type: Number, default: 0 },
  low: { type: Number, default: 5 },
  buy: { type: Number, default: 0 },
  sell: { type: Number, default: 0 },
  supplier: String,
  desc: String
}, { timestamps: true });

ItemSchema.index({ createdAt: 1 }); // time index
ItemSchema.index({ name: 'text', sku: 'text', supplier: 'text' });

export const Item = model('Item', ItemSchema);
