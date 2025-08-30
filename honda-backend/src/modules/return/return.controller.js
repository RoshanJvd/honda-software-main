import mongoose from 'mongoose';
import { ReturnDoc } from './return.model.js';
import { Invoice } from '../invoice/invoice.model.js';
import { Item } from '../item/item.model.js';
import { Movement } from '../movement/movement.model.js';

export async function list(req, res) {
  const { limit = 20, skip = 0 } = req.query;
  const [data, total] = await Promise.all([
    ReturnDoc.find().sort({ createdAt: -1 }).skip(Number(skip)).limit(Math.min(200, Number(limit))),
    ReturnDoc.countDocuments()
  ]);
  res.json({ data, total });
}

export async function create(req, res) {
  const { invoiceId, lines = [], reason = 'customer return' } = req.body;
  const session = await mongoose.startSession();
  let saved;
  await session.withTransaction(async () => {
    const inv = await Invoice.findById(invoiceId).session(session);
    if (!inv) throw Object.assign(new Error('Invoice not found'), { status: 404 });
    let refund = 0;

    for (const { itemId, qty } of lines) {
      const it = await Item.findById(itemId).session(session);
      if (!it) throw Object.assign(new Error('Item not found'), { status: 404 });
      const soldLine = inv.lines.find(l => l.kind === 'item' && String(l.refId) === String(itemId));
      if (!soldLine) throw Object.assign(new Error('Item not on invoice'), { status: 400 });

      refund += qty * (soldLine.price || 0);
      it.qty += Math.abs(qty);
      await it.save({ session });
      await Movement.create([{ itemId: it._id, qty: Math.abs(qty), type: 'return' }], { session });
    }

    saved = await ReturnDoc.create([{ invoiceId, lines, reason, refund }], { session }).then(r => r[0]);
  });
  session.endSession();
  res.status(201).json(saved);
}
