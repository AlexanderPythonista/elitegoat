import { Event } from '../models/Event.js';
import { Person } from '../models/Person.js';

async function getPersonIdByUserId(userId) {
  const persons = await Person.findAll();
  let person = persons.find(p => p.user_id === userId);
  if (!person) {
    person = persons.find(p => p.id === userId);
  }
  return person ? person.id : null;
}

export const getRankingData = async (req, res) => {
  try {
    const isAdmin = req.user.user_metadata?.role === 'root' || req.user.user_metadata?.role === 'admin';
    let events;
    if (isAdmin) {
      const all = await Event.findAll();
      events = all.filter(e => e.status === 'activo');
    } else {
      const personId = await getPersonIdByUserId(req.user.id);
      events = await Event.findActiveByCreatorOrParticipant(personId, req.user.id);
    }

    const rankingData = await Promise.all(events.map(async (ev) => {
      const participantIds = ev.participantIds || [];
      const participants = await Promise.all(
        participantIds.map(id => Person.findById(id).catch(() => null))
      );
      const validParticipants = participants.filter(p => p !== null);

      const squadRanking = Event.getSquadRanking(ev);
      const enrichedSquadRanking = squadRanking.map(sq => {
        const memberStatsWithNames = sq.memberStats.map(ms => {
          const person = validParticipants.find(p => p.id === ms.participantId);
          return {
            ...ms,
            name: person ? person.nickname || person.first_name : 'Desconocido'
          };
        });
        return {
          ...sq,
          memberStats: memberStatsWithNames
        };
      });

      return {
        eventId: ev.id,
        eventName: ev.name,
        squads: enrichedSquadRanking
      };
    }));

    res.json({ success: true, data: rankingData });
  } catch (error) {
    console.error('Error getRankingData:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};