import { Event } from '../models/Event.js';
import { Person } from '../models/Person.js';
import { supabase } from '../config/supabase.js';
import { v4 as uuidv4 } from 'uuid';

// ================================================================
// HELPER: Obtener personId a partir de userId
// ================================================================
async function getPersonIdByUserId(userId) {
  const { data, error } = await supabase
    .from('persons')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.error('Error buscando persona por userId:', error);
    return null;
  }
  if (data) return data.id;

  const { data: byId, error: err2 } = await supabase
    .from('persons')
    .select('id')
    .eq('id', userId)
    .maybeSingle();

  if (err2) return null;
  return byId ? byId.id : null;
}

// ================================================================
// CRUD EVENTOS
// ================================================================

export const createEvent = async (req, res) => {
  try {
    const { name, type, mode, maxParticipants } = req.body;
    const newEvent = await Event.create({
      name,
      type,
      mode,
      maxParticipants: maxParticipants || 50,
      createdBy: req.user.id
    });
    res.status(201).json({ success: true, data: newEvent });
  } catch (error) {
    console.error('Error createEvent:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getMyEvents = async (req, res) => {
  try {
    const personId = await getPersonIdByUserId(req.user.id);
    const isAdmin = req.user.role === 'root' || req.user.role === 'admin';
    let events;
    if (isAdmin) {
      const allEvents = await Event.findAll();
      events = allEvents.filter(e => e.status === 'activo');
    } else if (personId) {
      events = await Event.findActiveByCreatorOrParticipant(personId, req.user.id);
    } else {
      events = await Event.findActiveByCreator(req.user.id);
    }

    const enriched = await Promise.all(events.map(async (ev) => {
      const participantIds = ev.participantIds || [];
      const participants = await Promise.all(
        participantIds.map(async (id) => {
          const person = await Person.findById(id);
          if (person) {
            return {
              ...person,
              firstName: person.firstName || person.first_name || '?',
              nickname: person.nickname || person.id || '?'
            };
          }
          return null;
        })
      );
      const validParticipants = participants.filter(p => p !== null);
      return { ...ev, participants: validParticipants };
    }));

    res.json({ success: true, data: enriched });
  } catch (error) {
    console.error('Error getMyEvents:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getEvent = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ success: false, message: 'Evento no encontrado' });

    const personId = await getPersonIdByUserId(req.user.id);
    const participantIds = event.participantIds || [];
    const isParticipant = participantIds.includes(personId);
    const isAdmin = req.user.role === 'root' || req.user.role === 'admin';

    if (event.created_by !== req.user.id && !isParticipant && !isAdmin) {
      return res.status(403).json({ success: false, message: 'No autorizado' });
    }

    const participants = await Promise.all(
      participantIds.map(async (id) => {
        const person = await Person.findById(id);
        if (person) {
          return {
            ...person,
            firstName: person.firstName || person.first_name || '?',
            nickname: person.nickname || person.id || '?'
          };
        }
        return null;
      })
    );
    const validParticipants = participants.filter(p => p !== null);

    res.json({ success: true, data: { ...event, participants: validParticipants } });
  } catch (error) {
    console.error('Error getEvent:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateEvent = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ success: false, message: 'No encontrado' });
    const isAdmin = req.user.role === 'root' || req.user.role === 'admin';
    if (event.created_by !== req.user.id && !isAdmin) {
      return res.status(403).json({ success: false, message: 'No autorizado' });
    }
    const updated = await Event.update(req.params.id, req.body);
    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('Error updateEvent:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteEvent = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ success: false, message: 'No encontrado' });
    const isAdmin = req.user.role === 'root' || req.user.role === 'admin';
    if (event.created_by !== req.user.id && !isAdmin) {
      return res.status(403).json({ success: false, message: 'No autorizado' });
    }
    await Event.delete(req.params.id);
    res.json({ success: true, message: 'Eliminado' });
  } catch (error) {
    console.error('Error deleteEvent:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ================================================================
// RANKING
// ================================================================

export const getEventRanking = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ success: false, message: 'No encontrado' });

    const personId = await getPersonIdByUserId(req.user.id);
    const participantIds = event.participantIds || [];
    const isParticipant = participantIds.includes(personId);
    const isAdmin = req.user.role === 'root' || req.user.role === 'admin';
    if (event.created_by !== req.user.id && !isParticipant && !isAdmin) {
      return res.status(403).json({ success: false, message: 'No autorizado' });
    }

    const participants = await Promise.all(
      participantIds.map(async (id) => {
        const person = await Person.findById(id);
        if (person) {
          return {
            ...person,
            firstName: person.firstName || person.first_name || '?',
            nickname: person.nickname || person.id || '?'
          };
        }
        return null;
      })
    );
    const validParticipants = participants.filter(p => p !== null);

    const statsMap = Event.getParticipantStats(event);
    const ranking = validParticipants.map(p => {
      const s = statsMap[p.id] || { partidas:0, botin:0, elimContratistas:0, elimOtros:0, minutos:0, segundos:0, victorias:0, derrotas:0 };
      const totalSegundos = s.minutos * 60 + s.segundos;
      const minutos = Math.floor(totalSegundos / 60);
      const segundos = totalSegundos % 60;
      return {
        ...p,
        stats: {
          partidas: s.partidas,
          botin: s.botin,
          elimContratistas: s.elimContratistas,
          elimOtros: s.elimOtros,
          minutos,
          segundos,
          victorias: s.victorias,
          derrotas: s.derrotas,
          score: s.botin + (s.elimContratistas + s.elimOtros) * 5 - s.derrotas * 2
        }
      };
    });
    ranking.sort((a, b) => b.stats.score - a.stats.score);
    res.json({ success: true, data: ranking });
  } catch (error) {
    console.error('Error getEventRanking:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ================================================================
// ESCUADRAS
// ================================================================

export const createSquad = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { name, leaderId, memberIds } = req.body;
    const event = await Event.findById(eventId);
    if (!event) return res.status(404).json({ success: false, message: 'Evento no encontrado' });
    const isAdmin = req.user.role === 'root' || req.user.role === 'admin';
    if (event.created_by !== req.user.id && !isAdmin) {
      return res.status(403).json({ success: false, message: 'No autorizado' });
    }
    const squad = await Event.addSquad(eventId, { name, leaderId, memberIds: memberIds || [] });
    res.status(201).json({ success: true, data: squad });
  } catch (error) {
    console.error('Error createSquad:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateSquad = async (req, res) => {
  try {
    const { eventId, squadId } = req.params;
    const event = await Event.findById(eventId);
    if (!event) return res.status(404).json({ success: false, message: 'Evento no encontrado' });
    const isAdmin = req.user.role === 'root' || req.user.role === 'admin';
    if (event.created_by !== req.user.id && !isAdmin) {
      return res.status(403).json({ success: false, message: 'No autorizado' });
    }
    const updated = await Event.updateSquad(eventId, squadId, req.body);
    if (!updated) return res.status(404).json({ success: false, message: 'Escuadra no encontrada' });
    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('Error updateSquad:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteSquad = async (req, res) => {
  try {
    const { eventId, squadId } = req.params;
    const event = await Event.findById(eventId);
    if (!event) return res.status(404).json({ success: false, message: 'Evento no encontrado' });
    const isAdmin = req.user.role === 'root' || req.user.role === 'admin';
    if (event.created_by !== req.user.id && !isAdmin) {
      return res.status(403).json({ success: false, message: 'No autorizado' });
    }
    await Event.removeSquad(eventId, squadId);
    res.json({ success: true, message: 'Escuadra eliminada' });
  } catch (error) {
    console.error('Error deleteSquad:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ================================================================
// IMÁGENES DE ESCUADRAS
// ================================================================

export const uploadSquadImage = async (req, res) => {
  try {
    const { eventId, squadId } = req.params;
    const event = await Event.findById(eventId);
    if (!event) return res.status(404).json({ success: false, message: 'Evento no encontrado' });

    const personId = await getPersonIdByUserId(req.user.id);
    const isCreator = event.created_by === req.user.id;
    const isAdmin = req.user.role === 'root' || req.user.role === 'admin';
    const isParticipant = event.participantIds && event.participantIds.includes(personId);

    if (!isCreator && !isAdmin && !isParticipant) {
      return res.status(403).json({ success: false, message: 'No autorizado para subir imágenes a esta escuadra' });
    }

    const squad = event.squads.find(s => s.id === squadId);
    if (!squad) {
      return res.status(404).json({ success: false, message: 'Escuadra no encontrada' });
    }

    if (!isAdmin && !isCreator) {
      const memberIds = squad.memberIds || [];
      if (!memberIds.includes(personId)) {
        return res.status(403).json({ success: false, message: 'No perteneces a esta escuadra' });
      }
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No se subió ninguna imagen' });
    }

    // Subir a Supabase Storage
    const fileExt = req.file.originalname.split('.').pop();
    const fileName = `${uuidv4()}.${fileExt}`;
    const filePath = `squads/${squadId}/${fileName}`;

    const { data, error: uploadError } = await supabase.storage
      .from('squad-images')
      .upload(filePath, req.file.buffer, {
        contentType: req.file.mimetype,
        cacheControl: '3600'
      });

    if (uploadError) throw new Error(uploadError.message);

    const { data: urlData } = supabase.storage
      .from('squad-images')
      .getPublicUrl(filePath);

    const imageUrl = urlData.publicUrl;

    await Event.addImageToSquad(eventId, squadId, imageUrl);

    res.json({ success: true, message: 'Imagen subida', data: { imageUrl } });
  } catch (error) {
    console.error('Error uploadSquadImage:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteSquadImage = async (req, res) => {
  try {
    const { eventId, squadId, imageIndex } = req.params;
    const event = await Event.findById(eventId);
    if (!event) return res.status(404).json({ success: false, message: 'Evento no encontrado' });
    const isAdmin = req.user.role === 'root' || req.user.role === 'admin';
    if (event.created_by !== req.user.id && !isAdmin) {
      return res.status(403).json({ success: false, message: 'No autorizado' });
    }
    await Event.removeImageFromSquad(eventId, squadId, parseInt(imageIndex));
    res.json({ success: true, message: 'Imagen eliminada' });
  } catch (error) {
    console.error('Error deleteSquadImage:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ================================================================
// PARTICIPANTES
// ================================================================

export const addParticipantToEvent = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { personIds, squadId } = req.body;
    const event = await Event.findById(eventId);
    if (!event) return res.status(404).json({ success: false, message: 'Evento no encontrado' });
    const isAdmin = req.user.role === 'root' || req.user.role === 'admin';
    if (event.created_by !== req.user.id && !isAdmin) {
      return res.status(403).json({ success: false, message: 'No autorizado' });
    }
    if (!Array.isArray(personIds) || personIds.length === 0) {
      return res.status(400).json({ success: false, message: 'Se requiere al menos un participante' });
    }
    const persons = await Promise.all(personIds.map(id => Person.findById(id).catch(() => null)));
    const valid = persons.filter(p => p !== null);
    if (valid.length !== personIds.length) {
      return res.status(404).json({ success: false, message: 'Alguna persona no existe' });
    }
    for (const personId of personIds) {
      await Event.addParticipant(eventId, personId);
      if (squadId) {
        await Event.addMemberToSquad(eventId, squadId, personId);
      }
    }
    res.json({ success: true, message: `${personIds.length} participante(s) añadido(s)` });
  } catch (error) {
    console.error('Error addParticipantToEvent:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const removeParticipantFromEvent = async (req, res) => {
  try {
    const { eventId, personId } = req.params;
    const event = await Event.findById(eventId);
    if (!event) return res.status(404).json({ success: false, message: 'Evento no encontrado' });
    const isAdmin = req.user.role === 'root' || req.user.role === 'admin';
    if (event.created_by !== req.user.id && !isAdmin) {
      return res.status(403).json({ success: false, message: 'No autorizado' });
    }
    await Event.removeParticipant(eventId, personId);
    res.json({ success: true, message: 'Participante removido' });
  } catch (error) {
    console.error('Error removeParticipantFromEvent:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ================================================================
// PARTIDAS (MATCHES) - CON VALIDACIÓN DE ESCUADRA PARA PARTICIPANTES
// ================================================================

export const addMatches = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { participantIds, squadId, botin, elimContratistas, elimOtros, minutos, segundos, resultado } = req.body;
    const event = await Event.findById(eventId);
    if (!event) return res.status(404).json({ success: false, message: 'Evento no encontrado' });

    const personId = await getPersonIdByUserId(req.user.id);
    const isCreator = event.created_by === req.user.id;
    const isAdmin = req.user.role === 'root' || req.user.role === 'admin';
    const isParticipant = event.participantIds && event.participantIds.includes(personId);

    if (!isCreator && !isAdmin && !isParticipant) {
      return res.status(403).json({ success: false, message: 'No autorizado para registrar partidas' });
    }

    // Validación para participantes (no admin/root)
    if (!isCreator && !isAdmin) {
      // Buscar la escuadra del usuario en este evento
      const userSquad = (event.squads || []).find(sq => (sq.memberIds || []).includes(personId));
      if (!userSquad) {
        return res.status(403).json({ success: false, message: 'No perteneces a ninguna escuadra en este evento' });
      }

      // Verificar que todos los participantIds pertenecen a la misma escuadra
      const squadMemberIds = userSquad.memberIds || [];
      const allInSquad = participantIds.every(pid => squadMemberIds.includes(pid));
      if (!allInSquad) {
        return res.status(403).json({ success: false, message: 'Solo puedes registrar partidas para miembros de tu escuadra' });
      }
    }

    if (!Array.isArray(participantIds) || participantIds.length === 0) {
      return res.status(400).json({ success: false, message: 'Se requiere al menos un participante' });
    }

    const persons = await Promise.all(participantIds.map(id => Person.findById(id).catch(() => null)));
    const valid = persons.filter(p => p !== null);
    if (valid.length !== participantIds.length) {
      return res.status(404).json({ success: false, message: 'Alguna persona no existe' });
    }

    const matchesData = participantIds.map(pid => ({
      participantId: pid,
      squadId: squadId || null,
      botin: parseFloat(botin) || 0,
      elimContratistas: parseFloat(elimContratistas) || 0,
      elimOtros: parseFloat(elimOtros) || 0,
      minutos: parseInt(minutos) || 0,
      segundos: parseInt(segundos) || 0,
      resultado: resultado || ''
    }));

    await Event.addMatches(eventId, matchesData);
    res.json({ success: true, message: `${participantIds.length} partida(s) registrada(s)` });
  } catch (error) {
    console.error('Error addMatches:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ================================================================
// ESTADÍSTICAS DE PARTICIPANTE (solo admin)
// ================================================================

export const updateParticipantStats = async (req, res) => {
  try {
    const { eventId, personId } = req.params;
    const stats = req.body;
    const event = await Event.findById(eventId);
    if (!event) return res.status(404).json({ success: false, message: 'Evento no encontrado' });
    const isAdmin = req.user.role === 'root' || req.user.role === 'admin';
    if (event.created_by !== req.user.id && !isAdmin) {
      return res.status(403).json({ success: false, message: 'No autorizado' });
    }
    await Event.updateParticipantStats(eventId, personId, stats);
    res.json({ success: true, message: 'Estadísticas actualizadas' });
  } catch (error) {
    console.error('Error updateParticipantStats:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};