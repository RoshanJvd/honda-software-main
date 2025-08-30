import { Router } from 'express';
import item from '../modules/item/item.routes.js';
import invoice from '../modules/invoice/invoice.routes.js';
import ret from '../modules/return/return.routes.js';
import dashboard from '../modules/dashboard/dashboard.routes.js';
import report from '../modules/report/report.routes.js';
import service from '../modules/service/service.routes.js';
// ...


const r = Router();
r.use('/items', item);
r.use('/invoices', invoice);
r.use('/returns', ret);
r.use('/dashboard', dashboard);
r.use('/reports', report);
r.use('/services', service);

export default r;
