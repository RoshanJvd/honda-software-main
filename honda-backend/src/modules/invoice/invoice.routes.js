import { Router } from 'express';
import { requireRole } from '../../middleware/auth.js';
import * as c from './invoice.controller.js';

const r = Router();
r.get('/', requireRole(['admin','agent','inventory','service']), c.list);
r.post('/', requireRole(['admin','agent','service']), c.create);

export default r;
