import express from 'express';
import {
  createPerson,
  getPersons,
  getPerson,
  updatePerson,
  deletePerson,
  getPersonsWithoutCoordination
} from '../controllers/personController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticate);

// Solo admin/root pueden modificar
router.post('/', authorize('admin', 'root'), createPerson);
router.put('/:id', authorize('admin', 'root'), updatePerson);
router.delete('/:id', authorize('admin', 'root'), deletePerson);

// GET pueden ver todos
router.get('/', getPersons);
router.get('/without-coordination', getPersonsWithoutCoordination);
router.get('/:id', getPerson);

export default router;