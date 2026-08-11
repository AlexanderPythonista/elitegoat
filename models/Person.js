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
      createdAt: p.created_at
    }));
  },

  async create(data, creatorId = null) {
    if (data.id) {
      const existing = await this.findById(data.id);
      if (existing) throw new Error('El ID ya está en uso');
    }

    // 1. Insertar persona con user_id = null
    const newPerson = {
      id: data.id || crypto.randomUUID(),
      first_name: data.firstName,
      nickname: data.nickname,
      country: data.country || '',
      coordination_id: data.coordinationId || null,
      user_id: null,
      created_at: new Date().toISOString()
    };

    const { data: result, error } = await supabase
      .from(TABLE)
      .insert([newPerson])
      .select()
      .single();
    if (error) throw new Error(error.message);

    console.log('📝 Persona insertada:', result);

    // 2. Si no tiene userId, crear usuario en Auth y en tabla users
    if (!data.userId) {
      try {
        const email = `${data.id || result.id}@eventpro.local`;
        const password = data.id || result.id;
        console.log(`🔐 Creando usuario en Auth con email: ${email}`);
        
        // 2a. Crear en auth.users
        const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
          email,
          password,
          user_metadata: { username: data.firstName || data.id, person_id: data.id || result.id },
          email_confirm: true
        });
        if (authError) throw new Error(authError.message);
        console.log(`✅ Usuario creado en Auth: ${authUser.user.id}`);

        // 2b. Insertar en la tabla users personalizada (ANTES de actualizar persons)
        const { error: insertUserError } = await supabase
          .from('users')
          .insert([{
            id: authUser.user.id,
            username: data.firstName || data.id,
            email: email,
            role: 'participante',
            is_active: true,
            created_at: new Date().toISOString()
          }]);
        if (insertUserError) {
          console.error('❌ Error insertando en users:', insertUserError);
          throw new Error(`Error insertando en users: ${insertUserError.message}`);
        }
        console.log(`✅ Usuario insertado en tabla users: ${authUser.user.id}`);

        // 2c. Ahora sí, actualizar persons con el user_id (la clave foránea ya existe)
        const { error: updateError } = await supabase
          .from(TABLE)
          .update({ user_id: authUser.user.id })
          .eq('id', result.id);
        if (updateError) {
          console.error('❌ Error actualizando persons con user_id:', updateError);
          throw new Error(`Error actualizando persons: ${updateError.message}`);
        }
        console.log(`✅ Persona actualizada con user_id: ${authUser.user.id}`);

        // 2d. Recuperar la persona completa con el user_id actualizado
        const fullPerson = await this.findById(result.id);
        return fullPerson;
      } catch (e) {
        console.error('❌ Error en el flujo de creación de usuario:', e);
        // Si falla, devolver la persona sin userId (pero no debería)
        return result;
      }
    }

    // Si ya tenía userId (caso raro), devolver la persona
    return result;
  },

  async update(id, updateData) {
    const updates = {};
    if (updateData.firstName !== undefined) updates.first_name = updateData.firstName;
    if (updateData.nickname !== undefined) updates.nickname = updateData.nickname;
    if (updateData.country !== undefined) updates.country = updateData.country;
    if (updateData.coordinationId !== undefined) updates.coordination_id = updateData.coordinationId;
    if (updateData.userId !== undefined) updates.user_id = updateData.userId;

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
      createdAt: data.created_at
    };
  }
};