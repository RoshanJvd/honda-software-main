import mongoose from 'mongoose';
import XLSX from 'xlsx';
import { Item } from './item.model.js';
import { Movement } from '../movement/movement.model.js';

export async function list(req, res) {
  const { q = '', limit = 20, skip = 0 } = req.query;
  const where = q
    ? { $or: [{ name: new RegExp(q, 'i') }, { sku: new RegExp(q, 'i') }, { supplier: new RegExp(q, 'i') }] }
    : {};
  const [items, total] = await Promise.all([
    Item.find(where).sort({ createdAt: -1 }).skip(Number(skip)).limit(Math.min(200, Number(limit))),
    Item.countDocuments(where)
  ]);
  res.json({ data: items, total });
}

export async function create(req, res) {
  const body = req.body;
  const saved = await Item.create(body);
  if (saved.qty) {
    await Movement.create({ itemId: saved._id, qty: saved.qty, type: 'purchase' });
  }
  res.status(201).json(saved);
}

export async function update(req, res) {
  const patch = req.body;
  const updated = await Item.findByIdAndUpdate(req.params.id, patch, { new: true });
  if (!updated) return res.status(404).json({ message: 'Not found' });
  res.json(updated);
}

export async function remove(req, res) {
  await Item.findByIdAndDelete(req.params.id);
  res.status(204).end();
}

export async function adjust(req, res) {
  const { delta, reason = 'adjustment' } = req.body;
  const session = await mongoose.startSession();
  await session.withTransaction(async () => {
    const it = await Item.findById(req.params.id).session(session);
    if (!it) throw Object.assign(new Error('Item not found'), { status: 404 });
    if (it.qty + Number(delta) < 0) throw Object.assign(new Error('Insufficient stock'), { status: 400 });
    it.qty += Number(delta);
    await it.save({ session });
    await Movement.create([{ itemId: it._id, qty: Number(delta), type: reason }], { session });
  });
  session.endSession();
  res.json({ ok: true });
}

// XLSX import: expects file field name "file"
export async function importXlsx(req, res) {
  if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
  const wb = XLSX.read(req.file.buffer, { type: 'buffer' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });

  const ops = [];
  for (const r of rows) {
    const doc = {
      name: r.name || r.Name || r.item || r.Item,
      sku: String(r.sku || r.SKU || r.code || r.Code || ''),
      qty: Number(r.qty || r.Qty || 0),
      low: Number(r.low || r.Low || 5),
      buy: Number(r.buy || r.Buy || 0),
      sell: Number(r.sell || r.Sell || 0),
      supplier: r.supplier || r.Supplier || '',
      desc: r.desc || r.Desc || ''
    };
    if (!doc.name || !doc.sku) continue;
    ops.push({ updateOne: { filter: { sku: doc.sku }, update: { $setOnInsert: doc }, upsert: true } });
  }
  if (ops.length) await Item.bulkWrite(ops);

  res.json({ imported: ops.length });
}
