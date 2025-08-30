import { Invoice } from '../invoice/invoice.model.js';
import { Item } from '../item/item.model.js';
import { Movement } from '../movement/movement.model.js';
import { ReturnDoc } from '../return/return.model.js';

function parsePeriod(p) {
  const now = new Date();
  const map = { '7d': 7, '30d': 30, '90d': 90 };
  const days = map[p || '7d'] || 7;
  const from = new Date(now);
  from.setDate(now.getDate() - (days - 1)); from.setHours(0,0,0,0);
  return { from, to: now };
}

export async function summary(req, res) {
  const { from, to } = parsePeriod(String(req.query.period));
  const [invAgg, stockAgg, retAgg, invoicesCount] = await Promise.all([
    Invoice.aggregate([
      { $match: { createdAt: { $gte: from, $lte: to } } },
      { $group: {
        _id: null,
        sales: { $sum: '$grandTotal' },
        service: { $sum: { $sum: { $map: {
          input: '$lines', as: 'ln',
          in: { $cond: [{ $eq: ['$$ln.kind','service'] }, { $multiply: ['$$ln.qty','$$ln.price'] }, 0] }
        }}}}
      }},
      { $project: { _id: 0, sales: 1, service: 1 } }
    ]),
    Item.aggregate([{ $group: { _id: null, stock: { $sum: '$qty' }, low: { $sum: { $cond: [{ $lte: ['$qty','$low'] }, 1, 0] } } } }, { $project: { _id: 0 } }]),
    ReturnDoc.aggregate([{ $match: { createdAt: { $gte: from, $lte: to } } }, { $group: { _id: null, refunds: { $sum: '$refund' } } }]),
    Invoice.countDocuments({ createdAt: { $gte: from, $lte: to } })
  ]);

  res.json({
    totalSales: invAgg[0]?.sales || 0,
    serviceRevenue: invAgg[0]?.service || 0,
    stockOnHand: stockAgg[0]?.stock || 0,
    lowStockItems: stockAgg[0]?.low || 0,
    invoicesCount,
    refunds: retAgg[0]?.refunds || 0
  });
}

export async function timeseries(req, res) {
  const { from, to } = parsePeriod(String(req.query.period));
  const agg = await Movement.aggregate([
    { $match: { createdAt: { $gte: from, $lte: to } } },
    { $project: { day: { $dateTrunc: { date: '$createdAt', unit: 'day' } }, qty: '$qty' } },
    { $group: {
      _id: '$day',
      in:  { $sum: { $cond: [{ $gt: ['$qty', 0] }, '$qty', 0] } },
      out: { $sum: { $cond: [{ $lt: ['$qty', 0] }, { $abs: '$qty' }, 0] } }
    }},
    { $sort: { _id: 1 } }
  ]);
  res.json(agg.map(d => ({ date: d._id, in: d.in, out: d.out })));
}

export async function top(req, res) {
  const limit = Math.min(50, Number(req.query.limit) || 10);
  const top = await Invoice.aggregate([
    { $unwind: '$lines' },
    { $match: { 'lines.kind': 'item' } },
    { $group: { _id: '$lines.refId', qty: { $sum: '$lines.qty' }, rev: { $sum: { $multiply: ['$lines.qty', '$lines.price'] } } } },
    { $sort: { qty: -1 } },
    { $limit: limit },
    { $lookup: { from: 'items', localField: '_id', foreignField: '_id', as: 'item' } },
    { $unwind: '$item' },
    { $project: { _id: 0, itemId: '$item._id', name: '$item.name', qty: 1, rev: 1 } }
  ]);
  res.json(top);
}

export async function lowStock(_req, res) {
  const items = await Item.find({ $expr: { $lte: ['$qty','$low'] } }).sort({ qty: 1 });
  res.json(items);
}
