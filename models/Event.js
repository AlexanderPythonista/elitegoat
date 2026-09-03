import { supabase } from '../config/supabase.js';

const EVENTS_TABLE = 'events';
const SQUADS_TABLE = 'squads';
const PARTICIPANTS_TABLE = 'event_participants';
const MATCHES_TABLE = 'matches';
const SQUAD_MEMBERS_TABLE = 'squad_members';

export const Event = {
  async findAll() {
    const { data, error } = await supabase
      .from(EVENTS_TABLE)
      .select(`
        *,
        squads (
          *,
          members:squad_members (person_id)
        ),
        participants:event_participants (person_id),
        matches (*)
      `)
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);

    return data.map(ev => ({
      ...ev,
      squads: (ev.squads || []).map(sq => ({
        ...sq,
        leaderId: sq.leader_id,
        memberIds: (sq.members || []).map(m => m.person_id)
      })),
      participantIds: (ev.participants || []).map(p => p.person_id),
      participants: ev.participants || [],
      matches: ev.matches || []
    }));
  },

  async findById(id) {
    const { data, error } = await supabase
      .from(EVENTS_TABLE)
      .select(`
        *,
        squads (
          *,
          members:squad_members (person_id)
        ),
        participants:event_participants (person_id),
        matches (*)
      `)
      .eq('id', id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return null;

    return {
      ...data,
      squads: (data.squads || []).map(sq => ({
        ...sq,
        leaderId: sq.leader_id,
        memberIds: (sq.members || []).map(m => m.person_id)
      })),
      participantIds: (data.participants || []).map(p => p.person_id),
      participants: data.participants || [],
      matches: data.matches || []
    };
  },

  async findActiveByCreatorOrParticipant(personId, userId) {
    const { data, error } = await supabase
      .from(EVENTS_TABLE)
      .select(`
        *,
        squads (
          *,
          members:squad_members (person_id)
        ),
        participants:event_participants (person_id),
        matches (*)
      `)
      .eq('status', 'activo')
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);

    const filtered = data.filter(ev => {
      const isCreator = ev.created_by === userId;
      const participantIds = (ev.participants || []).map(p => p.person_id);
      const isParticipant = participantIds.includes(personId);
      return isCreator || isParticipant;
    });

    return filtered.map(ev => ({
      ...ev,
      squads: (ev.squads || []).map(sq => ({
        ...sq,
        leaderId: sq.leader_id,
        memberIds: (sq.members || []).map(m => m.person_id)
      })),
      participantIds: (ev.participants || []).map(p => p.person_id),
      participants: ev.participants || [],
      matches: ev.matches || []
    }));
  },

  async findActiveByCreator(userId) {
    const { data, error } = await supabase
      .from(EVENTS_TABLE)
      .select(`
        *,
        squads (
          *,
          members:squad_members (person_id)
        ),
        participants:event_participants (person_id),
        matches (*)
      `)
      .eq('created_by', userId)
      .eq('status', 'activo')
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);

    return data.map(ev => ({
      ...ev,
      squads: (ev.squads || []).map(sq => ({
        ...sq,
        leaderId: sq.leader_id,
        memberIds: (sq.members || []).map(m => m.person_id)
      })),
      participantIds: (ev.participants || []).map(p => p.person_id),
      participants: ev.participants || [],
      matches: ev.matches || []
    }));
  },

  async create(data) {
    const { data: result, error } = await supabase
      .from(EVENTS_TABLE)
      .insert([{
        name: data.name,
        type: data.type,
        mode: data.mode,
        max_participants: data.maxParticipants || 50,
        created_by: data.createdBy,
        status: 'activo',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }])
      .select()
      .single();
    if (error) throw new Error(error.message);
    return {
      ...result,
      squads: [],
      participantIds: [],
      matches: []
    };
  },

  async update(id, updateData) {
    const updates = {
      name: updateData.name,
      type: updateData.type,
      mode: updateData.mode,
      max_participants: updateData.maxParticipants,
      status: updateData.status,
      updated_at: new Date().toISOString()
    };
    const { data, error } = await supabase
      .from(EVENTS_TABLE)
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  async delete(id) {
    const { error } = await supabase
      .from(EVENTS_TABLE)
      .delete()
      .eq('id', id);
    if (error) throw new Error(error.message);
    return true;
  },

  // ---- ESCUADRAS ----
  async addSquad(eventId, squadData) {
    const { data: squad, error } = await supabase
      .from(SQUADS_TABLE)
      .insert([{
        event_id: eventId,
        name: squadData.name,
        leader_id: squadData.leaderId || null,
        images: []
      }])
      .select()
      .single();
    if (error) throw new Error(error.message);

    if (squadData.memberIds && squadData.memberIds.length) {
      const members = squadData.memberIds.map(pid => ({
        squad_id: squad.id,
        person_id: pid
      }));
      const { error: memError } = await supabase
        .from(SQUAD_MEMBERS_TABLE)
        .insert(members);
      if (memError) {
        console.error('❌ Error al insertar miembros:', memError);
        throw new Error(memError.message);
      }
    }
    return this.getSquadById(squad.id);
  },

  async updateSquad(eventId, squadId, updateData) {
    const { data: squad, error } = await supabase
      .from(SQUADS_TABLE)
      .update({
        name: updateData.name,
        leader_id: updateData.leaderId || null
      })
      .eq('id', squadId)
      .eq('event_id', eventId)
      .select()
      .single();
    if (error) throw new Error(error.message);

    if (updateData.memberIds !== undefined) {
      await supabase
        .from(SQUAD_MEMBERS_TABLE)
        .delete()
        .eq('squad_id', squadId);

      if (updateData.memberIds.length) {
        const members = updateData.memberIds.map(pid => ({
          squad_id: squadId,
          person_id: pid
        }));
        const { error: memError } = await supabase
          .from(SQUAD_MEMBERS_TABLE)
          .insert(members);
        if (memError) throw new Error(memError.message);
      }
    }
    return this.getSquadById(squadId);
  },

  async removeSquad(eventId, squadId) {
    const { error } = await supabase
      .from(SQUADS_TABLE)
      .delete()
      .eq('id', squadId)
      .eq('event_id', eventId);
    if (error) throw new Error(error.message);
    return true;
  },

  async getSquadById(squadId) {
    const { data: squad, error } = await supabase
      .from(SQUADS_TABLE)
      .select('*')
      .eq('id', squadId)
      .single();
    if (error) throw new Error(error.message);

    const { data: members, error: memError } = await supabase
      .from(SQUAD_MEMBERS_TABLE)
      .select('person_id')
      .eq('squad_id', squadId);
    if (memError) throw new Error(memError.message);

    return {
      ...squad,
      leaderId: squad.leader_id,
      memberIds: members.map(m => m.person_id)
    };
  },

  // ---- IMÁGENES EN ESCUADRA ----
  async addImageToSquad(eventId, squadId, imageUrl) {
    const { data: squad, error } = await supabase
      .from(SQUADS_TABLE)
      .select('images')
      .eq('id', squadId)
      .eq('event_id', eventId)
      .single();
    if (error) throw new Error(error.message);
    const images = squad.images || [];
    images.push(imageUrl);
    const { error: updateError } = await supabase
      .from(SQUADS_TABLE)
      .update({ images })
      .eq('id', squadId);
    if (updateError) throw new Error(updateError.message);
    return { images };
  },

  async removeImageFromSquad(eventId, squadId, imageIndex) {
    const { data: squad, error } = await supabase
      .from(SQUADS_TABLE)
      .select('images')
      .eq('id', squadId)
      .eq('event_id', eventId)
      .single();
    if (error) throw new Error(error.message);
    const images = squad.images || [];
    if (imageIndex >= 0 && imageIndex < images.length) {
      images.splice(imageIndex, 1);
      const { error: updateError } = await supabase
        .from(SQUADS_TABLE)
        .update({ images })
        .eq('id', squadId);
      if (updateError) throw new Error(updateError.message);
    }
    return { images };
  },

  // ---- PARTICIPANTES ----
  async addParticipant(eventId, personId) {
    const { error } = await supabase
      .from(PARTICIPANTS_TABLE)
      .insert([{ event_id: eventId, person_id: personId }]);
    if (error) throw new Error(error.message);
    return true;
  },

  async removeParticipant(eventId, personId) {
    const { data: squads } = await supabase
      .from(SQUADS_TABLE)
      .select('id')
      .eq('event_id', eventId);
    for (const sq of squads) {
      await supabase
        .from(SQUAD_MEMBERS_TABLE)
        .delete()
        .match({ squad_id: sq.id, person_id: personId });
    }
    const { error } = await supabase
      .from(PARTICIPANTS_TABLE)
      .delete()
      .match({ event_id: eventId, person_id: personId });
    if (error) throw new Error(error.message);
    return true;
  },

  async addMemberToSquad(eventId, squadId, personId) {
    const { data: part, error: partError } = await supabase
      .from(PARTICIPANTS_TABLE)
      .select('person_id')
      .match({ event_id: eventId, person_id: personId })
      .maybeSingle();
    if (partError) throw new Error(partError.message);
    if (!part) throw new Error('La persona no es participante del evento');

    const { error } = await supabase
      .from(SQUAD_MEMBERS_TABLE)
      .insert([{ squad_id: squadId, person_id: personId }]);
    if (error) throw new Error(error.message);
    return true;
  },

  // ---- PARTIDAS (MATCHES) ----
  async addMatches(eventId, matchesData) {
    for (const m of matchesData) {
      const { error } = await supabase
        .from(MATCHES_TABLE)
        .insert([{
          event_id: eventId,
          participant_id: m.participantId,
          squad_id: m.squadId || null,
          botin: m.botin || 0,
          elim_contratistas: m.elimContratistas || 0,
          elim_otros: m.elimOtros || 0,
          minutos: m.minutos || 0,
          segundos: m.segundos || 0,
          resultado: m.resultado || '',
          timestamp: new Date().toISOString()
        }]);
      if (error) {
        console.error('❌ Error insertando match:', error);
        throw new Error(error.message);
      }
    }
    return true;
  },

  async updateParticipantStats(eventId, personId, stats) {
    return true;
  },

  getSquadRanking(event) {
    const squads = event.squads || [];
    const matches = event.matches || [];
    const squadStats = squads.map(squad => {
      const memberIds = squad.memberIds || [];
      const squadMatches = matches.filter(m => String(m.squad_id || m.squadId || '') === String(squad.id));
      let totalBotin = 0;
      let totalElimContratistas = 0;
      let totalElimOtros = 0;
      let totalPartidas = 0;
      const memberStats = memberIds.map(pid => {
        const memberMatches = matches.filter(m => String(m.participant_id || m.participantId || '') === String(pid)
          && (!m.squad_id || String(m.squad_id) === String(squad.id)));
        const stats = memberMatches.reduce((acc, m) => {
          acc.botin += Number(m.botin || 0);
          acc.elimContratistas += Number(m.elim_contratistas ?? m.elimContratistas ?? 0);
          acc.elimOtros += Number(m.elim_otros ?? m.elimOtros ?? 0);
          acc.partidas += 1;
          if ((m.resultado || '') === 'Victoria') acc.victorias += 1;
          if ((m.resultado || '') === 'Derrota') acc.derrotas += 1;
          return acc;
        }, { botin: 0, elimContratistas: 0, elimOtros: 0, partidas: 0, victorias: 0, derrotas: 0 });
        totalBotin += stats.botin;
        totalElimContratistas += stats.elimContratistas;
        totalElimOtros += stats.elimOtros;
        totalPartidas += stats.partidas;
        return { participantId: pid, ...stats, totalBotin: stats.botin };
      });
      // Fallback for matches assigned to the squad but whose participant isn't
      // currently in memberIds, so the stored event data is never silently lost.
      if (memberStats.length === 0 && squadMatches.length) {
        totalBotin = squadMatches.reduce((a,m) => a + Number(m.botin || 0), 0);
        totalElimContratistas = squadMatches.reduce((a,m) => a + Number(m.elim_contratistas ?? 0), 0);
        totalElimOtros = squadMatches.reduce((a,m) => a + Number(m.elim_otros ?? 0), 0);
        totalPartidas = squadMatches.length;
      }
      return {
        squadId: squad.id,
        squadName: squad.name,
        memberStats,
        totalBotin,
        totalElimContratistas,
        totalElimOtros,
        totalEliminaciones: totalElimContratistas + totalElimOtros,
        totalPartidas
      };
    });
    squadStats.sort((a, b) => (b.totalBotin + b.totalEliminaciones * 5) - (a.totalBotin + a.totalEliminaciones * 5));
    return squadStats;
  },

  getParticipantStats(event) {
    const statsMap = {};
    (event.matches || []).forEach(m => {
      const pid = m.participant_id || m.participantId;
      if (!pid) return;
      if (!statsMap[pid]) {
        statsMap[pid] = {
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
      statsMap[pid].partidas += 1;
      statsMap[pid].botin += Number(m.botin || 0);
      statsMap[pid].elimContratistas += Number(m.elim_contratistas ?? m.elimContratistas ?? 0);
      statsMap[pid].elimOtros += Number(m.elim_otros ?? m.elimOtros ?? 0);
      statsMap[pid].minutos += Number(m.minutos || 0);
      statsMap[pid].segundos += Number(m.segundos || 0);
      if (m.resultado === 'Victoria') statsMap[pid].victorias += 1;
      else if (m.resultado === 'Derrota') statsMap[pid].derrotas += 1;
    });
    return statsMap;
  }
};