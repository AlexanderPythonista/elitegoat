import express from 'express';
import { getTop, saveTop } from '../controllers/topController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticate);
router.get('/', authorize('admin', 'root'), getTop);
router.post('/', authorize('admin', 'root'), saveTop);

export default router;