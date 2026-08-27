import express from 'express';
import {
  createPerson,
  getPersons,
  getPerson,
  updatePerson,
  deletePerson,
  getPersonsWithoutCoordination,
  getProfile,
  updateProfile,
  getAllProfiles
} from '../controllers/personController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticate);

// ================================================================
// RUTAS DE PERFIL
// ================================================================
router.get('/profile/all', authorize('admin', 'root'), getAllProfiles);
router.get('/:id/profile', getProfile);
router.put('/:id/profile', updateProfile);

// ================================================================
// CRUD PERSONAS (solo admin/root)
// ================================================================
router.post('/', authorize('admin', 'root'), createPerson);
router.put('/:id', authorize('admin', 'root'), updatePerson);
router.delete('/:id', authorize('admin', 'root'), deletePerson);

// ================================================================
// GETS PÚBLICOS
// ================================================================
router.get('/', getPersons);
router.get('/without-coordination', getPersonsWithoutCoordination);
router.get('/:id', getPerson);

export default router;