import express from 'express';
import { getRankingData } from '../controllers/rankingController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticate);

router.get('/', getRankingData);

export default router;