import mongoose from 'mongoose';
import XLSX from 'xlsx';
import { Item } from './item.model.js';
import { Movement } from '../movement/movement.model.js';

export async function list(req, res) {
  const { q = '', limit = 20, skip = 0 } = req.query;
  let where = q
    ? { $or: [{ name: new RegExp(q, 'i') }, { sku: new RegExp(q, 'i') }, { supplier: new RegExp(q, 'i') }] }
    : {};

  // If agent role, restrict strictly to assigned items. If none, return empty.
  if (req.userRole === 'agent') {
    if (!req.userId) {
      return res.json({ data: [], total: 0 });
    }
    const { User } = await import('../user/user.model.js');
    const user = await User.findById(req.userId);
    if (!user || !Array.isArray(user.assignedItems) || user.assignedItems.length === 0) {
      return res.json({ data: [], total: 0 });
    }
    where._id = { $in: user.assignedItems };
  }

  const [items, total] = await Promise.all([
    Item.find(where).sort({ createdAt: -1 }).skip(Number(skip)).limit(Math.min(2000, Number(limit))),
    Item.countDocuments(where)
  ]);
  res.json({ data: items, total });
}

export async function create(req, res) {
  // Agents cannot create new items, only use assigned ones
  if (req.userRole === 'agent') {
    return res.status(403).json({ message: 'Agents cannot create items' });
  }
  const body = req.body;
  const saved = await Item.create(body);
  if (saved.qty) {
    await Movement.create({ itemId: saved._id, qty: saved.qty, type: 'purchase' });
  }
  res.status(201).json(saved);
}

export async function scan(req, res) {
  const { code } = req.params;
  if (!code) return res.status(400).json({ message: 'code required' });
  let where = { $or: [{ sku: code }, { barcode: code }] };

  // If agent role, restrict to assigned items only
  if (req.userRole === 'agent' && req.userId) {
    const { User } = await import('../user/user.model.js');
    const user = await User.findById(req.userId);
    if (user && user.assignedItems && user.assignedItems.length > 0) {
      where._id = { $in: user.assignedItems };
    } else {
      return res.status(404).json({ message: 'Not found' });
    }
  }

  const it = await Item.findOne(where);
  if (!it) return res.status(404).json({ message: 'Not found' });
  res.json(it);
}

export async function update(req, res) {
  const patch = req.body || {};
  const existing = await Item.findById(req.params.id);
  if (!existing) return res.status(404).json({ message: 'Not found' });

  const nextQty = typeof patch.qty === 'number' ? Number(patch.qty) : existing.qty;
  if (Number.isNaN(nextQty) || nextQty < 0) return res.status(400).json({ message: 'Invalid qty' });

  const delta = nextQty - Number(existing.qty || 0);

  existing.name = patch.name ?? existing.name;
  existing.sku = patch.sku ?? existing.sku;
  existing.qty = nextQty;
  existing.low = patch.low ?? existing.low;
  existing.buy = typeof patch.buy === 'number' ? Number(patch.buy) : existing.buy;
  existing.sell = typeof patch.sell === 'number' ? Number(patch.sell) : existing.sell;
  existing.supplier = patch.supplier ?? existing.supplier;
  existing.desc = patch.desc ?? existing.desc;
  await existing.save();

  if (delta !== 0) {
    await Movement.create({ itemId: existing._id, qty: delta, type: 'adjustment' });
  }

  res.json(existing);
}

export async function remove(req, res) {
  await Item.findByIdAndDelete(req.params.id);
  res.status(204).end();
}

export async function adjust(req, res) {
  const { delta, reason = 'adjustment' } = req.body;
  const it = await Item.findById(req.params.id);
  if (!it) return res.status(404).json({ message: 'Item not found' });
  const change = Number(delta);
  if (Number.isNaN(change)) return res.status(400).json({ message: 'delta must be a number' });
  if (it.qty + change < 0) return res.status(400).json({ message: 'Insufficient stock' });
  it.qty += change;
  await it.save();
  await Movement.create({ itemId: it._id, qty: change, type: reason });
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

