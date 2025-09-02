import { Router } from 'express';
import multer from 'multer';
import { requireRole } from '../../middleware/auth.js';
import * as c from './item.controller.js';

const upload = multer({ storage: multer.memoryStorage() });
const r = Router();

r.get('/', requireRole(['admin','agent']), c.list);
r.post('/', requireRole(['admin']), c.create);
r.patch('/:id', requireRole(['admin']), c.update);
r.delete('/:id', requireRole(['admin']), c.remove);
r.post('/:id/adjust', requireRole(['admin']), c.adjust);

r.post('/import', requireRole(['admin']), upload.single('file'), c.importXlsx);
// scan by sku or barcode (e.g. barcode reader provides code)
r.get('/scan/:code', requireRole(['admin','agent']), c.scan);

export default r;
