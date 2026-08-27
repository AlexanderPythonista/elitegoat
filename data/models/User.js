import { supabase } from '../config/supabase.js';

const TABLE = 'users';

export const User = {
  async findAll() {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*');
    if (error) throw new Error(error.message);
    return data;
  },

  async findById(id) {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .eq('id', id)
      .maybeSingle();  // Cambiar a maybeSingle
    if (error) throw new Error(error.message);
    return data;
  },

  async findOne(query) {
    let q = supabase.from(TABLE).select('*');
    if (query.username) q = q.eq('username', query.username);
    if (query.email) q = q.eq('email', query.email);
    const { data, error } = await q.maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  },

  async create(userData) {
    const { data, error } = await supabase
      .from(TABLE)
      .insert([{
        id: userData.id || crypto.randomUUID(),
        username: userData.username,
        email: userData.email,
        password_hash: userData.password || null,
        role: userData.role || 'participante',
        is_active: userData.isActive !== undefined ? userData.isActive : true,
        created_at: new Date().toISOString()
      }])
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  async update(id, updateData) {
    const updates = {};
    if (updateData.username !== undefined) updates.username = updateData.username;
    if (updateData.email !== undefined) updates.email = updateData.email;
    if (updateData.password !== undefined) updates.password_hash = updateData.password;
    if (updateData.role !== undefined) updates.role = updateData.role;
    if (updateData.isActive !== undefined) updates.is_active = updateData.isActive;

    const { data, error } = await supabase
      .from(TABLE)
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  async delete(id) {
    const { error } = await supabase.from(TABLE).delete().eq('id', id);
    if (error) throw new Error(error.message);
    return true;
  }
};