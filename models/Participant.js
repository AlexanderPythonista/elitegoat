import { readJSON, writeJSON, findById, removeById } from './base.js';

const FILE = 'participants.json';

export const Participant = {
  async findAll() {
    return await readJSON(FILE);
  },

  async findById(id) {
    const participants = await this.findAll();
    return findById(participants, id);
  },

  // Buscar participantes por evento
  async findByEvent(eventId) {
    const participants = await this.findAll();
    return participants.filter(p => p.event === eventId);
  },

  // Buscar participante por evento + userId o nickname
  async findOneByEvent(eventId, query) {
    const participants = await this.findAll();
    return participants.find(p => {
      if (p.event !== eventId) return false;
      if (query.userId && p.userId === query.userId) return true;
      if (query.nickname && p.nickname === query.nickname) return true;
      return false;
    });
  },

  async create(participantData) {
    const participants = await this.findAll();
    const newParticipant = {
      id: crypto.randomUUID ? crypto.randomUUID() : require('uuid').v4(),
      ...participantData,
      stats: {
        kills: 0,
        deaths: 0,
        wins: 0,
        matchesPlayed: 0,
        score: 0
      },
      matches: [],
      joinedAt: new Date().toISOString()
    };
    participants.push(newParticipant);
    await writeJSON(FILE, participants);
    return newParticipant;
  },

  async update(id, updateData) {
    const participants = await this.findAll();
    const participant = findById(participants, id);
    if (!participant) return null;
    Object.assign(participant, updateData);
    await writeJSON(FILE, participants);
    return participant;
  },

  async delete(id) {
    const participants = await this.findAll();
    const removed = removeById(participants, id);
    if (removed) {
      await writeJSON(FILE, participants);
      return true;
    }
    return false;
  },

  // Agregar una partida (match) y actualizar estadísticas
  async addMatch(participantId, matchData) {
    const participants = await this.findAll();
    const participant = findById(participants, participantId);
    if (!participant) return null;

    // Actualizar estadísticas
    const kills = matchData.kills || 0;
    const deaths = matchData.deaths || 0;
    const position = matchData.position || 0;
    const imageUrl = matchData.imageUrl || '';

    participant.stats.kills += kills;
    participant.stats.deaths += deaths;
    participant.stats.matchesPlayed += 1;
    if (position === 1) participant.stats.wins += 1;

    // Calcular score (ejemplo: kills*10 + wins*50)
    participant.stats.score = (participant.stats.kills * 10) + (participant.stats.wins * 50);

    participant.matches.push({
      date: new Date().toISOString(),
      imageUrl,
      kills,
      deaths,
      position,
      score: participant.stats.score
    });

    await writeJSON(FILE, participants);
    return participant;
  }
};