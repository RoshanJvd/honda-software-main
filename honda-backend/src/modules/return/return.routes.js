import { Router } from 'express';
import { requireRole } from '../../middleware/auth.js';
import * as c from './return.controller.js';

const r = Router();
r.get('/', requireRole(['admin','agent','inventory','service']), c.list);
r.post('/', requireRole(['admin','agent']), c.create);
export default r;
