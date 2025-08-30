import { connectDB } from '../src/db.js';
import { Item } from '../src/modules/item/item.model.js';
import { Movement } from '../src/modules/movement/movement.model.js';
import { Service } from '../src/modules/service/service.model.js';
import { Invoice } from '../src/modules/invoice/invoice.model.js';

function uid(n = 5) { return Math.random().toString(36).slice(2, 2 + n); }

(async () => {
  await connectDB();

  await Promise.all([Item.deleteMany({}), Movement.deleteMany({}), Service.deleteMany({}), Invoice.deleteMany({})]);

  const items = await Item.insertMany([
    { name: 'Engine Oil 20W-50', sku: 'AH-EO-2050', qty: 35, low: 8, buy: 800, sell: 1200, supplier: 'Atlas Honda', desc: 'Genuine oil for 125cc' },
    { name: 'Brake Shoe Set',     sku: 'AH-BS-125', qty: 20, low: 5, buy: 600, sell: 950,  supplier: 'Atlas Honda', desc: 'Front/Rear compatible' },
    { name: 'Spark Plug',         sku: 'AH-SP-PZ',  qty: 55, low: 10, buy: 250, sell: 450,  supplier: 'NGK',         desc: 'PZ type' },
    { name: 'Air Filter',         sku: 'AH-AF-125', qty: 18, low: 5, buy: 300, sell: 520,  supplier: 'Atlas Honda', desc: 'Genuine' }
  ]);

  await Movement.insertMany(items.map(it => ({ itemId: it._id, qty: it.qty, type: 'seed', createdAt: new Date(Date.now() - 2 * 86400000) })));

  const oil = items[0], plug = items[2];

  const svc = await Service.create({ name: 'Oil Change Service', price: 500, description: '' });

  const inv = await Invoice.create({
    customerName: 'Walk-in',
    lines: [
      { kind: 'item', refId: oil._id, name: oil.name, qty: 2, price: oil.sell },
      { kind: 'item', refId: plug._id, name: plug.name, qty: 1, price: plug.sell },
      { kind: 'service', refId: svc._id, name: svc.name, qty: 1, price: 500 }
    ],
    discount: 0, tax: 0,
    subtotal: 2*oil.sell + 1*plug.sell + 500,
    grandTotal: 2*oil.sell + 1*plug.sell + 500
  });

  // decrement stock + movements for the invoice
  oil.qty -= 2; plug.qty -= 1;
  await oil.save(); await plug.save();
  await Movement.insertMany([
    { itemId: oil._id, qty: -2, type: 'sale', createdAt: inv.createdAt },
    { itemId: plug._id, qty: -1, type: 'sale', createdAt: inv.createdAt }
  ]);

  console.log('Seed complete');
  process.exit(0);
})();
