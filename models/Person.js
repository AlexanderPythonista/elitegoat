import { supabase } from '../config/supabase.js';

const TABLE = 'persons';

export const Person = {
  async findAll() {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*');
    if (error) throw new Error(error.message);
    return data.map(p => ({
      ...p,
      firstName: p.first_name || p.id || '?',
      nickname: p.nickname || p.id || '?',
      country: p.country || '',
      coordinationId: p.coordination_id,
      userId: p.user_id,
      photoUrl: p.photo_url || null,
      reputation: p.reputation || 0,
      joinedAt: p.joined_at || p.created_at,
      fanKamona: p.fan_kamona || 0,
      fanBlackgold: p.fan_blackgold || 0,
      fanLobosBlancos: p.fan_lobos_blancos || 0,
      createdAt: p.created_at
    }));
  },

  async findById(id) {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (data) {
      return {
        ...data,
        firstName: data.first_name || data.id || '?',
        nickname: data.nickname || data.id || '?',
        country: data.country || '',
        coordinationId: data.coordination_id,
        userId: data.user_id,
        photoUrl: data.photo_url || null,
        reputation: data.reputation || 0,
        joinedAt: data.joined_at || data.created_at,
        fanKamona: data.fan_kamona || 0,
        fanBlackgold: data.fan_blackgold || 0,
        fanLobosBlancos: data.fan_lobos_blancos || 0,
        createdAt: data.created_at
      };
    }
    return null;
  },

  async findByCoordination(coordId) {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .eq('coordination_id', coordId);
    if (error) throw new Error(error.message);
    return data.map(p => ({
      ...p,
      firstName: p.first_name || p.id || '?',
      nickname: p.nickname || p.id || '?',
      country: p.country || '',
      coordinationId: p.coordination_id,
      userId: p.user_id,
      photoUrl: p.photo_url || null,
      reputation: p.reputation || 0,
      joinedAt: p.joined_at || p.created_at,
      fanKamona: p.fan_kamona || 0,
      fanBlackgold: p.fan_blackgold || 0,
      fanLobosBlancos: p.fan_lobos_blancos || 0,
      createdAt: p.created_at
    }));
  },

  async findWithoutCoordination() {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .is('coordination_id', null);
    if (error) throw new Error(error.message);
    return data.map(p => ({
      ...p,
      firstName: p.first_name || p.id || '?',
      nickname: p.nickname || p.id || '?',
      country: p.country || '',
      coordinationId: p.coordination_id,
      userId: p.user_id,
      photoUrl: p.photo_url || null,
      reputation: p.reputation || 0,
      joinedAt: p.joined_at || p.created_at,
      fanKamona: p.fan_kamona || 0,
      fanBlackgold: p.fan_blackgold || 0,
      fanLobosBlancos: p.fan_lobos_blancos || 0,
      createdAt: p.created_at
    }));
  },

  async create(data, creatorId = null) {
    if (data.id) {
      const existing = await this.findById(data.id);
      if (existing) throw new Error('El ID ya está en uso');
    }

    const newPerson = {
      id: data.id || crypto.randomUUID(),
      first_name: data.firstName,
      nickname: data.nickname,
      country: data.country || '',
      coordination_id: data.coordinationId || null,
      user_id: null,
      photo_url: data.photoUrl || null,
      reputation: data.reputation || 0,
      joined_at: data.joinedAt || new Date().toISOString(),
      fan_kamona: data.fanKamona || 0,
      fan_blackgold: data.fanBlackgold || 0,
      fan_lobos_blancos: data.fanLobosBlancos || 0,
      created_at: new Date().toISOString()
    };

    const { data: result, error } = await supabase
      .from(TABLE)
      .insert([newPerson])
      .select()
      .single();
    if (error) throw new Error(error.message);

    // Si no tiene userId, crear usuario en Auth y en tabla users
    if (!data.userId) {
      try {
        const email = `${data.id || result.id}@eventpro.local`;
        const password = data.id || result.id;
        const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
          email,
          password,
          user_metadata: { username: data.firstName || data.id, person_id: data.id || result.id },
          email_confirm: true
        });
        if (authError) throw new Error(authError.message);

        await supabase
          .from('users')
          .insert([{
            id: authUser.user.id,
            username: data.firstName || data.id,
            email: email,
            role: 'participante',
            is_active: true,
            created_at: new Date().toISOString()
          }]);

        await supabase
          .from(TABLE)
          .update({ user_id: authUser.user.id })
          .eq('id', result.id);

        const fullPerson = await this.findById(result.id);
        return fullPerson;
      } catch (e) {
        console.error('Error creando usuario:', e);
        return result;
      }
    }

    return {
      ...result,
      firstName: result.first_name || result.id || '?',
      nickname: result.nickname || result.id || '?',
      country: result.country || '',
      coordinationId: result.coordination_id,
      userId: result.user_id,
      photoUrl: result.photo_url || null,
      reputation: result.reputation || 0,
      joinedAt: result.joined_at || result.created_at,
      fanKamona: result.fan_kamona || 0,
      fanBlackgold: result.fan_blackgold || 0,
      fanLobosBlancos: result.fan_lobos_blancos || 0,
      createdAt: result.created_at
    };
  },

  async update(id, updateData) {
    const updates = {};
    if (updateData.firstName !== undefined) updates.first_name = updateData.firstName;
    if (updateData.nickname !== undefined) updates.nickname = updateData.nickname;
    if (updateData.country !== undefined) updates.country = updateData.country;
    if (updateData.coordinationId !== undefined) updates.coordination_id = updateData.coordinationId;
    if (updateData.userId !== undefined) updates.user_id = updateData.userId;
    if (updateData.photoUrl !== undefined) updates.photo_url = updateData.photoUrl;
    if (updateData.reputation !== undefined) updates.reputation = updateData.reputation;
    if (updateData.joinedAt !== undefined) updates.joined_at = updateData.joinedAt;
    if (updateData.fanKamona !== undefined) updates.fan_kamona = updateData.fanKamona;
    if (updateData.fanBlackgold !== undefined) updates.fan_blackgold = updateData.fanBlackgold;
    if (updateData.fanLobosBlancos !== undefined) updates.fan_lobos_blancos = updateData.fanLobosBlancos;

    const { data, error } = await supabase
      .from(TABLE)
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return {
      ...data,
      firstName: data.first_name || data.id || '?',
      nickname: data.nickname || data.id || '?',
      country: data.country || '',
      coordinationId: data.coordination_id,
      userId: data.user_id,
      photoUrl: data.photo_url || null,
      reputation: data.reputation || 0,
      joinedAt: data.joined_at || data.created_at,
      fanKamona: data.fan_kamona || 0,
      fanBlackgold: data.fan_blackgold || 0,
      fanLobosBlancos: data.fan_lobos_blancos || 0,
      createdAt: data.created_at
    };
  },

  async delete(id) {
    await supabase.from('coordination_persons').delete().eq('person_id', id);
    await supabase.from('squad_members').delete().eq('person_id', id);
    await supabase.from('event_participants').delete().eq('person_id', id);
    await supabase.from('matches').delete().eq('participant_id', id);
    const { error } = await supabase.from(TABLE).delete().eq('id', id);
    if (error) throw new Error(error.message);
    return true;
  },

  async assignToCoordination(personId, coordId) {
    const { data, error } = await supabase
      .from(TABLE)
      .update({ coordination_id: coordId })
      .eq('id', personId)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return {
      ...data,
      firstName: data.first_name || data.id || '?',
      nickname: data.nickname || data.id || '?',
      country: data.country || '',
      coordinationId: data.coordination_id,
      userId: data.user_id,
      photoUrl: data.photo_url || null,
      reputation: data.reputation || 0,
      joinedAt: data.joined_at || data.created_at,
      fanKamona: data.fan_kamona || 0,
      fanBlackgold: data.fan_blackgold || 0,
      fanLobosBlancos: data.fan_lobos_blancos || 0,
      createdAt: data.created_at
    };
  },

  async removeFromCoordination(personId) {
    const { data, error } = await supabase
      .from(TABLE)
      .update({ coordination_id: null })
      .eq('id', personId)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return {
      ...data,
      firstName: data.first_name || data.id || '?',
      nickname: data.nickname || data.id || '?',
      country: data.country || '',
      coordinationId: data.coordination_id,
      userId: data.user_id,
      photoUrl: data.photo_url || null,
      reputation: data.reputation || 0,
      joinedAt: data.joined_at || data.created_at,
      fanKamona: data.fan_kamona || 0,
      fanBlackgold: data.fan_blackgold || 0,
      fanLobosBlancos: data.fan_lobos_blancos || 0,
      createdAt: data.created_at
    };
  }
};