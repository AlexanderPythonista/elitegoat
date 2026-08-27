import express from 'express';
import {
  createOrganization,
  getOrganizations,
  getOrganization,
  updateOrganization,
  deleteOrganization,
  addPersonToOrganization,
  removePersonFromOrganization
} from '../controllers/organizationController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticate);

// Solo admin/root pueden modificar
router.post('/', authorize('admin', 'root'), createOrganization);
router.put('/:id', authorize('admin', 'root'), updateOrganization);
router.delete('/:id', authorize('admin', 'root'), deleteOrganization);
router.post('/:id/persons', authorize('admin', 'root'), addPersonToOrganization);
router.delete('/:id/persons/:personId', authorize('admin', 'root'), removePersonFromOrganization);

// GET pueden ver todos
router.get('/', getOrganizations);
router.get('/:id', getOrganization);

export default router;