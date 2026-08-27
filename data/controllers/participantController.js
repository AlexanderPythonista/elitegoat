import { Participant } from '../models/Participant.js';
import { Event } from '../models/Event.js';

export const addParticipant = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { userId, nickname } = req.body;

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ success: false, message: 'Evento no encontrado' });
    }
    if (event.createdBy !== req.user.id) {
      return res.status(403).json({ success: false, message: 'No tienes permiso para añadir participantes a este evento' });
    }
    // Verificar si el participante ya existe
    const existing = await Participant.findOneByEvent(eventId, { userId, nickname });
    if (existing) {
      return res.status(400).json({ success: false, message: 'El participante ya existe en este evento' });
    }

    const newParticipant = await Participant.create({
      userId,
      nickname,
      event: eventId
    });

    // Agregar el ID del participante al evento
    await Event.addParticipant(eventId, newParticipant.id);

    res.status(201).json({ success: true, data: newParticipant });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error al añadir participante', error: error.message });
  }
};

export const removeParticipant = async (req, res) => {
  try {
    const { eventId, participantId } = req.params;
    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ success: false, message: 'Evento no encontrado' });
    }
    if (event.createdBy !== req.user.id) {
      return res.status(403).json({ success: false, message: 'No tienes permiso' });
    }
    const participant = await Participant.findById(participantId);
    if (!participant || participant.event !== eventId) {
      return res.status(404).json({ success: false, message: 'Participante no encontrado en este evento' });
    }
    await Participant.delete(participantId);
    await Event.removeParticipant(eventId, participantId);
    res.json({ success: true, message: 'Participante eliminado' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error al eliminar participante', error: error.message });
  }
};

export const addMatch = async (req, res) => {
  try {
    const { participantId } = req.params;
    const { kills, deaths, position } = req.body;
    let imageUrl = '';
    if (req.file) {
      imageUrl = `/uploads/${req.file.filename}`;
    }

    const participant = await Participant.findById(participantId);
    if (!participant) {
      return res.status(404).json({ success: false, message: 'Participante no encontrado' });
    }

    // Verificar que el evento pertenece al usuario autenticado
    const event = await Event.findById(participant.event);
    if (!event || event.createdBy !== req.user.id) {
      return res.status(403).json({ success: false, message: 'No tienes permiso para subir partidas de este participante' });
    }

    const updated = await Participant.addMatch(participantId, {
      kills: parseInt(kills) || 0,
      deaths: parseInt(deaths) || 0,
      position: parseInt(position) || 0,
      imageUrl
    });

    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error al agregar partida', error: error.message });
  }
};

export const getParticipantStats = async (req, res) => {
  try {
    const { participantId } = req.params;
    const participant = await Participant.findById(participantId);
    if (!participant) {
      return res.status(404).json({ success: false, message: 'Participante no encontrado' });
    }
    // Verificar permiso
    const event = await Event.findById(participant.event);
    if (!event || event.createdBy !== req.user.id) {
      return res.status(403).json({ success: false, message: 'No tienes permiso' });
    }
    res.json({ success: true, data: participant });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error al obtener estadísticas', error: error.message });
  }
};

export const getEventParticipants = async (req, res) => {
  try {
    const { eventId } = req.params;
    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ success: false, message: 'Evento no encontrado' });
    }
    if (event.createdBy !== req.user.id) {
      return res.status(403).json({ success: false, message: 'No tienes permiso' });
    }
    const participants = await Participant.findByEvent(eventId);
    res.json({ success: true, data: participants });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error al obtener participantes', error: error.message });
  }
};