import express from 'express';
import {
  getForms,
  createForm,
  getForm,
  updateForm,
  deleteForm,
  addQuestion,
  updateQuestion,
  deleteQuestion,
  submitResponse,
  getResponses
} from '../controllers/formController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

// Crear, actualizar y eliminar solo admin/root
router.post('/', authenticate, authorize('admin', 'root'), createForm);
router.put('/:id', authenticate, authorize('admin', 'root'), updateForm);
router.delete('/:id', authenticate, authorize('admin', 'root'), deleteForm);

router.post('/:id/questions', authenticate, authorize('admin', 'root'), addQuestion);
router.put('/:id/questions/:questionId', authenticate, authorize('admin', 'root'), updateQuestion);
router.delete('/:id/questions/:questionId', authenticate, authorize('admin', 'root'), deleteQuestion);

router.get('/:id/responses', authenticate, authorize('admin', 'root'), getResponses);

// Las rutas públicas de GET y submit no requieren autenticación
router.get('/', getForms);
router.get('/:id', getForm);
router.post('/:id/submit', submitResponse);
export default router;