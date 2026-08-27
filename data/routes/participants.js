import express from 'express';
import {
  addParticipant,
  addMatch,
  getParticipantStats,
  getEventParticipants,
  removeParticipant
} from '../controllers/participantController.js';
import { authenticate } from '../middleware/auth.js';
import { participantValidation, validate } from '../middleware/validation.js';
import { upload } from '../middleware/upload.js';

const router = express.Router();

router.use(authenticate);

// Participantes de un evento
router.get('/events/:eventId/participants', getEventParticipants);
router.post('/events/:eventId/participants', participantValidation.add, validate, addParticipant);
router.delete('/events/:eventId/participants/:participantId', removeParticipant);

// Partidas y estadísticas de un participante
router.post('/participants/:participantId/matches', upload.single('image'), participantValidation.addMatch, validate, addMatch);
router.get('/participants/:participantId/stats', getParticipantStats);

export default router;