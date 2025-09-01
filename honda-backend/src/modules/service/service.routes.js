import { Router } from 'express';
import { requireRole } from '../../middleware/auth.js';
import * as c from './service.controller.js';
const r = Router();
r.get('/',  requireRole(['admin','agent','inventory','service']), c.list);
r.post('/', requireRole(['admin','service','agent']), c.create);
r.patch('/:id', requireRole(['admin','service']), c.update);
r.delete('/:id', requireRole(['admin']), c.remove);
// scan endpoint
r.get('/scan/:code', requireRole(['admin','agent','inventory','service']), c.scan);
export default r;
