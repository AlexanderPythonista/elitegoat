import express from 'express';
import {
  createCoordination,
  getCoordinations,
  getCoordination,
  updateCoordination,
  deleteCoordination,
  addPersonToCoordination,
  removePersonFromCoordination
} from '../controllers/coordinationController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticate);

// Solo admin/root pueden crear, editar o eliminar
router.post('/', authorize('admin', 'root'), createCoordination);
router.put('/:id', authorize('admin', 'root'), updateCoordination);
router.delete('/:id', authorize('admin', 'root'), deleteCoordination);
router.post('/:id/persons', authorize('admin', 'root'), addPersonToCoordination);
router.delete('/:id/persons/:personId', authorize('admin', 'root'), removePersonFromCoordination);

// GET pueden ver todos (según necesidad)
router.get('/', getCoordinations);
router.get('/:id', getCoordination);

export default router;