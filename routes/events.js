import express from 'express';
import {
  createEvent,
  getMyEvents,
  getEvent,
  updateEvent,
  deleteEvent,
  getEventRanking,
  createSquad,
  updateSquad,
  deleteSquad,
  uploadSquadImage,
  deleteSquadImage,
  addParticipantToEvent,
  removeParticipantFromEvent,
  addMatches,
  updateParticipantStats
} from '../controllers/eventController.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';

const router = express.Router();
router.use(authenticate);

// Rutas de eventos
router.post('/', authorize('admin', 'root'), createEvent);
router.get('/', getMyEvents);
router.get('/:id', getEvent);
router.put('/:id', authorize('admin', 'root'), updateEvent);
router.delete('/:id', authorize('admin', 'root'), deleteEvent);
router.get('/:id/ranking', getEventRanking);

// Rutas de escuadras (solo admin/root pueden crear/editar/eliminar)
router.post('/:eventId/squads', authorize('admin', 'root'), createSquad);
router.put('/:eventId/squads/:squadId', authorize('admin', 'root'), updateSquad);
router.delete('/:eventId/squads/:squadId', authorize('admin', 'root'), deleteSquad);
// Subir imagen: participantes pueden, pero se validará en el controlador
router.post('/:eventId/squads/:squadId/images', upload.single('image'), uploadSquadImage);
router.delete('/:eventId/squads/:squadId/images/:imageIndex', authorize('admin', 'root'), deleteSquadImage);

// Rutas de participantes (solo admin/root pueden añadir/remover)
router.post('/:eventId/participants', authorize('admin', 'root'), addParticipantToEvent);
router.delete('/:eventId/participants/:personId', authorize('admin', 'root'), removeParticipantFromEvent);

// Rutas de partidas (matches): los participantes pueden registrar sus propias partidas (se valida en controlador)
router.post('/:eventId/matches', addMatches);

// Rutas de estadísticas (solo admin/root)
router.put('/:eventId/participants/:personId/stats', authorize('admin', 'root'), updateParticipantStats);

export default router;