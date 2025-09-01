import { Router } from 'express';
import { requireRole } from '../../middleware/auth.js';
import * as c from './user.controller.js';

const r = Router();

// Only admin can manage users
r.get('/', requireRole(['admin']), c.list);
r.post('/', requireRole(['admin']), c.create);
r.patch('/:id', requireRole(['admin']), c.update);
r.delete('/:id', requireRole(['admin']), c.remove);

// Assignment routes (admin only)
r.post('/:userId/assign-items', requireRole(['admin']), c.assignItems);
r.post('/:userId/assign-services', requireRole(['admin']), c.assignServices);
r.get('/:userId/assignments', requireRole(['admin']), c.getAssignments);

// Authentication route (public)
r.post('/authenticate', c.authenticate);

export default r;
