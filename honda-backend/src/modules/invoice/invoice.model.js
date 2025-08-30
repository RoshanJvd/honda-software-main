import { Schema, model, Types } from 'mongoose';

const LineSchema = new Schema({
  kind: { type: String, enum: ['item','service'], required: true },
  refId: { type: Types.ObjectId, required: true },
  name: String,
  qty: { type: Number, default: 1 },
  price: { type: Number, default: 0 }
}, { _id: false });

const InvoiceSchema = new Schema({
  customerName: { type: String, default: 'Walk-in' },
  lines: { type: [LineSchema], default: [] },
  discount: { type: Number, default: 0 },
  tax: { type: Number, default: 0 },
  subtotal: { type: Number, default: 0 },
  grandTotal: { type: Number, default: 0 }
}, { timestamps: true });

InvoiceSchema.index({ createdAt: 1 }); // time index

export const Invoice = model('Invoice', InvoiceSchema);
