import { readJSON, writeJSON, findById, removeById } from './base.js';
import { v4 as uuidv4 } from 'uuid';
import { Person } from './Person.js';

const FILE = 'events.json';

export const Event = {
  async findAll() {
    return await readJSON(FILE);
  },

  async findById(id) {
    const events = await this.findAll();
    return findById(events, id);
  },

  async findByCreator(userId) {
    const events = await this.findAll();
    return events.filter(e => e.createdBy === userId);
  },

  async findActiveByCreator(userId) {
    const events = await this.findAll();
    return events.filter(e => e.createdBy === userId && e.status === 'activo');
  },

  // Eventos activos donde el usuario es creador O participante
  async findActiveByCreatorOrParticipant(personId, userId) {
    const events = await this.findAll();
    return events.filter(e => {
      if (e.status !== 'activo') return false;
      if (e.createdBy === userId) return true;
      const participantIds = e.participantIds || [];
      return participantIds.includes(personId);
    });
  },

  async create(data) {
    const events = await this.findAll();
    const newEvent = {
      id: uuidv4(),
      ...data,
      status: 'activo',
      squads: [],
      participantIds: [],
      participantStats: {},
      matches: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    events.push(newEvent);
    await writeJSON(FILE, events);
    return newEvent;
  },

  async update(id, updateData) {
    const events = await this.findAll();
    const event = findById(events, id);
    if (!event) return null;
    Object.assign(event, updateData, { updatedAt: new Date().toISOString() });
    if (!event.squads) event.squads = [];
    if (!event.participantIds) event.participantIds = [];
    if (!event.participantStats) event.participantStats = {};
    if (!event.matches) event.matches = [];
    await writeJSON(FILE, events);
    return event;
  },

  async delete(id) {
    const events = await this.findAll();
    const removed = removeById(events, id);
    if (removed) {
      await writeJSON(FILE, events);
      return true;
    }
    return false;
  },

  // ---- Escuadras con validaciones ----
  async addSquad(eventId, squadData) {
    const events = await this.findAll();
    const event = findById(events, eventId);
    if (!event) throw new Error('Evento no encontrado');

    // Validar líder si se proporciona
    if (squadData.leaderId) {
      const person = await Person.findById(squadData.leaderId);
      if (!person) throw new Error('Líder no existe');
    }
    // Validar miembros
    if (squadData.memberIds && squadData.memberIds.length) {
      for (const pid of squadData.memberIds) {
        const person = await Person.findById(pid);
        if (!person) throw new Error(`Miembro ${pid} no existe`);
      }
    }

    if (!event.squads) event.squads = [];
    const newSquad = {
      id: uuidv4(),
      name: squadData.name,
      leaderId: squadData.leaderId || null,
      memberIds: squadData.memberIds || [],
      images: []
    };
    event.squads.push(newSquad);
    await writeJSON(FILE, events);
    return newSquad;
  },

  async updateSquad(eventId, squadId, updateData) {
    const events = await this.findAll();
    const event = findById(events, eventId);
    if (!event) throw new Error('Evento no encontrado');
    if (!event.squads) event.squads = [];
    const squad = event.squads.find(s => s.id === squadId);
    if (!squad) return null;

    // Validar líder si se proporciona
    if (updateData.leaderId) {
      const person = await Person.findById(updateData.leaderId);
      if (!person) throw new Error('Líder no existe');
    }
    // Validar miembros
    if (updateData.memberIds && updateData.memberIds.length) {
      for (const pid of updateData.memberIds) {
        const person = await Person.findById(pid);
        if (!person) throw new Error(`Miembro ${pid} no existe`);
      }
    }

    Object.assign(squad, updateData);
    await writeJSON(FILE, events);
    return squad;
  },

  async removeSquad(eventId, squadId) {
    const events = await this.findAll();
    const event = findById(events, eventId);
    if (!event) return null;
    if (!event.squads) event.squads = [];
    event.squads = event.squads.filter(s => s.id !== squadId);
    await writeJSON(FILE, events);
    return event;
  },

  // ---- Imágenes en escuadra ----
  async addImageToSquad(eventId, squadId, imageUrl) {
    const events = await this.findAll();
    const event = findById(events, eventId);
    if (!event) return null;
    const squad = event.squads.find(s => s.id === squadId);
    if (!squad) return null;
    if (!squad.images) squad.images = [];
    squad.images.push(imageUrl);
    await writeJSON(FILE, events);
    return squad;
  },

  async removeImageFromSquad(eventId, squadId, imageIndex) {
    const events = await this.findAll();
    const event = findById(events, eventId);
    if (!event) return null;
    const squad = event.squads.find(s => s.id === squadId);
    if (!squad) return null;
    if (!squad.images) squad.images = [];
    squad.images.splice(imageIndex, 1);
    await writeJSON(FILE, events);
    return squad;
  },

  // ---- Participantes con validaciones ----
  async addParticipant(eventId, personId) {
    const events = await this.findAll();
    const event = findById(events, eventId);
    if (!event) throw new Error('Evento no encontrado');
    const person = await Person.findById(personId);
    if (!person) throw new Error('Persona no encontrada');

    if (!event.participantIds) event.participantIds = [];
    if (!event.participantIds.includes(personId)) {
      event.participantIds.push(personId);
      await writeJSON(FILE, events);
    }
    return event;
  },

  async removeParticipant(eventId, personId) {
    const events = await this.findAll();
    const event = findById(events, eventId);
    if (!event) return null;
    if (!event.participantIds) event.participantIds = [];
    event.participantIds = event.participantIds.filter(id => id !== personId);
    if (event.squads) {
      event.squads.forEach(s => {
        s.memberIds = (s.memberIds || []).filter(id => id !== personId);
        if (s.leaderId === personId) s.leaderId = null;
      });
    }
    await writeJSON(FILE, events);
    return event;
  },

  async addMemberToSquad(eventId, squadId, personId) {
    const events = await this.findAll();
    const event = findById(events, eventId);
    if (!event) throw new Error('Evento no encontrado');
    const person = await Person.findById(personId);
    if (!person) throw new Error('Persona no encontrada');

    if (!event.squads) event.squads = [];
    const squad = event.squads.find(s => s.id === squadId);
    if (!squad) throw new Error('Escuadra no encontrada');
    if (!squad.memberIds) squad.memberIds = [];
    if (!squad.memberIds.includes(personId)) {
      squad.memberIds.push(personId);
      await writeJSON(FILE, events);
    }
    return event;
  },

  async removeMemberFromSquad(eventId, squadId, personId) {
    const events = await this.findAll();
    const event = findById(events, eventId);
    if (!event) return null;
    if (!event.squads) event.squads = [];
    const squad = event.squads.find(s => s.id === squadId);
    if (!squad) return null;
    if (!squad.memberIds) squad.memberIds = [];
    squad.memberIds = squad.memberIds.filter(id => id !== personId);
    await writeJSON(FILE, events);
    return event;
  },

  // ---- Estadísticas de participantes ----
  async updateParticipantStats(eventId, personId, stats) {
    const events = await this.findAll();
    const event = findById(events, eventId);
    if (!event) return null;
    if (!event.participantStats) event.participantStats = {};
    if (!event.participantStats[personId]) event.participantStats[personId] = {};
    Object.assign(event.participantStats[personId], stats);
    await writeJSON(FILE, events);
    return event;
  },

  // ---- Partidas (matches) con validaciones ----
  async addMatches(eventId, matchesData) {
    const events = await this.findAll();
    const event = findById(events, eventId);
    if (!event) throw new Error('Evento no encontrado');

    // Validar participantes y escuadras
    const allPersons = await Person.findAll();
    for (const m of matchesData) {
      if (!allPersons.find(p => p.id === m.participantId)) {
        throw new Error(`Participante ${m.participantId} no existe`);
      }
      if (m.squadId) {
        const squadExists = event.squads.some(s => s.id === m.squadId);
        if (!squadExists) throw new Error(`Escuadra ${m.squadId} no existe en este evento`);
      }
    }

    if (!event.matches) event.matches = [];
    matchesData.forEach(m => {
      event.matches.push({
        id: uuidv4(),
        ...m,
        timestamp: new Date().toISOString()
      });
    });
    await writeJSON(FILE, events);
    return event;
  },

  // ---- Ranking de escuadras ----
  getSquadRanking(event) {
    const squads = event.squads || [];
    const matches = event.matches || [];
    const squadStats = squads.map(squad => {
      const memberIds = squad.memberIds || [];
      let totalBotin = 0;
      const memberStats = memberIds.map(pid => {
        const memberMatches = matches.filter(m => m.participantId === pid);
        const total = memberMatches.reduce((sum, m) => sum + (m.botin || 0), 0);
        totalBotin += total;
        return { participantId: pid, totalBotin: total };
      });
      return {
        squadId: squad.id,
        squadName: squad.name,
        memberStats,
        totalBotin
      };
    });
    squadStats.sort((a, b) => b.totalBotin - a.totalBotin);
    return squadStats;
  },

  // ---- Estadísticas agregadas por participante ----
  getParticipantStats(event) {
    const statsMap = {};
    (event.matches || []).forEach(m => {
      if (!statsMap[m.participantId]) {
        statsMap[m.participantId] = {
          partidas: 0,
          botin: 0,
          elimContratistas: 0,
          elimOtros: 0,
          minutos: 0,
          segundos: 0,
          victorias: 0,
          derrotas: 0
        };
      }
      statsMap[m.participantId].partidas += 1;
      statsMap[m.participantId].botin += m.botin || 0;
      statsMap[m.participantId].elimContratistas += m.elimContratistas || 0;
      statsMap[m.participantId].elimOtros += m.elimOtros || 0;
      statsMap[m.participantId].minutos += m.minutos || 0;
      statsMap[m.participantId].segundos += m.segundos || 0;
      if (m.resultado === 'Victoria') statsMap[m.participantId].victorias += 1;
      else if (m.resultado === 'Derrota') statsMap[m.participantId].derrotas += 1;
    });
    return statsMap;
  }
};