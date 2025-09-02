import mongoose from 'mongoose';
import { Invoice } from './invoice.model.js';
import { Item } from '../item/item.model.js';
import { Movement } from '../movement/movement.model.js';
import { Service } from '../service/service.model.js';

export async function list(req, res) {
  const { from, to, limit = 20, skip = 0 } = req.query;
  const where = {};
  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt.$gte = new Date(from);
    if (to)   where.createdAt.$lte = new Date(to);
  }
  const [data, total] = await Promise.all([
    Invoice.find(where).sort({ createdAt: -1 }).skip(Number(skip)).limit(Math.min(200, Number(limit))),
    Invoice.countDocuments(where)
  ]);
  res.json({ data, total });
}

export async function create(req, res) {
  const payload = req.body; // { customerName, discount, tax, lines: [{kind, refId, qty, price}] }

  // For agents, validate that they can only use assigned items/services
  if (req.userRole === 'agent' && req.userId) {
    const { User } = await import('../user/user.model.js');
    const user = await User.findById(req.userId);
    if (!user) throw Object.assign(new Error('User not found'), { status: 404 });

    const assignedItemIds = new Set((user.assignedItems || []).map(id => id.toString()));
    const assignedServiceIds = new Set((user.assignedServices || []).map(id => id.toString()));

    for (const ln of payload.lines || []) {
      if (ln.kind === 'item') {
        if (!assignedItemIds.has(ln.refId.toString())) {
          throw Object.assign(new Error('Access denied to this item'), { status: 403 });
        }
      } else if (ln.kind === 'service') {
        if (!assignedServiceIds.has(ln.refId.toString())) {
          throw Object.assign(new Error('Access denied to this service'), { status: 403 });
        }
      }
    }
  }

  const session = await mongoose.startSession();
  let saved;
  await session.withTransaction(async () => {
    let subtotal = 0;
    const lines = [];
    for (const ln of payload.lines || []) {
      if (ln.kind === 'item') {
        const it = await Item.findById(ln.refId).session(session);
        if (!it) throw Object.assign(new Error('Item not found'), { status: 404 });
        if ((it.qty || 0) < ln.qty) throw Object.assign(new Error(`Insufficient stock for ${it.name}`), { status: 400 });
        it.qty -= ln.qty;
        await it.save({ session });
        await Movement.create([{ itemId: it._id, qty: -Math.abs(ln.qty), type: 'sale' }], { session });
        subtotal += ln.qty * ln.price;
        lines.push({ ...ln, name: it.name });
      } else if (ln.kind === 'service') {
        const svc = await Service.findById(ln.refId).session(session);
        if (!svc) throw Object.assign(new Error('Service not found'), { status: 404 });
        subtotal += ln.qty * ln.price;
        lines.push({ ...ln, name: svc.name });
      }
    }
    const discount = Number(payload.discount || 0);
    const tax = Number(payload.tax || 0);
    const grandTotal = subtotal - discount + tax;
    saved = await Invoice.create([{ customerName: payload.customerName || 'Walk-in', lines, subtotal, discount, tax, grandTotal }], { session }).then(r => r[0]);
  });
  session.endSession();
  res.status(201).json(saved);
}
