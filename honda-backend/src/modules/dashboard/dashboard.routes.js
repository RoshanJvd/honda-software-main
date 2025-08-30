import { Router } from 'express';
import { requireRole } from '../../middleware/auth.js';
import * as c from './dashboard.controller.js';

const r = Router();
r.get('/summary', requireRole(['admin','agent','inventory','service']), c.summary);
r.get('/timeseries', requireRole(['admin','agent','inventory','service']), c.timeseries);
r.get('/top', requireRole(['admin']), c.top);
r.get('/low-stock', requireRole(['admin','inventory']), c.lowStock);
export default r;
