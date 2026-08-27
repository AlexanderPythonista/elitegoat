import express from 'express';
import {
  getUsers,
  updateUser,
  updateUserRole,
  syncPersonUser,
  createMissingUsers,
  createUserForPerson,
  getLogs
} from '../controllers/userController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticate);

// Todas estas rutas solo para admin/root
router.get('/', authorize('admin', 'root'), getUsers);
router.put('/:id', authorize('admin', 'root'), updateUser);
router.put('/:id/role', authorize('admin', 'root'), updateUserRole);
router.put('/sync/:personId', authorize('admin', 'root'), syncPersonUser);
router.post('/create-missing', authorize('admin', 'root'), createMissingUsers);
router.post('/create-for-person/:personId', authorize('admin', 'root'), createUserForPerson);
router.get('/logs', authorize('admin', 'root'), getLogs);

export default router;