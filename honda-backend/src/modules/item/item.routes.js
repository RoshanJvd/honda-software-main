import { Router } from 'express';
import multer from 'multer';
import { requireRole } from '../../middleware/auth.js';
import * as c from './item.controller.js';

const upload = multer({ storage: multer.memoryStorage() });
const r = Router();

r.get('/', requireRole(['admin','inventory','agent','service']), c.list);
r.post('/', requireRole(['admin','inventory']), c.create);
r.patch('/:id', requireRole(['admin','inventory']), c.update);
r.delete('/:id', requireRole(['admin']), c.remove);
r.post('/:id/adjust', requireRole(['admin','inventory']), c.adjust);

r.post('/import', requireRole(['admin','inventory']), upload.single('file'), c.importXlsx);

export default r;
