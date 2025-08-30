import { Router } from 'express';
import XLSX from 'xlsx';
import { requireRole } from '../../middleware/auth.js';
import { Invoice } from '../invoice/invoice.model.js';
import { Movement } from '../movement/movement.model.js';

const r = Router();

function parsePeriod(p) {
  const now = new Date();
  const map = { '7d': 7, '30d': 30, '90d': 90 };
  const days = map[p || '30d'] || 30;
  const from = new Date(now); from.setDate(now.getDate() - (days - 1)); from.setHours(0,0,0,0);
  return { from, to: now };
}

r.get('/export', requireRole(['admin']), async (req, res, next) => {
  try {
    const { from, to } = parsePeriod(String(req.query.period));
    const invoices = await Invoice.find({ createdAt: { $gte: from, $lte: to } }).sort({ createdAt: 1 });
    const moves = await Movement.find({ createdAt: { $gte: from, $lte: to } }).sort({ createdAt: 1 }).populate('itemId', 'name sku');

    const wb = XLSX.utils.book_new();

    const invRows = invoices.flatMap(inv =>
      inv.lines.map(ln => ({
        invoiceId: inv._id.toString(),
        date: inv.createdAt.toISOString(),
        customer: inv.customerName,
        kind: ln.kind,
        name: ln.name,
        qty: ln.qty,
        price: ln.price,
        subtotal: inv.subtotal,
        discount: inv.discount,
        tax: inv.tax,
        grandTotal: inv.grandTotal
      }))
    );
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(invRows), 'Invoices');

    const mvRows = moves.map(m => ({
      date: m.createdAt.toISOString(),
      item: m.itemId?.name,
      sku: m.itemId?.sku,
      qty: m.qty,
      type: m.type
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(mvRows), 'Movements');

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="report_${from.toISOString().slice(0,10)}_${to.toISOString().slice(0,10)}.xlsx"`);
    res.send(buf);
  } catch (e) { next(e); }
});

export default r;
